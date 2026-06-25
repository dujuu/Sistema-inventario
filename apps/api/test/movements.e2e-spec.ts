import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('Movements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let productId: string;
  let warehouseId: string;
  let foreignWarehouseId: string;
  const email = `test-${randomUUID()}@x.local`;

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

    const warehouse = await prisma.warehouse.create({
      data: { code: `TEST-${randomUUID()}`, name: 'Test Warehouse' },
    });
    warehouseId = warehouse.id;
    foreignWarehouseId = randomUUID();

    const passwordHash = await bcrypt.hash('test1234', 10);
    await prisma.user.create({
      data: {
        email,
        name: 'Test User',
        passwordHash,
        warehousePermissions: { create: { warehouseId, role: Role.ADMIN } },
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'test1234' });
    token = (loginRes.body as { accessToken: string }).accessToken;

    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sku: `SKU-${randomUUID()}`,
        name: 'Test Product',
        unit: 'unidad',
        cost: 5,
      });
    productId = (productRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  async function quantityOnHand() {
    const res = await auth(
      request(app.getHttpServer()).get(
        `/api/v1/stock?product=${productId}&warehouse=${warehouseId}`,
      ),
    ).expect(200);
    return (res.body as { quantityOnHand: string }[])[0].quantityOnHand;
  }

  it('rejects unauthenticated requests', () => {
    return request(app.getHttpServer()).get('/api/v1/stock').expect(401);
  });

  it('rejects invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('has no stock row before any movement', async () => {
    const res = await auth(
      request(app.getHttpServer()).get(
        `/api/v1/stock?product=${productId}&warehouse=${warehouseId}`,
      ),
    ).expect(200);
    expect(res.body).toEqual([]);
  });

  it('increases stock on an IN movement', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId,
        type: 'IN',
        quantity: 50,
        idempotencyKey: `in-${productId}`,
      })
      .expect(201);

    expect(await quantityOnHand()).toBe('50');
  });

  it('does not duplicate a movement retried with the same idempotencyKey', async () => {
    const first = await auth(
      request(app.getHttpServer()).post('/api/v1/movements'),
    ).send({
      productId,
      warehouseId,
      type: 'IN',
      quantity: 50,
      idempotencyKey: `in-${productId}`,
    });
    expect(first.status).toBe(201);

    expect(await quantityOnHand()).toBe('50');
  });

  it('rejects an OUT movement larger than available stock', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId,
        type: 'OUT',
        quantity: 1000,
        idempotencyKey: `out-fail-${productId}`,
      })
      .expect(400);
  });

  it('decreases stock on a valid OUT movement', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId,
        type: 'OUT',
        quantity: 20,
        idempotencyKey: `out-${productId}`,
      })
      .expect(201);

    expect(await quantityOnHand()).toBe('30');
  });

  it('forbids movements against a warehouse the user has no permission for', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/movements'))
      .send({
        productId,
        warehouseId: foreignWarehouseId,
        type: 'IN',
        quantity: 1,
        idempotencyKey: `forbidden-${productId}`,
      })
      .expect(403);
  });
});
