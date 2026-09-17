const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/auditLogger');

const router = express.Router();

router.use(authenticate);

/**
 * POST /api/contributions
 * Branch admin logs a contribution
 * Body: { member_id, amount, month_covered (YYYY-MM-DD), date_paid, category, note? }
 */
router.post('/', requireRole('branch_admin', 'superadmin'), async (req, res) => {
  const { member_id, amount, month_covered, date_paid, category, note } = req.body;

  if (!member_id || !amount || !month_covered) {
    return res.status(400).json({ error: 'member_id, amount, and month_covered are required' });
  }

  if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  try {
    // Parse YYYY-MM or YYYY-MM-DD without timezone conversion
    const monthStr = month_covered.slice(0, 7); // get YYYY-MM part
    const [yr, mo] = monthStr.split('-');
    if (!yr || !mo || isNaN(parseInt(yr)) || isNaN(parseInt(mo))) {
      return res.status(400).json({ error: 'Invalid month_covered date. Use YYYY-MM-DD or YYYY-MM format.' });
    }
    const firstOfMonth = `${yr}-${mo.padStart(2, '0')}-01`;

    // Verify member exists and is in the same branch (for branch_admin)
    const memberResult = await pool.query(
      `SELECT id, branch_id, full_name FROM users WHERE id=$1 AND role='member'`,
      [member_id]
    );
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const member = memberResult.rows[0];

    if (req.user.role === 'branch_admin' && member.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden: member is not in your branch' });
    }

    const branchId = req.user.role === 'superadmin' ? member.branch_id : req.user.branch_id;
    const contributionCategory = category || 'Monthly Dues';

    const result = await pool.query(
      `INSERT INTO contributions (member_id, branch_id, amount, category, month_covered, date_paid, recorded_by, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ]
    );

    const savedContribution = result.rows[0];

    // Log Audit Event
    await logAudit(
      req,
      'CREATE_CONTRIBUTION',
      'contribution',
      savedContribution.id,
      {
        member_id,
        member_name: member.full_name,
        amount: parseFloat(amount),
        category: contributionCategory,
        month_covered: firstOfMonth,
      }
    );

    res.status(201).json(savedContribution);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/contributions
 * Branch admin: ?member_id=&month=YYYY-MM&category=&page=&limit=
 */
router.get('/', requireRole('branch_admin', 'superadmin'), async (req, res) => {
  const { member_id, month, category, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  try {
    let conditions = [];
    let params = [];
    let paramCount = 1;

    // Branch scope
    if (req.user.role === 'branch_admin') {
      conditions.push(`c.branch_id = $${paramCount++}`);
      params.push(req.user.branch_id);
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

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contributions c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT 
         c.id, c.amount, c.category, c.month_covered, c.date_paid, c.note, c.created_at,
         u.full_name AS member_name, u.phone AS member_phone,
         r.full_name AS recorded_by_name,
         b.name AS branch_name
       FROM contributions c
       JOIN users u ON u.id = c.member_id
       JOIN users r ON r.id = c.recorded_by
       JOIN branches b ON b.id = c.branch_id
       ${whereClause}
       ORDER BY c.month_covered DESC, c.created_at DESC
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

/**
 * DELETE /api/contributions/:id
 */
router.delete('/:id', requireRole('branch_admin', 'superadmin'), async (req, res) => {
  try {
    let deleteQuery, params;
    if (req.user.role === 'branch_admin') {
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

