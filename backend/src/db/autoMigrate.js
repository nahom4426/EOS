const pool = require('./pool');

/**
 * Runs idempotent database schema updates and migrations automatically on server boot.
 * Guarantees all tables, columns (including first_child_id, mini_admin_id, etc.),
 * enums, and default system settings exist in production without manual CLI steps.
 */
async function runAutoMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Checking & applying automatic DB schema migrations...');

    // 1. Extend user_role enum
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'branch_admin', 'mini_admin', 'first_child', 'member');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new enum values if type already existed
    const newEnumValues = ['admin', 'mini_admin', 'first_child'];
    for (const val of newEnumValues) {
      try {
        await client.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS '${val}';`);
      } catch (e) {
        // Ignore if already present or not supported in transaction
      }
    }

    // 2. Ensure branches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        location   VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Ensure users table and columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        phone         VARCHAR(20) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name     VARCHAR(255) NOT NULL,
        role          user_role NOT NULL DEFAULT 'member',
        branch_id     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        avatar_url    TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS first_child_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS mini_admin_id  INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Legacy role migration: branch_admin -> admin
    await client.query(`UPDATE users SET role = 'admin' WHERE role = 'branch_admin';`);

    // 4. Ensure contributions table and columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS contributions (
        id            SERIAL PRIMARY KEY,
        member_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        branch_id     INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        amount        DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
        category      VARCHAR(100) NOT NULL DEFAULT 'Monthly Dues',
        month_covered DATE,
        date_paid     DATE NOT NULL DEFAULT CURRENT_DATE,
        recorded_by   INTEGER NOT NULL REFERENCES users(id),
        note          TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE contributions
        ALTER COLUMN month_covered DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS category               VARCHAR(100) NOT NULL DEFAULT 'Monthly Dues',
        ADD COLUMN IF NOT EXISTS months_covered         JSONB,
        ADD COLUMN IF NOT EXISTS base_rate_applied      DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS status                 VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
        ADD COLUMN IF NOT EXISTS assigned_mini_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS mini_admin_received_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS admin_approved_at      TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS handover_dispatched_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS batch_id               UUID;
    `);

    // 5. Ensure audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id            SERIAL PRIMARY KEY,
        user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name     VARCHAR(255),
        user_role     VARCHAR(50),
        branch_id     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        action        VARCHAR(100) NOT NULL,
        entity_type   VARCHAR(50),
        entity_id     INTEGER,
        details       JSONB,
        ip_address    VARCHAR(45),
        location      VARCHAR(255),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS location VARCHAR(255);
    `);

    // 6. Ensure system_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      INSERT INTO system_settings (key, value) VALUES ('default_monthly_contribution', '10.00')
      ON CONFLICT (key) DO NOTHING;
      INSERT INTO system_settings (key, value) VALUES ('church_stamp_url', '')
      ON CONFLICT (key) DO NOTHING;
      INSERT INTO system_settings (key, value) VALUES ('authorized_signature_url', '')
      ON CONFLICT (key) DO NOTHING;
    `);

    // 7. Ensure Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_first_child_id ON users(first_child_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_mini_admin_id ON users(mini_admin_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_category ON contributions(category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_batch_id ON contributions(batch_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_contributions_mini_admin ON contributions(assigned_mini_admin_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);`);

    console.log('✅ DB schema auto-migration completed successfully!');
  } catch (err) {
    console.error('⚠️ Auto migration warning:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runAutoMigrations };
