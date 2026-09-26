const express = require('express');
const { stringify } = require('csv-stringify/sync');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/reports/dashboard-metrics
 * Role-scoped dashboard metrics:
 *  - mini_admin: cash held (RECEIVED_BY_MINI_ADMIN), pending deliveries
 *  - admin/superadmin: total collected, mini-admin balances, unsettled funds
 */
router.get('/dashboard-metrics', async (req, res) => {
  const role = req.user.role;

  if (!['superadmin', 'admin', 'mini_admin'].includes(role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    if (role === 'mini_admin') {
      const branchId = req.user.branch_id;

      // Cash currently in hands of this mini-admin (verified, not yet dispatched)
      const cashHeld = await pool.query(
        `SELECT COALESCE(SUM(c.amount), 0) AS total_held,
                COUNT(*) AS contribution_count,
                COUNT(DISTINCT c.batch_id) AS batch_count
         FROM contributions c
         WHERE (c.assigned_mini_admin_id = $1 OR (c.branch_id = $2 AND c.assigned_mini_admin_id IS NULL))
           AND c.status = 'RECEIVED_BY_MINI_ADMIN'`,
        [req.user.id, branchId]
      );

      // Dispatched to admin (waiting for admin settlement)
      const dispatched = await pool.query(
        `SELECT COALESCE(SUM(c.amount), 0) AS total_dispatched,
                COUNT(*) AS dispatched_count
         FROM contributions c
         WHERE (c.assigned_mini_admin_id = $1 OR (c.branch_id = $2 AND c.assigned_mini_admin_id IS NULL))
           AND c.status = 'DISPATCHED_TO_ADMIN'`,
        [req.user.id, branchId]
      );

      // Pending first_child deliveries (SUBMITTED, not yet received)
      const pendingDeliveries = await pool.query(
        `SELECT COALESCE(SUM(c.amount), 0) AS total_pending,
                COUNT(DISTINCT c.batch_id) AS pending_batches,
                COUNT(*) AS pending_count
         FROM contributions c
         WHERE (c.assigned_mini_admin_id = $1 OR c.assigned_mini_admin_id IS NULL OR c.branch_id = $2)
           AND c.status = 'SUBMITTED'`,
        [req.user.id, branchId]
      );

      // Pending batches detail (for queue display)
      const batchQueue = await pool.query(
        `SELECT c.batch_id,
                MIN(c.created_at) AS submitted_at,
                SUM(c.amount) AS batch_amount,
                COUNT(*) AS entry_count,
                fc.full_name AS submitted_by
         FROM contributions c
         LEFT JOIN users fc ON fc.id = c.recorded_by
         WHERE (c.assigned_mini_admin_id = $1 OR c.assigned_mini_admin_id IS NULL OR c.branch_id = $2)
           AND c.status = 'SUBMITTED'
         GROUP BY c.batch_id, fc.full_name
         ORDER BY submitted_at DESC`,
        [req.user.id, branchId]
      );

      res.json({
        role: 'mini_admin',
        cash_held: {
          total: parseFloat(cashHeld.rows[0].total_held),
          contribution_count: parseInt(cashHeld.rows[0].contribution_count),
          batch_count: parseInt(cashHeld.rows[0].batch_count),
        },
        dispatched: {
          total: parseFloat(dispatched.rows[0].total_dispatched),
          count: parseInt(dispatched.rows[0].dispatched_count),
        },
        pending_deliveries: {
          total: parseFloat(pendingDeliveries.rows[0].total_pending),
          batch_count: parseInt(pendingDeliveries.rows[0].pending_batches),
          count: parseInt(pendingDeliveries.rows[0].pending_count),
        },
        pending_batch_queue: batchQueue.rows,
      });

    } else {
      // Admin / superadmin — cross-branch or branch-scoped
      const branchFilter = role === 'admin' ? `AND c.branch_id = ${req.user.branch_id}` : '';

      // Total collected all-time
      const totalCollected = await pool.query(
        `SELECT COALESCE(SUM(c.amount), 0) AS total FROM contributions c WHERE 1=1 ${branchFilter}`
      );

      // Settled (SETTLED_WITH_ADMIN)
      const settled = await pool.query(
        `SELECT COALESCE(SUM(c.amount), 0) AS total FROM contributions c
         WHERE c.status = 'SETTLED_WITH_ADMIN' ${branchFilter}`
      );

      // In mini-admin hands (RECEIVED_BY_MINI_ADMIN)
      const inMiniAdmin = await pool.query(
        `SELECT COALESCE(SUM(c.amount), 0) AS total FROM contributions c
         WHERE c.status = 'RECEIVED_BY_MINI_ADMIN' ${branchFilter}`
      );

      // Submitted but not yet received (SUBMITTED)
      const submitted = await pool.query(
        `SELECT COALESCE(SUM(c.amount), 0) AS total FROM contributions c
         WHERE c.status = 'SUBMITTED' ${branchFilter}`
      );

      // Per-mini-admin balances
      const miniAdminBalances = await pool.query(
        `SELECT ma.id AS mini_admin_id, ma.full_name AS mini_admin_name,
                COALESCE(SUM(CASE WHEN c.status = 'RECEIVED_BY_MINI_ADMIN' THEN c.amount ELSE 0 END), 0) AS held_amount,
                COALESCE(SUM(CASE WHEN c.status = 'SUBMITTED' THEN c.amount ELSE 0 END), 0) AS pending_amount,
                COUNT(CASE WHEN c.status = 'RECEIVED_BY_MINI_ADMIN' THEN 1 END) AS held_count
         FROM users ma
         LEFT JOIN contributions c ON c.assigned_mini_admin_id = ma.id ${branchFilter ? 'AND c.branch_id = ' + req.user.branch_id : ''}
         WHERE ma.role = 'mini_admin' ${role === 'admin' ? 'AND ma.branch_id = ' + req.user.branch_id : ''}
         GROUP BY ma.id, ma.full_name
         ORDER BY held_amount DESC`
      );

      res.json({
        role: role,
        summary: {
          total_collected: parseFloat(totalCollected.rows[0].total),
          settled_with_admin: parseFloat(settled.rows[0].total),
          in_mini_admin_hands: parseFloat(inMiniAdmin.rows[0].total),
          pending_submission: parseFloat(submitted.rows[0].total),
          unsettled_total: parseFloat(inMiniAdmin.rows[0].total) + parseFloat(submitted.rows[0].total),
        },
        mini_admin_balances: miniAdminBalances.rows,
      });
    }
  } catch (err) {
    console.error('Dashboard metrics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/reports/branch
 * Branch admin: monthly summary for their branch
 */
router.get('/branch', requireRole('admin', 'superadmin'), async (req, res) => {
  const { month } = req.query;
  const branchId = req.user.role === 'admin'
    ? req.user.branch_id
    : req.query.branch_id;

  if (!branchId) return res.status(400).json({ error: 'branch_id is required for superadmin' });

  try {
    let monthFilter = '';
    let params = [branchId];

    if (month) {
      const [year, mon] = month.split('-');
      const firstOfMonth = `${year}-${mon.padStart(2, '0')}-01`;
      monthFilter = `AND c.month_covered = $2`;
      params.push(firstOfMonth);
    }

    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(c.amount), 0) AS total_collected,
              COUNT(DISTINCT c.member_id) AS paying_members
       FROM contributions c
       WHERE c.branch_id = $1 ${monthFilter}`,
      params
    );

    const memberCountResult = await pool.query(
      `SELECT COUNT(*) AS total_members FROM users WHERE branch_id=$1 AND role='member'`,
      [branchId]
    );

    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const selectedMonth = month ? `${month}-01` : `${nowYear}-${nowMonth}-01`;

    const memberStatusResult = await pool.query(
      `SELECT
         u.id, u.full_name, u.phone,
         COALESCE(SUM(c.amount), 0) AS amount_paid,
         CASE WHEN SUM(c.amount) IS NOT NULL THEN true ELSE false END AS paid
       FROM users u
       LEFT JOIN contributions c ON c.member_id = u.id AND c.month_covered = $2
       WHERE u.branch_id = $1 AND u.role = 'member'
       GROUP BY u.id, u.full_name, u.phone
       ORDER BY u.full_name`,
      [branchId, selectedMonth]
    );

    res.json({
      summary: {
        total_collected: parseFloat(totalResult.rows[0].total_collected),
        paying_members: parseInt(totalResult.rows[0].paying_members),
        total_members: parseInt(memberCountResult.rows[0].total_members),
        month: selectedMonth,
      },
      members: memberStatusResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/reports/branch/export  — CSV export
 */
router.get('/branch/export', requireRole('admin', 'superadmin'), async (req, res) => {
  const { month } = req.query;
  const branchId = req.user.role === 'admin'
    ? req.user.branch_id
    : req.query.branch_id;

  if (!branchId) return res.status(400).json({ error: 'branch_id required' });

  try {
    let params = [branchId];
    let monthFilter = '';

    if (month) {
      const [year, mon] = month.split('-');
      monthFilter = `AND c.month_covered = $2`;
      params.push(`${year}-${mon.padStart(2, '0')}-01`);
    }

    const result = await pool.query(
      `SELECT
         u.full_name AS "Member Name",
         u.phone AS "Phone",
         c.amount AS "Amount (ETB)",
         TO_CHAR(c.month_covered, 'YYYY-MM') AS "Month Covered",
         c.months_covered::text AS "Months (Ethiopian)",
         c.status AS "Status",
         c.date_paid AS "Date Paid",
         r.full_name AS "Recorded By",
         c.note AS "Note",
         b.name AS "Branch"
       FROM contributions c
       JOIN users u ON u.id = c.member_id
       JOIN users r ON r.id = c.recorded_by
       JOIN branches b ON b.id = c.branch_id
       WHERE c.branch_id = $1 ${monthFilter}
       ORDER BY c.created_at DESC, u.full_name`,
      params
    );

    const csv = stringify(result.rows, { header: true });
    const filename = month ? `contributions_${month}.csv` : `contributions_all.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/reports/overview  — Superadmin cross-branch totals
 */
router.get('/overview', requireRole('superadmin'), async (req, res) => {
  const { month } = req.query;
  try {
    let monthFilter = '';
    let params = [];

    if (month) {
      const [year, mon] = month.split('-');
      monthFilter = `WHERE c.month_covered = $1`;
      params.push(`${year}-${mon.padStart(2, '0')}-01`);
    }

    const result = await pool.query(
      `SELECT
         b.id AS branch_id,
         b.name AS branch_name,
         b.location,
         COALESCE(SUM(c.amount), 0) AS total_collected,
         COUNT(DISTINCT c.member_id) AS paying_members,
         COUNT(DISTINCT u.id) AS total_members
       FROM branches b
       LEFT JOIN contributions c ON c.branch_id = b.id ${month ? `AND c.month_covered = $1` : ''}
       LEFT JOIN users u ON u.branch_id = b.id AND u.role = 'member'
       GROUP BY b.id, b.name, b.location
       ORDER BY total_collected DESC`,
      params
    );

    const grandTotal = result.rows.reduce((sum, r) => sum + parseFloat(r.total_collected), 0);
    res.json({ branches: result.rows, grand_total: grandTotal, month: month || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
