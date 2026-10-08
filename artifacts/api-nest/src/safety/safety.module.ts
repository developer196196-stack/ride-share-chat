import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ValidationModule } from '../validation/validation.module';
import { ReportsService } from './reports.service';
import { SafetyController, SharePageController } from './safety.controller';
import { SafetyService } from './safety.service';

@Module({
  imports: [AuthModule, ValidationModule, RoomsModule],
  controllers: [SafetyController, SharePageController],
  providers: [SafetyService, ReportsService],
  exports: [SafetyService],
})
export class SafetyModule {}
