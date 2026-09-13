import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Inventory counts (e2e)', () => {
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

  async function confirmPin() {
    const res = await request(app.getHttpServer())
      .post('/api/auth/confirm-pin')
      .set(auth())
      .send({ pin: 'admin123' });
    return res.body.confirmationToken as string;
  }

  it('a shortage count moves stock to the counted value, leaves avgCost untouched, and reduces stock-value by |diffValue|', async () => {
    const sku = `SKU-INV-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Test Elektr kabel',
        units: [{ label: 'metr', factor: 1, price: 8000, isBase: true }],
      });
    const productId = product.body.id;

    const receipt = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({ lines: [{ productId, unitLabel: 'metr', qtyInUnit: 100, unitCostPack: 4000 }] });
    await request(app.getHttpServer())
      .post(`/api/receipts/${receipt.body.id}/post`)
      .set(auth())
      .expect(201);

    const before = await request(app.getHttpServer()).get('/api/reports/stock-value').set(auth());
    const totalBefore = Number(before.body.totalStockValue);

    const count = await request(app.getHttpServer())
      .post('/api/inventory-counts')
      .set(auth())
      .send({ productIds: [productId] });

    // physical count found a shortage: 92 instead of 100 -> diff -8 @ avgCost 4000
    await request(app.getHttpServer())
      .patch(`/api/inventory-counts/${count.body.id}/lines`)
      .set(auth())
      .send({ lines: [{ productId, countedQty: 92 }] })
      .expect(200);

    const pin1 = await confirmPin();
    await request(app.getHttpServer())
      .post(`/api/inventory-counts/${count.body.id}/post`)
      .set(auth())
      .set('X-Pin-Confirmation', pin1)
      .expect(201);

    const detail = await request(app.getHttpServer()).get(`/api/products/${productId}`).set(auth());
    expect(Number(detail.body.stock)).toBe(92);
    expect(Number(detail.body.avgCost)).toBe(4000); // untouched by the count

    const expectedDiffValue = -8 * 4000;
    const after = await request(app.getHttpServer()).get('/api/reports/stock-value').set(auth());
    const totalAfter = Number(after.body.totalStockValue);
    expect(totalAfter - totalBefore).toBeCloseTo(expectedDiffValue, 3);

    const countDetail = await request(app.getHttpServer())
      .get(`/api/inventory-counts/${count.body.id}`)
      .set(auth());
    expect(Number(countDetail.body.totalDiffValue)).toBe(expectedDiffValue);
    expect(countDetail.body.status).toBe('POSTED');
  });
});
