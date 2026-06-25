import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CatalogModule } from './catalog/catalog.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { StockModule } from './stock/stock.module';
import { MovementsModule } from './movements/movements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    WarehousesModule,
    StockModule,
    MovementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
