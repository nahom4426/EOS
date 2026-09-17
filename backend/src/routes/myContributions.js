const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const { calculateMemberScore } = require('../services/scoreCalculator');

router.use(authenticate, requireRole('member'));

/**
 * GET /api/my-contributions
 * Member sees only their own contributions
 * ?month=YYYY-MM (optional, defaults to all)
 * ?page=&limit=
 */
router.get('/', async (req, res) => {
  const { month, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  try {
    let conditions = [`c.member_id = $1`];
    let params = [req.user.id];
    let paramCount = 2;

    if (month) {
      const [year, mon] = month.split('-');
      const firstOfMonth = `${year}-${mon.padStart(2, '0')}-01`;
      conditions.push(`c.month_covered = $${paramCount++}`);
      params.push(firstOfMonth);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM contributions c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT 
         c.id, c.amount, c.category, c.month_covered, c.date_paid, c.note, c.created_at,
         b.name AS branch_name, u.full_name AS member_name, u.phone AS member_phone
       FROM contributions c
       JOIN branches b ON b.id = c.branch_id
       JOIN users u ON u.id = c.member_id
       ${whereClause}
       ORDER BY c.month_covered DESC, c.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limitNum, offset]
    );

    // Summary & Member score
    const summaryResult = await pool.query(
      `SELECT 
         COALESCE(SUM(amount), 0) AS total_contributed,
         MAX(date_paid) AS last_payment_date
       FROM contributions
       WHERE member_id = $1`,
      [req.user.id]
    );

    const scoreDetails = await calculateMemberScore(req.user.id);

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

