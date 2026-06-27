import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let warehouseId: string;
  let productId: string;
  const email = `test-reports-${randomUUID()}@x.local`;

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
      data: { code: `RPT-WH-${randomUUID().slice(0, 6)}`, name: 'Report WH' },
    });
    warehouseId = wh.id;

    const passwordHash = await bcrypt.hash('test1234', 10);
    await prisma.user.create({
      data: {
        email,
        name: 'Report Test User',
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
      sku: `SKU-RPT-${randomUUID().slice(0, 6)}`,
      name: 'Report Product',
      unit: 'unit',
      cost: 50,
    });
    productId = (productRes.body as { id: string }).id;

    // Seed movements: IN 100, OUT 30, ADJUSTMENT -5
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId, warehouseId, type: 'IN', quantity: 100,
      idempotencyKey: `rpt-in-${productId}`,
    });
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId, warehouseId, type: 'OUT', quantity: 30,
      idempotencyKey: `rpt-out-${productId}`,
    });
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId, warehouseId, type: 'ADJUSTMENT', quantity: -5,
      idempotencyKey: `rpt-adj-${productId}`,
    });
    // Final stock: 100 - 30 - 5 = 65
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  describe('GET /reports/stock-valuation', () => {
    it('returns lines and grandTotal', async () => {
      const res = await auth(
        request(app.getHttpServer()).get('/api/v1/reports/stock-valuation'),
      ).expect(200);

      const body = res.body as { lines: Array<{ productId: string; value: string }>; grandTotal: string };
      expect(body.lines).toBeInstanceOf(Array);
      expect(typeof body.grandTotal).toBe('string');

      const line = body.lines.find((l) => l.productId === productId);
      expect(line).toBeDefined();
      // 65 units × cost 50 = 3250
      expect(Number(line!.value)).toBeCloseTo(3250, 2);
    });

    it('filters by warehouseId', async () => {
      const res = await auth(
        request(app.getHttpServer()).get(
          `/api/v1/reports/stock-valuation?warehouseId=${warehouseId}`,
        ),
      ).expect(200);

      const body = res.body as { lines: Array<{ warehouseId: string }> };
      expect(body.lines.every((l) => l.warehouseId === warehouseId)).toBe(true);
    });

    it('requires auth', () => {
      return request(app.getHttpServer())
        .get('/api/v1/reports/stock-valuation')
        .expect(401);
    });
  });

  describe('GET /reports/kardex', () => {
    it('returns all movements with running balance', async () => {
      const res = await auth(
        request(app.getHttpServer()).get(
          `/api/v1/reports/kardex?productId=${productId}`,
        ),
      ).expect(200);

      const body = res.body as {
        product: { sku: string };
        lines: Array<{ type: string; balance: string }>;
      };
      expect(body.product).toBeDefined();
      expect(body.lines).toHaveLength(3);

      const balances = body.lines.map((l) => Number(l.balance));
      expect(balances[0]).toBeCloseTo(100, 4);  // after IN 100
      expect(balances[1]).toBeCloseTo(70, 4);   // after OUT 30
      expect(balances[2]).toBeCloseTo(65, 4);   // after ADJUSTMENT -5
    });

    it('filters by warehouseId', async () => {
      const res = await auth(
        request(app.getHttpServer()).get(
          `/api/v1/reports/kardex?productId=${productId}&warehouseId=${warehouseId}`,
        ),
      ).expect(200);

      const body = res.body as { lines: Array<unknown> };
      expect(body.lines).toHaveLength(3);
    });

    it('filters by date range', async () => {
      const future = new Date(Date.now() + 86400_000).toISOString();
      const res = await auth(
        request(app.getHttpServer()).get(
          `/api/v1/reports/kardex?productId=${productId}&to=${future}`,
        ),
      ).expect(200);

      const body = res.body as { lines: Array<unknown> };
      expect(body.lines.length).toBeGreaterThanOrEqual(3);
    });

    it('requires productId', async () => {
      await auth(
        request(app.getHttpServer()).get('/api/v1/reports/kardex'),
      ).expect(400);
    });

    it('requires auth', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/reports/kardex?productId=${productId}`)
        .expect(401);
    });
  });
});
