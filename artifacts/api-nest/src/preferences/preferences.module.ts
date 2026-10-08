import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfilesService } from '../profiles/profiles.service';
import { ValidationModule } from '../validation/validation.module';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

/** Global: rooms, chat and safety all read preferences and public profiles. */
@Global()
@Module({
  imports: [AuthModule, ValidationModule],
  controllers: [PreferencesController],
  providers: [PreferencesService, ProfilesService],
  exports: [PreferencesService, ProfilesService],
})
export class PreferencesModule {}
