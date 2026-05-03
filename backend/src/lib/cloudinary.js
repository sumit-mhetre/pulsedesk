// Cloudinary SDK wrapper. Reads creds from env, exposes upload + delete helpers.
//
// Env vars (set in Render → Environment tab, also in backend/.env.development):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
//
// If env vars are missing, calls will throw a clear error rather than silently fail.

const cloudinary = require('cloudinary').v2;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary env vars not set (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key:    CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure:     true,
  });
  configured = true;
}

// Folder layout in Cloudinary: simplerx/<kind>/<entityId>/<random>
//   kind = 'logo' | 'footer' | 'letterhead' | 'signature' | 'stamp'
//   entityId = clinicId or userId
//
// processing modes:
//   'original'      → resize-only (max 1600px wide, keep alpha)
//   'auto-clean'    → background removal + transparent + crisp edges
//   'high-contrast' → grayscale + threshold for fax-style faded prints

function transformationsFor(processing) {
  switch (processing) {
    case 'auto-clean':
      // 'background_removal' is a paid Cloudinary add-on. Approximate it with:
      //   - extract dominant color region (auto-trim)
      //   - threshold to remove near-white background
      //   - keep transparent PNG output
      return [
        { width: 1200, crop: 'limit' },
        { effect: 'trim:10' },                // crops uniform background bands
        { effect: 'grayscale' },              // collapse colours to gray
        { effect: 'contrast:60' },
        { effect: 'threshold:200' },          // anything lighter than 200 → white
        { effect: 'make_transparent:30:white' },  // turn white into transparent
        { fetch_format: 'png' },
        { quality: 'auto' },
      ];
    case 'high-contrast':
      return [
        { width: 1200, crop: 'limit' },
        { effect: 'trim:10' },
        { effect: 'grayscale' },
        { effect: 'contrast:80' },
        { effect: 'sharpen:200' },
        { fetch_format: 'png' },
        { quality: 'auto' },
      ];
    case 'original':
    default:
      return [
        { width: 1600, crop: 'limit' },       // cap dimension, preserve everything else
        { fetch_format: 'auto' },
        { quality: 'auto' },
      ];
  }
}

/**
 * Upload a buffer to Cloudinary.
 *
 * @param {Buffer} buffer       — file bytes
 * @param {object} opts
 *   - kind        'logo'|'footer'|'letterhead'|'signature'|'stamp'
 *   - entityId    clinicId or userId (used for folder pathing)
 *   - processing  'original'|'auto-clean'|'high-contrast'
 *   - filename    optional original filename (helps Cloudinary detect type)
 * @returns {Promise<{secure_url, public_id, width, height, bytes, format}>}
 */
async function uploadBuffer(buffer, { kind, entityId, processing = 'original', filename = '' } = {}) {
  ensureConfigured();
  if (!kind || !entityId) throw new Error('uploadBuffer requires { kind, entityId }');

  const folder = `simplerx/${kind}/${entityId}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: transformationsFor(processing),
        // Random unique public_id per upload — avoids stale cached collisions
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('Cloudinary returned no result'));
        resolve({
          secure_url: result.secure_url,
          public_id:  result.public_id,
          width:      result.width,
          height:     result.height,
          bytes:      result.bytes,
          format:     result.format,
        });
      }
    );
    stream.end(buffer);
  });
}

/** Delete a file by its public_id. Best-effort — swallows errors. */
async function deleteByPublicId(publicId, resourceType = 'image') {
  if (!publicId) return false;
  try {
    ensureConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return true;
  } catch (err) {
    console.warn('[cloudinary delete]', err?.message || err);
    return false;
  }
}

/**
 * Upload an arbitrary file (image OR pdf) without image transformations.
 * Used for prescription attachments where we want the file preserved as-is.
 *
 * @param {Buffer} buffer
 * @param {object} opts
 *   - kind        e.g. 'rx-attachment'
 *   - entityId    prescriptionId
 *   - mimeType    e.g. 'application/pdf', 'image/jpeg'
 *   - filename    original filename (preserved in public_id where possible)
 * @returns {Promise<{secure_url, public_id, bytes, format, resource_type}>}
 */
async function uploadRaw(buffer, { kind, entityId, mimeType = '', filename = '' } = {}) {
  ensureConfigured();
  if (!kind || !entityId) throw new Error('uploadRaw requires { kind, entityId }');

  const folder = `simplerx/${kind}/${entityId}`;
  // 'auto' lets Cloudinary pick image vs raw based on the file. PDFs go to
  // 'image' resource type with format='pdf' (Cloudinary treats PDFs as
  // image-renderable). For other types (docx etc) we'd use 'raw'.
  // We stick to image for jpg/png/pdf because that allows preview-via-URL.
  const resourceType = mimeType === 'application/pdf' || mimeType.startsWith('image/')
    ? 'image'
    : 'raw';

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        // No transformations — preserve the original file.
        use_filename:    true,
        unique_filename: true,
        overwrite:       false,
      },
      (err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('Cloudinary returned no result'));
        resolve({
          secure_url:    result.secure_url,
          public_id:     result.public_id,
          bytes:         result.bytes,
          format:        result.format,
          resource_type: result.resource_type,
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Cloudinary URLs encode the public_id between '/upload/' (sometimes with version) and the file extension.
 * Examples:
 *   https://res.cloudinary.com/x/image/upload/v123456/folder/abc.png  →  folder/abc
 *   https://res.cloudinary.com/x/image/upload/folder/abc.png          →  folder/abc
 */
function publicIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+(?:\?.*)?$/i);
  return m ? m[1] : null;
}

module.exports = { uploadBuffer, uploadRaw, deleteByPublicId, publicIdFromUrl };
