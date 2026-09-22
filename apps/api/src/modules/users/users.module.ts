import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { OwnerLinkModule } from '../owner-link/owner-link.module.js';

@Module({
  imports: [OwnerLinkModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
