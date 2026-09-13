import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Receiving (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

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

  it('posting two receipts at different costs blends the moving average correctly', async () => {
    const sku = `SKU-RCV-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Test Sement',
        units: [{ label: 'dona', factor: 1, price: 1500, isBase: true }],
      });
    const productId = product.body.id;

    // Receipt 1: 100 @ 1000
    const r1 = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({ lines: [{ productId, unitLabel: 'dona', qtyInUnit: 100, unitCostPack: 1000 }] });
    await request(app.getHttpServer())
      .post(`/api/receipts/${r1.body.id}/post`)
      .set(auth())
      .expect(201);

    let detail = await request(app.getHttpServer()).get(`/api/products/${productId}`).set(auth());
    expect(Number(detail.body.stock)).toBe(100);
    expect(Number(detail.body.avgCost)).toBe(1000);

    // Receipt 2: 50 @ 1300 -> blended avg = (100*1000+50*1300)/150 = 1100
    const r2 = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({ lines: [{ productId, unitLabel: 'dona', qtyInUnit: 50, unitCostPack: 1300 }] });
    await request(app.getHttpServer())
      .post(`/api/receipts/${r2.body.id}/post`)
      .set(auth())
      .expect(201);

    detail = await request(app.getHttpServer()).get(`/api/products/${productId}`).set(auth());
    expect(Number(detail.body.stock)).toBe(150);
    expect(Number(detail.body.avgCost)).toBe(1100);

    // stock cache must equal the ledger sum
    const ledger = await request(app.getHttpServer())
      .get('/api/inventory/ledger')
      .query({ productId })
      .set(auth());
    const ledgerSum = ledger.body.reduce((acc: number, e: { qtyDelta: string }) => acc + Number(e.qtyDelta), 0);
    expect(ledgerSum).toBe(150);

    // movements history shape
    const movements = await request(app.getHttpServer())
      .get(`/api/products/${productId}/movements`)
      .set(auth());
    expect(movements.body).toHaveLength(2);
    expect(movements.body[0].type).toBe('RECEIPT');

    // re-posting a POSTED receipt is rejected
    await request(app.getHttpServer())
      .post(`/api/receipts/${r1.body.id}/post`)
      .set(auth())
      .expect(409);

    // verify reports no drift for this product
    const verify = await request(app.getHttpServer()).get('/api/inventory/verify').set(auth());
    expect(verify.body.find((d: { productId: string }) => d.productId === productId)).toBeUndefined();
  });
});
