// 오늘의 개념 (KST 기준 하루 한 번): 보도자료·경제·정치에서 논술에 쓸 개념 하나
import { mkdir, writeFile } from "node:fs/promises";
import { DATA_DIR, PRESS_LABEL, report, type NewsItem } from "./config.ts";
import { callGemini, geminiKey } from "./gemini.ts";
import { kstToday, parseJson, readData } from "./util.ts";

type Concept = {
  date: string; // KST 기준 YYYY-MM-DD
  term: string;
  definition: string;
  issues: string[];
  essayAngle: string;
  relatedIds: string[];
};

export async function makeConcept(items: NewsItem[]): Promise<void> {
  const apiKey = geminiKey();
  if (!apiKey) return;
  let history = (await readData<{ history?: Concept[] }>("concept.json"))?.history ?? [];
  const today = kstToday();
  if (history[0]?.date === today) return; // 오늘 건 이미 있음

  const pool = items
    .filter((n) => !n.hidden && n.summary && [PRESS_LABEL, "경제", "정치"].includes(n.category))
    .sort((a, b) => Number(b.label === PRESS_LABEL) - Number(a.label === PRESS_LABEL)) // 보도자료 먼저
    .slice(0, 20)
    .map((n) => ({ id: n.id, category: n.category, title: n.title, summary: n.summary, essayPoint: n.essayPoint }));
  if (pool.length < 3) return;

  const recent = history.slice(0, 30).map((c) => c.term);
  const prompt = `너는 금융감독원 논술을 준비하는 사람의 스터디 코치야.
아래 오늘 기사들을 보고, 논술에 가장 쓸모 있는 경제·금융 개념 하나를 골라 정리해서 JSON 객체 하나로만 답해.
최근에 다룬 개념은 피해: ${JSON.stringify(recent)}

형식: {
  "term": "개념 이름 (예: 책무구조도, 스트레스 DSR, 공매도 전산화)",
  "definition": "이 개념이 무엇인지 2~3문장. 교과서적으로 정확하게",
  "issues": ["찬반이나 쟁점 한 줄씩, 2~3개"],
  "essayAngle": "논술 답안에서 이 개념을 어떻게 끌어다 쓰면 좋은지 1~2문장",
  "relatedIds": ["이 개념과 관련된 기사 id, 1~3개"]
}
definition과 issues는 널리 알려진 사실만 쓰고, 기사 내용은 relatedIds로만 연결해.

기사: ${JSON.stringify(pool)}`;

  try {
    const c = parseJson<Partial<Concept>>(await callGemini(apiKey, prompt), "{");
    const ids = new Set(pool.map((p) => p.id));
    const concept: Concept = {
      date: today,
      term: String(c.term),
      definition: String(c.definition),
      issues: (c.issues ?? []).map(String).slice(0, 3),
      essayAngle: String(c.essayAngle ?? ""),
      relatedIds: (c.relatedIds ?? []).map(String).filter((id) => ids.has(id)).slice(0, 3),
    };
    history = [concept, ...history].slice(0, 30);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(`${DATA_DIR}/concept.json`, JSON.stringify({ history }, null, 2));
    report.concept = concept.term;
    console.log(`📘 오늘의 개념: ${concept.term}`);
  } catch (e) {
    console.warn(`⚠️  오늘의 개념 실패: ${(e as Error).message}`);
  }
}
