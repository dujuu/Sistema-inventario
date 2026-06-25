import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../generated/prisma';

describe('Purchase orders (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let warehouseId: string;
  let foreignWarehouseId: string;
  let supplierId: string;
  let productAId: string;
  let productBId: string;
  let poId: string;
  let lineAId: string;
  let lineBId: string;
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
      data: { code: `PO-WH-${randomUUID()}`, name: 'PO Warehouse' },
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

    const supplierRes = await auth(
      request(app.getHttpServer()).post('/api/v1/suppliers'),
    ).send({
      name: 'Proveedor Test',
    });
    supplierId = (supplierRes.body as { id: string }).id;

    const productARes = await auth(
      request(app.getHttpServer()).post('/api/v1/products'),
    ).send({
      sku: `SKU-PO-A-${randomUUID()}`,
      name: 'Producto A',
      unit: 'unidad',
      cost: 2,
    });
    productAId = (productARes.body as { id: string }).id;

    const productBRes = await auth(
      request(app.getHttpServer()).post('/api/v1/products'),
    ).send({
      sku: `SKU-PO-B-${randomUUID()}`,
      name: 'Producto B',
      unit: 'unidad',
      cost: 4,
    });
    productBId = (productBRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  function auth(req: request.Test) {
    return req.set('Authorization', `Bearer ${token}`);
  }

  async function stockAt(productId: string) {
    const res = await auth(
      request(app.getHttpServer()).get(
        `/api/v1/stock?product=${productId}&warehouse=${warehouseId}`,
      ),
    ).expect(200);
    return res.body as { quantityOnHand: string }[];
  }

  it('creates a purchase order with two lines: status PENDING, stock untouched', async () => {
    const res = await auth(
      request(app.getHttpServer()).post('/api/v1/purchase-orders'),
    )
      .send({
        supplierId,
        warehouseId,
        idempotencyKey: `po-${productAId}`,
        lines: [
          { productId: productAId, quantity: 50, unitCost: 2 },
          { productId: productBId, quantity: 20, unitCost: 4 },
        ],
      })
      .expect(201);

    poId = (res.body as { id: string }).id;
    const lines = (
      res.body as { status: string; lines: { id: string; productId: string }[] }
    ).lines;
    expect((res.body as { status: string }).status).toBe('PENDING');
    lineAId = lines.find((l) => l.productId === productAId)!.id;
    lineBId = lines.find((l) => l.productId === productBId)!.id;

    expect(await stockAt(productAId)).toEqual([]);
    expect(await stockAt(productBId)).toEqual([]);
  });

  it('receives line A fully and line B partially: status PARTIALLY_RECEIVED', async () => {
    const res = await auth(
      request(app.getHttpServer()).post(
        `/api/v1/purchase-orders/${poId}/receive`,
      ),
    )
      .send({
        warehouseId,
        idempotencyKey: `receive-1-${poId}`,
        lines: [
          { lineId: lineAId, quantity: 50 },
          { lineId: lineBId, quantity: 8 },
        ],
      })
      .expect(201);

    expect((res.body as { status: string }).status).toBe('PARTIALLY_RECEIVED');
    expect((await stockAt(productAId))[0].quantityOnHand).toBe('50');
    expect((await stockAt(productBId))[0].quantityOnHand).toBe('8');
  });

  it('does not double-credit on a repeated identical receive call', async () => {
    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/purchase-orders/${poId}/receive`,
      ),
    )
      .send({
        warehouseId,
        idempotencyKey: `receive-1-${poId}`,
        lines: [
          { lineId: lineAId, quantity: 50 },
          { lineId: lineBId, quantity: 8 },
        ],
      })
      .expect(201);

    expect((await stockAt(productAId))[0].quantityOnHand).toBe('50');
    expect((await stockAt(productBId))[0].quantityOnHand).toBe('8');
  });

  it('receives the remainder of line B: status RECEIVED', async () => {
    const res = await auth(
      request(app.getHttpServer()).post(
        `/api/v1/purchase-orders/${poId}/receive`,
      ),
    )
      .send({
        warehouseId,
        idempotencyKey: `receive-2-${poId}`,
        lines: [{ lineId: lineBId, quantity: 12 }],
      })
      .expect(201);

    expect((res.body as { status: string }).status).toBe('RECEIVED');
    expect((await stockAt(productBId))[0].quantityOnHand).toBe('20');
  });

  it('rejects receiving more than the ordered quantity on a line', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/purchase-orders'))
      .send({
        supplierId,
        warehouseId,
        idempotencyKey: `po-over-${productAId}`,
        lines: [{ productId: productAId, quantity: 10, unitCost: 2 }],
      })
      .expect(201)
      .then(async (res) => {
        const overPoId = (res.body as { id: string }).id;
        const overLineId = (res.body as { lines: { id: string }[] }).lines[0]
          .id;
        await auth(
          request(app.getHttpServer()).post(
            `/api/v1/purchase-orders/${overPoId}/receive`,
          ),
        )
          .send({
            warehouseId,
            idempotencyKey: `receive-over-${overPoId}`,
            lines: [{ lineId: overLineId, quantity: 9999 }],
          })
          .expect(400);
      });
  });

  it('rejects a lineId that does not belong to the purchase order', async () => {
    await auth(
      request(app.getHttpServer()).post(
        `/api/v1/purchase-orders/${poId}/receive`,
      ),
    )
      .send({
        warehouseId,
        idempotencyKey: `receive-bad-line-${poId}`,
        lines: [{ lineId: randomUUID(), quantity: 1 }],
      })
      .expect(400);
  });

  it('forbids creating a purchase order for a warehouse the user has no permission for', async () => {
    await auth(request(app.getHttpServer()).post('/api/v1/purchase-orders'))
      .send({
        supplierId,
        warehouseId: foreignWarehouseId,
        idempotencyKey: `po-forbidden-${productAId}`,
        lines: [{ productId: productAId, quantity: 1, unitCost: 2 }],
      })
      .expect(403);
  });
});
