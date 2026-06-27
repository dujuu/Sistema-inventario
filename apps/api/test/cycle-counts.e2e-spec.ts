import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('CycleCounts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let warehouseId: string;
  let productAId: string;
  let productBId: string;
  const email = `test-cc-${randomUUID()}@x.local`;

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
      data: { code: `CC-WH-${randomUUID().slice(0, 6)}`, name: 'CC Warehouse' },
    });
    warehouseId = wh.id;

    const passwordHash = await bcrypt.hash('test1234', 10);
    await prisma.user.create({
      data: {
        email,
        name: 'CC Test User',
        passwordHash,
        warehousePermissions: { create: [{ warehouseId, role: Role.ADMIN }] },
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'test1234' });
    token = (loginRes.body as { accessToken: string }).accessToken;

    const pA = await auth(request(app.getHttpServer()).post('/api/v1/products')).send({
      sku: `SKU-CCA-${randomUUID().slice(0, 6)}`, name: 'Product A', unit: 'un', cost: 10,
    });
    productAId = (pA.body as { id: string }).id;

    const pB = await auth(request(app.getHttpServer()).post('/api/v1/products')).send({
      sku: `SKU-CCB-${randomUUID().slice(0, 6)}`, name: 'Product B', unit: 'un', cost: 20,
    });
    productBId = (pB.body as { id: string }).id;

    // Seed: A=100, B=50
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId: productAId, warehouseId, type: 'IN', quantity: 100,
      idempotencyKey: `cc-seed-a-${productAId}`,
    });
    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId: productBId, warehouseId, type: 'IN', quantity: 50,
      idempotencyKey: `cc-seed-b-${productBId}`,
    });
  });

  afterAll(() => app.close());

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  let countId: string;
  let lineAId: string;
  let lineBId: string;

  it('creates a cycle count with one line per product in stock', async () => {
    const res = await auth(request(app.getHttpServer()).post('/api/v1/cycle-counts'))
      .send({ warehouseId, reference: 'test-count-1' })
      .expect(201);

    const body = res.body as { id: string; status: string; lines: Array<{ id: string; productId: string; systemQuantity: string }> };
    expect(body.status).toBe('DRAFT');
    expect(body.lines.length).toBeGreaterThanOrEqual(2);
    countId = body.id;

    const lineA = body.lines.find((l) => l.productId === productAId)!;
    const lineB = body.lines.find((l) => l.productId === productBId)!;
    expect(lineA).toBeDefined();
    expect(lineB).toBeDefined();
    expect(Number(lineA.systemQuantity)).toBe(100);
    expect(Number(lineB.systemQuantity)).toBe(50);
    lineAId = lineA.id;
    lineBId = lineB.id;
  });

  it('updates a line with counted quantity', async () => {
    const res = await auth(
      request(app.getHttpServer()).patch(`/api/v1/cycle-counts/${countId}/lines/${lineAId}`),
    )
      .send({ countedQuantity: 95 })
      .expect(200);

    expect(Number((res.body as { countedQuantity: string }).countedQuantity)).toBe(95);
  });

  it('rejects updating a line with negative quantity', async () => {
    await auth(
      request(app.getHttpServer()).patch(`/api/v1/cycle-counts/${countId}/lines/${lineAId}`),
    )
      .send({ countedQuantity: -1 })
      .expect(400);
  });

  it('commits the count and applies adjustments for counted lines', async () => {
    // Only line A has a countedQuantity (95); line B has none → no adjustment for B
    const res = await auth(
      request(app.getHttpServer()).post(`/api/v1/cycle-counts/${countId}/commit`),
    )
      .send({ warehouseId })
      .expect(201);

    const body = res.body as { status: string };
    expect(body.status).toBe('COMMITTED');

    // Stock for A should now be 95 (adjusted -5)
    const stockRes = await auth(
      request(app.getHttpServer()).get(`/api/v1/stock?product=${productAId}&warehouse=${warehouseId}`),
    ).expect(200);
    const stockA = (stockRes.body as Array<{ quantityOnHand: string }>)[0];
    expect(Number(stockA.quantityOnHand)).toBe(95);

    // Stock for B unchanged at 50
    const stockResB = await auth(
      request(app.getHttpServer()).get(`/api/v1/stock?product=${productBId}&warehouse=${warehouseId}`),
    ).expect(200);
    const stockB = (stockResB.body as Array<{ quantityOnHand: string }>)[0];
    expect(Number(stockB.quantityOnHand)).toBe(50);
  });

  it('rejects committing an already-committed count', async () => {
    await auth(
      request(app.getHttpServer()).post(`/api/v1/cycle-counts/${countId}/commit`),
    )
      .send({ warehouseId })
      .expect(400);
  });

  it('cancels a DRAFT count', async () => {
    const createRes = await auth(request(app.getHttpServer()).post('/api/v1/cycle-counts'))
      .send({ warehouseId })
      .expect(201);
    const newId = (createRes.body as { id: string }).id;

    const res = await auth(
      request(app.getHttpServer()).post(`/api/v1/cycle-counts/${newId}/cancel`),
    )
      .send({ warehouseId })
      .expect(201);

    expect((res.body as { status: string }).status).toBe('CANCELLED');
  });

  it('idempotency: commit is rejected on second call (not DRAFT)', async () => {
    // Already tested above — committed count returns 400
    await auth(
      request(app.getHttpServer()).post(`/api/v1/cycle-counts/${countId}/commit`),
    )
      .send({ warehouseId })
      .expect(400);
  });

  it('lists all counts', async () => {
    const res = await auth(
      request(app.getHttpServer()).get('/api/v1/cycle-counts'),
    ).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as Array<{ id: string }>).some((c) => c.id === countId)).toBe(true);
  });

  it('returns count detail with lines', async () => {
    const res = await auth(
      request(app.getHttpServer()).get(`/api/v1/cycle-counts/${countId}`),
    ).expect(200);
    const body = res.body as { lines: Array<{ id: string; difference: string }> };
    const lineA = body.lines.find((l) => l.id === lineAId)!;
    // difference = countedQuantity(95) - systemQuantity(100) = -5
    expect(Number(lineA.difference)).toBe(-5);
  });
});
