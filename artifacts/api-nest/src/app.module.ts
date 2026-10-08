import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HttpLoggingMiddleware } from './common/http-logging.middleware';
import { DocsModule } from './docs/docs.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HealthModule } from './health/health.module';
import { PreferencesModule } from './preferences/preferences.module';
import { GatewayModule } from './realtime/gateway.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';
import { RoomsModule } from './rooms/rooms.module';
import { SafetyModule } from './safety/safety.module';
import { ValidationModule } from './validation/validation.module';
import { loadAppConfig } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FirebaseModule,
    RedisModule,
    RealtimeModule,
    HealthModule,
    DocsModule,
    AuthModule,
    ValidationModule,
    PreferencesModule,
    RoomsModule,
    SafetyModule,
    GatewayModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    const config = loadAppConfig();
    if (config.NODE_ENV === 'development') {
      consumer.apply(HttpLoggingMiddleware).forRoutes('*');
    }
  }
}
