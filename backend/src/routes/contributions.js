const express = require('express');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/auditLogger');

const router = express.Router();

router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the current default_monthly_contribution from system_settings.
 * Falls back to 10.00 if not set.
 */
async function getBaseRate(client) {
  const r = await (client || pool).query(
    `SELECT value FROM system_settings WHERE key = 'default_monthly_contribution'`
  );
  return r.rows.length ? parseFloat(r.rows[0].value) : 10.00;
}

/**
 * Validate Ethiopian month string names.
 */
const ETHIOPIAN_MONTHS = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit',
  'Megabit', 'Miyazya', 'Ginbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
];
// Alias support for variant spellings
const MONTH_ALIASES = {
  'Yakatit': 'Yekatit', 'Yakitit': 'Yekatit',
  'Magabit': 'Megabit', 'Megazit': 'Megabit',
  'Tikimt': 'Tikimt', 'Tikit': 'Tikimt',
};

function normalizeMonth(m) {
  return MONTH_ALIASES[m] || m;
}

function validateMonths(months) {
  if (!Array.isArray(months) || months.length === 0) return false;
  return months.map(normalizeMonth).every(m => ETHIOPIAN_MONTHS.includes(m));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contributions
// Supports both legacy single-month format and new multi-month batch format.
//
// New batch body (first_child / admin):
// {
//   "entries": [
//     { "member_id": 10, "months_covered": ["Meskerem","Tikimt"], "amount": 20.00, "note": "" },
//     { "member_id": 12, "months_covered": ["Meskerem"], "amount": 10.00 }
//   ],
//   "assigned_mini_admin_id": 4,
//   "date_paid": "2026-09-21"
// }
//
// Legacy single-entry body (admin tools):
// { "member_id", "amount", "month_covered", "date_paid", "category", "note" }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireRole('superadmin', 'admin', 'mini_admin', 'first_child'), async (req, res) => {
  // Detect format: new batch OR legacy single
  const isNewBatch = Array.isArray(req.body.entries);

  if (isNewBatch) {
    return handleBatchSubmission(req, res);
  } else {
    return handleLegacySubmission(req, res);
  }
});

