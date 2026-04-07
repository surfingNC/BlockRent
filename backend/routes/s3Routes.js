import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3 from '../s3Client.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function sanitizeExt(fileName = '') {
  const ext = path.extname(String(fileName)).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') return ext;
  return '';
}

/**
 * GET /api/s3/upload-url?fileName=...&fileType=...
 * Returns a short-lived pre-signed URL for direct-to-S3 uploads.
 *
 * Production hardening:
 * - Requires authentication
 * - Restricts MIME types
 * - Server generates object key (does not trust client fileName as S3 key)
 */
router.get('/upload-url', authMiddleware, async (req, res) => {
  try {
    const fileName = String(req.query.fileName || '');
    const fileType = String(req.query.fileType || '');

    if (!fileName || !fileType) {
      return res.status(400).json({ error: 'Missing fileName or fileType' });
    }

    if (!process.env.S3_BUCKET_NAME) {
      return res.status(500).json({ error: 'S3_BUCKET_NAME not configured' });
    }

    if (!ALLOWED_MIME.has(fileType)) {
      return res.status(400).json({ error: 'Unsupported fileType' });
    }

    const ext = sanitizeExt(fileName);
    if (!ext) {
      return res.status(400).json({ error: 'Unsupported file extension' });
    }

    const userId = req.user?.id || 'anonymous';
    const key = `uploads/${userId}/${Date.now()}-${crypto.randomUUID()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    return res.json({ uploadUrl, key });
  } catch (err) {
    console.error('❌ S3 upload-url error:', err);
    return res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

export default router;
