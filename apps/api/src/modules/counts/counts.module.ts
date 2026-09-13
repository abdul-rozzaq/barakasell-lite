import { Module } from '@nestjs/common';
import { CountsController } from './counts.controller.js';
import { CountsService } from './counts.service.js';

@Module({
  controllers: [CountsController],
  providers: [CountsService],
})
export class CountsModule {}
