/**
 * Unit tests for signed Cloudinary avatar uploads: only the server-chosen public id and a
 * valid Cloudinary response signature are accepted.
 */
const { v2: cloudinary } = require('cloudinary');
const uploadService = require('../../src/services/upload.service');

const SECRET = process.env.CLOUDINARY_API_SECRET;
const userId = '64b7f0c2a1b2c3d4e5f60718';

/** Signature Cloudinary would return for an upload. */
const cloudinarySignature = (publicId, version) =>
  cloudinary.utils.api_sign_request({ public_id: publicId, version }, SECRET);

describe('upload.service avatars', () => {
  it('signs upload parameters for the user’s own avatar path', () => {
    const { uploadUrl, fields } = uploadService.createAvatarUploadParams(userId);

    expect(uploadUrl).toBe('https://api.cloudinary.com/v1_1/saathmein-test/image/upload');
    expect(fields.public_id).toBe(`saathmein/avatars/${userId}`);
    expect(fields.api_key).toBe(process.env.CLOUDINARY_API_KEY);
    expect(fields).not.toHaveProperty('api_secret');

    const { signature, api_key: _apiKey, ...signed } = fields;
    expect(signature).toBe(cloudinary.utils.api_sign_request(signed, SECRET));
  });

  it('accepts a correctly signed upload and builds a face-cropped URL', () => {
    const publicId = uploadService.avatarPublicId(userId);
    const result = uploadService.verifyAvatarUpload(userId, {
      publicId,
      version: 1730000000,
      signature: cloudinarySignature(publicId, 1730000000),
    });

    expect(result.publicId).toBe(publicId);
    expect(result.url).toContain('res.cloudinary.com/saathmein-test');
    expect(result.url).toContain('g_face');
  });

  it('rejects another user’s image and forged signatures', () => {
    const otherPublicId = uploadService.avatarPublicId('ffffffffffffffffffffffff');
    expect(() =>
      uploadService.verifyAvatarUpload(userId, {
        publicId: otherPublicId,
        version: 1,
        signature: cloudinarySignature(otherPublicId, 1),
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_UPLOAD' }));

    expect(() =>
      uploadService.verifyAvatarUpload(userId, {
        publicId: uploadService.avatarPublicId(userId),
        version: 1,
        signature: 'a'.repeat(40),
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_UPLOAD' }));
  });
});
