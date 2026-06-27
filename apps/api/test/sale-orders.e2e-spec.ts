import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('SaleOrders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let warehouseId: string;
  let productAId: string;
  let productBId: string;
  const email = `test-so-${randomUUID()}@x.local`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    const wh = await prisma.warehouse.create({
      data: { code: `SO-WH-${randomUUID().slice(0, 6)}`, name: 'Sales WH' },
    });
    warehouseId = wh.id;

    const passwordHash = await bcrypt.hash('test1234', 10);
    await prisma.user.create({
      data: {
        email,
        name: 'Sales Test User',
        passwordHash,
        warehousePermissions: { create: [{ warehouseId, role: Role.ADMIN }] },
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'test1234' });
    token = (loginRes.body as { accessToken: string }).accessToken;

    const pA = await auth(request(app.getHttpServer()).post('/api/v1/products')).send({
      sku: `SKU-SOA-${randomUUID().slice(0, 6)}`, name: 'Product A', unit: 'un', cost: 100,
    });
    productAId = (pA.body as { id: string }).id;

    const pB = await auth(request(app.getHttpServer()).post('/api/v1/products')).send({
      sku: `SKU-SOB-${randomUUID().slice(0, 6)}`, name: 'Product B', unit: 'un', cost: 200,
    });
    productBId = (pB.body as { id: string }).id;

    // Stock: A=50, B=30
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId: productAId, warehouseId, type: 'IN', quantity: 50,
      idempotencyKey: `so-seed-a-${productAId}`,
    });
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId: productBId, warehouseId, type: 'IN', quantity: 30,
      idempotencyKey: `so-seed-b-${productBId}`,
    });
  });

  afterAll(() => app.close());

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  let orderId: string;
  const idemKey = randomUUID();

  it('creates a sale order with multiple lines', async () => {
    const res = await auth(request(app.getHttpServer()).post('/api/v1/sale-orders'))
      .send({
        warehouseId,
        customerName: 'Cliente Test',
        idempotencyKey: idemKey,
        lines: [
          { productId: productAId, quantity: 10, unitPrice: 150 },
          { productId: productBId, quantity: 5, unitPrice: 250 },
        ],
      })
      .expect(201);

    const body = res.body as { id: string; status: string; lines: Array<unknown> };
    expect(body.status).toBe('PENDING');
    expect(body.lines).toHaveLength(2);
    orderId = body.id;
  });

  it('is idempotent: repeating the same key returns the existing order', async () => {
    const res = await auth(request(app.getHttpServer()).post('/api/v1/sale-orders'))
      .send({
        warehouseId,
        idempotencyKey: idemKey,
        lines: [{ productId: productAId, quantity: 99, unitPrice: 1 }],
      })
      .expect(201);

    expect((res.body as { id: string }).id).toBe(orderId);
  });

  it('dispatches the order and decrements stock', async () => {
    const res = await auth(
      request(app.getHttpServer()).post(`/api/v1/sale-orders/${orderId}/dispatch`),
    )
      .send({ warehouseId })
      .expect(201);

    expect((res.body as { status: string }).status).toBe('DISPATCHED');

    const stockA = await auth(
      request(app.getHttpServer()).get(`/api/v1/stock?product=${productAId}&warehouse=${warehouseId}`),
    ).expect(200);
    // 50 - 10 = 40
    expect(Number((stockA.body as Array<{ quantityOnHand: string }>)[0].quantityOnHand)).toBe(40);

    const stockB = await auth(
      request(app.getHttpServer()).get(`/api/v1/stock?product=${productBId}&warehouse=${warehouseId}`),
    ).expect(200);
    // 30 - 5 = 25
    expect(Number((stockB.body as Array<{ quantityOnHand: string }>)[0].quantityOnHand)).toBe(25);
  });

  it('dispatch is idempotent: repeating returns the same order without double-deducting', async () => {
    await auth(
      request(app.getHttpServer()).post(`/api/v1/sale-orders/${orderId}/dispatch`),
    )
      .send({ warehouseId })
      .expect(201);

    // Stock must remain at 40 / 25
    const stockA = await auth(
      request(app.getHttpServer()).get(`/api/v1/stock?product=${productAId}&warehouse=${warehouseId}`),
    ).expect(200);
    expect(Number((stockA.body as Array<{ quantityOnHand: string }>)[0].quantityOnHand)).toBe(40);
  });

  it('rejects dispatching a cancelled order', async () => {
    const createRes = await auth(request(app.getHttpServer()).post('/api/v1/sale-orders'))
      .send({
        warehouseId,
        idempotencyKey: randomUUID(),
        lines: [{ productId: productAId, quantity: 1, unitPrice: 10 }],
      })
      .expect(201);
    const newId = (createRes.body as { id: string }).id;

    await auth(request(app.getHttpServer()).post(`/api/v1/sale-orders/${newId}/cancel`))
      .send({ warehouseId })
      .expect(201);

    await auth(request(app.getHttpServer()).post(`/api/v1/sale-orders/${newId}/dispatch`))
      .send({ warehouseId })
      .expect(400);
  });

  it('rejects cancelling a dispatched order', async () => {
    await auth(
      request(app.getHttpServer()).post(`/api/v1/sale-orders/${orderId}/cancel`),
    )
      .send({ warehouseId })
      .expect(400);
  });

  it('rejects an order with insufficient stock', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/sale-orders'))
      .send({
        warehouseId,
        idempotencyKey: randomUUID(),
        lines: [{ productId: productAId, quantity: 9999, unitPrice: 1 }],
      })
      .expect(201); // order is created fine

    const bigOrderRes = await auth(request(app.getHttpServer()).post('/api/v1/sale-orders'))
      .send({
        warehouseId,
        idempotencyKey: randomUUID(),
        lines: [{ productId: productAId, quantity: 9999, unitPrice: 1 }],
      });
    const bigId = (bigOrderRes.body as { id: string }).id;

    await auth(request(app.getHttpServer()).post(`/api/v1/sale-orders/${bigId}/dispatch`))
      .send({ warehouseId })
      .expect(400);
  });

  it('lists all sale orders', async () => {
    const res = await auth(
      request(app.getHttpServer()).get('/api/v1/sale-orders'),
    ).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((o) => o.id === orderId)).toBe(true);
  });

  it('returns order detail with lines', async () => {
    const res = await auth(
      request(app.getHttpServer()).get(`/api/v1/sale-orders/${orderId}`),
    ).expect(200);
    const body = res.body as { status: string; lines: Array<{ quantity: string }> };
    expect(body.status).toBe('DISPATCHED');
    expect(body.lines).toHaveLength(2);
  });

  it('requires auth', () => {
    return request(app.getHttpServer()).get('/api/v1/sale-orders').expect(401);
  });
});
