import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

/** A file in /public. The app is served under a basePath (/admin) that next/image doesn't add itself. */
export function publicAsset(path: string): string {
  return `${process.env.NEXT_PUBLIC_ADMIN_BASE_PATH ?? ''}${path}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