// ── New batch submission ──────────────────────────────────────────────────────
async function handleBatchSubmission(req, res) {
  const { entries, assigned_mini_admin_id, date_paid } = req.body;

  if (!entries || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required and must not be empty' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const baseRate = await getBaseRate(client);
    const batchId = randomUUID();
    const datePaid = date_paid || new Date().toISOString().split('T')[0];

    // Determine assigned_mini_admin_id:
    // - first_child: use their own mini_admin_id unless overridden
    // - admin/superadmin: use the provided one
    let miniAdminId = assigned_mini_admin_id || null;
    if (req.user.role === 'first_child' && !miniAdminId) {
      miniAdminId = req.user.mini_admin_id || null;
    }

    const savedContributions = [];

    for (const entry of entries) {
      const { member_id, months_covered, amount, note } = entry;

      if (!member_id || !months_covered || amount == null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Each entry requires member_id, months_covered, and amount' });
      }

      if (!validateMonths(months_covered)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Invalid months_covered. Use Ethiopian month names: ${ETHIOPIAN_MONTHS.join(', ')}`
        });
      }

      const parsedAmount = parseFloat(amount);
      const minimumAmount = months_covered.length * baseRate;

      if (parsedAmount < minimumAmount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Amount ${parsedAmount} ETB is below the minimum of ${minimumAmount} ETB (${months_covered.length} month(s) × ${baseRate} ETB base rate)`
        });
      }

      // Verify member exists and branch scope
      const memberResult = await client.query(
        `SELECT id, branch_id, full_name, role, first_child_id FROM users WHERE id=$1`,
        [member_id]
      );
      if (memberResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Member id=${member_id} not found` });
      }
      const member = memberResult.rows[0];

      if (req.user.role === 'admin' && member.branch_id !== req.user.branch_id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: `Member id=${member_id} is not in your branch` });
      }

      // first_child can only record for their own registered siblings or themselves
      if (req.user.role === 'first_child' && member.first_child_id !== req.user.id && member.id !== req.user.id) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: `Member id=${member_id} is not registered under your family` });
      }

      const branchId = req.user.role === 'superadmin' ? member.branch_id : req.user.branch_id;

      const result = await client.query(
        `INSERT INTO contributions
           (member_id, branch_id, amount, months_covered, base_rate_applied, date_paid,
            recorded_by, assigned_mini_admin_id, status, batch_id, note, category)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, 'SUBMITTED', $9, $10, 'Monthly Dues')
         RETURNING *`,
        [
          member_id,
          branchId,
          parsedAmount,
          JSON.stringify(months_covered),
          baseRate,
          datePaid,
          req.user.id,
          miniAdminId,
          batchId,
          note || null,
        ]
      );
      savedContributions.push({ ...result.rows[0], member_name: member.full_name });
    }

    await client.query('COMMIT');

    // Audit log the batch
    await logAudit(req, 'CREATE_CONTRIBUTION_BATCH', 'contribution', null, {
      batch_id: batchId,
      count: savedContributions.length,
      total_amount: savedContributions.reduce((s, c) => s + parseFloat(c.amount), 0),
      assigned_mini_admin_id: miniAdminId,
    });

    res.status(201).json({
      batch_id: batchId,
      contributions: savedContributions,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Batch contribution error:', err);
    res.status(500).json({ error: 'Server error during batch submission' });
  } finally {
    client.release();
  }
}

// ── Legacy single-entry submission (backward compat for admin panel) ───────────
async function handleLegacySubmission(req, res) {
  const { member_id, amount, month_covered, date_paid, category, note } = req.body;

  if (!member_id || !amount || !month_covered) {
    return res.status(400).json({ error: 'member_id, amount, and month_covered are required' });
  }

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    const monthStr = month_covered.slice(0, 7);
    const [yr, mo] = monthStr.split('-');
    if (!yr || !mo || isNaN(parseInt(yr)) || isNaN(parseInt(mo))) {
      return res.status(400).json({ error: 'Invalid month_covered. Use YYYY-MM-DD or YYYY-MM format.' });
    }
    const firstOfMonth = `${yr}-${mo.padStart(2, '0')}-01`;

    const memberResult = await pool.query(
      `SELECT id, branch_id, full_name, role, first_child_id FROM users WHERE id=$1`,
      [member_id]
    );
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const member = memberResult.rows[0];

    if (req.user.role === 'admin' && member.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden: member is not in your branch' });
    }

    if (req.user.role === 'first_child' && member.first_child_id !== req.user.id && member.id !== req.user.id) {
      return res.status(403).json({ error: `Member id=${member_id} is not registered under your family` });
    }

    const branchId = req.user.role === 'superadmin' ? member.branch_id : req.user.branch_id;
    const contributionCategory = category || 'Monthly Dues';

    // Derive months_covered from single month (legacy compat)
    const baseRate = await getBaseRate();
    const monthName = legacyMonthName(parseInt(mo));

    const result = await pool.query(
      `INSERT INTO contributions
         (member_id, branch_id, amount, category, month_covered, date_paid, recorded_by, note,
          months_covered, base_rate_applied, status, batch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, 'SUBMITTED', $11)
       RETURNING *`,
      [
        member_id,
        branchId,
        parseFloat(amount),
        contributionCategory,
        firstOfMonth,
        date_paid || new Date().toISOString().split('T')[0],
        req.user.id,
        note || null,
        JSON.stringify([monthName]),
        baseRate,
        randomUUID(),
      ]
    );

    const saved = result.rows[0];

    await logAudit(req, 'CREATE_CONTRIBUTION', 'contribution', saved.id, {
      member_id,
      member_name: member.full_name,
      amount: parseFloat(amount),
      category: contributionCategory,
      month_covered: firstOfMonth,
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** Map Gregorian month number → closest Ethiopian month name */
function legacyMonthName(mo) {
  const map = {
    1: 'Tir', 2: 'Yekatit', 3: 'Megabit', 4: 'Miyazya',
    5: 'Ginbot', 6: 'Sene', 7: 'Hamle', 8: 'Nehase',
    9: 'Meskerem', 10: 'Tikimt', 11: 'Hidar', 12: 'Tahsas'
  };
  return map[mo] || 'Meskerem';
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contributions
// Admin/superadmin/mini_admin: paginated list with new filters
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireRole('superadmin', 'admin', 'mini_admin'), async (req, res) => {
  const {
    member_id, month, category, status, mini_admin_id,
    date_from, date_to,
    page = 1, limit = 20
  } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  try {
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (req.user.role === 'admin') {
      conditions.push(`c.branch_id = $${paramCount++}`);
      params.push(req.user.branch_id);
    } else if (req.user.role === 'mini_admin') {
      conditions.push(`(c.assigned_mini_admin_id = $${paramCount} OR (c.branch_id = $${paramCount + 1} AND c.status != 'SUBMITTED'))`);
      params.push(req.user.id, req.user.branch_id);
      paramCount += 2;
    }

    if (member_id) {
      conditions.push(`c.member_id = $${paramCount++}`);
      params.push(member_id);
    }

    if (month) {
      const [year, mon] = month.split('-');
      const firstOfMonth = `${year}-${mon.padStart(2, '0')}-01`;
      conditions.push(`c.month_covered = $${paramCount++}`);
      params.push(firstOfMonth);
    }

    if (category) {
      conditions.push(`c.category = $${paramCount++}`);
      params.push(category);
    }

    if (status) {
      conditions.push(`c.status = $${paramCount++}`);
      params.push(status);
    }

    if (mini_admin_id) {
      conditions.push(`c.assigned_mini_admin_id = $${paramCount++}`);
      params.push(mini_admin_id);
    }

    if (date_from) {
      conditions.push(`c.date_paid >= $${paramCount++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`c.date_paid <= $${paramCount++}`);
      params.push(date_to);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contributions c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT
         c.id, c.amount, c.category, c.month_covered, c.months_covered, c.base_rate_applied,
         c.date_paid, c.note, c.created_at, c.status, c.batch_id,
         c.mini_admin_received_at, c.admin_approved_at,
         u.full_name AS member_name, u.phone AS member_phone,
         r.full_name AS recorded_by_name,
         ma.full_name AS mini_admin_name,
         b.name AS branch_name
       FROM contributions c
       JOIN users u ON u.id = c.member_id
       JOIN users r ON r.id = c.recorded_by
       LEFT JOIN users ma ON ma.id = c.assigned_mini_admin_id
       JOIN branches b ON b.id = c.branch_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limitNum, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/contributions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    let deleteQuery, params;
    if (req.user.role === 'admin') {
      deleteQuery = `DELETE FROM contributions WHERE id=$1 AND branch_id=$2 RETURNING id, amount, member_id`;
      params = [req.params.id, req.user.branch_id];
    } else {
      deleteQuery = `DELETE FROM contributions WHERE id=$1 RETURNING id, amount, member_id`;
      params = [req.params.id];
    }
    const result = await pool.query(deleteQuery, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contribution not found or forbidden' });

    const deletedRecord = result.rows[0];
    await logAudit(req, 'DELETE_CONTRIBUTION', 'contribution', deletedRecord.id, {
      amount: deletedRecord.amount,
      member_id: deletedRecord.member_id,
    });

    res.json({ message: 'Contribution deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
