import { Inject, Injectable } from '@nestjs/common';
import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreCollections, type ReportDoc } from '@workspace/firebase';
import { requireFirestore } from '../common/require-firestore';
import { FIRESTORE } from '../firebase/firebase.tokens';
import { ChatService } from '../chat/chat.service';
import { RoomsService } from '../rooms/rooms.service';

type ReportInput = {
  roomId?: string | null;
  reportedUid?: string | null;
  reason: ReportDoc['reason'];
  details?: string | null;
};

@Injectable()
export class ReportsService {
  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore | null,
    private readonly rooms: RoomsService,
    private readonly chat: ChatService,
  ) {}

  /** Stores the report with recent room chat so moderators have context. */
  async create(uid: string, input: ReportInput): Promise<{ id: string }> {
    const db = requireFirestore(this.firestore);
    const roomId = input.roomId ?? (await this.rooms.currentRoomId(uid).catch(() => null));
    const recentMessages = roomId ? await this.chat.contextFor(roomId).catch(() => []) : [];
    const doc: ReportDoc = {
      reporterUid: uid,
      reportedUid: input.reportedUid ?? null,
      roomId,
      reason: input.reason,
      details: input.details?.trim() || null,
      recentMessages,
      status: 'open',
      createdAt: Timestamp.now(),
    };
    const ref = await db.collection(FirestoreCollections.reports).add(doc);
    return { id: ref.id };
  }
}
