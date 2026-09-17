const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('superadmin'));


/**
 * GET /api/audit-logs
 * Query params: ?search=&action=&page=1&limit=20
 */
router.get('/', async (req, res) => {
  const { search, action, page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  try {
    let conditions = [];
    let params = [];
    let paramCount = 1;

    // Branch scoping for branch_admin
    if (req.user.role === 'branch_admin') {
      conditions.push(`(branch_id = $${paramCount} OR user_id = $${paramCount + 1})`);
      params.push(req.user.branch_id, req.user.id);
      paramCount += 2;
    }

    if (action) {
      conditions.push(`action = $${paramCount++}`);
      params.push(action);
    }

    if (search) {
      conditions.push(`(user_name ILIKE $${paramCount} OR action ILIKE $${paramCount} OR entity_type ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM audit_logs 
       ${whereClause} 
       ORDER BY created_at DESC 
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
    console.error('Audit logs fetch error:', err);
    res.status(500).json({ error: 'Server error fetching audit logs' });
  }
});

module.exports = router;
