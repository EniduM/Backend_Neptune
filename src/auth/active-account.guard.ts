import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRE_ACTIVE_ACCOUNT_KEY } from './active-account.decorator';

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ACTIVE_ACCOUNT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { id: string } | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { status: true },
    });

    if (!dbUser || dbUser.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your account is currently deactivated. You cannot perform this action.',
      );
    }

    return true;
  }
}