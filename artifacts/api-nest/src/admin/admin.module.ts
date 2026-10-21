import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ValidationModule } from '../validation/validation.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

/** Admin panel API (`/api/v1/admin/*`) for artifacts/admin-web. */
@Module({
  imports: [AuthModule, ValidationModule, RoomsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
