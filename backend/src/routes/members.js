const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadAvatar } = require('../services/minio');
const { calculateMemberScore } = require('../services/scoreCalculator');
const { logAudit } = require('../services/auditLogger');

const router = express.Router();

// All routes require branch_admin (or superadmin can also call)
router.use(authenticate, requireRole('branch_admin', 'superadmin'));

/**
 * GET /api/members
 * Query params: ?search=&status=active|deactivated|all&paid_this_month=
 */
router.get('/', async (req, res) => {
  const { search, page = 1, limit = 20, paid_this_month, status = 'active' } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const branchId =
    req.user.role === 'superadmin'
      ? req.query.branch_id || null
      : req.user.branch_id;

  const now = new Date();
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    let conditions = [`u.role = 'member'`];
    let params = [];
    let paramCount = 1;

    // Status filtering (active / deactivated / all)
    if (status === 'active') {
      conditions.push(`u.is_active = true`);
    } else if (status === 'deactivated') {
      conditions.push(`u.is_active = false`);
    }

    if (branchId) {
      conditions.push(`u.branch_id = $${paramCount++}`);
      params.push(branchId);
    }

    if (search) {
      conditions.push(`(u.full_name ILIKE $${paramCount} OR u.phone ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const monthParam = paramCount;
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;

    const result = await pool.query(
      `SELECT 
         u.id, u.phone, u.full_name, u.branch_id, u.avatar_url, u.is_active, u.created_at,
         b.name AS branch_name,
         CASE WHEN EXISTS (
           SELECT 1 FROM contributions c
           WHERE c.member_id = u.id AND c.month_covered = $${monthParam}
         ) THEN true ELSE false END AS paid_this_month
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       ${whereClause}
       ORDER BY u.full_name
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, currentMonthStart, limitNum, offset]
    );

    let rows = result.rows;
    if (paid_this_month === 'true') rows = rows.filter(r => r.paid_this_month);
    if (paid_this_month === 'false') rows = rows.filter(r => !r.paid_this_month);

    // Attach calculated score details to each member
    const enrichedRows = await Promise.all(
      rows.map(async (m) => {
        const scoreInfo = await calculateMemberScore(m.id);
        return {
          ...m,
          score: scoreInfo.score,
          tier: scoreInfo.tier,
          tierBadge: scoreInfo.tierBadge,
          tierColor: scoreInfo.tierColor,
          streakMonths: scoreInfo.streakMonths,
        };
      })
    );

    res.json({
      data: enrichedRows,
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
 * GET /api/members/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.phone, u.full_name, u.branch_id, u.avatar_url, u.is_active, u.created_at, b.name AS branch_name
       FROM users u LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id=$1 AND u.role='member'`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    const member = result.rows[0];
    if (req.user.role === 'branch_admin' && member.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const scoreInfo = await calculateMemberScore(member.id);
    res.json({
      ...member,
      score: scoreInfo.score,
      tier: scoreInfo.tier,
      tierBadge: scoreInfo.tierBadge,
      tierColor: scoreInfo.tierColor,
      streakMonths: scoreInfo.streakMonths,
      monthsPaidCount: scoreInfo.monthsPaidCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/members
 */
router.post('/', upload.single('avatar'), async (req, res) => {
  const { phone, password, full_name } = req.body;
  if (!phone || !password || !full_name) {
    return res.status(400).json({ error: 'phone, password, and full_name are required' });
  }

  const branchId = req.user.role === 'superadmin'
    ? req.body.branch_id
    : req.user.branch_id;

  if (!branchId) return res.status(400).json({ error: 'branch_id is required' });

  try {
    let avatarUrl = null;
    if (req.file) {
      avatarUrl = await uploadAvatar(req.file);
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (phone, password_hash, full_name, role, branch_id, avatar_url, is_active)
       VALUES ($1, $2, $3, 'member', $4, $5, true)
       RETURNING id, phone, full_name, role, branch_id, avatar_url, is_active, created_at`,
      [phone.trim(), password_hash, full_name.trim(), branchId, avatarUrl]
    );

    const newMember = result.rows[0];
    await logAudit(req, 'CREATE_MEMBER', 'user', newMember.id, {
      full_name: newMember.full_name,
      phone: newMember.phone,
      branch_id: branchId,
    });

    res.status(201).json(newMember);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/members/:id/activate
 * Reactivate a deactivated member
 */
router.put('/:id/activate', async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT branch_id, full_name FROM users WHERE id=$1 AND role='member'`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    if (req.user.role === 'branch_admin' && check.rows[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query(`UPDATE users SET is_active = true WHERE id = $1 AND role = 'member'`, [req.params.id]);

    await logAudit(req, 'ACTIVATE_MEMBER', 'user', req.params.id, {
      full_name: check.rows[0].full_name,
    });

    res.json({ message: 'Member reactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/members/:id
 */
router.put('/:id', upload.single('avatar'), async (req, res) => {
  const { full_name, phone, password } = req.body;
  try {
    const check = await pool.query(
      `SELECT branch_id, avatar_url, full_name FROM users WHERE id=$1 AND role='member'`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    if (req.user.role === 'branch_admin' && check.rows[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let avatarUrl = check.rows[0].avatar_url;
    if (req.file) {
      avatarUrl = await uploadAvatar(req.file);
    }

    let updateQuery, params;
    if (password) {
      const password_hash = await bcrypt.hash(password, 12);
      updateQuery = `UPDATE users SET full_name=$1, phone=$2, password_hash=$3, avatar_url=$4
                     WHERE id=$5 AND role='member' RETURNING id, phone, full_name, role, branch_id, avatar_url, is_active`;
      params = [full_name, phone, password_hash, avatarUrl, req.params.id];
    } else {
      updateQuery = `UPDATE users SET full_name=$1, phone=$2, avatar_url=$3
                     WHERE id=$4 AND role='member' RETURNING id, phone, full_name, role, branch_id, avatar_url, is_active`;
      params = [full_name, phone, avatarUrl, req.params.id];
    }

    const result = await pool.query(updateQuery, params);
    const updatedMember = result.rows[0];

    await logAudit(req, 'UPDATE_MEMBER', 'user', updatedMember.id, {
      full_name: updatedMember.full_name,
      phone: updatedMember.phone,
    });

    res.json(updatedMember);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/members/:id (Soft Delete / Deactivate)
 */
router.delete('/:id', async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT branch_id, full_name FROM users WHERE id=$1 AND role='member'`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    if (req.user.role === 'branch_admin' && check.rows[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Soft Delete / Deactivate
    await pool.query(`UPDATE users SET is_active = false WHERE id=$1 AND role='member'`, [req.params.id]);

    await logAudit(req, 'DEACTIVATE_MEMBER', 'user', req.params.id, {
      full_name: check.rows[0].full_name,
    });

    res.json({ message: 'Member deactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/members/:id/permanent (Superadmin Permanent Delete)
 */
router.delete('/:id/permanent', requireRole('superadmin'), async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT full_name FROM users WHERE id=$1 AND role='member'`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Member not found' });

    await pool.query(`DELETE FROM users WHERE id=$1 AND role='member'`, [req.params.id]);

    await logAudit(req, 'PERMANENT_DELETE_MEMBER', 'user', req.params.id, {
      full_name: check.rows[0].full_name,
    });

    res.json({ message: 'Member permanently deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;


