import { BadRequestException } from '@nestjs/common';

export const NIC_REGEX = /^(?:\d{9}[VvXx]|\d{12})$/;

export function normalizeNic(value: unknown): string {
  if (value === undefined || value === null) {
    return value as never;
  }

  const trimmed = String(value).trim();

  if (!NIC_REGEX.test(trimmed)) {
    throw new BadRequestException('Invalid NIC format');
  }

  return trimmed.length === 12 ? trimmed : trimmed.toUpperCase();
}