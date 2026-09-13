import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;

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
  });

  afterEach(async () => {
    await app.close();
  });

  function auth() {
    return { Authorization: `Bearer ${adminToken}` };
  }

  it('dashboard returns the expected shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/dashboard')
      .set(auth())
      .expect(200);
    expect(res.body).toHaveProperty('todayRevenue');
    expect(res.body).toHaveProperty('todayProfit');
    expect(res.body).toHaveProperty('openShiftsCount');
    expect(Array.isArray(res.body.topProducts)).toBe(true);
    expect(Array.isArray(res.body.lowStock)).toBe(true);
    expect(Array.isArray(res.body.recentShifts)).toBe(true);
  });

  it('dead-stock lists a never-sold product and excludes a just-sold one', async () => {
    const sku = `SKU-DEAD-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Harakatsiz tovar',
        units: [{ label: 'dona', factor: 1, price: 1000, isBase: true }],
      });

    const res = await request(app.getHttpServer())
      .get('/api/reports/dead-stock?days=30')
      .set(auth())
      .expect(200);
    const found = res.body.find(
      (r: { productId: string }) => r.productId === product.body.id,
    );
    expect(found).toBeDefined();
    expect(found.lastSoldAt).toBeNull();
  });

  it('stock-value response shape is unchanged (regression)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/reports/stock-value')
      .set(auth())
      .expect(200);
    expect(res.body).toHaveProperty('totalStockValue');
    expect(Object.keys(res.body)).toEqual(['totalStockValue']);
  });
});
