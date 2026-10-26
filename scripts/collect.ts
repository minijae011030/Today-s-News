/**
 * 뉴스 수집 스크립트
 * feeds.json → (네이버 뉴스 검색 / RSS) 수집 → 중복 제거
 *   → 원문 본문 추출 → Gemini 요약 → public/data/news.json
 *
 * 실행: npm run collect
 * 필요한 환경변수(.env): GEMINI_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// 로컬에서는 .env 자동 로드 (Actions에는 파일이 없으니 그냥 넘어감)
try {
  process.loadEnvFile();
} catch {}

type FeedSource =
  | { category: string; type: "rss"; url: string }
  | { category: string; type: "naver"; query: string }
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
  essayPoint?: string; // 경제 전용: 논술 포인트
  spaceFact?: string; // 우주 전용: 흥미로운 우주 지식
  titleKo?: string; // 영어 기사면 한국어 제목
};

// 공식 데이터(public/data)는 GitHub Actions 봇만 커밋하고,
// 로컬에서 돌린 결과는 git에 안 올라가는 public/data-local에 따로 저장 (main과 충돌 방지)
const IS_CI = !!process.env.CI;
const DATA_DIR = IS_CI ? "public/data" : "public/data-local";
const OUTPUT = `${DATA_DIR}/news.json`;
const SHARED = "public/data/news.json"; // 로컬 첫 실행 때 봇이 만든 요약을 재사용
const KEEP_DAYS = 3;
const MAX_PER_FEED = 15;
const BODY_CHARS = 2000; // LLM에 넘길 본문 길이
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ================= 공통 유틸 ================= */

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

function stripHtml(s = "", max = 300): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// 같은 기사가 여러 피드에 걸리는 걸 막기 위한 키
function normalizeTitle(t: string): string {
  return t
    .replace(/\s+-\s+[^-]+$/, "") // 구글 뉴스의 " - 언론사" 꼬리 제거
    .replace(/[\s\p{P}]/gu, "")
    .toLowerCase();
}

// 같은 기사면 항상 같은 ID가 나오도록 key를 해시해서 10자리로
function withIds(key: string): { id: string; key: string } {
  return { key, id: createHash("sha1").update(key).digest("hex").slice(0, 10) };
}

// 네이버 API는 언론사 이름을 안 줘서 도메인으로 추정 (본문 수집 때 og:site_name으로 덮어씀)
const PRESS: Record<string, string> = {
  "hankyung.com": "한국경제", "mk.co.kr": "매일경제", "yna.co.kr": "연합뉴스",
  "chosun.com": "조선일보", "biz.chosun.com": "조선비즈", "joongang.co.kr": "중앙일보",
  "donga.com": "동아일보", "hani.co.kr": "한겨레", "khan.co.kr": "경향신문",
  "etnews.com": "전자신문", "zdnet.co.kr": "지디넷코리아", "sedaily.com": "서울경제",
  "mt.co.kr": "머니투데이", "edaily.co.kr": "이데일리", "newsis.com": "뉴시스",
  "news1.kr": "뉴스1", "ytn.co.kr": "YTN", "kbs.co.kr": "KBS", "imbc.com": "MBC",
  "sbs.co.kr": "SBS", "bloter.net": "블로터", "dongascience.com": "동아사이언스",
  "fnnews.com": "파이낸셜뉴스", "asiae.co.kr": "아시아경제", "heraldcorp.com": "헤럴드경제",
};
function pressName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(www|m|news)\./, "");
    const hit = Object.keys(PRESS).find((d) => host === d || host.endsWith("." + d));
    return hit ? PRESS[hit] : host;
  } catch {
    return "";
  }
}

/* ================= 수집: RSS ================= */

const parser = new Parser();

// User-Agent 필요한 사이트(406) 대응 + 이스케이프 안 된 & 보정
async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  let xml = await res.text();
  // 앞부분(rss/channel 태그 속성)에서 속성 사이 공백이 빠진 경우 보정: a="1"b="2" → a="1" b="2"
  const head = xml.slice(0, 3000).replace(/"(?=[a-zA-Z_][\w:.-]*=")/g, '" ');
  xml = head + xml.slice(3000);
  return xml.replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
}

