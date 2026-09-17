const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadAvatar } = require('../services/minio');

const { logAudit } = require('../services/auditLogger');

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { phone, password }
 * Returns: { token, user: { id, full_name, role, branch_id } }
 */
router.post('/login', async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, phone, password_hash, full_name, role, branch_id, avatar_url, is_active FROM users WHERE phone = $1',
      [phone.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const user = result.rows[0];
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Account is deactivated. Please contact the administrator.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    // Log LOGIN audit event
    const loginReq = { user, headers: req.headers, socket: req.socket };
    await logAudit(loginReq, 'LOGIN', 'user', user.id, {
      full_name: user.full_name,
      phone: user.phone,
      role: user.role
    });

    const payload = {
      id: user.id,
      role: user.role,
      branch_id: user.branch_id,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
    };


    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        branch_id: user.branch_id,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/auth/me
 * Returns current logged-in user profile
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.phone, u.full_name, u.role, u.branch_id, u.avatar_url, b.name AS branch_name
       FROM users u LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/auth/profile
 * Allows logged-in user to update their own full_name, phone, password, and avatar
 */
router.put('/profile', authenticate, upload.single('avatar'), async (req, res) => {
  const { full_name, phone, password } = req.body;

  try {
    const userRes = await pool.query(
      'SELECT id, phone, full_name, avatar_url FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const currentUser = userRes.rows[0];
    let avatarUrl = currentUser.avatar_url;
    if (req.file) {
      avatarUrl = await uploadAvatar(req.file);
    }

    // Name can be changed by superadmin and branch_admin (not members)
    const canChangeName = ['superadmin', 'branch_admin'].includes(req.user.role);
    const newName = (canChangeName && full_name && full_name.trim()) ? full_name.trim() : currentUser.full_name;
    const newPhone = phone && phone.trim() ? phone.trim() : currentUser.phone;

    let updateQuery, params;
    if (password && password.trim()) {
      const password_hash = await bcrypt.hash(password.trim(), 12);
      updateQuery = `UPDATE users SET full_name = $1, phone = $2, password_hash = $3, avatar_url = $4
                     WHERE id = $5 RETURNING id, phone, full_name, role, branch_id, avatar_url`;
      params = [newName, newPhone, password_hash, avatarUrl, req.user.id];
    } else {
      updateQuery = `UPDATE users SET full_name = $1, phone = $2, avatar_url = $3
                     WHERE id = $4 RETURNING id, phone, full_name, role, branch_id, avatar_url`;
      params = [newName, newPhone, avatarUrl, req.user.id];
    }

    const result = await pool.query(updateQuery, params);
    const updatedUser = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already in use' });
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
