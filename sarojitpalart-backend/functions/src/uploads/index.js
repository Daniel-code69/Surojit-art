const express = require('express');
const { z } = require('zod');
const { admin, storage, config } = require('../config');
const { validate } = require('../middleware/validate');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /uploads/thumbnail - Admin: generate signed upload URL
router.post('/thumbnail', verifyAdmin, validate(z.object({
  fileName: z.string().min(1),
  contentType: z.string().regex(/^image\//).optional(),
})), async (req, res, next) => {
  try {
    const { fileName, contentType } = req.body;
    const bucket = storage.bucket();

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `thumbnails/${timestamp}_${sanitizedName}`;
    const file = bucket.file(filePath);

    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

    const [uploadUrl] = await file.getSignedUrl({
      action: 'write',
      expires,
      contentType: contentType || 'image/jpeg',
    });

    const finalUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    res.json({
      uploadUrl,
      finalUrl,
      filePath,
      expires: new Date(expires).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// Alternative: POST /uploads/base64 - Admin: upload via base64
router.post('/base64', verifyAdmin, validate(z.object({
  imageData: z.string().min(1), // base64 string
  fileName: z.string().min(1).optional(),
})), async (req, res, next) => {
  try {
    const { imageData, fileName } = req.body;
    const bucket = storage.bucket();

    // Decode base64
    const matches = imageData.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    let buffer;
    let contentType = 'image/jpeg';

    if (matches) {
      contentType = `image/${matches[1]}`;
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(imageData, 'base64');
    }

    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image exceeds 5MB limit' });
    }

    const sanitizedName = (fileName || 'upload.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `thumbnails/${timestamp}_${sanitizedName}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType },
      public: true,
    });

    const finalUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    res.json({
      finalUrl,
      filePath,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
