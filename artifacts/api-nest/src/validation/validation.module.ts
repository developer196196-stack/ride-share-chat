import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoadMatcher } from './road-matcher';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';

@Module({
  imports: [AuthModule],
  controllers: [ValidationController],
  providers: [ValidationService, RoadMatcher],
  exports: [ValidationService, RoadMatcher],
})
export class ValidationModule {}
