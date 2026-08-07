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
  const { class_name, max_groups } = req.body;

  if (!class_name?.trim()) {
    return res.status(400).json({ error: 'class_name is required.' });
  }

  const parsedMax = max_groups && parseInt(max_groups, 10) > 0 ? parseInt(max_groups, 10) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const classCode = nanoid(8).toUpperCase();

    const tenantResult = await client.query(
      'INSERT INTO tenants (class_name, class_code, course_rep_id, max_groups) VALUES ($1, $2, $3, $4) RETURNING *',
      [class_name.trim(), classCode, req.repId, parsedMax]
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
    const tenantCheck = await pool.query(
      'SELECT id, class_name, class_code, is_locked, max_groups, created_at FROM tenants WHERE id = $1 AND course_rep_id = $2',
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

// PATCH /api/rep/classes/:id — update class (name, lock state, max groups)
router.patch('/classes/:id', auth, async (req, res) => {
  const { class_name, is_locked, max_groups } = req.body;
  try {
    const tenantCheck = await pool.query(
      'SELECT id FROM tenants WHERE id = $1 AND course_rep_id = $2',
      [req.params.id, req.repId]
    );
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (class_name !== undefined) {
      if (!class_name.trim()) return res.status(400).json({ error: 'Class name cannot be empty.' });
      updates.push(`class_name = $${idx++}`);
      values.push(class_name.trim());
    }

    if (is_locked !== undefined) {
      updates.push(`is_locked = $${idx++}`);
      values.push(Boolean(is_locked));
    }

    if (max_groups !== undefined) {
      const parsed = max_groups ? parseInt(max_groups, 10) : null;
      updates.push(`max_groups = $${idx++}`);
      values.push(parsed && parsed > 0 ? parsed : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ class: result.rows[0] });
  } catch (err) {
    console.error('[Update Class Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/rep/classes/:id — delete entire class and its submissions
router.delete('/classes/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const classId = req.params.id;
    await client.query('BEGIN');

    const tenantCheck = await client.query(
      'SELECT id, class_name FROM tenants WHERE id = $1 AND course_rep_id = $2',
      [classId, req.repId]
    );

    if (tenantCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found.' });
    }

    await client.query('DELETE FROM groups WHERE tenant_id = $1', [classId]);
    await client.query('DELETE FROM tenant_counters WHERE tenant_id = $1', [classId]);
    await client.query('DELETE FROM tenants WHERE id = $1', [classId]);

    await client.query('COMMIT');
    res.json({ message: 'Class deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Delete Class Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
});

// DELETE /api/rep/classes/:id/groups/:groupId — remove a specific group submission
router.delete('/classes/:id/groups/:groupId', auth, async (req, res) => {
  try {
    const { id: classId, groupId } = req.params;

    const tenantCheck = await pool.query(
      'SELECT id FROM tenants WHERE id = $1 AND course_rep_id = $2',
      [classId, req.repId]
    );
    if (tenantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found.' });
    }

    const deleteRes = await pool.query(
      'DELETE FROM groups WHERE id = $1 AND tenant_id = $2 RETURNING id, group_number, group_name',
      [groupId, classId]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    res.json({ message: 'Group submission removed.', removed: deleteRes.rows[0] });
  } catch (err) {
    console.error('[Delete Group Error]', err.message);
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

    let csv = 'Order,Group Number,Group Name,Leader Name,Submitted At\n';
    groups.rows.forEach((g, i) => {
      const escapedGroup = `"${(g.group_name || '').replace(/"/g, '""')}"`;
      const escapedLeader = `"${(g.leader_name || '').replace(/"/g, '""')}"`;
      const time = new Date(g.submitted_at).toLocaleString();
      csv += `${i + 1},${g.group_number},${escapedGroup},${escapedLeader},"${time}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${tenantCheck.rows[0].class_name.replace(/[^a-z0-9]/gi, '_')}_roster.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[CSV Export Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