function rssUrl(src: FeedSource): string {
  if (src.type === "rss") return src.url;
  const q = encodeURIComponent(`${(src as { query: string }).query} when:2d`);
  return `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
}

async function fetchRss(src: FeedSource): Promise<NewsItem[]> {
  const url = rssUrl(src);
  const feed = await parser.parseString(await fetchXml(url));
  return (feed.items ?? []).slice(0, MAX_PER_FEED).map((it) => {
    const title = stripHtml(it.title ?? "", 500);
    return {
      ...withIds(normalizeTitle(title)),
      category: src.category,
      title,
      link: it.link ?? "",
      source: String((it as { source?: string }).source ?? feed.title ?? pressName(url)),
      publishedAt: new Date(it.isoDate ?? it.pubDate ?? Date.now()).toISOString(),
      snippet: stripHtml(it.contentSnippet ?? it.content ?? ""),
    };
  });
}

/* ================= 수집: 네이버 뉴스 검색 (NAVER API HUB) ================= */

type NaverNews = { title: string; originallink: string; link: string; description: string; pubDate: string };

async function fetchNaver(src: { category: string; query: string }): Promise<NewsItem[]> {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음");

  const url =
    `https://naverapihub.apigw.ntruss.com/search/v1/news` +
    `?query=${encodeURIComponent(src.query)}&display=${MAX_PER_FEED}&sort=date`;
  const res = await fetch(url, {
    headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`네이버 ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data: { items?: NaverNews[] } = await res.json();

  return (data.items ?? []).map((it) => {
    const title = stripHtml(it.title, 500);
    const link = it.originallink || it.link;
    return {
      ...withIds(normalizeTitle(title)),
      category: src.category,
      title,
      link,
      source: pressName(link),
      publishedAt: new Date(it.pubDate).toISOString(),
      snippet: stripHtml(it.description),
    };
  });
}

async function fetchSource(src: FeedSource): Promise<NewsItem[]> {
  try {
    return src.type === "naver" ? await fetchNaver(src) : await fetchRss(src);
  } catch (e) {
    const label = src.type === "rss" ? src.url : src.query;
    console.warn(`⚠️  피드 실패 (${src.category}) ${label}: ${(e as Error).message}`);
    return [];
  }
}

// 구글 뉴스는 제목 끝에 " - 언론사"가 붙고, source가 검색어로 나와서 정리 (예전 데이터용)
function cleanGoogle(n: NewsItem): NewsItem {
  if (!n.link.includes("news.google.com")) return n;
  const m = n.title.match(/^(.*)\s+-\s+([^-]+)$/);
  if (!m) return n;
  const [, title, source] = m;
  const snippet = n.snippet.replace(n.title, "").replace(title, "").replace(source, "").trim();
  return { ...n, title: title.trim(), source: source.trim(), snippet };
}

/* ================= 원문 본문 추출 ================= */

// 국내 사이트는 EUC-KR도 있어서 charset을 보고 디코딩
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*", "Accept-Language": "ko-KR,ko;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder("latin1").decode(buf.slice(0, 4000));
  const charset =
    res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

// 잘린 제목("...")이면 원문 페이지의 og:title로 복원. 앞부분이 같은 경우만 교체해서 엉뚱한 제목은 막음
const TRUNCATED = /(\.\.\.|…)\s*$/;
function restoreTitle(n: NewsItem, fullTitle?: string, siteName?: string): void {
  if (!fullTitle || !TRUNCATED.test(n.title)) return;
  let t = fullTitle.trim();
  for (const name of [siteName, n.source].filter(Boolean) as string[]) {
    t = t.replace(new RegExp(`\\s*[|\\-–:]\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
  }
  const prefix = n.title.replace(TRUNCATED, "").trim().slice(0, 12);
  if (t.length > n.title.length - 3 && t.startsWith(prefix)) n.title = t;
}

async function fetchBody(
  url: string,
): Promise<{ text: string; siteName?: string; title?: string } | null> {
  if (!url || url.includes("news.google.com")) return null; // 구글 리다이렉트 링크는 건너뜀
  try {
    const html = await fetchHtml(url);
    const { document } = parseHTML(html);
    const siteName =
      document.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() || undefined;
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() || undefined;
    const article = new Readability(document as unknown as Document).parse();
    const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();
    const title = ogTitle ?? article?.title ?? undefined;
    return text.length >= 200 ? { text, siteName, title } : { text: "", siteName, title };
  } catch {
    return null;
  }
}

/* ================= Gemini ================= */
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

/* ================= 요약 ================= */

async function save(items: NewsItem[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(items, null, 2));
  // 푸터의 "마지막 수집" 표시용
  await writeFile(
    `${DATA_DIR}/meta.json`,
    JSON.stringify({ updatedAt: new Date().toISOString(), count: items.length }, null, 2),
  );
}

const PROMPT = `다음 뉴스 목록 각각에 대해 JSON 배열로만 답해.
각 원소: {
  "idx": number,
  "titleKo": "제목이 한국어가 아니면 자연스러운 한국어 제목, 한국어면 null",
  "summary": "한국어 요약. body가 있으면 핵심 사실(누가, 무엇을, 왜, 수치)을 담아 3~4문장. body가 null이면 snippet 기준으로 1~2문장",
  "tags": ["키워드", 최대 3개],
  "essayPoint": "경제 카테고리만: 금융감독원 논술 관점에서 이 기사의 쟁점과 연결되는 개념(예: 금융소비자보호, 건전성 규제, 시스템 리스크)을 2문장으로. 다른 카테고리는 null",
  "spaceFact": "우주 카테고리만: 이 기사와 연결된, 일반인이 '오 신기하다' 할 만한 우주 지식을 2~3문장으로 쉽게 설명 (기사에 나온 천체나 현상이 무엇이고 왜 흥미로운지). 다른 카테고리는 null"
}
summary와 essayPoint는 제공된 title, snippet, body에 있는 내용만 근거로 쓰고 지어내지 마. spaceFact는 널리 확립된 과학 지식만 써.`;

// 이미 요약된 기사 중 제목이 잘린 것만 원문 제목으로 복원 (LLM 호출 없음)
async function fixTruncatedTitles(items: NewsItem[]): Promise<void> {
  const targets = items.filter((n) => n.summary && TRUNCATED.test(n.title));
  for (let i = 0; i < targets.length; i += 8) {
    const chunk = targets.slice(i, i + 8);
    const bodies = await Promise.all(chunk.map((n) => fetchBody(n.link)));
    chunk.forEach((n, idx) => restoreTitle(n, bodies[idx]?.title, bodies[idx]?.siteName));
  }
  if (targets.length) {
    const left = targets.filter((n) => TRUNCATED.test(n.title)).length;
    console.log(`✂️  잘린 제목 복원 ${targets.length - left}/${targets.length}`);
  }
}

async function enrich(items: NewsItem[]): Promise<void> {
  const todo = items.filter((n) => !n.summary || (n.category === "우주" && !n.spaceFact));
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("ℹ️  GEMINI_API_KEY 없음 → LLM 요약 건너뜀");
    return;
  }
  if (todo.length === 0) return;

  const BATCH = 8; // 본문이 붙어서 조금 더 작게

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    console.log(`⏳ ${i + 1}~${i + batch.length}/${todo.length} 본문 수집 + 요약 중`);

    const bodies = await Promise.all(batch.map((n) => fetchBody(n.link)));
    batch.forEach((n, idx) => {
      const site = bodies[idx]?.siteName;
      if (site && site.length <= 20) n.source = site;
      restoreTitle(n, bodies[idx]?.title, site);
    });
    const gotBody = bodies.filter((b) => b?.text).length;

    const input = batch.map((n, idx) => ({
      idx,
      category: n.category,
      title: n.title,
      snippet: n.snippet,
      body: bodies[idx]?.text ? bodies[idx]!.text.slice(0, BODY_CHARS) : null,
    }));

    try {
      const text = await callGemini(apiKey, `${PROMPT}\n\n${JSON.stringify(input)}`);
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
      console.log(`🤖 요약 ${i + batch.length}/${todo.length} (본문 확보 ${gotBody}/${batch.length})`);
      await save(items); // 중간에 끊겨도 여기까지는 저장
      await sleep(4000); // 무료 티어 분당 제한 대비
    } catch (e) {
      console.warn(`⚠️  LLM 배치 실패: ${(e as Error).message}`);
    }
  }
}

/* ================= main ================= */

async function loadPrevious(): Promise<Map<string, NewsItem>> {
  try {
    const raw = await readFile(OUTPUT, "utf8").catch(() => readFile(SHARED, "utf8"));
    const prev: NewsItem[] = JSON.parse(raw);
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

async function main() {
  const sources: FeedSource[] = JSON.parse(await readFile("feeds.json", "utf8"));
  const prev = await loadPrevious();

  const fetched = (await Promise.all(sources.map(fetchSource))).flat();

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

  console.log(
    `📥 수집 ${fetched.length}건 → 유지 ${items.length}건 (요약 필요 ${items.filter((n) => !n.summary).length}건)`,
  );
  await fixTruncatedTitles(items);
  await enrich(items);
  await save(items);
  console.log(`✅ ${items.length}건 저장 → ${OUTPUT}`);
}

main();
