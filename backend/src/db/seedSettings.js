const pool = require('./pool');

async function seedSettings() {
  try {
    const val = JSON.stringify({
      track: 'custom_audio',
      custom_url: '/assets/audio/orthodox_classical.mp3',
    });

    await pool.query(
      `INSERT INTO system_settings (key, value)
       VALUES ('login_classical_track', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [val]
    );

    console.log('✅ Classical audio settings updated in DB!');
  } catch (err) {
    console.error('❌ Settings update failed:', err);
  } finally {
    await pool.end();
  }
}

seedSettings();
