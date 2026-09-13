import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Suppliers (e2e)', () => {
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

  it('reports last receipt date and total purchase only from POSTED receipts', async () => {
    const supplier = await request(app.getHttpServer())
      .post('/api/suppliers')
      .set(auth())
      .send({
        name: `Test yetkazuvchi ${Date.now()}`,
        contactPerson: 'Aziz',
        phone: '+998901234567',
      });
    const supplierId = supplier.body.id;

    const sku = `SKU-SUP-${Date.now()}`;
    const product = await request(app.getHttpServer())
      .post('/api/products')
      .set(auth())
      .send({
        sku,
        name: 'Yetkazuvchi tovari',
        units: [{ label: 'dona', factor: 1, price: 5000, isBase: true }],
      });

    // A draft receipt must not count toward totalPurchase.
    await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({
        supplierId,
        lines: [
          {
            productId: product.body.id,
            unitLabel: 'dona',
            qtyInUnit: 5,
            unitCostPack: 1000,
          },
        ],
      });

    const posted = await request(app.getHttpServer())
      .post('/api/receipts')
      .set(auth())
      .send({
        supplierId,
        lines: [
          {
            productId: product.body.id,
            unitLabel: 'dona',
            qtyInUnit: 10,
            unitCostPack: 2000,
          },
        ],
      });
    await request(app.getHttpServer())
      .post(`/api/receipts/${posted.body.id}/post`)
      .set(auth())
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/suppliers')
      .set(auth())
      .expect(200);
    const found = list.body.find((s: { id: string }) => s.id === supplierId);
    expect(found.contactPerson).toBe('Aziz');
    expect(Number(found.totalPurchase)).toBe(20000); // only the posted 10 x 2000
    expect(found.lastReceiptAt).not.toBeNull();
  });
});
