import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';

@ValidatorConstraint({ name: 'maxDecimals', async: false })
export class MaxDecimalsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    const max = args.constraints[0] as number;
    const str = String(value);
    const decimalPart = str.includes('.') ? str.split('.')[1] : '';
    return decimalPart.length <= max;
  }

  defaultMessage(args: ValidationArguments): string {
    const max = args.constraints[0];
    return `must have at most ${max} decimal places`;
  }
}

export function MaxDecimals(maxDecimals: number) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxDecimals',
      target: object.constructor,
      propertyName,
      constraints: [maxDecimals],
      validator: MaxDecimalsConstraint,
    });
  };
}