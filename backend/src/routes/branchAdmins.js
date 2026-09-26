const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require superadmin
router.use(authenticate, requireRole('superadmin'));

/**
 * GET /api/branch-admins/all-users
 * Superadmin endpoint to fetch all system users across all roles & branches
 */
router.get('/all-users', async (req, res) => {
  const { search, role, branch_id, status = 'all', page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  try {
    let conditions = [];
    let params = [];
    let paramCount = 1;

    if (status === 'active') {
      conditions.push(`u.is_active = true`);
    } else if (status === 'deactivated') {
      conditions.push(`u.is_active = false`);
    }

    if (role) {
      conditions.push(`u.role = $${paramCount++}`);
      params.push(role);
    }

    if (branch_id) {
      conditions.push(`u.branch_id = $${paramCount++}`);
      params.push(branch_id);
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

    const limitParam = paramCount++;
    const offsetParam = paramCount++;
    params.push(limitNum, offset);

    const usersResult = await pool.query(
      `SELECT u.id, u.phone, u.full_name, u.role, u.avatar_url, u.is_active, u.created_at,
              b.id AS branch_id, b.name AS branch_name
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );


    res.json({
      users: usersResult.rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/branch-admins
 * Returns all branch staff accounts (admin, mini_admin, first_child) with their branch info
 */
router.get('/', async (req, res) => {
  try {
    const { role: roleFilter } = req.query;
    let whereClause = `u.role IN ('admin', 'mini_admin', 'first_child')`;
    const params = [];
    if (roleFilter && ['admin', 'mini_admin', 'first_child'].includes(roleFilter)) {
      whereClause = `u.role = $1`;
      params.push(roleFilter);
    }
    const result = await pool.query(`
      SELECT u.id, u.phone, u.full_name, u.role, u.created_at, u.mini_admin_id,
             b.id AS branch_id, b.name AS branch_name,
             ma.full_name AS mini_admin_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      LEFT JOIN users ma ON ma.id = u.mini_admin_id
      WHERE ${whereClause}
      ORDER BY u.role, u.created_at DESC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/branch-admins
 * Body: { phone, password, full_name, branch_id, role?, mini_admin_id? }
 * Supported roles: admin, mini_admin, first_child
 */
router.post('/', async (req, res) => {
  const { phone, password, full_name, branch_id, mini_admin_id } = req.body;
  if (!phone || !password || !full_name || !branch_id) {
    return res.status(400).json({ error: 'phone, password, full_name, and branch_id are required' });
  }

  // Validate allowed roles
  const ALLOWED_ROLES = ['admin', 'mini_admin', 'first_child'];
  const userRole = ALLOWED_ROLES.includes(req.body.role) ? req.body.role : 'admin';

  try {
    // Check branch exists
    const branchCheck = await pool.query('SELECT id FROM branches WHERE id=$1', [branch_id]);
    if (branchCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Branch not found' });
    }

    // For first_child: validate mini_admin_id if provided
    let resolvedMiniAdminId = null;
    if (userRole === 'first_child' && mini_admin_id) {
      const maCheck = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'mini_admin'`,
        [mini_admin_id]
      );
      if (maCheck.rows.length === 0) {
        return res.status(400).json({ error: 'mini_admin_id does not refer to a valid mini_admin' });
      }
      resolvedMiniAdminId = parseInt(mini_admin_id);
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (phone, password_hash, full_name, role, branch_id, mini_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, phone, full_name, role, branch_id, mini_admin_id, created_at`,
      [phone.trim(), password_hash, full_name.trim(), userRole, branch_id, resolvedMiniAdminId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/branch-admins/:id
 * Body: { full_name, phone, branch_id, password?, mini_admin_id? }
 */
router.put('/:id', async (req, res) => {
  const { full_name, phone, branch_id, password, mini_admin_id } = req.body;
  try {
    let updateQuery, params;
    if (password) {
      const password_hash = await bcrypt.hash(password, 12);
      updateQuery = `UPDATE users SET full_name=$1, phone=$2, branch_id=$3, password_hash=$4, mini_admin_id=$5
                     WHERE id=$6 AND role IN ('admin','mini_admin','first_child') RETURNING id, phone, full_name, role, branch_id, mini_admin_id`;
      params = [full_name, phone, branch_id, password_hash, mini_admin_id || null, req.params.id];
    } else {
      updateQuery = `UPDATE users SET full_name=$1, phone=$2, branch_id=$3, mini_admin_id=$4
                     WHERE id=$5 AND role IN ('admin','mini_admin','first_child') RETURNING id, phone, full_name, role, branch_id, mini_admin_id`;
      params = [full_name, phone, branch_id, mini_admin_id || null, req.params.id];
    }
    const result = await pool.query(updateQuery, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/branch-admins/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM users WHERE id=$1 AND role IN ('admin','mini_admin','first_child') RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
