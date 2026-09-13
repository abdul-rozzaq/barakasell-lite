import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Shifts (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let cashierToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    adminToken = login.body.accessToken;

    const users = await request(app.getHttpServer())
      .get('/api/users')
      .set(auth(adminToken));
    const cashier = users.body.find(
      (u: { role: string }) => u.role === 'CASHIER',
    );
    const cashierLogin = await request(app.getHttpServer())
      .post('/api/auth/pin-login')
      .send({ userId: cashier.id, pin: '1234' });
    cashierToken = cashierLogin.body.accessToken;

    // Close any shift left open by a previous test run against this shared DB.
    const current = await request(app.getHttpServer())
      .get('/api/shifts/current')
      .set(auth(cashierToken));
    if (current.body) {
      const pin = await confirmPin(cashierToken);
      await request(app.getHttpServer())
        .post(`/api/shifts/${current.body.id}/close`)
        .set(auth(cashierToken))
        .set('X-Pin-Confirmation', pin)
        .send({ countedCash: Number(current.body.expectedCash) });
    }
  });

  afterEach(async () => {
    await app.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function confirmPin(token: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/confirm-pin')
      .set(auth(token))
      .send({ pin: '1234' });
    return res.body.confirmationToken as string;
  }

  it('opens a shift, blocks a second open, tracks cash movements, and closes with the right diff', async () => {
    const open = await request(app.getHttpServer())
      .post('/api/shifts/open')
      .set(auth(cashierToken))
      .send({ openingCash: 100000 })
      .expect(201);
    expect(open.body.status).toBe('OPEN');
    const shiftId = open.body.id;

    await request(app.getHttpServer())
      .post('/api/shifts/open')
      .set(auth(cashierToken))
      .send({ openingCash: 50000 })
      .expect(409);

    const current = await request(app.getHttpServer())
      .get('/api/shifts/current')
      .set(auth(cashierToken));
    expect(current.body.id).toBe(shiftId);
    expect(Number(current.body.expectedCash)).toBe(100000);

    await request(app.getHttpServer())
      .post(`/api/shifts/${shiftId}/cash-movements`)
      .set(auth(cashierToken))
      .send({ type: 'IN', amount: 5000, reason: 'Qaytim uchun' })
      .expect(403); // no PIN confirmation header

    const pin1 = await confirmPin(cashierToken);
    await request(app.getHttpServer())
      .post(`/api/shifts/${shiftId}/cash-movements`)
      .set(auth(cashierToken))
      .set('X-Pin-Confirmation', pin1)
      .send({ type: 'IN', amount: 5000, reason: 'Qaytim uchun' })
      .expect(201);

    const pin2 = await confirmPin(cashierToken);
    await request(app.getHttpServer())
      .post(`/api/shifts/${shiftId}/cash-movements`)
      .set(auth(cashierToken))
      .set('X-Pin-Confirmation', pin2)
      .send({ type: 'OUT', amount: 2000, reason: 'Kir-yuv uchun' })
      .expect(201);

    const beforeClose = await request(app.getHttpServer())
      .get('/api/shifts/current')
      .set(auth(cashierToken));
    expect(Number(beforeClose.body.expectedCash)).toBe(103000);

    const closed = await request(app.getHttpServer())
      .post(`/api/shifts/${shiftId}/close`)
      .set(auth(cashierToken))
      .send({ countedCash: 103000 })
      .expect(201);
    expect(closed.body.status).toBe('CLOSED');
    expect(Number(closed.body.expectedCash)).toBe(103000);
    expect(Number(closed.body.diffCash)).toBe(0);

    const afterClose = await request(app.getHttpServer())
      .get('/api/shifts/current')
      .set(auth(cashierToken));
    expect(afterClose.body?.id).toBeUndefined();
  });

  it('reports a negative diff when counted cash is short', async () => {
    const open = await request(app.getHttpServer())
      .post('/api/shifts/open')
      .set(auth(cashierToken))
      .send({ openingCash: 20000 })
      .expect(201);

    const closed = await request(app.getHttpServer())
      .post(`/api/shifts/${open.body.id}/close`)
      .set(auth(cashierToken))
      .send({ countedCash: 19500 })
      .expect(201);
    expect(Number(closed.body.diffCash)).toBe(-500);
  });
});
