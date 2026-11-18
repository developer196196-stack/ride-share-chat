import { redirect } from 'next/navigation';

/** Room Categories moved into Trip Validation & Modes (room types section). */
export default function RoomCategoriesMoved() {
  redirect('/dashboard/settings#room-types');
}
