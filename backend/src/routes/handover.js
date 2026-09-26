/**
 * Handover Pipeline Routes
 *
 * PATCH /api/contributions/mini-admin/verify-batch
 *   Mini-admin confirms physical cash receipt for a batch.
 *   Transitions: SUBMITTED → RECEIVED_BY_MINI_ADMIN
 *
 * PATCH /api/contributions/admin/bulk-approve
 *   Admin/superadmin reconciles and settles contributions from mini-admin.
 *   Transitions: RECEIVED_BY_MINI_ADMIN → SETTLED_WITH_ADMIN
 */

const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/auditLogger');

const router = express.Router();
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/contributions/mini-admin/verify-batch
// Body: { batch_id: "uuid" }  OR  { contribution_ids: [1,2,3] }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/mini-admin/verify-batch', requireRole('mini_admin'), async (req, res) => {
  const { batch_id, contribution_ids } = req.body;

  if (!batch_id && (!Array.isArray(contribution_ids) || contribution_ids.length === 0)) {
    return res.status(400).json({ error: 'Provide batch_id or a non-empty contribution_ids array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let rows;
    if (batch_id) {
      // Fetch all contributions in this batch
      const check = await client.query(
        `SELECT id, assigned_mini_admin_id, status, branch_id
         FROM contributions
         WHERE batch_id = $1`,
        [batch_id]
      );

      if (check.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Batch not found' });
      }

      // State-machine guard: all must be SUBMITTED
      const alreadyProcessed = check.rows.filter(r => r.status !== 'SUBMITTED');
      if (alreadyProcessed.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Batch contains ${alreadyProcessed.length} contribution(s) not in SUBMITTED state.`,
          already_processed: alreadyProcessed.map(r => ({ id: r.id, status: r.status }))
        });
      }

      // Branch authorization
      if (req.user.branch_id) {
        const wrongBranch = check.rows.filter(r => r.branch_id && r.branch_id !== req.user.branch_id);
        if (wrongBranch.length > 0) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Forbidden: this batch belongs to another branch' });
        }
      }

      const result = await client.query(
        `UPDATE contributions
         SET status = 'RECEIVED_BY_MINI_ADMIN',
             mini_admin_received_at = NOW(),
             assigned_mini_admin_id = $2
         WHERE batch_id = $1 AND status = 'SUBMITTED'
         RETURNING id, batch_id, status, mini_admin_received_at, amount`,
        [batch_id, req.user.id]
      );
      rows = result.rows;
    } else {
      // Verify by individual IDs
      const ids = contribution_ids.map(Number);

      const check = await client.query(
        `SELECT id, assigned_mini_admin_id, status, branch_id
         FROM contributions
         WHERE id = ANY($1::int[])`,
        [ids]
      );

      if (check.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No contributions found for given IDs' });
      }

      const alreadyProcessed = check.rows.filter(r => r.status !== 'SUBMITTED');
      if (alreadyProcessed.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `${alreadyProcessed.length} contribution(s) are not in SUBMITTED state`,
          already_processed: alreadyProcessed.map(r => ({ id: r.id, status: r.status }))
        });
      }

      if (req.user.branch_id) {
        const wrongBranch = check.rows.filter(r => r.branch_id && r.branch_id !== req.user.branch_id);
        if (wrongBranch.length > 0) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Forbidden: one or more contributions belong to another branch' });
        }
      }

      const result = await client.query(
        `UPDATE contributions
         SET status = 'RECEIVED_BY_MINI_ADMIN',
             mini_admin_received_at = NOW(),
             assigned_mini_admin_id = $2
         WHERE id = ANY($1::int[]) AND status = 'SUBMITTED'
         RETURNING id, batch_id, status, mini_admin_received_at, amount`,
        [ids, req.user.id]
      );
      rows = result.rows;
    }

    // Auto-repair any unassigned verified/dispatched contributions in this branch
    if (req.user.branch_id) {
      await client.query(
        `UPDATE contributions
         SET assigned_mini_admin_id = $1
         WHERE branch_id = $2 AND assigned_mini_admin_id IS NULL AND status IN ('RECEIVED_BY_MINI_ADMIN', 'DISPATCHED_TO_ADMIN')`,
        [req.user.id, req.user.branch_id]
      );
    }

    await client.query('COMMIT');

    await logAudit(req, 'MINI_ADMIN_VERIFY_BATCH', 'contribution', null, {
      batch_id: batch_id || null,
      contribution_ids: rows.map(r => r.id),
      count: rows.length,
      total_amount: rows.reduce((s, r) => s + parseFloat(r.amount), 0),
    });

    res.json({
      message: `${rows.length} contribution(s) marked as RECEIVED_BY_MINI_ADMIN`,
      updated: rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('verify-batch error:', err);
    res.status(500).json({ error: 'Server error during batch verification' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/contributions/admin/bulk-approve
// Body: { contribution_ids: [1,2,3], force?: false }
//
// By default, only approves RECEIVED_BY_MINI_ADMIN contributions.
// If force=true (superadmin only), also approves SUBMITTED ones (override).
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/admin/bulk-approve', requireRole('admin', 'superadmin'), async (req, res) => {
  const { contribution_ids, force = false } = req.body;

  if (!Array.isArray(contribution_ids) || contribution_ids.length === 0) {
    return res.status(400).json({ error: 'contribution_ids must be a non-empty array' });
  }

  const ids = contribution_ids.map(Number);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch current state
    const check = await client.query(
      `SELECT id, status, branch_id, amount FROM contributions WHERE id = ANY($1::int[])`,
      [ids]
    );

    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No contributions found' });
    }

    // Branch scope for non-superadmin
    if (req.user.role === 'admin') {
      const crossBranch = check.rows.filter(r => r.branch_id !== req.user.branch_id);
      if (crossBranch.length > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden: contributions belong to another branch' });
      }
    }

    // State guard: accept RECEIVED_BY_MINI_ADMIN and DISPATCHED_TO_ADMIN
    const SETTLEABLE_STATUSES = ['RECEIVED_BY_MINI_ADMIN', 'DISPATCHED_TO_ADMIN'];
    const invalidState = check.rows.filter(r => !SETTLEABLE_STATUSES.includes(r.status));
    if (invalidState.length > 0) {
      if (!force || req.user.role !== 'superadmin') {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `${invalidState.length} contribution(s) have not been received by a mini-admin yet. Use force=true (superadmin only) to override.`,
          invalid: invalidState.map(r => ({ id: r.id, status: r.status }))
        });
      }
      // force=true and superadmin: allow all statuses except already settled
      const alreadySettled = invalidState.filter(r => r.status === 'SETTLED_WITH_ADMIN');
      if (alreadySettled.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `${alreadySettled.length} contribution(s) are already SETTLED_WITH_ADMIN`,
          already_settled: alreadySettled.map(r => r.id)
        });
      }
    }

    const result = await client.query(
      `UPDATE contributions
       SET status = 'SETTLED_WITH_ADMIN', admin_approved_at = NOW()
       WHERE id = ANY($1::int[]) AND status != 'SETTLED_WITH_ADMIN'
       RETURNING id, status, admin_approved_at, amount`,
      [ids]
    );

    await client.query('COMMIT');

    await logAudit(req, 'ADMIN_BULK_APPROVE', 'contribution', null, {
      contribution_ids: result.rows.map(r => r.id),
      count: result.rows.length,
      total_settled: result.rows.reduce((s, r) => s + parseFloat(r.amount), 0),
      forced: force && req.user.role === 'superadmin',
    });

    res.json({
      message: `${result.rows.length} contribution(s) settled successfully`,
      updated: result.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('bulk-approve error:', err);
    res.status(500).json({ error: 'Server error during bulk approval' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/contributions/mini-admin/dispatch-handover
//
// Mini-admin formally initiates handover to Admin.
// Transitions: RECEIVED_BY_MINI_ADMIN → DISPATCHED_TO_ADMIN
// Body: { contribution_ids?: number[], notes?: string }
// If contribution_ids is omitted/empty: dispatches ALL RECEIVED_BY_MINI_ADMIN
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/mini-admin/dispatch-handover', requireRole('mini_admin'), async (req, res) => {
  const { contribution_ids, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let targetIds;
    if (Array.isArray(contribution_ids) && contribution_ids.length > 0) {
      targetIds = contribution_ids.map(Number);
    } else {
      // Dispatch all RECEIVED_BY_MINI_ADMIN for this mini_admin
      const allReady = await client.query(
        `SELECT id FROM contributions
         WHERE assigned_mini_admin_id = $1 AND status = 'RECEIVED_BY_MINI_ADMIN'`,
        [req.user.id]
      );
      if (allReady.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'No contributions in RECEIVED_BY_MINI_ADMIN state to dispatch' });
      }
      targetIds = allReady.rows.map(r => r.id);
    }

    // Validate: all must be RECEIVED_BY_MINI_ADMIN and belong to this mini_admin
    const check = await client.query(
      `SELECT id, status, assigned_mini_admin_id FROM contributions WHERE id = ANY($1::int[])`,
      [targetIds]
    );

    const unauthorized = check.rows.filter(r => r.assigned_mini_admin_id !== req.user.id);
    if (unauthorized.length > 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden: some contributions are not assigned to you' });
    }

    const notReady = check.rows.filter(r => r.status !== 'RECEIVED_BY_MINI_ADMIN');
    if (notReady.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `${notReady.length} contribution(s) are not in RECEIVED_BY_MINI_ADMIN state`,
        invalid: notReady.map(r => ({ id: r.id, status: r.status }))
      });
    }

    const result = await client.query(
      `UPDATE contributions
       SET status = 'DISPATCHED_TO_ADMIN',
           handover_dispatched_at = NOW()
       WHERE id = ANY($1::int[]) AND status = 'RECEIVED_BY_MINI_ADMIN' AND assigned_mini_admin_id = $2
       RETURNING id, status, handover_dispatched_at, amount`,
      [targetIds, req.user.id]
    );

    await client.query('COMMIT');

    const totalAmount = result.rows.reduce((s, r) => s + parseFloat(r.amount), 0);

    await logAudit(req, 'MINI_ADMIN_DISPATCH_HANDOVER', 'contribution', null, {
      contribution_ids: result.rows.map(r => r.id),
      count: result.rows.length,
      total_amount: totalAmount,
      notes: notes || null,
    });

    res.json({
      message: `${result.rows.length} contribution(s) dispatched to Admin`,
      total_amount: totalAmount,
      updated: result.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('dispatch-handover error:', err);
    res.status(500).json({ error: 'Server error during dispatch' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/contributions/admin/unsettle
// Body: { contribution_ids?: number[], batch_id?: string }
//
// Admin/superadmin reverts settled contributions back to DISPATCHED_TO_ADMIN.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/admin/unsettle', requireRole('admin', 'superadmin'), async (req, res) => {
  const { contribution_ids, batch_id } = req.body;
  if (!batch_id && (!Array.isArray(contribution_ids) || contribution_ids.length === 0)) {
    return res.status(400).json({ error: 'Provide batch_id or contribution_ids array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let ids = [];
    if (batch_id) {
      const bRes = await client.query(
        `SELECT id, branch_id FROM contributions WHERE batch_id = $1 AND status = 'SETTLED_WITH_ADMIN'`,
        [batch_id]
      );
      ids = bRes.rows.map(r => r.id);
    } else {
      ids = contribution_ids.map(Number);
    }

    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No settled contributions found for the given batch/IDs' });
    }

    // Branch authorization check
    if (req.user.role === 'admin') {
      const check = await client.query(
        `SELECT branch_id FROM contributions WHERE id = ANY($1::int[])`,
        [ids]
      );
      const wrongBranch = check.rows.filter(r => r.branch_id !== req.user.branch_id);
      if (wrongBranch.length > 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden: contributions belong to another branch' });
      }
    }

    const result = await client.query(
      `UPDATE contributions
       SET status = 'DISPATCHED_TO_ADMIN', admin_approved_at = NULL
       WHERE id = ANY($1::int[]) AND status = 'SETTLED_WITH_ADMIN'
       RETURNING id, status, amount, batch_id`,
      [ids]
    );

    await client.query('COMMIT');

    await logAudit(req, 'ADMIN_UNSETTLE_CONTRIBUTIONS', 'contribution', null, {
      batch_id: batch_id || null,
      contribution_ids: result.rows.map(r => r.id),
      count: result.rows.length,
      total_amount: result.rows.reduce((s, r) => s + parseFloat(r.amount), 0),
    });

    res.json({
      message: `${result.rows.length} contribution(s) reverted back to DISPATCHED_TO_ADMIN state`,
      updated: result.rows,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('unsettle error:', err);
    res.status(500).json({ error: 'Server error during unsettle' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contributions/handover-summary
// Role: admin, superadmin
// Query: ?status=active (default) OR ?status=settled
//
// Returns per-mini-admin grouped balance of contributions ready for admin
// settlement or already settled.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/handover-summary', requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const branchCondition = req.user.role === 'admin'
      ? `AND c.branch_id = ${req.user.branch_id}`
      : '';

    const targetStatuses = status === 'settled'
      ? `'SETTLED_WITH_ADMIN'`
      : `'RECEIVED_BY_MINI_ADMIN', 'DISPATCHED_TO_ADMIN'`;

    // Grouped summary per mini-admin
    const summary = await pool.query(`
      SELECT
        ma.id          AS mini_admin_id,
        ma.full_name   AS mini_admin_name,
        ma.phone       AS mini_admin_phone,
        COUNT(c.id)::int                                  AS pending_count,
        COALESCE(SUM(c.amount), 0)                        AS total_amount,
        ARRAY_AGG(c.id ORDER BY c.created_at)             AS contribution_ids,
        MIN(c.mini_admin_received_at)                     AS oldest_received_at,
        MAX(c.handover_dispatched_at)                     AS latest_dispatched_at,
        MAX(c.admin_approved_at)                          AS latest_settled_at,
        COUNT(CASE WHEN c.status='DISPATCHED_TO_ADMIN' THEN 1 END)::int AS dispatched_count
      FROM users ma
      JOIN contributions c ON c.assigned_mini_admin_id = ma.id
      WHERE ma.role = 'mini_admin'
        AND c.status IN (${targetStatuses})
        ${branchCondition}
      GROUP BY ma.id, ma.full_name, ma.phone
      ORDER BY total_amount DESC
    `);

    // Individual contributions per mini-admin (for drill-down)
    const details = await pool.query(`
      SELECT
        c.id, c.amount, c.status, c.months_covered, c.date_paid,
        c.mini_admin_received_at, c.handover_dispatched_at, c.admin_approved_at, c.batch_id,
        c.assigned_mini_admin_id AS mini_admin_id,
        u.full_name AS member_name, u.phone AS member_phone
      FROM contributions c
      JOIN users u ON u.id = c.member_id
      WHERE c.status IN (${targetStatuses})
        ${branchCondition}
      ORDER BY c.assigned_mini_admin_id, c.created_at DESC
    `);

    // Group detail rows by mini_admin_id for O(1) lookup
    const detailsByMiniAdmin = {};
    for (const row of details.rows) {
      const key = row.mini_admin_id;
      if (!detailsByMiniAdmin[key]) detailsByMiniAdmin[key] = [];
      detailsByMiniAdmin[key].push(row);
    }

    const result = summary.rows.map(s => ({
      ...s,
      total_amount: parseFloat(s.total_amount),
      contributions: detailsByMiniAdmin[s.mini_admin_id] || [],
    }));

    res.json({ mini_admins: result, total_mini_admins: result.length });
  } catch (err) {
    console.error('handover-summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
