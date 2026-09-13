import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ReceiptsService } from './receipts.service.js';
import { CreateReceiptDto } from './dto/create-receipt.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  findAll() {
    return this.receiptsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receiptsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateReceiptDto, @CurrentUser() user: AuthUser) {
    return this.receiptsService.create(dto, user.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateReceiptDto) {
    return this.receiptsService.update(id, dto);
  }

  @Post(':id/post')
  post(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.receiptsService.post(id, user.sub);
  }
}
