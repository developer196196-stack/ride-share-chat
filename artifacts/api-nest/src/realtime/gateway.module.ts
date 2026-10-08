import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module';
import { SafetyModule } from '../safety/safety.module';
import { ValidationModule } from '../validation/validation.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [ValidationModule, RoomsModule, SafetyModule],
  providers: [RealtimeGateway],
})
export class GatewayModule {}
