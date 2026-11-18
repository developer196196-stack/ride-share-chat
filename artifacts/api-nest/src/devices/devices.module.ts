import { Global, Module } from '@nestjs/common';
import { DevicesService } from './devices.service';

/** Global: the auth guard and the realtime gateway check every request against blocked devices. */
@Global()
@Module({
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
