const app = require('./app');
const pool = require('./db/pool');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Test DB connection
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');

    app.listen(PORT, () => {
      console.log(`🚀 EOS Church API running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }
}

start();
