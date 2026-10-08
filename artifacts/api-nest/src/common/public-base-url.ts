import { loadAppConfig } from '../config/configuration';

type HeaderBag = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.split(',')[0]?.trim();

/**
 * Origin used in links we hand out (share pages). PUBLIC_BASE_URL wins; otherwise the
 * request's forwarded host (Replit / proxies) or Host header.
 */
export function resolvePublicBaseUrl(headers: HeaderBag, fallbackProtocol = 'http'): string {
  const configured = loadAppConfig().PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const host = first(headers['x-forwarded-host']) ?? first(headers.host) ?? 'localhost:5000';
  const proto = first(headers['x-forwarded-proto']) ?? fallbackProtocol;
  return `${proto}://${host}`;
}
