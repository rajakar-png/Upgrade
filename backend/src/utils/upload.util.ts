import { BadRequestException } from '@nestjs/common';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const IMAGE_MAGIC_BYTES: { ext: string; bytes: number[] }[] = [
  { ext: '.jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: '.png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: '.gif', bytes: [0x47, 0x49, 0x46] },
  { ext: '.webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header
];

function hasValidMagicBytes(buffer: Buffer): boolean {
  return IMAGE_MAGIC_BYTES.some(({ bytes }) =>
    bytes.every((b, i) => buffer[i] === b),
  );
}

export function imageFileFilter(
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  // Check MIME type
  if (!file.mimetype.startsWith('image/')) {
    return cb(new BadRequestException('Only images allowed'), false);
  }

  // Check extension whitelist
  const ext = '.' + (file.originalname.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new BadRequestException(`File extension ${ext} is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`), false);
  }

  cb(null, true);
}

export async function validateImageBuffer(buffer: Buffer): Promise<void> {
  if (!buffer || buffer.length < 4) {
    throw new BadRequestException('File is too small to be a valid image');
  }
  if (!hasValidMagicBytes(buffer)) {
    throw new BadRequestException('File content does not match a valid image format');
  }
}
