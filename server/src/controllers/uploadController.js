import multer from 'multer';
import { uploadBuffer, destroyAsset, isCloudinaryConfigured } from '../config/cloudinary.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError, badRequest } from '../utils/ApiError.js';

const ALLOWED = /^(image\/(jpeg|png|webp|gif|avif)|video\/(mp4|webm|quicktime))$/;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.test(file.mimetype)) return cb(badRequest('Only JPG, PNG, WEBP, GIF, AVIF images or MP4/WEBM videos are allowed'));
    cb(null, true);
  },
});

const shape = (r) => ({
  url: r.secure_url,
  publicId: r.public_id,
  resourceType: r.resource_type === 'video' ? 'video' : 'image',
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  format: r.format,
});

/** POST /api/admin/upload  (multipart: files[]) ?folder=gallery|services|barbers|branding */
export const uploadMedia = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured()) throw badRequest('Cloudinary is not configured on the server (.env)');
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];
  if (!files.length) throw badRequest('No file received');
  const sub = String(req.query.folder || 'misc').replace(/[^a-z0-9_-]/gi, '');
  const folder = `${env.cloudinary.folder}/${sub}`;
  let results;
  try {
    results = await Promise.all(
      files.map((f) => uploadBuffer(f.buffer, { folder, resourceType: f.mimetype.startsWith('video') ? 'video' : 'image' })),
    );
  } catch (err) {
    const code = err?.http_code || err?.error?.http_code;
    const detail = err?.error?.message || err?.message || 'unknown error';
    if (code === 403) {
      throw new ApiError(502, 'Cloudinary refused the upload: this API key has no upload permission. In Cloudinary Console > Settings > Access Keys use the root key or enable upload rights, then update CLOUDINARY_API_KEY/SECRET.');
    }
    if (code === 401) throw new ApiError(502, 'Cloudinary rejected the credentials. Check CLOUDINARY_CLOUD_NAME, API_KEY and API_SECRET in .env.');
    throw new ApiError(502, `Cloudinary upload failed (${code || 'network'}): ${detail}`);
  }
  const media = results.map(shape);
  res.status(201).json({ success: true, media, file: media[0] });
});

export const deleteMedia = asyncHandler(async (req, res) => {
  const { publicId, resourceType = 'image' } = req.body;
  if (!publicId) throw badRequest('publicId required');
  await destroyAsset(publicId, resourceType);
  res.json({ success: true });
});
