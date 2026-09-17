const express = require('express');
const { stringify } = require('csv-stringify/sync');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/reports/branch
 * Branch admin: monthly summary for their branch
 * ?month=YYYY-MM
 */
router.get('/branch', requireRole('branch_admin', 'superadmin'), async (req, res) => {
  const { month } = req.query;
  const branchId = req.user.role === 'branch_admin'
    ? req.user.branch_id
    : req.query.branch_id;

  if (!branchId) return res.status(400).json({ error: 'branch_id is required for superadmin' });

  try {
    // Build month filter
    let monthFilter = '';
    let params = [branchId];

    if (month) {
      const [year, mon] = month.split('-');
      const firstOfMonth = `${year}-${mon.padStart(2, '0')}-01`;
      monthFilter = `AND c.month_covered = $2`;
      params.push(firstOfMonth);
    }

    // Total collected
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(c.amount), 0) AS total_collected,
              COUNT(DISTINCT c.member_id) AS paying_members
       FROM contributions c
       WHERE c.branch_id = $1 ${monthFilter}`,
      params
    );

    // Total members in branch
    const memberCountResult = await pool.query(
      `SELECT COUNT(*) AS total_members FROM users WHERE branch_id=$1 AND role='member'`,
      [branchId]
    );

    // Per-member paid status for the selected month
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
    const selectedMonth = month
      ? `${month}-01`
      : `${nowYear}-${nowMonth}-01`;

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
 * GET /api/reports/branch/export
 * CSV export of contributions for the branch
 * ?month=YYYY-MM (optional)
 */
router.get('/branch/export', requireRole('branch_admin', 'superadmin'), async (req, res) => {
  const { month } = req.query;
  const branchId = req.user.role === 'branch_admin'
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
         c.date_paid AS "Date Paid",
         r.full_name AS "Recorded By",
         c.note AS "Note",
         b.name AS "Branch"
       FROM contributions c
       JOIN users u ON u.id = c.member_id
       JOIN users r ON r.id = c.recorded_by
       JOIN branches b ON b.id = c.branch_id
       WHERE c.branch_id = $1 ${monthFilter}
       ORDER BY c.month_covered DESC, u.full_name`,
      params
    );

    const csv = stringify(result.rows, { header: true });
    const filename = month
      ? `contributions_${month}.csv`
      : `contributions_all.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/reports/overview
 * Superadmin: cross-branch totals
 * ?month=YYYY-MM (optional)
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

    const grandTotal = result.rows.reduce(
      (sum, r) => sum + parseFloat(r.total_collected), 0
    );

    res.json({
      branches: result.rows,
      grand_total: grandTotal,
      month: month || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
