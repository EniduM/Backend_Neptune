import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { login: jest.Mock; getProfile: jest.Mock };

  beforeEach(() => {
    authService = {
      login: jest.fn(),
      getProfile: jest.fn(),
    };

    controller = new AuthController(authService as never);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login with loginId and password', async () => {
      authService.login.mockResolvedValue({
        accessToken: 'token',
        user: { id: '1', loginId: 'ADMIN001', role: 'ADMIN', status: 'ACTIVE' },
      });

      const result = await controller.login({
        loginId: 'ADMIN001',
        password: 'password123',
      });

      expect(authService.login).toHaveBeenCalledWith('ADMIN001', 'password123');
      expect(result).toHaveProperty('accessToken', 'token');
    });
  });

  describe('getMe', () => {
    it('should call authService.getProfile with user id and role', async () => {
      authService.getProfile.mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
      });

      const result = await controller.getMe({
        user: { id: 'user-1', loginId: 'ADMIN001', role: 'ADMIN' },
      } as never);

      expect(authService.getProfile).toHaveBeenCalledWith('user-1', 'ADMIN');
      expect(result).toEqual({ id: 'user-1', role: 'ADMIN' });
    });
  });
});
