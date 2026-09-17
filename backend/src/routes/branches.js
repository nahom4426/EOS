const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// All routes require superadmin
router.use(authenticate, requireRole('superadmin'));

/**
 * GET /api/branches
 * Returns all branches with member/admin counts
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id, b.name, b.location, b.created_at,
        COUNT(DISTINCT CASE WHEN u.role = 'member' THEN u.id END) AS member_count,
        COUNT(DISTINCT CASE WHEN u.role = 'branch_admin' THEN u.id END) AS admin_count
      FROM branches b
      LEFT JOIN users u ON u.branch_id = b.id
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/branches
 * Body: { name, location }
 */
router.post('/', async (req, res) => {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required' });
  try {
    const result = await pool.query(
      'INSERT INTO branches (name, location) VALUES ($1, $2) RETURNING *',
      [name.trim(), location?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/branches/:id
 */
router.put('/:id', async (req, res) => {
  const { name, location } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name is required' });
  try {
    const result = await pool.query(
      'UPDATE branches SET name=$1, location=$2 WHERE id=$3 RETURNING *',
      [name.trim(), location?.trim() || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/branches/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM branches WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.json({ message: 'Branch deleted', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
