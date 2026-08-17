import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body()
    body: {
      loginId: string;
      password: string;
    },
  ) {
    return this.authService.login(body.loginId, body.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() request: Request) {
    const user = request.user as { id: string; loginId: string; role: string };
    return this.authService.getProfile(user.id, user.role);
  }

  @Get('admin-test')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  adminTest(@Req() request: Request) {
    return {
      message: 'You have access to the admin endpoint',
      user: request.user,
    };
  }
}
