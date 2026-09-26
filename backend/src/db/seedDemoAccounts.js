/**
 * Demo Accounts Seeder
 * Creates demo accounts for Mini-Admin and First Child roles
 * for development/demo quick-fill login buttons.
 *
 * Run: node src/db/seedDemoAccounts.js
 *
 * Credentials:
 *   Branch Admin  : 0922000001 / BranchAdmin@1   (already seeded via branch creation)
 *   Mini-Admin    : 0922000010 / MiniAdmin@1
 *   First Child   : 0933000020 / FirstChild@1
 *   Member        : 0933000002 / Member@1         (already seeded)
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seedDemoAccounts() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding demo accounts...\n');

    // ------------------------------------------------------------------
    // Find first available branch for linking
    // ------------------------------------------------------------------
    const branchRes = await client.query(
      `SELECT id, name FROM branches ORDER BY id LIMIT 1`
    );
    if (branchRes.rows.length === 0) {
      console.error('❌ No branches found. Please create a branch first via the superadmin dashboard.');
      process.exit(1);
    }
    const branch = branchRes.rows[0];
    console.log(`📌 Using branch: ${branch.name} (id=${branch.id})\n`);

    // ------------------------------------------------------------------
    // Ensure a Branch Admin exists for branch (needed as parent for mini-admin)
    // ------------------------------------------------------------------
    let adminId;
    const adminCheck = await client.query(
      `SELECT id FROM users WHERE phone = '0922000001' AND role = 'admin'`
    );
    if (adminCheck.rows.length === 0) {
      const adminHash = await bcrypt.hash('BranchAdmin@1', 12);
      const adminInsert = await client.query(
        `INSERT INTO users (phone, password_hash, full_name, role, branch_id)
         VALUES ($1, $2, $3, 'admin', $4)
         ON CONFLICT (phone) DO UPDATE SET role = 'admin', branch_id = $4
         RETURNING id`,
        ['0922000001', adminHash, 'Demo Branch Admin', branch.id]
      );
      adminId = adminInsert.rows[0].id;
      console.log(`✅ Branch Admin  created: 0922000001 / BranchAdmin@1 (id=${adminId})`);
    } else {
      adminId = adminCheck.rows[0].id;
      console.log(`ℹ️  Branch Admin  already exists: id=${adminId}`);
    }

    // ------------------------------------------------------------------
    // Mini-Admin
    // ------------------------------------------------------------------
    let miniAdminId;
    const maCheck = await client.query(
      `SELECT id FROM users WHERE phone = '0922000010'`
    );
    if (maCheck.rows.length === 0) {
      const maHash = await bcrypt.hash('MiniAdmin@1', 12);
      const maInsert = await client.query(
        `INSERT INTO users (phone, password_hash, full_name, role, branch_id)
         VALUES ($1, $2, $3, 'mini_admin', $4)
         RETURNING id`,
        ['0922000010', maHash, 'Demo Mini-Admin', branch.id]
      );
      miniAdminId = maInsert.rows[0].id;
      console.log(`✅ Mini-Admin    created: 0922000010 / MiniAdmin@1  (id=${miniAdminId})`);
    } else {
      miniAdminId = maCheck.rows[0].id;
      console.log(`ℹ️  Mini-Admin    already exists: id=${miniAdminId}`);
    }

    // ------------------------------------------------------------------
    // First Child — linked to mini-admin above
    // ------------------------------------------------------------------
    const fcCheck = await client.query(
      `SELECT id FROM users WHERE phone = '0933000020'`
    );
    if (fcCheck.rows.length === 0) {
      const fcHash = await bcrypt.hash('FirstChild@1', 12);
      const fcInsert = await client.query(
        `INSERT INTO users (phone, password_hash, full_name, role, branch_id, mini_admin_id)
         VALUES ($1, $2, $3, 'first_child', $4, $5)
         RETURNING id`,
        ['0933000020', fcHash, 'Demo First Child', branch.id, miniAdminId]
      );
      console.log(`✅ First Child   created: 0933000020 / FirstChild@1 (id=${fcInsert.rows[0].id}, mini_admin_id=${miniAdminId})`);
    } else {
      console.log(`ℹ️  First Child   already exists`);
    }

    // ------------------------------------------------------------------
    // Member
    // ------------------------------------------------------------------
    const memberCheck = await client.query(
      `SELECT id FROM users WHERE phone = '0933000002'`
    );
    if (memberCheck.rows.length === 0) {
      const memberHash = await bcrypt.hash('Member@1', 12);
      await client.query(
        `INSERT INTO users (phone, password_hash, full_name, role, branch_id)
         VALUES ($1, $2, $3, 'member', $4)`,
        ['0933000002', memberHash, 'Demo Member', branch.id]
      );
      console.log(`✅ Member        created: 0933000002 / Member@1`);
    } else {
      console.log(`ℹ️  Member        already exists`);
    }

    console.log('\n🎉 Demo accounts seeded successfully!');
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  QUICK LOGIN CREDENTIALS                                 ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║  👑 Superadmin  : 0911000000 / Admin@1234                ║');
    console.log('║  🏛️ Branch Admin : 0922000001 / BranchAdmin@1            ║');
    console.log('║  📦 Mini-Admin  : 0922000010 / MiniAdmin@1               ║');
    console.log('║  👨‍👩‍👧‍👦 First Child : 0933000020 / FirstChild@1            ║');
    console.log('║  👤 Member      : 0933000002 / Member@1                  ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
  } catch (err) {
    console.error('\n❌ Seeding failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoAccounts();
