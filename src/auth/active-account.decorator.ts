import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ACTIVE_ACCOUNT_KEY = 'requireActiveAccount';
export const RequireActiveAccount = () =>
  SetMetadata(REQUIRE_ACTIVE_ACCOUNT_KEY, true);