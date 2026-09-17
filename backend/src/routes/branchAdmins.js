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
 * Returns all branch admin accounts with their branch info
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.phone, u.full_name, u.role, u.created_at,
             b.id AS branch_id, b.name AS branch_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.role = 'branch_admin'
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/branch-admins
 * Body: { phone, password, full_name, branch_id }
 */
router.post('/', async (req, res) => {
  const { phone, password, full_name, branch_id } = req.body;
  if (!phone || !password || !full_name || !branch_id) {
    return res.status(400).json({ error: 'phone, password, full_name, and branch_id are required' });
  }

  try {
    // Check branch exists
    const branchCheck = await pool.query('SELECT id FROM branches WHERE id=$1', [branch_id]);
    if (branchCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Branch not found' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (phone, password_hash, full_name, role, branch_id)
       VALUES ($1, $2, $3, 'branch_admin', $4)
       RETURNING id, phone, full_name, role, branch_id, created_at`,
      [phone.trim(), password_hash, full_name.trim(), branch_id]
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
 * Body: { full_name, phone, branch_id, password? }
 */
router.put('/:id', async (req, res) => {
  const { full_name, phone, branch_id, password } = req.body;
  try {
    let updateQuery, params;
    if (password) {
      const password_hash = await bcrypt.hash(password, 12);
      updateQuery = `UPDATE users SET full_name=$1, phone=$2, branch_id=$3, password_hash=$4
                     WHERE id=$5 AND role='branch_admin' RETURNING id, phone, full_name, role, branch_id`;
      params = [full_name, phone, branch_id, password_hash, req.params.id];
    } else {
      updateQuery = `UPDATE users SET full_name=$1, phone=$2, branch_id=$3
                     WHERE id=$4 AND role='branch_admin' RETURNING id, phone, full_name, role, branch_id`;
      params = [full_name, phone, branch_id, req.params.id];
    }
    const result = await pool.query(updateQuery, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
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
      `DELETE FROM users WHERE id=$1 AND role='branch_admin' RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    res.json({ message: 'Branch admin deleted', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
