// Gemini 호출
// - 모델: 가벼운 lite 우선, 없으면(404) flash로
// - 생각(thinking) 최소화 옵션을 순서대로 시도하고, 통하는 조합은 기억해서 재사용
// - 503(과부하)/429(한도)/타임아웃은 잠깐 쉬었다가 재시도
import { sleep } from "./util.ts";

const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-lite-latest", "gemini-flash-latest"].filter(
  (m): m is string => !!m,
);
const THINKING_OPTIONS: object[] = [
  { thinkingConfig: { thinkingLevel: "minimal" } }, // Gemini 3 계열
  { thinkingConfig: { thinkingBudget: 0 } }, // Gemini 2.5 계열
  {}, // 옵션 없이
];
let working: { model: string; thinking: object } | null = null;

export const geminiKey = () => process.env.GEMINI_API_KEY;

async function requestOnce(apiKey: string, model: string, thinking: object, prompt: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 6000, ...thinking },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) return { ok: false as const, status: res.status, error: (await res.text()).slice(0, 200) };
  const data = await res.json();
  const text: string = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  return { ok: true as const, text };
}

async function findWorking(apiKey: string, prompt: string): Promise<string> {
  let lastErr = "";
  for (const model of MODELS) {
    for (const thinking of THINKING_OPTIONS) {
      const r = await requestOnce(apiKey, model, thinking, prompt);
      if (r.ok) {
        working = { model, thinking };
        console.log(`✨ 사용 모델: ${model} ${JSON.stringify(thinking)}`);
        return r.text;
      }
      lastErr = `Gemini ${r.status}: ${r.error}`;
      if (r.status === 404) break; // 이 모델 없음 → 다음 모델
      if (r.status !== 400) throw new Error(lastErr); // 503/429 등은 바깥 재시도로
    }
  }
  throw new Error(lastErr);
}

export async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const delays = [5_000, 15_000, 30_000];
  for (let attempt = 0; ; attempt++) {
    try {
      if (!working) return await findWorking(apiKey, prompt);
      const r = await requestOnce(apiKey, working.model, working.thinking, prompt);
      if (r.ok) return r.text;
      throw new Error(`Gemini ${r.status}: ${r.error}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (!/Gemini (429|500|503)|timeout|aborted|fetch failed/i.test(msg) || attempt >= delays.length) throw e;
      console.log(`   ↻ ${msg.split("\n")[0].slice(0, 60)}… ${delays[attempt] / 1000}초 후 재시도`);
      await sleep(delays[attempt]);
    }
  }
}
