require('dotenv').config();
const pool = require('./pool');

async function migrate() {
  try {
    console.log('🔄 Running database migrations for is_active user status...');

    // Add is_active column to users table if it doesn't exist
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);
    console.log('✅ Column "is_active" ensured on "users" table.');

    // Add category column to contributions table if it doesn't exist
    await pool.query(`
      ALTER TABLE contributions 
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'Monthly Dues';
    `);
    console.log('✅ Column "category" ensured on "contributions" table.');

    // Create audit_logs table
    await pool.query(`
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

      ALTER TABLE audit_logs 
      ADD COLUMN IF NOT EXISTS location VARCHAR(255);
    `);
    console.log('✅ Table "audit_logs" and "location" column ensured.');

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contributions_category ON contributions(category);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);`);
    console.log('✅ Indexes created successfully.');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
