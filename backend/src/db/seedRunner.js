/**
 * DB Seed Runner
 * Inserts the initial superadmin account
 * Run: npm run db:seed
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  try {
    console.log('🌱 Seeding superadmin account...');

    // Generate a fresh hash to be sure
    const password = 'Admin@1234';
    const password_hash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users (phone, password_hash, full_name, role, branch_id)
       VALUES ($1, $2, $3, 'superadmin', NULL)
       ON CONFLICT (phone) DO NOTHING`,
      ['0911000000', password_hash, 'System Superadmin']
    );

    console.log('✅ Superadmin seeded!');
    console.log('   Phone: 0911000000');
    console.log('   Password: Admin@1234');
    console.log('   ⚠️  Please change this password after first login!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
