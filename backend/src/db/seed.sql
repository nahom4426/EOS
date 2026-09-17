-- Seed: initial superadmin account
-- Phone: 0911000000 | Password: Admin@1234 (bcrypt hash below)
-- Hash generated with bcrypt rounds=12

INSERT INTO users (phone, password_hash, full_name, role, branch_id)
VALUES (
  '0911000000',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpP8ErtJGCB/dW',  -- Admin@1234
  'System Superadmin',
  'superadmin',
  NULL
)
ON CONFLICT (phone) DO NOTHING;
