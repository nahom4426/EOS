const Minio = require('minio');
const fs = require('fs');
const path = require('path');

// Read MinIO configuration from environment variables with sensible defaults
const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = parseInt(process.env.MINIO_PORT || '9000', 10);
const useSSL = process.env.MINIO_USE_SSL === 'true';
const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const bucketName = process.env.MINIO_BUCKET || 'eos-members';

// Initialize MinIO client
let minioClient = null;
try {
  minioClient = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });
} catch (err) {
  console.warn('⚠️ MinIO client initialization warning:', err.message);
}

// Local fallback upload folder
const uploadDir = path.join(__dirname, '../../public/uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Ensures bucket exists and has public read policy
 */
async function ensureBucket() {
  if (!minioClient) return false;
  try {
    const exists = await minioClient.bucketExists(bucketName);
    if (!exists) {
      await minioClient.makeBucket(bucketName);
      console.log(`✅ Created MinIO bucket: ${bucketName}`);
      
      // Set public read policy on bucket
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
    }
    return true;
  } catch (err) {
    console.warn(`⚠️ MinIO bucket check failed (${err.message}). Using local storage fallback.`);
    return false;
  }
}

/**
 * Uploads avatar image file to MinIO (or local fallback)
 * @param {Object} file - Express Multer file object
 * @returns {Promise<string>} Public image URL
 */
async function uploadAvatar(file) {
  if (!file) return null;

  const ext = path.extname(file.originalname).toLowerCase() || '.png';
  const filename = `avatar-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

  // Attempt MinIO Upload first
  try {
    const isMinioReady = await ensureBucket();
    if (isMinioReady) {
      await minioClient.putObject(
        bucketName,
        filename,
        file.buffer,
        file.size,
        { 'Content-Type': file.mimetype }
      );
      const protocol = useSSL ? 'https' : 'http';
      const publicUrl = `${protocol}://${endPoint}:${port}/${bucketName}/${filename}`;
      console.log(`📸 Profile photo uploaded to MinIO: ${publicUrl}`);
      return publicUrl;
    }
  } catch (err) {
    console.warn(`⚠️ MinIO upload failed (${err.message}). Falling back to local storage.`);
  }

  // Fallback: Save to local public/uploads/avatars folder
  const localFilePath = path.join(uploadDir, filename);
  fs.writeFileSync(localFilePath, file.buffer);
  const localUrl = `/uploads/avatars/${filename}`;
  console.log(`📁 Profile photo saved locally: ${localUrl}`);
  return localUrl;
}

module.exports = {
  minioClient,
  uploadAvatar,
};
