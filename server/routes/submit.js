const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/submit/:classCode — validate class code, return class name
router.get('/:classCode', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, class_name, class_code FROM tenants WHERE class_code = $1',
      [req.params.classCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid class code.' });
    }

    res.json({ class: result.rows[0] });
  } catch (err) {
    console.error('[Validate Code Error]', err.message);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/submit/:classCode — atomic group number allocation
router.post('/:classCode', async (req, res) => {
  const { leader_name, group_name } = req.body;

  if (!leader_name?.trim()) {
    return res.status(400).json({ error: 'Leader name is required.' });
  }
  if (!group_name?.trim()) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  const client = await pool.connect();
  try {
    // Resolve tenant
    const tenantResult = await client.query(
      'SELECT id FROM tenants WHERE class_code = $1',
      [req.params.classCode]
    );

    if (tenantResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Invalid class code.' });
    }

    const tenantId = tenantResult.rows[0].id;

    await client.query('BEGIN');

    // Atomic counter increment — the database serializes concurrent hits on the same row
    const counterResult = await client.query(
      'UPDATE tenant_counters SET next_number = next_number + 1 WHERE tenant_id = $1 RETURNING next_number - 1 AS allocated_number',
      [tenantId]
    );

    const allocatedNumber = counterResult.rows[0].allocated_number;

    // Insert the group with the allocated number
    const groupResult = await client.query(
      'INSERT INTO groups (tenant_id, leader_name, group_name, group_number) VALUES ($1, $2, $3, $4) RETURNING id, leader_name, group_name, group_number, submitted_at',
      [tenantId, leader_name.trim(), group_name.trim(), allocatedNumber]
    );

    await client.query('COMMIT');

    res.status(201).json({ group: groupResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');

    // Handle unique constraint violations
    if (err.code === '23505') {
      if (err.constraint?.includes('group_name')) {
        return res.status(409).json({ error: 'A group with this name already exists in this class.' });
      }
      if (err.constraint?.includes('group_number')) {
        return res.status(409).json({ error: 'Group number conflict. Please try again.' });
      }
    }

    console.error('[Submit Error]', err.message);
    res.status(500).json({ error: 'Server error during allocation.' });
  } finally {
    client.release();
  }
});

module.exports = router;
