const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const { calculateMemberScore } = require('../services/scoreCalculator');

// Accessible by both member and first_child roles
router.use(authenticate, requireRole('member', 'first_child'));

/**
 * GET /api/my-contributions
 * - member: their own contributions
 * - first_child: contributions for all their siblings
 *
 * Query: ?month=YYYY-MM  ?page=  ?limit=
 */
router.get('/', async (req, res) => {
  const { month, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  try {
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (req.user.role === 'member') {
      conditions.push(`c.member_id = $${paramCount++}`);
      params.push(req.user.id);
    } else if (req.user.role === 'first_child') {
      // Show contributions for all siblings under this first_child
      conditions.push(`u.first_child_id = $${paramCount++}`);
      params.push(req.user.id);
    }

    if (month) {
      const [year, mon] = month.split('-');
      const firstOfMonth = `${year}-${mon.padStart(2, '0')}-01`;
      conditions.push(`c.month_covered = $${paramCount++}`);
      params.push(firstOfMonth);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contributions c
       JOIN users u ON u.id = c.member_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT
         c.id, c.amount, c.category, c.month_covered, c.months_covered,
         c.base_rate_applied, c.date_paid, c.note, c.created_at,
         c.status, c.batch_id, c.mini_admin_received_at, c.admin_approved_at,
         b.name AS branch_name,
         u.full_name AS member_name, u.phone AS member_phone
       FROM contributions c
       JOIN branches b ON b.id = c.branch_id
       JOIN users u ON u.id = c.member_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limitNum, offset]
    );

    // For member role: personal score; for first_child: aggregate
    let scoreDetails;
    if (req.user.role === 'member') {
      scoreDetails = await calculateMemberScore(req.user.id);
    } else {
      // first_child: placeholder (no personal score)
      scoreDetails = { score: null, tier: null, tierBadge: null, tierColor: null, streakMonths: 0, monthsPaidCount: 0 };
    }

    const summaryResult = await pool.query(
      req.user.role === 'member'
        ? `SELECT COALESCE(SUM(amount), 0) AS total_contributed, MAX(date_paid) AS last_payment_date
           FROM contributions WHERE member_id = $1`
        : `SELECT COALESCE(SUM(c.amount), 0) AS total_contributed, MAX(c.date_paid) AS last_payment_date
           FROM contributions c
           JOIN users u ON u.id = c.member_id
           WHERE u.first_child_id = $1`,
      [req.user.id]
    );

    res.json({
      data: result.rows,
      summary: {
        total_contributed: parseFloat(summaryResult.rows[0].total_contributed),
        last_payment_date: summaryResult.rows[0].last_payment_date,
        score: scoreDetails.score,
        tier: scoreDetails.tier,
        tierBadge: scoreDetails.tierBadge,
        tierColor: scoreDetails.tierColor,
        streakMonths: scoreDetails.streakMonths,
        monthsPaidCount: scoreDetails.monthsPaidCount,
      },
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

module.exports = router;
