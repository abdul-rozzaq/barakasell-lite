import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CountsService } from './counts.service.js';
import { CreateInventoryCountDto } from './dto/create-count.dto.js';
import { UpdateCountLinesDto } from './dto/update-count-lines.dto.js';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequiresPinConfirmation } from '../../common/decorators/requires-pin.decorator.js';
import { Audit } from '../../common/decorators/audit.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';

@Controller('inventory-counts')
@Roles(UserRole.ADMIN)
export class CountsController {
  constructor(private readonly countsService: CountsService) {}

  @Get()
  findAll() {
    return this.countsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.countsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInventoryCountDto, @CurrentUser() user: AuthUser) {
    return this.countsService.create(dto, user.sub);
  }

  @Patch(':id/lines')
  updateLines(@Param('id') id: string, @Body() dto: UpdateCountLinesDto) {
    return this.countsService.updateLines(id, dto);
  }

  @Post(':id/post')
  @RequiresPinConfirmation()
  @Audit({ action: 'Inventarizatsiya', entity: 'InventoryCount' })
  post(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.countsService.post(id, user.sub);
  }
}
