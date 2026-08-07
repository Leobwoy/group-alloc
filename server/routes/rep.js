const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const pool = require('../db/pool');
const auth = require('../middleware/auth');

const router = express.Router();

// POST /api/rep/register
router.post('/register', async (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'full_name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM course_reps WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO course_reps (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email',
      [full_name.trim(), email.trim().toLowerCase(), password_hash]
    );

    const rep = result.rows[0];
    const token = jwt.sign({ repId: rep.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, rep: { id: rep.id, full_name: rep.full_name, email: rep.email } });
  } catch (err) {
    console.error('[Register Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/rep/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM course_reps WHERE email = $1', [email.trim().toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const rep = result.rows[0];
    const valid = await bcrypt.compare(password, rep.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ repId: rep.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, rep: { id: rep.id, full_name: rep.full_name, email: rep.email } });
  } catch (err) {
    console.error('[Login Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/rep/classes — create a class
router.post('/classes', auth, async (req, res) => {
  const { class_name } = req.body;

  if (!class_name?.trim()) {
    return res.status(400).json({ error: 'class_name is required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const classCode = nanoid(8).toUpperCase();

    const tenantResult = await client.query(
      'INSERT INTO tenants (class_name, class_code, course_rep_id) VALUES ($1, $2, $3) RETURNING *',
      [class_name.trim(), classCode, req.repId]
    );

    await client.query(
      'INSERT INTO tenant_counters (tenant_id, next_number) VALUES ($1, 1)',
      [tenantResult.rows[0].id]
    );

    await client.query('COMMIT');

    res.status(201).json({ class: tenantResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Create Class Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

// GET /api/rep/classes — list rep's classes
router.get('/classes', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM groups g WHERE g.tenant_id = t.id) AS group_count
       FROM tenants t 
       WHERE t.course_rep_id = $1 
       ORDER BY t.created_at DESC`,
      [req.repId]
    );
    res.json({ classes: result.rows });
  } catch (err) {
    console.error('[List Classes Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/rep/classes/:id/groups — list submissions for a class
router.get('/classes/:id/groups', auth, async (req, res) => {
  try {
    // Verify ownership
    const tenantCheck = await pool.query(
      'SELECT id, class_name, class_code FROM tenants WHERE id = $1 AND course_rep_id = $2',
      [req.params.id, req.repId]
    );
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const groups = await pool.query(
      'SELECT id, leader_name, group_name, group_number, submitted_at FROM groups WHERE tenant_id = $1 ORDER BY group_number ASC',
      [req.params.id]
    );

    res.json({
      class: tenantCheck.rows[0],
      groups: groups.rows
    });
  } catch (err) {
    console.error('[List Groups Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/rep/classes/:id/export — CSV export
router.get('/classes/:id/export', auth, async (req, res) => {
  try {
    const tenantCheck = await pool.query(
      'SELECT id, class_name FROM tenants WHERE id = $1 AND course_rep_id = $2',
      [req.params.id, req.repId]
    );
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const groups = await pool.query(
      'SELECT leader_name, group_name, group_number, submitted_at FROM groups WHERE tenant_id = $1 ORDER BY group_number ASC',
      [req.params.id]
    );

    let csv = 'Group Number,Group Name,Leader Name,Submitted At\n';
    for (const g of groups.rows) {
      const escapedGroup = `"${(g.group_name || '').replace(/"/g, '""')}"`;
      const escapedLeader = `"${(g.leader_name || '').replace(/"/g, '""')}"`;
      const time = new Date(g.submitted_at).toLocaleString();
      csv += `${g.group_number},${escapedGroup},${escapedLeader},"${time}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${tenantCheck.rows[0].class_name.replace(/[^a-z0-9]/gi, '_')}_roster.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[CSV Export Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
