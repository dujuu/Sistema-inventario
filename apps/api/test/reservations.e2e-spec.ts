import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('Reservations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let warehouseId: string;
  let foreignWarehouseId: string;
  let productId: string;
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
      data: { code: `RES-WH-${randomUUID()}`, name: 'Reservations Warehouse' },
    });
    warehouseId = warehouse.id;
    foreignWarehouseId = randomUUID();

    const passwordHash = await bcrypt.hash('test1234', 10);
    await prisma.user.create({
      data: {
        email,
        name: 'Test User',
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
      sku: `SKU-RES-${randomUUID()}`,
      name: 'Producto Reservable',
      unit: 'unidad',
      cost: 1,
    });
    productId = (productRes.body as { id: string }).id;

    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId,
      warehouseId,
      type: 'IN',
      quantity: 100,
      idempotencyKey: `seed-${productId}`,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  async function stock() {
    const res = await auth(
      request(app.getHttpServer()).get(
        `/api/v1/stock?product=${productId}&warehouse=${warehouseId}`,
      ),
    ).expect(200);
    return res.body as { quantityOnHand: string; quantityReserved: string }[];
  }

  it('creates a reservation: increases quantityReserved, leaves quantityOnHand untouched', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/reservations'),
    )
      .send({
        productId,
        warehouseId,
        quantity: 30,
        idempotencyKey: `res-1-${productId}`,
      })
      .expect(201);

    expect((res.body as { status: string }).status).toBe('ACTIVE');
    const [row] = await stock();
    expect(row.quantityOnHand).toBe('100');
    expect(row.quantityReserved).toBe('30');
  });

  it('rejects reserving more than the available (unreserved) stock', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/reservations'))
      .send({
        productId,
        warehouseId,
        quantity: 9999,
        idempotencyKey: `res-over-${productId}`,
      })
      .expect(400);
  });

  it('dispatches a reservation: decreases both quantityOnHand and quantityReserved, records an OUT movement', async () => {
    const createRes = await auth(
      request(app.getHttpServer()).post('/api/v1/reservations'),
    ).send({
      productId,
      warehouseId,
      quantity: 10,
      idempotencyKey: `res-dispatch-${productId}`,
    });
    const reservationId = (createRes.body as { id: string }).id;

    const res = await auth(
      request(app.getHttpServer()).post(
        `/api/v1/reservations/${reservationId}/dispatch`,
      ),
    )
      .send({ warehouseId })
      .expect(201);
    expect((res.body as { status: string }).status).toBe('DISPATCHED');

    const [row] = await stock();
    expect(row.quantityOnHand).toBe('90');
    expect(row.quantityReserved).toBe('30');

    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/reservations/${reservationId}/dispatch`,
      ),
    )
      .send({ warehouseId })
      .expect(201);
    const [rowAfterRetry] = await stock();
    expect(rowAfterRetry.quantityOnHand).toBe('90');
    expect(rowAfterRetry.quantityReserved).toBe('30');
  });

  it('rejects dispatching a cancelled reservation', async () => {
    const createRes = await auth(
      request(app.getHttpServer()).post('/api/v1/reservations'),
    ).send({
      productId,
      warehouseId,
      quantity: 5,
      idempotencyKey: `res-cancel-${productId}`,
    });
    const reservationId = (createRes.body as { id: string }).id;

    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/reservations/${reservationId}/cancel`,
      ),
    )
      .send({ warehouseId })
      .expect(201);

    const [row] = await stock();
    expect(row.quantityReserved).toBe('30');

    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/reservations/${reservationId}/dispatch`,
      ),
    )
      .send({ warehouseId })
      .expect(400);
  });

  it('expires an unresolved reservation automatically via the BullMQ delayed job', async () => {
    const expiresAt = new Date(Date.now() + 200).toISOString();
    const createRes = await auth(
      request(app.getHttpServer()).post('/api/v1/reservations'),
    )
      .send({
        productId,
        warehouseId,
        quantity: 7,
        expiresAt,
        idempotencyKey: `res-expire-${productId}`,
      })
      .expect(201);
    const reservationId = (createRes.body as { id: string }).id;

    const [rowAfterCreate] = await stock();
    expect(rowAfterCreate.quantityReserved).toBe('37');

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const listRes = await auth(
      request(app.getHttpServer()).get('/api/v1/reservations'),
    ).expect(200);
    const expired = (listRes.body as { id: string; status: string }[]).find(
      (r) => r.id === reservationId,
    );
    expect(expired?.status).toBe('EXPIRED');

    const [rowAfterExpiry] = await stock();
    expect(rowAfterExpiry.quantityReserved).toBe('30');
  }, 10000);

  it('forbids creating a reservation for a warehouse the user has no permission for', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/reservations'))
      .send({
        productId,
        warehouseId: foreignWarehouseId,
        quantity: 1,
        idempotencyKey: `res-forbidden-${productId}`,
      })
      .expect(403);
  });
});
