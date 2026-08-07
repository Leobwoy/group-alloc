require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const pool = require('./db/pool');
const fs = require('fs');

const repRoutes = require('./routes/rep');
const submitRoutes = require('./routes/submit');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate-limit the public submit endpoint
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests per IP per minute
  message: { error: 'Too many submissions. Please try again shortly.' }
});
app.use('/api/submit', submitLimiter);

// Routes
app.use('/api/rep', repRoutes);
app.use('/api/submit', submitRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Initialize database schema on startup
async function initDB() {
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Wrap each CREATE TABLE in IF NOT EXISTS logic
    // We'll use a simpler approach: just run the schema and catch "already exists" errors
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        const safeStmt = stmt.replace(/CREATE TABLE (\w+)/i, 'CREATE TABLE IF NOT EXISTS $1');
        await pool.query(safeStmt + ';');
      } catch (err) {
        if (err.code !== '42P07' && err.code !== '42710') {
          console.warn('[DB Init Warning]', err.message);
        }
      }
    }

    // Run schema migrations for existing databases
    try {
      await pool.query(`
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_groups INT DEFAULT NULL;
      `);
    } catch (migErr) {
      console.warn('[DB Migration Warning]', migErr.message);
    }

    console.log('[DB] Schema initialized.');
  } catch (err) {
    console.error('[DB] Failed to initialize schema:', err.message);
    process.exit(1);
  }
}

// Start server if executed directly
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
module.exports.initDB = initDB;
