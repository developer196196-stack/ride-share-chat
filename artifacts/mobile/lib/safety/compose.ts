/**
 * Phase-one safety messaging: everything goes through the rider's own SMS, WhatsApp or email
 * app, pre-filled, and the rider taps Send. Nothing is sent by our server.
 */
import { Linking, Platform, Share } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import { getLocales } from 'expo-localization';
import type { TrustedContact } from '@workspace/api-client-react';

/** Local emergency numbers; 112 works across the EU and many other countries. */
const EMERGENCY_NUMBERS: Record<string, string> = {
  US: '911', CA: '911', MX: '911', SA: '911', PH: '911', AR: '911',
  GB: '999', AE: '999', HK: '999', MY: '999', SG: '999',
  AU: '000', NZ: '111', IN: '112', PK: '15', BR: '190', JP: '110', CN: '110', KR: '112',
};

export function emergencyNumberFor(countryCode?: string | null): string {
  const region = (countryCode ?? getLocales()[0]?.regionCode ?? '').toUpperCase();
  return EMERGENCY_NUMBERS[region] ?? '112';
}

export async function callEmergency(countryCode?: string | null): Promise<void> {
  await Linking.openURL(`tel:${emergencyNumberFor(countryCode)}`);
}

/** Opens the SMS composer with every recipient filled in. Returns false if SMS isn't available. */
export async function composeSms(phones: string[], body: string): Promise<boolean> {
  if (Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
    await SMS.sendSMSAsync(phones, body);
    return true;
  }
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${phones.join(',')}${separator}body=${encodeURIComponent(body)}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
    return true;
  }
  return false;
}

/** WhatsApp takes one recipient per chat. */
export async function composeWhatsApp(phone: string, body: string): Promise<boolean> {
  const digits = phone.replace(/\D/g, '');
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function composeEmail(emails: string[], subject: string, body: string): Promise<boolean> {
  if (Platform.OS !== 'web' && (await MailComposer.isAvailableAsync())) {
    await MailComposer.composeAsync({ recipients: emails, subject, body });
    return true;
  }
  const url = `mailto:${emails.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Generic OS share sheet (any app). */
export async function shareAnyApp(body: string): Promise<void> {
  await Share.share({ message: body });
}

/** Sends to one contact through their preferred channel. */
export async function sendToContact(contact: TrustedContact, body: string, subject: string): Promise<boolean> {
  if (contact.channel === 'whatsapp' && contact.phone) return composeWhatsApp(contact.phone, body);
  if (contact.channel === 'email' && contact.email) return composeEmail([contact.email], subject, body);
  if (contact.phone) return composeSms([contact.phone], body);
  return false;
}
