import { BadRequestException } from '@nestjs/common';
import { posix } from 'path';

export function sanitizePath(input: string): string {
  if (!input) return '/';

  // Normalize and resolve the path
  const normalized = posix.normalize(input);

  // Reject absolute paths that escape root or contain traversal
  if (normalized.includes('..')) {
    throw new BadRequestException('Path traversal is not allowed');
  }

  // Reject null bytes
  if (input.includes('\0')) {
    throw new BadRequestException('Invalid path');
  }

  return normalized;
}
