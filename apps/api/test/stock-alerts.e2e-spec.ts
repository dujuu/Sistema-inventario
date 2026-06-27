import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('StockAlerts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let warehouseId: string;
  let productId: string;
  const email = `test-alerts-${randomUUID()}@x.local`;

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
      data: { code: `ALT-WH-${randomUUID().slice(0, 6)}`, name: 'Alert WH' },
    });
    warehouseId = wh.id;

    const passwordHash = await bcrypt.hash('test1234', 10);
    await prisma.user.create({
      data: {
        email,
        name: 'Alert Test User',
        passwordHash,
        warehousePermissions: { create: [{ warehouseId, role: Role.ADMIN }] },
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'test1234' });
    token = (loginRes.body as { accessToken: string }).accessToken;

    const productRes = await auth(
      request(app.getHttpServer()).post('/api/v1/products'),
    ).send({
      sku: `SKU-ALT-${randomUUID().slice(0, 6)}`,
      name: 'Alert Product',
      unit: 'unit',
      cost: 10,
    });
    productId = (productRes.body as { id: string }).id;

    // Seed initial stock
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId,
      warehouseId,
      type: 'IN',
      quantity: 100,
      idempotencyKey: `seed-alert-${productId}`,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  it('sets a reorder point on a stock row', async () => {
    const res = await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/stock/${productId}/${warehouseId}/reorder-point`,
      ),
    )
      .send({ reorderPoint: 20 })
      .expect(200);

    expect(Number(res.body.reorderPoint)).toBe(20);
  });

  it('triggers alert when OUT drops stock below reorder point', async () => {
    // 100 - 85 = 15 < reorderPoint(20)
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId,
        type: 'OUT',
        quantity: 85,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    // BullMQ processes the job asynchronously
    await new Promise((r) => setTimeout(r, 600));

    const res = await auth(
      request(app.getHttpServer()).get('/api/v1/stock-alerts'),
    ).expect(200);

    const active = (
      res.body as Array<{ active: boolean; productId: string; quantityOnHand: string }>
    ).filter((a) => a.active && a.productId === productId);
    expect(active.length).toBe(1);
    expect(Number(active[0].quantityOnHand)).toBeLessThanOrEqual(20);
  });

  it('auto-resolves alert when stock recovers above reorder point', async () => {
    // 15 + 90 = 105 > reorderPoint(20)
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId,
        type: 'IN',
        quantity: 90,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await new Promise((r) => setTimeout(r, 600));

    const res = await auth(
      request(app.getHttpServer()).get('/api/v1/stock-alerts'),
    ).expect(200);

    const active = (
      res.body as Array<{ active: boolean; productId: string }>
    ).filter((a) => a.active && a.productId === productId);
    expect(active.length).toBe(0);
  });

  it('can dismiss an active alert manually', async () => {
    // 105 - 90 = 15 < 20 → alert fires
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId,
        type: 'OUT',
        quantity: 90,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await new Promise((r) => setTimeout(r, 600));

    const listRes = await auth(
      request(app.getHttpServer()).get('/api/v1/stock-alerts'),
    ).expect(200);

    const alert = (
      listRes.body as Array<{ id: string; active: boolean; productId: string }>
    ).find((a) => a.active && a.productId === productId);
    expect(alert).toBeDefined();

    await auth(
      request(app.getHttpServer()).post(`/api/v1/stock-alerts/${alert!.id}/dismiss`),
    ).expect(201);

    const afterRes = await auth(
      request(app.getHttpServer()).get('/api/v1/stock-alerts'),
    ).expect(200);

    const stillActive = (
      afterRes.body as Array<{ id: string; active: boolean }>
    ).find((a) => a.id === alert!.id && a.active);
    expect(stillActive).toBeUndefined();
  });

  it('clearing reorder point resolves any active alert', async () => {
    // Trigger alert again (stock is already low from previous test)
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId,
        type: 'OUT',
        quantity: 1,
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    await new Promise((r) => setTimeout(r, 600));

    // Clear threshold
    const cleared = await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/stock/${productId}/${warehouseId}/reorder-point`,
      ),
    )
      .send({ reorderPoint: null })
      .expect(200);
    expect(cleared.body.reorderPoint).toBeNull();

    const res = await auth(
      request(app.getHttpServer()).get('/api/v1/stock-alerts'),
    ).expect(200);

    const active = (
      res.body as Array<{ active: boolean; productId: string }>
    ).filter((a) => a.active && a.productId === productId);
    expect(active.length).toBe(0);
  });
});
