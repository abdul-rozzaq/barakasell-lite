import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdatePinDto } from './dto/update-pin.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequiresPinConfirmation } from '../../common/decorators/requires-pin.decorator.js';
import { Audit } from '../../common/decorators/audit.decorator.js';
import { UserRole } from '../../generated/prisma/client.js';

@Controller('users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Audit({ action: 'Foydalanuvchi', entity: 'User' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id/status')
  @Audit({ action: 'Foydalanuvchi', entity: 'User' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }

  @Patch(':id/pin')
  @RequiresPinConfirmation()
  @Audit({ action: 'Foydalanuvchi', entity: 'User' })
  updatePin(@Param('id') id: string, @Body() dto: UpdatePinDto) {
    return this.usersService.updatePin(id, dto.pin);
  }
}
