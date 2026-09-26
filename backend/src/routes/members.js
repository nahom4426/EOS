const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadAvatar } = require('../services/minio');
const { calculateMemberScore } = require('../services/scoreCalculator');
const { logAudit } = require('../services/auditLogger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Helper: staff roles that can manage members
const STAFF_ROLES = ['superadmin', 'admin', 'mini_admin', 'first_child'];

/**
 * GET /api/members
 * Admin/superadmin: all branch members.
 * mini_admin/first_child: members whose first_child_id = caller id (first_child)
 *   or whose first_child.mini_admin_id = caller (mini_admin)
 */
router.get('/', requireRole('superadmin', 'admin', 'mini_admin', 'first_child'), async (req, res) => {
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

    if (status === 'active') {
      conditions.push(`u.is_active = true`);
    } else if (status === 'deactivated') {
      conditions.push(`u.is_active = false`);
    }

    if (branchId) {
      conditions.push(`u.branch_id = $${paramCount++}`);
      params.push(branchId);
    }

    // first_child can only see their own siblings
    if (req.user.role === 'first_child') {
      conditions.push(`u.first_child_id = $${paramCount++}`);
      params.push(req.user.id);
    }

    // mini_admin can see members whose family rep is under them
    if (req.user.role === 'mini_admin') {
      conditions.push(`u.mini_admin_id = $${paramCount++}`);
      params.push(req.user.id);
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
         u.first_child_id, u.mini_admin_id,
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
    console.error('GET /api/members error:', err);
    res.status(500).json({ error: 'GET /api/members error: ' + err.message, stack: err.stack });
  }
});

/**
 * GET /api/members/mini-admins
 * Returns list of mini_admin users for dropdown (used by first_child form)
 */
router.get('/mini-admins', requireRole('superadmin', 'admin', 'mini_admin', 'first_child'), async (req, res) => {
  try {
    const branchId = req.user.role === 'superadmin' ? req.query.branch_id : req.user.branch_id;
    const conditions = [`u.role = 'mini_admin'`, `u.is_active = true`];
    const params = [];
    if (branchId) {
      conditions.push(`u.branch_id = $1`);
      params.push(branchId);
    }
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.phone FROM users u WHERE ${conditions.join(' AND ')} ORDER BY u.full_name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/members/first-children
 * Returns list of first_child users for admin dropdowns
 */
router.get('/first-children', requireRole('superadmin', 'admin', 'mini_admin'), async (req, res) => {
  try {
    const branchId = req.user.role === 'superadmin' ? req.query.branch_id : req.user.branch_id;
    const conditions = [`u.role = 'first_child'`, `u.is_active = true`];
    const params = [];
    if (branchId) {
      conditions.push(`u.branch_id = $1`);
      params.push(branchId);
    }
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.phone FROM users u WHERE ${conditions.join(' AND ')} ORDER BY u.full_name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/members/grouped-by-first-child
 * Returns First Children in branch with their member counts and child members
 */
router.get('/grouped-by-first-child', requireRole('superadmin', 'admin', 'mini_admin'), async (req, res) => {
  console.log('>>> ENTERED GROUPED-BY-FIRST-CHILD ROUTE <<<', req.user);
  try {
    const { status = 'all', search } = req.query;
    const branchId = req.user.role === 'superadmin' ? (req.query.branch_id || null) : req.user.branch_id;
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    let fcConditions = [`u.role = 'first_child'`];
    let fcParams = [];
    let fcParamCount = 1;

    if (status === 'active') {
      fcConditions.push(`u.is_active = true`);
    } else if (status === 'deactivated') {
      fcConditions.push(`u.is_active = false`);
    }

    if (branchId) {
      fcConditions.push(`u.branch_id = $${fcParamCount++}`);
      fcParams.push(branchId);
    }

    if (search) {
      fcConditions.push(`(u.full_name ILIKE $${fcParamCount} OR u.phone ILIKE $${fcParamCount})`);
      fcParams.push(`%${search}%`);
      fcParamCount++;
    }

    const fcResult = await pool.query(
      `SELECT u.id, u.full_name, u.phone, u.avatar_url, u.is_active, u.created_at, u.mini_admin_id,
              ma.full_name AS mini_admin_name
       FROM users u
       LEFT JOIN users ma ON ma.id = u.mini_admin_id
       WHERE ${fcConditions.join(' AND ')}
       ORDER BY u.full_name`,
      fcParams
    );

    let mConditions = [`u.role = 'member'`];
    let mParams = [currentMonthStart];
    let mParamCount = 2;

    if (status === 'active') {
      mConditions.push(`u.is_active = true`);
    } else if (status === 'deactivated') {
      mConditions.push(`u.is_active = false`);
    }

    if (branchId) {
      mConditions.push(`u.branch_id = $${mParamCount++}`);
      mParams.push(branchId);
    }

    const membersResult = await pool.query(
      `SELECT u.id, u.full_name, u.phone, u.avatar_url, u.is_active, u.created_at, u.first_child_id, u.mini_admin_id,
              fc.full_name AS first_child_name,
              CASE WHEN EXISTS (
                SELECT 1 FROM contributions c
                WHERE c.member_id = u.id AND c.month_covered = $1
              ) THEN true ELSE false END AS paid_this_month
       FROM users u
       LEFT JOIN users fc ON fc.id = u.first_child_id
       WHERE ${mConditions.join(' AND ')}
       ORDER BY u.full_name`,
      mParams
    );

    // Calculate score for each member safely
    const enrichedMembers = await Promise.all(
      membersResult.rows.map(async (m) => {
        try {
          const scoreInfo = await calculateMemberScore(m.id);
          return { ...m, ...scoreInfo };
        } catch (err) {
          return { ...m, score: 50, tier: 'Bronze', tierBadge: '🥈', streakMonths: 0 };
        }
      })
    );

    // Group members by first_child_id
    const fcIds = fcResult.rows.map(fc => fc.id);
    const groups = fcResult.rows.map(fc => {
      const fcMembers = enrichedMembers.filter(m => m.first_child_id === fc.id);
      return {
        first_child: fc,
        member_count: fcMembers.length,
        members: fcMembers
      };
    });

    // Collect unassigned members (first_child_id IS NULL or not pointing to a known first child)
    const unassignedMembers = enrichedMembers.filter(m => !m.first_child_id || !fcIds.includes(m.first_child_id));

    res.json({
      groups,
      unassigned: unassignedMembers,
      total_first_children: fcResult.rows.length,
      total_members: enrichedMembers.length
    });
  } catch (err) {
    console.error('Grouped members error:', err);
    res.status(500).json({ error: 'Grouped members error: ' + err.message, stack: err.stack });
  }
});

/**
 * GET /api/members/:id
 */
router.get('/:id', requireRole('superadmin', 'admin', 'mini_admin', 'first_child'), async (req, res, next) => {
  if (isNaN(parseInt(req.params.id))) return next();
  try {
    const result = await pool.query(
      `SELECT u.id, u.phone, u.full_name, u.branch_id, u.avatar_url, u.is_active, u.created_at,
              u.first_child_id, u.mini_admin_id, b.name AS branch_name
       FROM users u LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id=$1 AND u.role='member'`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    const member = result.rows[0];
    if (req.user.role === 'admin' && member.branch_id !== req.user.branch_id) {
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
    console.error('GET /api/members/:id error:', err);
    res.status(500).json({ error: 'GET /api/members/:id error: ' + err.message, stack: err.stack });
  }
});

/**
 * POST /api/members
 * - superadmin/admin: can create members or first_children
 * - mini_admin: can create members or first_children in their branch
 * - first_child: can register siblings (auto-sets first_child_id = their own id)
 */
router.post('/', requireRole('superadmin', 'admin', 'mini_admin', 'first_child'), upload.single('avatar'), async (req, res) => {
  const { phone, password, full_name, role: inputRole, first_child_id: bodyFirstChildId, mini_admin_id: bodyMiniAdminId } = req.body;
  if (!phone || !password || !full_name) {
    return res.status(400).json({ error: 'phone, password, and full_name are required' });
  }

  const targetRole = inputRole || 'member';
  const validRoles = ['member', 'first_child', 'mini_admin', 'admin'];
  if (!validRoles.includes(targetRole)) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }

  if (targetRole === 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can create Branch Admin' });
  }

  const branchId = (req.user.role === 'superadmin')
    ? (req.body.branch_id || req.user.branch_id)
    : req.user.branch_id;

  if (!branchId) return res.status(400).json({ error: 'branch_id is required' });

  let assignedFirstChildId = null;
  let assignedMiniAdminId = null;

  if (targetRole === 'member') {
    if (req.user.role === 'first_child') {
      assignedFirstChildId = req.user.id;
    } else if (bodyFirstChildId) {
      assignedFirstChildId = parseInt(bodyFirstChildId);
    }

    if (assignedFirstChildId) {
      const fcRow = await pool.query(
        `SELECT mini_admin_id FROM users WHERE id = $1 AND role = 'first_child'`,
        [assignedFirstChildId]
      ).catch(() => null);
      if (fcRow && fcRow.rows.length > 0) {
        assignedMiniAdminId = fcRow.rows[0].mini_admin_id;
      }
    }
  } else if (targetRole === 'first_child') {
    if (bodyMiniAdminId) {
      assignedMiniAdminId = parseInt(bodyMiniAdminId);
    } else if (req.user.role === 'mini_admin') {
      assignedMiniAdminId = req.user.id;
    }
  }

  try {
    let avatarUrl = null;
    if (req.file) {
      avatarUrl = await uploadAvatar(req.file);
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (phone, password_hash, full_name, role, branch_id, avatar_url, is_active, first_child_id, mini_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8)
       RETURNING id, phone, full_name, role, branch_id, avatar_url, is_active, first_child_id, mini_admin_id, created_at`,
      [phone.trim(), password_hash, full_name.trim(), targetRole, branchId, avatarUrl, assignedFirstChildId, assignedMiniAdminId]
    );

    const newMember = result.rows[0];
    await logAudit(req, `CREATE_${targetRole.toUpperCase()}`, 'user', newMember.id, {
      full_name: newMember.full_name,
      phone: newMember.phone,
      role: targetRole,
      branch_id: branchId,
      first_child_id: assignedFirstChildId,
      mini_admin_id: assignedMiniAdminId,
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
 */
router.put('/:id/activate', requireRole('superadmin', 'admin'), async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT branch_id, full_name FROM users WHERE id=$1 AND role='member'`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    if (req.user.role === 'admin' && check.rows[0].branch_id !== req.user.branch_id) {
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
 * Admin/superadmin/mini_admin endpoint to update user account details, role, and parent assignments
 */
router.put('/:id', requireRole('superadmin', 'admin', 'mini_admin'), upload.single('avatar'), async (req, res) => {
  const {
    full_name,
    phone,
    password,
    role: inputRole,
    first_child_id: bodyFirstChildId,
    mini_admin_id: bodyMiniAdminId
  } = req.body;

  try {
    const check = await pool.query(
      `SELECT id, branch_id, avatar_url, full_name, role FROM users WHERE id=$1`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'User account not found' });
    const existingUser = check.rows[0];

    if (req.user.role === 'admin' && existingUser.branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden: user is not in your branch' });
    }

    const targetRole = inputRole || existingUser.role;
    const validRoles = ['member', 'first_child', 'mini_admin', 'admin'];
    if (!validRoles.includes(targetRole)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }

    if (targetRole === 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can set role to Branch Admin' });
    }

    let avatarUrl = existingUser.avatar_url;
    if (req.file) {
      avatarUrl = await uploadAvatar(req.file);
    }

    // Determine first_child_id and mini_admin_id to set
    let assignedFirstChildId = null;
    let assignedMiniAdminId = null;

    if (targetRole === 'member') {
      if (bodyFirstChildId) {
        assignedFirstChildId = parseInt(bodyFirstChildId);
        const fcRow = await pool.query(
          `SELECT mini_admin_id FROM users WHERE id = $1 AND role = 'first_child'`,
          [assignedFirstChildId]
        ).catch(() => null);
        if (fcRow && fcRow.rows.length > 0) {
          assignedMiniAdminId = fcRow.rows[0].mini_admin_id;
        }
      }
    } else if (targetRole === 'first_child') {
      if (bodyMiniAdminId) {
        assignedMiniAdminId = parseInt(bodyMiniAdminId);
      }
    }

    let updateQuery, params;
    if (password && password.trim()) {
      const password_hash = await bcrypt.hash(password, 12);
      updateQuery = `UPDATE users
                     SET full_name=$1, phone=$2, password_hash=$3, avatar_url=$4, role=$5, first_child_id=$6, mini_admin_id=$7
                     WHERE id=$8
                     RETURNING id, phone, full_name, role, branch_id, avatar_url, is_active, first_child_id, mini_admin_id`;
      params = [full_name.trim(), phone.trim(), password_hash, avatarUrl, targetRole, assignedFirstChildId, assignedMiniAdminId, req.params.id];
    } else {
      updateQuery = `UPDATE users
                     SET full_name=$1, phone=$2, avatar_url=$3, role=$4, first_child_id=$5, mini_admin_id=$6
                     WHERE id=$7
                     RETURNING id, phone, full_name, role, branch_id, avatar_url, is_active, first_child_id, mini_admin_id`;
      params = [full_name.trim(), phone.trim(), avatarUrl, targetRole, assignedFirstChildId, assignedMiniAdminId, req.params.id];
    }

    const result = await pool.query(updateQuery, params);
    const updatedUser = result.rows[0];

    await logAudit(req, 'UPDATE_USER', 'user', updatedUser.id, {
      full_name: updatedUser.full_name,
      phone: updatedUser.phone,
      role: targetRole,
      first_child_id: assignedFirstChildId,
      mini_admin_id: assignedMiniAdminId,
    });

    res.json(updatedUser);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already in use' });
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user account: ' + err.message });
  }
});

/**
 * DELETE /api/members/:id (Soft Delete)
 */
router.delete('/:id', requireRole('superadmin', 'admin', 'mini_admin'), async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT branch_id, full_name FROM users WHERE id=$1 AND role='member'`,
      [req.params.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    if (req.user.role === 'admin' && check.rows[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

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
 * DELETE /api/members/:id/permanent
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
