/**
 * Migration V2 — EOS Church Role Hierarchy & Pipeline Upgrade
 *
 * Safe, non-destructive migration:
 *  - Adds new enum values (admin, mini_admin, first_child) to user_role
 *  - Renames legacy 'branch_admin' records → 'admin'
 *  - Adds first_child_id, mini_admin_id columns to users
 *  - Adds months_covered, base_rate_applied, status, batch_id, assigned_mini_admin_id,
 *    mini_admin_received_at, admin_approved_at to contributions
 *  - Keeps old month_covered DATE column as nullable (backward compat)
 *  - Seeds default system_settings keys
 *
 * Run: node src/db/migration_v2.js
 */
require('dotenv').config();
const { randomUUID } = require('crypto');
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting EOS V2 database migration...\n');

    // ─── Step 1: Add new enum values (PG allows this outside a transaction) ───
    // ADD VALUE IF NOT EXISTS was added in PG 9.3; safe for all modern versions.
    // Note: ALTER TYPE ADD VALUE cannot run inside a transaction block in PG < 12.
    console.log('📌 Step 1: Extending user_role enum...');
    await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';`);
    await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mini_admin';`);
    await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'first_child';`);
    console.log('  ✅ Enum values added: admin, mini_admin, first_child');

    // ─── Step 2: Migrate existing branch_admin records → admin ───
    console.log('\n📌 Step 2: Migrating branch_admin → admin...');
    const migrationResult = await client.query(`
      UPDATE users SET role = 'admin' WHERE role = 'branch_admin';
    `);
    console.log(`  ✅ Updated ${migrationResult.rowCount} user(s) from branch_admin → admin`);

    // ─── Step 3: Add new columns to users ───
    console.log('\n📌 Step 3: Adding new columns to users table...');
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS first_child_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS mini_admin_id   INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    console.log('  ✅ first_child_id, mini_admin_id columns added to users');

    // ─── Step 4: Add new columns to contributions ───
    console.log('\n📌 Step 4: Adding new columns to contributions table...');

    // Keep month_covered but make it nullable (old rows keep their value)
    await client.query(`
      ALTER TABLE contributions
        ALTER COLUMN month_covered DROP NOT NULL;
    `);
    console.log('  ✅ month_covered is now nullable (backward-compat)');

    await client.query(`
      ALTER TABLE contributions
        ADD COLUMN IF NOT EXISTS months_covered          JSONB,
        ADD COLUMN IF NOT EXISTS base_rate_applied       DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS status                  VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
        ADD COLUMN IF NOT EXISTS assigned_mini_admin_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS mini_admin_received_at  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS admin_approved_at       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS batch_id                UUID;
    `);
    console.log('  ✅ months_covered, base_rate_applied, status, assigned_mini_admin_id,');
    console.log('     mini_admin_received_at, admin_approved_at, batch_id added to contributions');

    // For existing rows, backfill months_covered from the old month_covered DATE
    await client.query(`
      UPDATE contributions
      SET months_covered = to_jsonb(ARRAY[
        CASE EXTRACT(MONTH FROM month_covered)
          WHEN 1 THEN 'Tir'
          WHEN 2 THEN 'Yekatit'
          WHEN 3 THEN 'Megabit'
          WHEN 4 THEN 'Miyazya'
          WHEN 5 THEN 'Ginbot'
          WHEN 6 THEN 'Sene'
          WHEN 7 THEN 'Hamle'
          WHEN 8 THEN 'Nehase'
          WHEN 9 THEN 'Meskerem'
          WHEN 10 THEN 'Tikimt'
          WHEN 11 THEN 'Hidar'
          WHEN 12 THEN 'Tahsas'
        END
      ])
      WHERE months_covered IS NULL AND month_covered IS NOT NULL;
    `);
    console.log('  ✅ Backfilled months_covered for existing contributions');

    // ─── Step 5: Create or update system_settings table ───
    console.log('\n📌 Step 5: Ensuring system_settings table and keys...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key   VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    console.log('  ✅ system_settings table ensured');

    // Seed default_monthly_contribution
    await client.query(`
      INSERT INTO system_settings (key, value) VALUES ('default_monthly_contribution', '10.00')
      ON CONFLICT (key) DO NOTHING;
    `);
    // Seed church_stamp_url (null stored as empty string; treated as null in application)
    await client.query(`
      INSERT INTO system_settings (key, value) VALUES ('church_stamp_url', '')
      ON CONFLICT (key) DO NOTHING;
    `);
    // Seed authorized_signature_url
    await client.query(`
      INSERT INTO system_settings (key, value) VALUES ('authorized_signature_url', '')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log('  ✅ Seeded: default_monthly_contribution=10.00, church_stamp_url, authorized_signature_url');

    // ─── Step 6: Add indexes ───
    console.log('\n📌 Step 6: Adding indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_status   ON contributions(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_batch_id  ON contributions(batch_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_mini_admin ON contributions(assigned_mini_admin_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_first_child_id   ON users(first_child_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_mini_admin_id    ON users(mini_admin_id);`);
    console.log('  ✅ All new indexes created');

    console.log('\n🎉 Migration V2 completed successfully!');
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
