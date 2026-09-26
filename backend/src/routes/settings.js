const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadAvatar } = require('../services/minio');

const router = express.Router();

// ── Audio upload setup (unchanged) ───────────────────────────────────────────
const audioDir = path.join(__dirname, '../../../frontend/public/uploads/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, audioDir); },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp3';
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `classical_${Date.now()}_${baseName}${ext}`);
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|ogg|m4a|flac)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file format. Allowed: .mp3, .wav, .ogg, .m4a, .flac'));
    }
  },
});

// Multer memory storage for image assets (stamp / signature)
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted for stamp/signature'));
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/login-classical  (public)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/contribution-settings  (public — needed by client-side PDF)
// Returns: { default_monthly_contribution, church_stamp_url, authorized_signature_url }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/contribution-settings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value FROM system_settings
       WHERE key IN ('default_monthly_contribution', 'church_stamp_url', 'authorized_signature_url')`
    );
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json({
      default_monthly_contribution: parseFloat(settings.default_monthly_contribution || '10.00'),
      church_stamp_url: settings.church_stamp_url || null,
      authorized_signature_url: settings.authorized_signature_url || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch contribution settings' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/contribution-fee  (admin / superadmin)
// Body: { amount: 15.00 }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/contribution-fee', authenticate, requireRole('superadmin', 'admin'), async (req, res) => {
  const { amount } = req.body;
  if (amount == null || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  try {
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ('default_monthly_contribution', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(parseFloat(amount))]
    );
    res.json({ message: 'Default monthly contribution updated', amount: parseFloat(amount) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update contribution fee' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/assets  (admin / superadmin)
// Uploads church_stamp or authorized_signature image to MinIO / local storage.
// Form field: "asset_type" = "church_stamp" | "authorized_signature"
// File field: "image"
// Also accepts base64: body.base64 + body.mimetype (for camera capture)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/assets', authenticate, requireRole('superadmin', 'admin'), (req, res) => {
  imageUpload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { asset_type, base64, mimetype } = req.body;

    if (!asset_type || !['church_stamp', 'authorized_signature'].includes(asset_type)) {
      return res.status(400).json({ error: 'asset_type must be "church_stamp" or "authorized_signature"' });
    }

    const settingKey = asset_type === 'church_stamp' ? 'church_stamp_url' : 'authorized_signature_url';

    try {
      let imageUrl;

      if (req.file) {
        // Uploaded via multipart
        imageUrl = await uploadAvatar(req.file);
      } else if (base64) {
        // Camera capture: base64 string
        const imgMime = mimetype || 'image/png';
        const ext = imgMime.split('/')[1] || 'png';
        const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const fakeFile = {
          buffer,
          originalname: `${asset_type}_capture.${ext}`,
          mimetype: imgMime,
          size: buffer.length,
        };
        imageUrl = await uploadAvatar(fakeFile);
      } else {
        return res.status(400).json({ error: 'Provide either a file upload or base64 image data' });
      }

      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2`,
        [settingKey, imageUrl]
      );

      res.json({ message: `${asset_type} updated successfully`, url: imageUrl });
    } catch (uploadErr) {
      console.error('Asset upload error:', uploadErr);
      res.status(500).json({ error: 'Failed to upload asset' });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/login-classical  (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/login-classical', authenticate, requireRole('superadmin'), async (req, res) => {
  const { track, custom_url } = req.body;
  const newValue = JSON.stringify({
    track: track || 'custom_audio',
    custom_url: custom_url || '/assets/audio/orthodox_classical.mp3',
  });
  try {
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ('login_classical_track', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [newValue]
    );
    res.json({ message: 'Classical music setting updated', setting: JSON.parse(newValue) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/settings/upload-audio  (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload-audio', authenticate, requireRole('superadmin'), (req, res) => {
  audioUpload.single('audio')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Audio upload failed' });
    if (!req.file) return res.status(400).json({ error: 'No audio file provided' });

    const fileUrl = `/uploads/audio/${req.file.filename}`;
    const newValue = JSON.stringify({ track: 'custom_audio', custom_url: fileUrl });

    try {
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ('login_classical_track', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [newValue]
      );
      res.json({
        message: 'Audio file imported and set as active classical track',
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
