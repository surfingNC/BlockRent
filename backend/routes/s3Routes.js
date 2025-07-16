import express from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import s3 from '../s3Client.js';

const router = express.Router();

router.get('/upload-url', async (req, res) => {
  const { fileName, fileType } = req.query;

  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'Missing fileName or fileType' });
  }

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    ContentType: fileType,
  };

  const command = new PutObjectCommand(params);
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

  res.json({ uploadUrl });
});

export default router;