import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  findAll() {
    return this.catalog.findAll();
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.catalog.create(dto);
  }
}
