import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';

describe('Inventory verify/repair (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'admin', password: 'admin123' });
    adminToken = login.body.accessToken;
  });

  afterEach(async () => {
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  it('detects and repairs a corrupted stock cache', async () => {
    const sku = `SKU-VER-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Test Bo\'yoq',
        units: [{ label: 'dona', factor: 1, price: 1000, isBase: true }],
      });
    const productId = product.body.id;

    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({ lines: [{ productId, unitLabel: 'dona', qtyInUnit: 20, unitCostPack: 500 }] });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth())
      .expect(201);

    // Corrupt the cache directly, bypassing StockService — simulates drift.
    await prisma.$executeRaw`UPDATE "Product" SET stock = 999 WHERE id = ${productId}`;

    const before = await request(app.getHttpServer()).get('/api/inventory/verify').set(auth());
    const drift = before.body.find((d: { productId: string }) => d.productId === productId);
    expect(drift).toBeDefined();
    expect(Number(drift.cachedStock)).toBe(999);
    expect(Number(drift.ledgerStock)).toBe(20);

    const confirm = await request(app.getHttpServer())
      .post('/api/auth/confirm-pin')
      .set(auth())
      .send({ pin: 'admin123' });
    // admin PIN confirmation uses the admin password per AuthService.confirmPin
    await request(app.getHttpServer())
      .post('/api/inventory/verify/repair')
      .set(auth())
      .set('X-Pin-Confirmation', confirm.body.confirmationToken)
      .expect(201);

    const after = await request(app.getHttpServer()).get(`/api/products/${productId}`).set(auth());
    expect(Number(after.body.stock)).toBe(20);

    const stillDrifting = await request(app.getHttpServer()).get('/api/inventory/verify').set(auth());
    expect(stillDrifting.body.find((d: { productId: string }) => d.productId === productId)).toBeUndefined();

    const audit = await request(app.getHttpServer()).get('/api/audit').set(auth());
    expect(audit.body.some((a: { action: string }) => a.action === 'Zaxira tuzatildi')).toBe(true);
  });
});
