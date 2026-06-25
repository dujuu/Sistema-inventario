import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../generated/prisma';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-01' },
    update: {},
    create: { code: 'WH-01', name: 'Bodega Central' },
  });

  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@inventario.local' },
    update: {},
    create: {
      email: 'admin@inventario.local',
      name: 'Admin',
      passwordHash,
      warehousePermissions: {
        create: { warehouseId: warehouse.id, role: Role.ADMIN },
      },
    },
  });

  console.log('Seed completo: admin@inventario.local / admin123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
