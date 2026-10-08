import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

/** Global so feature modules can push events; the gateway lives in GatewayModule. */
@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
