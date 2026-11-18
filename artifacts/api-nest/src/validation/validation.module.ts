import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoadMatcher } from './road-matcher';
import { TestOverridesService } from './test-overrides.service';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';

@Module({
  imports: [AuthModule],
  controllers: [ValidationController],
  providers: [ValidationService, RoadMatcher, TestOverridesService],
  exports: [ValidationService, RoadMatcher, TestOverridesService],
})
export class ValidationModule {}
