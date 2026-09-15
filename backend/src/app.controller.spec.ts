import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return status ok', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });
  });

  describe('health/db', () => {
    it('should report primary host kind without secrets or hostnames', () => {
      const status = appController.getDatabaseHealth();
      expect(status.policy.expectedPrimary).toBe('supabase');
      expect(status.primary).toHaveProperty('kind');
      expect(status.primary).not.toHaveProperty('host');
      expect(status.primary).not.toHaveProperty('allowRailwayPrimary');
      expect(status.backup).toHaveProperty('configured');
      expect(status.backup).not.toHaveProperty('host');
    });
  });
});
