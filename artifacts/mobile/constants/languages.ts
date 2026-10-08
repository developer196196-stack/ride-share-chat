/** Languages offered for native language / translation (Google Cloud Translation codes). */
export const LANGUAGES: { code: string; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'ur', label: 'Urdu', native: 'اردو' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'it', label: 'Italian', native: 'Italiano' },
  { code: 'ru', label: 'Russian', native: 'Русский' },
  { code: 'tr', label: 'Turkish', native: 'Türkçe' },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ms', label: 'Malay', native: 'Bahasa Melayu' },
  { code: 'th', label: 'Thai', native: 'ไทย' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'tl', label: 'Filipino', native: 'Filipino' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'ko', label: 'Korean', native: '한국어' },
];

export function languageLabel(code: string): string {
  const base = code.toLowerCase();
  const match =
    LANGUAGES.find((l) => l.code.toLowerCase() === base) ??
    LANGUAGES.find((l) => l.code.split('-')[0] === base.split('-')[0]);
  return match?.label ?? code;
}
