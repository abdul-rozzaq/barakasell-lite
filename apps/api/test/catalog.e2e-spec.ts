import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Catalog (e2e)', () => {
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

  it('creates a product with 3 units, prices stored independently', async () => {
    const sku = `SKU-${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Sement M400',
        units: [
          { label: 'dona', factor: 1, price: 68000, isBase: true },
          { label: 'pachka (50 dona)', factor: 50, price: 3200000 },
          { label: 'karobka (10 pachka - 500 dona)', factor: 500, price: 31000000 },
        ],
      })
      .expect(201);

    expect(res.body.units).toHaveLength(3);
    const [dona, pachka, karobka] = res.body.units;
    expect(Number(dona.price)).toBe(68000);
    expect(Number(pachka.price)).toBe(3200000);
    expect(Number(karobka.price)).toBe(31000000);

    const detail = await request(app.getHttpServer())
      .get(`/api/products/${res.body.id}`)
      .set(auth())
      .expect(200);
    expect(detail.body.units).toHaveLength(3);
  });

  it('rejects a duplicate barcode with the owning product name', async () => {
    const sku1 = `SKU-${Date.now()}-a`;
    const sku2 = `SKU-${Date.now()}-b`;
    const code = `${Date.now()}`.padStart(13, '0').slice(0, 13);

    const p1 = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku: sku1,
        name: 'Bo\'yoq oq',
        units: [{ label: 'dona', factor: 1, price: 50000, isBase: true }],
        barcodes: [code],
      });

    const p2 = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku: sku2,
        name: 'Bo\'yoq qora',
        units: [{ label: 'dona', factor: 1, price: 55000, isBase: true }],
      });

    const res = await request(app.getHttpServer())
      .post(`/api/products/${p2.body.id}/barcodes`)
      .set(auth())
      .send({ code })
      .expect(409);

    expect(res.body.message).toContain("Bo'yoq oq");
    void p1;
  });

  it('generates a valid internal EAN-13 barcode', async () => {
    const sku = `SKU-${Date.now()}-gen`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Kabel 2x1.5',
        units: [{ label: 'metr', factor: 1, price: 4500, isBase: true }],
      });

    const res = await request(app.getHttpServer())
      .post(`/api/products/${product.body.id}/barcodes/generate`)
      .set(auth())
      .expect(201);

    expect(res.body.code).toMatch(/^\d{13}$/);
    expect(res.body.isInternal).toBe(true);
  });
});
