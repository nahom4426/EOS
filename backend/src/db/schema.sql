-- Ethiopian Orthodox Church Contribution Management System
-- PostgreSQL Schema

-- Enable UUID extension (optional, using SERIAL for simplicity)
-- DROP existing types/tables if re-running
DROP TABLE IF EXISTS contributions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Enum for user roles
CREATE TYPE user_role AS ENUM ('superadmin', 'branch_admin', 'member');

-- Branches table
CREATE TABLE branches (
  id        SERIAL PRIMARY KEY,
  name      VARCHAR(255) NOT NULL,
  location  VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
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


-- Contributions table
CREATE TABLE contributions (
  id            SERIAL PRIMARY KEY,
  member_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id     INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  amount        DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  category      VARCHAR(100) NOT NULL DEFAULT 'Monthly Dues',
  month_covered DATE NOT NULL,         -- first-of-month convention: 2026-09-01
  date_paid     DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by   INTEGER NOT NULL REFERENCES users(id),
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs table
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

-- Indexes for common queries
CREATE INDEX idx_contributions_member_id ON contributions(member_id);
CREATE INDEX idx_contributions_branch_id ON contributions(branch_id);
CREATE INDEX idx_contributions_month_covered ON contributions(month_covered);
CREATE INDEX idx_contributions_category ON contributions(category);
CREATE INDEX idx_users_branch_id ON users(branch_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

