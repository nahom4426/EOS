const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Ensure audio uploads folder exists in backend public uploads directory
const audioDir = path.join(__dirname, '../../public/uploads/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `classical_${Date.now()}_${baseName}${ext}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file format. Allowed formats: .mp3, .wav, .ogg, .m4a'));
    }
  },
});

/**
 * GET /api/settings/login-classical
 * Public endpoint to fetch currently active login classical music setting
 */
router.get('/login-classical', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'login_classical_track'`
    );
    const value = result.rows.length
      ? JSON.parse(result.rows[0].value)
      : { track: 'custom_audio', custom_url: '/assets/audio/orthodox_classical.mp3' };
    res.json(value);
  } catch (err) {
    console.error(err);
    res.json({ track: 'custom_audio', custom_url: '/assets/audio/orthodox_classical.mp3' });
  }
});

/**
 * PUT /api/settings/login-classical
 * Superadmin only endpoint to choose or change classical track setting
 */
router.put('/login-classical', authenticate, requireRole('superadmin'), async (req, res) => {
  const { track, custom_url } = req.body;
  const newValue = JSON.stringify({
    track: track || 'custom_audio',
    custom_url: custom_url || '/assets/audio/orthodox_classical.mp3',
  });

  try {
    await pool.query(
      `INSERT INTO system_settings (key, value)
       VALUES ('login_classical_track', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [newValue]
    );
    res.json({ message: 'Classical music setting updated successfully', setting: JSON.parse(newValue) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

/**
 * POST /api/settings/upload-audio
 * Superadmin only endpoint to import/upload audio file
 */
router.post('/upload-audio', authenticate, requireRole('superadmin'), (req, res) => {
  audioUpload.single('audio')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Audio upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const fileUrl = `/uploads/audio/${req.file.filename}`;
    const newValue = JSON.stringify({
      track: 'custom_audio',
      custom_url: fileUrl,
    });

    try {
      await pool.query(
        `INSERT INTO system_settings (key, value)
         VALUES ('login_classical_track', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [newValue]
      );
      res.json({
        message: 'Audio file imported and set as active classical track successfully',
        custom_url: fileUrl,
        setting: JSON.parse(newValue),
      });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Failed to update system settings after audio upload' });
    }
  });
});

module.exports = router;

