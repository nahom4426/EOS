/**
 * Migration V3 — EOS Dispatch Handover Support
 *
 * Adds:
 *  - handover_dispatched_at TIMESTAMPTZ to contributions
 *  - Index on status for the new DISPATCHED_TO_ADMIN state
 *  - Updates bulk-approve to also accept DISPATCHED_TO_ADMIN status
 *
 * Run: node src/db/migration_v3.js
 */
require('dotenv').config();
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting EOS V3 database migration...\n');

    // Step 1: Add handover_dispatched_at to contributions
    console.log('📌 Step 1: Adding handover_dispatched_at to contributions...');
    await client.query(`
      ALTER TABLE contributions
        ADD COLUMN IF NOT EXISTS handover_dispatched_at TIMESTAMPTZ;
    `);
    console.log('  ✅ handover_dispatched_at column added');

    // Step 2: Update bulk-approve to accept DISPATCHED_TO_ADMIN as valid state too
    // (No schema change needed — handled in application logic)

    // Step 3: Add index for the new status value
    console.log('\n📌 Step 3: Adding index for DISPATCHED_TO_ADMIN lookups...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contributions_handover_dispatched
        ON contributions(assigned_mini_admin_id, status)
        WHERE status IN ('RECEIVED_BY_MINI_ADMIN', 'DISPATCHED_TO_ADMIN');
    `);
    console.log('  ✅ Partial index on handover statuses created');

    console.log('\n🎉 Migration V3 completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
