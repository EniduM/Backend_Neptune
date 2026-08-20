import { BadRequestException } from '@nestjs/common';
import { normalizeNic } from './nic.util';

describe('normalizeNic', () => {
  it.each(['123456789V', '123456789X', '123456789v', '123456789x'])(
    'accepts old-format NIC %s and uppercases the letter',
    (raw) => {
      expect(normalizeNic(raw)).toBe(raw.toUpperCase());
    },
  );

  it('accepts new-format 12-digit NIC unchanged', () => {
    expect(normalizeNic('200012345678')).toBe('200012345678');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeNic('  123456789v  ')).toBe('123456789V');
    expect(normalizeNic(' 123456789X')).toBe('123456789X');
    expect(normalizeNic('200012345678 ')).toBe('200012345678');
  });

  it.each([
    '123456789',
    '1234567890',
    '12345678V',
    '123456789VV',
    '123456789A',
    '20001234567',
    '2000123456789',
    '2000ABC45678',
    '',
    '123456789 V',
    '123 4567890',
  ])('rejects invalid NIC %s', (raw) => {
    expect(() => normalizeNic(raw)).toThrow(BadRequestException);
  });

  it('returns undefined as-is for optional update fields', () => {
    expect(normalizeNic(undefined)).toBeUndefined();
  });

  it('does not strip characters from inside the NIC', () => {
    expect(() => normalizeNic('123 456789V')).toThrow(BadRequestException);
    expect(() => normalizeNic('12A345678V')).toThrow(BadRequestException);
  });
});