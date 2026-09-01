/**
 * Language registry for VaakSetu.
 * Source languages (input): Marathi, Hindi, English (+ auto-detect).
 * Target languages (translated output): Marathi, Hindi, English.
 */

export type LanguageCode = "mr" | "hi" | "en" | "auto";

export interface Language {
  code: "mr" | "hi" | "en";
  /** English name */
  name: string;
  /** Native name (endonym) */
  nativeName: string;
  /** ISO 639-1 code */
  iso6391: string;
  /** Script used */
  script: string;
  /** BCP-47 tag */
  bcp47: string;
  /** IndicTrans2 script identifier (roman → native handled by model) */
  indicTrans2Lang: string;
  /** Whisper ASR language hint */
  whisperLang: string;
  /** Sample flag emoji */
  flag: string;
}

export const LANGUAGES: Record<"mr" | "hi" | "en", Language> = {
  mr: {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    iso6391: "mr",
    script: "Devanagari",
    bcp47: "mr-IN",
    indicTrans2Lang: "mar_Deva",
    whisperLang: "mr",
    flag: "🇮🇳",
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    iso6391: "hi",
    script: "Devanagari",
    bcp47: "hi-IN",
    indicTrans2Lang: "hin_Deva",
    whisperLang: "hi",
    flag: "🇮🇳",
  },
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    iso6391: "en",
    script: "Latin",
    bcp47: "en-IN",
    indicTrans2Lang: "eng_Latn",
    whisperLang: "en",
    flag: "🇬🇧",
  },
};

export const LANGUAGE_LIST: Language[] = [LANGUAGES.mr, LANGUAGES.hi, LANGUAGES.en];

/** Languages allowed as a translation source (explicit selection). */
export const SOURCE_LANGUAGES: { code: LanguageCode; label: string; native: string }[] =
  LANGUAGE_LIST.map((l) => ({ code: l.code, label: l.name, native: l.nativeName }));

/** Languages allowed as a translation target. */
export const TARGET_LANGUAGES = LANGUAGE_LIST.map((l) => ({
  code: l.code,
  label: l.name,
  native: l.nativeName,
}));

export const getLanguage = (code: string): Language | undefined =>
  code === "auto" ? undefined : LANGUAGES[code as "mr" | "hi" | "en"];

export const languageLabel = (code: string): string => {
  if (code === "auto") return "Auto-detect";
  return LANGUAGES[code as "mr" | "hi" | "en"]?.name ?? code;
};

export const languageNative = (code: string): string => {
  if (code === "auto") return "स्वयं";
  return LANGUAGES[code as "mr" | "hi" | "en"]?.nativeName ?? code;
};
