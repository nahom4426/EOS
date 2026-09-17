/**
 * DB Setup Script
 * Creates all tables from schema.sql
 * Run: npm run db:setup
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function setup() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    console.log('📦 Running schema migrations...');
    await pool.query(sql);
    console.log('✅ Schema created successfully!');
  } catch (err) {
    console.error('❌ Schema creation failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
