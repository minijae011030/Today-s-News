/**
 * 뉴스 수집 스크립트
 * feeds.json → RSS 수집 → 중복 제거 → (선택) LLM 요약 → public/data/news.json
 *
 * 실행: npm run collect
 * GEMINI_API_KEY가 있으면 LLM 요약까지, 없으면 수집만 해.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import Parser from "rss-parser";

// 로컬에서는 .env 자동 로드 (Actions에는 파일이 없으니 그냥 넘어감)
try {
  process.loadEnvFile();
} catch {}

type FeedSource =
  | { category: string; type: "rss"; url: string }
  | { category: string; type: "google"; query: string };

export type NewsItem = {
  id: string; // URL용 짧은 ID (key의 해시)
  key: string; // 중복 판별용 (정규화한 제목)
  category: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
  // LLM이 채우는 필드
  summary?: string;
  tags?: string[];
  essayPoint?: string; // 경제 카테고리 전용: 논술 포인트
  spaceFact?: string; // 우주 카테고리 전용: 흥미로운 우주 지식
  titleKo?: string; // 영어 기사면 한국어 제목
};

const OUTPUT = "public/data/news.json";
const KEEP_DAYS = 3;
const MAX_PER_FEED = 15;

const parser = new Parser();

// 직접 받아서 파싱: User-Agent/Accept 헤더 필요한 사이트(406) 대응 +
// 이스케이프 안 된 & 같은 깨진 XML 보정
async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (news-curator; personal RSS reader)",
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  const xml = await res.text();
  return xml.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
}

function toUrl(src: FeedSource): string {
  if (src.type === "rss") return src.url;
  const q = encodeURIComponent(`${src.query} when:2d`);
  return `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
}

function stripHtml(s = ""): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

// 같은 기사가 여러 피드에 걸리는 걸 막기 위한 키
function normalizeTitle(t: string): string {
  return t
    .replace(/\s+-\s+[^-]+$/, "") // 구글 뉴스의 " - 언론사" 꼬리 제거
    .replace(/[\s\p{P}]/gu, "")
    .toLowerCase();
}

// 구글 뉴스는 제목 끝에 " - 언론사"가 붙고, source가 검색어로 나와서 정리
function cleanGoogle(n: NewsItem): NewsItem {
  if (!n.link.includes("news.google.com")) return n;
  const m = n.title.match(/^(.*)\s+-\s+([^-]+)$/);
  if (!m) return n;
  const [, title, source] = m;
  const snippet = n.snippet.replace(n.title, "").replace(title, "").replace(source, "").trim();
  return { ...n, title: title.trim(), source: source.trim(), snippet };
}

async function fetchFeed(src: FeedSource): Promise<NewsItem[]> {
  const url = toUrl(src);
  try {
    const feed = await parser.parseString(await fetchXml(url));
    return (feed.items ?? []).slice(0, MAX_PER_FEED).map((it) => {
      const title = (it.title ?? "").trim();
      const sourceName =
        (it as { source?: string }).source ??
        feed.title ??
        new URL(url).hostname;
      return {
        ...withIds(normalizeTitle(title)),
        category: src.category,
        title,
        link: it.link ?? "",
        source: String(sourceName),
        publishedAt: new Date(
          it.isoDate ?? it.pubDate ?? Date.now(),
        ).toISOString(),
        snippet: stripHtml(it.contentSnippet ?? it.content ?? ""),
      };
    });
  } catch (e) {
    console.warn(
      `⚠️  피드 실패 (${src.category}) ${url}: ${(e as Error).message}`,
    );
    return [];
  }
}

// 같은 기사면 항상 같은 ID가 나오도록 key를 해시해서 10자리로
function withIds(key: string): { id: string; key: string } {
  return { key, id: createHash("sha1").update(key).digest("hex").slice(0, 10) };
}

async function loadPrevious(): Promise<Map<string, NewsItem>> {
  try {
    const prev: NewsItem[] = JSON.parse(await readFile(OUTPUT, "utf8"));
    // 예전 데이터는 id가 제목 기반이었으니 key로 옮기고 새 ID 부여
    return new Map(
      prev.map((n) => {
        const fixed = { ...n, ...withIds(n.key ?? n.id) };
        return [fixed.key, fixed];
      }),
    );
  } catch {
    return new Map();
  }
}

async function save(items: NewsItem[]): Promise<void> {
  await mkdir("public/data", { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(items, null, 2));
}

// Gemini 호출
// - 모델: 가벼운 lite 우선, 없으면(404) flash로
// - 생각(thinking) 최소화 옵션을 순서대로 시도하고, 통하는 조합은 기억해서 재사용
// - 503(과부하)/429(한도)/타임아웃은 잠깐 쉬었다가 재시도
const MODELS = [process.env.GEMINI_MODEL, "gemini-flash-lite-latest", "gemini-flash-latest"].filter(
  (m): m is string => !!m,
);
const THINKING_OPTIONS: object[] = [
  { thinkingConfig: { thinkingLevel: "minimal" } }, // Gemini 3 계열
  { thinkingConfig: { thinkingBudget: 0 } }, // Gemini 2.5 계열
  {}, // 옵션 없이
];
let working: { model: string; thinking: object } | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requestOnce(apiKey: string, model: string, thinking: object, prompt: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000, ...thinking },
      }),
      signal: AbortSignal.timeout(90_000),
    },
  );
  if (!res.ok) {
    return { ok: false as const, status: res.status, error: (await res.text()).slice(0, 200) };
  }
  const data = await res.json();
  const text: string = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  return { ok: true as const, text };
}

// 모델 + 옵션 조합 찾기 (처음 한 번만)
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

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const delays = [5_000, 15_000, 30_000];
  for (let attempt = 0; ; attempt++) {
    try {
      if (!working) return await findWorking(apiKey, prompt);
      const r = await requestOnce(apiKey, working.model, working.thinking, prompt);
      if (r.ok) return r.text;
      throw new Error(`Gemini ${r.status}: ${r.error}`);
    } catch (e) {
      const msg = (e as Error).message;
      const retryable = /Gemini (429|500|503)|timeout|aborted|fetch failed/i.test(msg);
      if (!retryable || attempt >= delays.length) throw e;
      console.log(`   ↻ ${msg.split("\n")[0].slice(0, 60)}… ${delays[attempt] / 1000}초 후 재시도`);
      await sleep(delays[attempt]);
    }
  }
}

async function enrich(items: NewsItem[]): Promise<void> {
  const todo = items.filter(
    (n) => !n.summary || (n.category === "우주" && !n.spaceFact),
  );
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("ℹ️  GEMINI_API_KEY 없음 → LLM 요약 건너뜀");
    return;
  }
  if (todo.length === 0) return;

  const BATCH = 10; // 작게 나눠야 응답이 빨라서 타임아웃·과부하에 덜 걸림

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    console.log(`⏳ LLM 요청 중 ${i + 1}~${i + batch.length}/${todo.length}`);
    const input = batch.map((n, idx) => ({
      idx,
      category: n.category,
      title: n.title,
      snippet: n.snippet,
    }));

    const prompt = `다음 뉴스 목록 각각에 대해 JSON 배열로만 답해.
각 원소: {
  "idx": number,
  "titleKo": "제목이 한국어가 아니면 자연스러운 한국어 제목, 한국어면 null",
  "summary": "한 문장 한국어 요약",
  "tags": ["키워드", 최대 3개],
  "essayPoint": "경제 카테고리만: 금융감독원 논술 관점의 쟁점이나 관련 개념 한 문장. 다른 카테고리는 null",
  "spaceFact": "우주 카테고리만: 이 기사와 연결된, 일반인이 '오 신기하다' 할 만한 우주 지식을 2~3문장으로 쉽게 설명 (예: 기사에 나온 천체나 현상이 무엇이고 왜 흥미로운지). 다른 카테고리는 null"
}
summary는 기사 제목과 요약에 있는 내용만 쓰고 지어내지 마. spaceFact는 널리 확립된 과학 지식만 써.

${JSON.stringify(input)}`;

    try {
      const text = await callGemini(apiKey, prompt);
      const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
      const out: {
        idx: number;
        summary: string;
        tags: string[];
        essayPoint: string | null;
        spaceFact: string | null;
        titleKo: string | null;
      }[] = JSON.parse(json);
      for (const o of out) {
        const n = batch[o.idx];
        if (!n) continue;
        n.summary = o.summary;
        n.tags = o.tags;
        if (o.essayPoint) n.essayPoint = o.essayPoint;
        if (o.spaceFact) n.spaceFact = o.spaceFact;
        if (o.titleKo) n.titleKo = o.titleKo;
      }
      console.log(`🤖 LLM 요약 ${i + batch.length}/${todo.length}`);
      await save(items); // 중간에 끊겨도 여기까지는 저장
      await new Promise((r) => setTimeout(r, 4000)); // 무료 티어 분당 제한 대비
    } catch (e) {
      console.warn(`⚠️  LLM 배치 실패: ${(e as Error).message}`);
    }
  }
}

async function main() {
  const sources: FeedSource[] = JSON.parse(
    await readFile("feeds.json", "utf8"),
  );
  const prev = await loadPrevious();

  const fetched = (await Promise.all(sources.map(fetchFeed))).flat();

  // 이전 데이터 + 새 데이터 병합 (이전 LLM 결과는 재사용해서 비용 절약)
  const merged = new Map([...prev].map(([key, n]) => [key, cleanGoogle(n)]));
  for (const n of fetched) {
    if (!n.key || !n.link) continue;
    if (!merged.has(n.key)) merged.set(n.key, cleanGoogle(n));
  }

  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const items = [...merged.values()]
    .filter((n) => new Date(n.publishedAt).getTime() >= cutoff)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  console.log(`📥 수집 ${fetched.length}건 → 유지 ${items.length}건 (요약 필요 ${items.filter((n) => !n.summary).length}건)`);
  await enrich(items);
  await save(items);
  console.log(`✅ ${items.length}건 저장 → ${OUTPUT}`);
}

main();
