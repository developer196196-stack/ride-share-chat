import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatService } from '../chat/chat.service';
import { TranslationService } from '../chat/translation.service';
import { ValidationModule } from '../validation/validation.module';
import { LiveKitService } from './livekit.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AuthModule, ValidationModule],
  controllers: [RoomsController],
  providers: [RoomsService, LiveKitService, ChatService, TranslationService],
  exports: [RoomsService, LiveKitService, ChatService, TranslationService],
})
export class RoomsModule {}
