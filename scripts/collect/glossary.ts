// 용어 사전 (glossary.json): 기사에서 뽑힌 용어 중 사전에 없는 것만 Gemini로 한 번 정의해서 계속 재사용
import { mkdir, writeFile } from "node:fs/promises";
import { DATA_DIR, MAX_NEW_TERMS, report, type NewsItem } from "./config.ts";
import { callGemini, geminiKey } from "./gemini.ts";
import { kstToday, parseJson, readData } from "./util.ts";

export type GlossaryEntry = {
  term: string; // 대표 표기
  aliases?: string[]; // 다른 표기 (예: 총부채원리금상환비율 ↔ DSR)
  definition: string;
  addedAt: string;
};

// 표기 비교용: 띄어쓰기·괄호·대소문자 무시
export const termKey = (t: string) => t.toLowerCase().replace(/[\s()\[\]·・\-_'"“”‘’]/g, "");

export async function updateGlossary(items: NewsItem[]): Promise<void> {
  const apiKey = geminiKey();
  if (!apiKey) return;
  const glossary = (await readData<GlossaryEntry[]>("glossary.json")) ?? [];
  const known = new Set(glossary.flatMap((e) => [e.term, ...(e.aliases ?? [])].map(termKey)));

  // 사전에 없는 용어 (자주 나온 것부터)
  const count = new Map<string, number>();
  for (const n of items) for (const t of n.terms ?? []) if (!known.has(termKey(t))) count.set(t, (count.get(t) ?? 0) + 1);
  const seen = new Set<string>();
  const missing = [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter((t) => !seen.has(termKey(t)) && seen.add(termKey(t)))
    .slice(0, MAX_NEW_TERMS);
  if (missing.length === 0) return;

  const prompt = `금융감독원 논술을 준비하는 사람을 위한 경제·금융 용어 사전을 만들고 있어. 아래 용어 각각을 JSON 배열로만 답해.
각 원소: {
  "term": "주어진 표기 그대로",
  "aliases": ["같은 뜻의 다른 표기 (약어↔정식 명칭 등), 없으면 빈 배열"],
  "definition": "무엇인지 1~2문장. 교과서적으로 정확하게, 널리 확립된 내용만. 특정 기사 내용이나 최근 수치는 넣지 마. 문체는 '~입니다/~합니다'"
}
일반 명사이거나 용어 사전에 넣을 만한 전문 용어가 아니면 그 원소는 빼.

용어: ${JSON.stringify(missing)}`;

  try {
    const out = parseJson<{ term: string; aliases?: string[]; definition: string }[]>(
      await callGemini(apiKey, prompt),
      "[",
    );
    const today = kstToday();
    const added: GlossaryEntry[] = [];
    for (const o of out) {
      if (!o.term || !o.definition || known.has(termKey(o.term))) continue;
      const aliases = (o.aliases ?? []).map(String).filter((a) => a && termKey(a) !== termKey(o.term)).slice(0, 4);
      added.push({ term: o.term, ...(aliases.length ? { aliases } : {}), definition: o.definition, addedAt: today });
      for (const k of [o.term, ...aliases]) known.add(termKey(k));
    }
    if (added.length === 0) return;
    const next = [...glossary, ...added].sort((a, b) => a.term.localeCompare(b.term, "ko"));
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(`${DATA_DIR}/glossary.json`, JSON.stringify(next, null, 2));
    report.newTerms = added.map((e) => e.term);
    console.log(`📖 용어 사전 +${added.length} (총 ${next.length}): ${report.newTerms.join(", ")}`);
  } catch (e) {
    console.warn(`⚠️  용어 사전 실패: ${(e as Error).message}`);
  }
}
