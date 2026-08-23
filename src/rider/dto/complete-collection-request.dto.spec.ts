import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteCollectionRequestDto } from './complete-collection-request.dto';

describe('CompleteCollectionRequestDto – weightKg validation', () => {
  const make = (weightKg: unknown) =>
    plainToInstance(CompleteCollectionRequestDto, {
      vehicleId: '00000000-0000-0000-0000-000000000001',
      weightKg,
    });

  it.each([2.75, 0.5, 5, 2.005, 2.05, 2.999, 0.001, 0.1, 100])(
    'accepts weightKg = %s',
    async (w) => {
      const errors = await validate(make(w));
      const weightErrors = errors.filter((e) => e.property === 'weightKg');
      expect(weightErrors).toHaveLength(0);
    },
  );

  it.each([0, -1, -0.001])(
    'rejects non-positive weightKg = %s',
    async (w) => {
      const errors = await validate(make(w));
      const weightErrors = errors.filter((e) => e.property === 'weightKg');
      expect(weightErrors.length).toBeGreaterThan(0);
    },
  );

  it('rejects more than 3 decimal places', async () => {
    const errors = await validate(make(2.0001));
    const weightErrors = errors.filter((e) => e.property === 'weightKg');
    expect(weightErrors.length).toBeGreaterThan(0);
  });

  it('rejects non-numeric text', async () => {
    const errors = await validate(make('abc'));
    const weightErrors = errors.filter((e) => e.property === 'weightKg');
    expect(weightErrors.length).toBeGreaterThan(0);
  });

  it('rejects null', async () => {
    const errors = await validate(make(null));
    const weightErrors = errors.filter((e) => e.property === 'weightKg');
    expect(weightErrors.length).toBeGreaterThan(0);
  });

  it('rejects undefined', async () => {
    const errors = await validate(make(undefined));
    const weightErrors = errors.filter((e) => e.property === 'weightKg');
    expect(weightErrors.length).toBeGreaterThan(0);
  });
});