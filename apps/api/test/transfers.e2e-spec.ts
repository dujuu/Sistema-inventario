import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('Transfers (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let productId: string;
  let fromWarehouseId: string;
  let toWarehouseId: string;
  let foreignWarehouseId: string;
  let transferId: string;
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

    const fromWarehouse = await prisma.warehouse.create({
      data: { code: `FROM-${randomUUID()}`, name: 'From Warehouse' },
    });
    const toWarehouse = await prisma.warehouse.create({
      data: { code: `TO-${randomUUID()}`, name: 'To Warehouse' },
    });
    fromWarehouseId = fromWarehouse.id;
    toWarehouseId = toWarehouse.id;
    foreignWarehouseId = randomUUID();

    const passwordHash = await bcrypt.hash('test1234', 10);
    await prisma.user.create({
      data: {
        email,
        name: 'Test User',
        passwordHash,
        warehousePermissions: {
          create: [
            { warehouseId: fromWarehouseId, role: Role.ADMIN },
            { warehouseId: toWarehouseId, role: Role.ADMIN },
          ],
        },
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

    await auth(request(app.getHttpServer()).post('/api/v1/movements')).send({
      productId,
      warehouseId: fromWarehouseId,
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

  async function stockAt(warehouseId: string) {
    const res = await auth(
      request(app.getHttpServer()).get(
        `/api/v1/stock?product=${productId}&warehouse=${warehouseId}`,
      ),
    ).expect(200);
    return res.body as { quantityOnHand: string }[];
  }

  it('creates a transfer: decreases source stock, leaves destination untouched', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/transfers'),
    )
      .send({
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity: 40,
        idempotencyKey: `transfer-${productId}`,
      })
      .expect(201);
    transferId = (res.body as { id: string }).id;

    expect((await stockAt(fromWarehouseId))[0].quantityOnHand).toBe('60');
    expect(await stockAt(toWarehouseId)).toEqual([]);
  });

  it('receives a transfer and increases destination stock', async () => {
    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/transfers/${transferId}/receive`,
      ),
    )
      .send({ toWarehouseId })
      .expect(201);

    expect((await stockAt(toWarehouseId))[0].quantityOnHand).toBe('40');
  });

  it('does not double-credit on a repeated receive', async () => {
    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/transfers/${transferId}/receive`,
      ),
    )
      .send({ toWarehouseId })
      .expect(201);

    expect((await stockAt(toWarehouseId))[0].quantityOnHand).toBe('40');
  });

  it('rejects a transfer larger than available source stock', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/transfers'))
      .send({
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity: 9999,
        idempotencyKey: `transfer-fail-${productId}`,
      })
      .expect(400);
  });

  it('rejects a transfer with the same source and destination warehouse', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/transfers'))
      .send({
        productId,
        fromWarehouseId,
        toWarehouseId: fromWarehouseId,
        quantity: 1,
        idempotencyKey: `transfer-same-${productId}`,
      })
      .expect(400);
  });

  it('forbids creating a transfer from a warehouse the user has no permission for', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/transfers'))
      .send({
        productId,
        fromWarehouseId: foreignWarehouseId,
        toWarehouseId,
        quantity: 1,
        idempotencyKey: `transfer-forbidden-${productId}`,
      })
      .expect(403);
  });

  it('rejects receiving with a mismatched toWarehouseId', async () => {
    const createRes = await auth(
      request(app.getHttpServer()).post('/api/v1/transfers'),
    )
      .send({
        productId,
        fromWarehouseId,
        toWarehouseId,
        quantity: 5,
        idempotencyKey: `transfer-mismatch-${productId}`,
      })
      .expect(201);
    const pendingId = (createRes.body as { id: string }).id;

    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/transfers/${pendingId}/receive`,
      ),
    )
      .send({ toWarehouseId: fromWarehouseId })
      .expect(400);
  });
});
