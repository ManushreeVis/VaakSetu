/**
 * Demo Adapter Facade for VaakSetu.
 *
 * Re-exports from `gemini-adapter.ts` for the local working demo.
 * In an on-premises deployment, this file is swapped with `onprem-adapter.ts`
 * (IndicTrans2, Whisper, AI4Bharat TTS, local open-source LLM).
 */

export { aiEngines, extractDocumentText } from "./bhashini-adapter";
