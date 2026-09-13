import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ShiftsService } from './shifts.service.js';
import { OpenShiftDto } from './dto/open-shift.dto.js';
import { CloseShiftDto } from './dto/close-shift.dto.js';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequiresPinConfirmation } from '../../common/decorators/requires-pin.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';

@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.shiftsService.findAll();
  }

  @Get('current')
  current(@CurrentUser() user: AuthUser) {
    return this.shiftsService.current(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shiftsService.findOne(id);
  }

  @Post('open')
  open(@Body() dto: OpenShiftDto, @CurrentUser() user: AuthUser) {
    return this.shiftsService.open(dto, user.sub);
  }

  @Post(':id/cash-movements')
  @RequiresPinConfirmation()
  addCashMovement(
    @Param('id') id: string,
    @Body() dto: CreateCashMovementDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shiftsService.addCashMovement(id, dto, user);
  }

  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.shiftsService.close(id, dto, user);
  }
}
