import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('admin login returns a JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.role).toBe('ADMIN');
  });

  it('lists cashiers publicly with no password/PIN fields', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/cashiers').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const cashier of res.body) {
      expect(Object.keys(cashier).sort()).toEqual(['id', 'name']);
    }
  });

  it('rejects a wrong admin password', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'wrong' })
      .expect(401);
  });

  it('cashier PIN login returns a JWT', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    const cashierId = await findCashierId(app);

    const res = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ userId: cashierId, pin: '1234' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.role).toBe('CASHIER');
    void adminLogin;
  });

  it('rejects a cashier token on an admin-only route', async () => {
    const cashierId = await findCashierId(app);
    const login = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ userId: cashierId, pin: '1234' });

    return request(app.getHttpServer())
      .get('/api/audit')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  it('rejects a request with no confirmation header on a PIN-guarded route', async () => {
    const cashierId = await findCashierId(app);
    const login = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ userId: cashierId, pin: '1234' });

    return request(app.getHttpServer())
      .patch(`/api/users/${cashierId}/pin`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ pin: '9999' })
      .expect(403);
  });

  async function findCashierId(app: INestApplication<App>): Promise<string> {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    const users = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
    const cashier = users.body.find((u: { role: string }) => u.role === 'CASHIER');
    return cashier.id;
  }
});
