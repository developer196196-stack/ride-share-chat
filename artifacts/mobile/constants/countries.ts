/** Dial codes offered on the Authentication screen. First entry is the default. */
export type Country = {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
  /** National number length range (digits, without the dial code). */
  minDigits: number;
  maxDigits: number;
};

export const COUNTRIES: Country[] = [
  { iso: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', minDigits: 10, maxDigits: 10 },
  { iso: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', minDigits: 10, maxDigits: 10 },
  { iso: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', minDigits: 9, maxDigits: 10 },
  { iso: 'PK', name: 'Pakistan', dialCode: '+92', flag: '🇵🇰', minDigits: 10, maxDigits: 10 },
  { iso: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', minDigits: 10, maxDigits: 10 },
  { iso: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', minDigits: 8, maxDigits: 9 },
  { iso: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', minDigits: 9, maxDigits: 9 },
  { iso: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', minDigits: 9, maxDigits: 9 },
  { iso: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', minDigits: 10, maxDigits: 11 },
  { iso: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', minDigits: 9, maxDigits: 9 },
  { iso: 'MX', name: 'Mexico', dialCode: '+52', flag: '🇲🇽', minDigits: 10, maxDigits: 10 },
  { iso: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', minDigits: 10, maxDigits: 11 },
];

export const DEFAULT_COUNTRY = COUNTRIES[0];

/** Digits only, without a trunk-prefix 0 (e.g. UK "07…" → "7…"). */
export function normalizeNationalNumber(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+/, '');
}

export function toE164(country: Country, nationalInput: string): string {
  return `${country.dialCode}${normalizeNationalNumber(nationalInput)}`;
}

export function isValidNationalNumber(country: Country, nationalInput: string): boolean {
  const digits = normalizeNationalNumber(nationalInput);
  return digits.length >= country.minDigits && digits.length <= country.maxDigits;
}

/** "(555) 382-9104" for NANP numbers; grouped digits elsewhere. */
export function formatNationalNumber(country: Country, nationalInput: string): string {
  const digits = normalizeNationalNumber(nationalInput).slice(0, country.maxDigits);
  if (country.dialCode === '+1') {
    if (digits.length <= 3) return digits.length ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // 3-3-rest grouping, e.g. "300 123 4567".
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(' ');
}
