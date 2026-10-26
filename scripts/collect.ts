/**
 * 뉴스 수집 스크립트
 * feeds.json → (네이버 뉴스 검색 / RSS) 수집 → 중복 제거
 *   → 원문 본문 추출 → Gemini 요약 → public/data/news.json
 *
 * 실행: npm run collect
 * 필요한 환경변수(.env): GEMINI_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 */
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// 로컬에서는 .env 자동 로드 (Actions에는 파일이 없으니 그냥 넘어감)
try {
  process.loadEnvFile();
} catch {}

type FeedSource = { category: string; keepDays?: number } & (
  | { type: "rss"; url: string }
  | { type: "naver"; query: string }
  | { type: "google"; query: string }
);

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
  essayPoint?: string; // 경제·국제·사회: 논술 포인트
  keepDays?: number; // 기술 블로그처럼 뜸하게 올라오는 소스는 더 오래 보관
  titleTried?: boolean; // 잘린 제목 복원을 이미 시도했는지 (실패해도 매번 다시 안 하려고)
  checked?: boolean; // LLM이 섹션에 맞는지 확인했는지
  hidden?: boolean; // 어느 섹션에도 안 맞음 → 화면에서 숨김 (다시 수집·요약하지 않으려고 데이터엔 남겨둠)
  spaceFact?: string; // 우주 전용: 흥미로운 우주 지식
  titleKo?: string; // 영어 기사면 한국어 제목
  image?: string; // 대표 사진 (원문의 og:image 또는 RSS 첨부 이미지)
};

// 공식 데이터(public/data)는 GitHub Actions 봇만 커밋하고,
// 로컬에서 돌린 결과는 git에 안 올라가는 public/data-local에 따로 저장 (main과 충돌 방지)
const IS_CI = !!process.env.CI;
let newCount = 0; // 이번 수집에서 처음 들어온 기사 수 (알림용)

// 실행 결과 기록 (meta.json + GitHub Actions 요약 카드용)
const report = {
  fetched: 0,
  newByCategory: {} as Record<string, number>,
  summarizedNow: 0,
  bodyFound: 0,
  failedFeeds: [] as { category: string; source: string; error: string }[],
  llmFailedBatches: 0,
  concept: null as string | null,
  spacePhoto: null as string | null,
  hidden: 0, // 섹션에 안 맞아서 숨긴 기사 수
  moved: [] as string[], // 섹션을 옮긴 기사 (예: "우주→IT")
};
const DATA_DIR = IS_CI ? "public/data" : "public/data-local";
const OUTPUT = `${DATA_DIR}/news.json`;
const SHARED = "public/data/news.json"; // 로컬 첫 실행 때 봇이 만든 요약을 재사용
const KEEP_DAYS = 3;
const MAX_NEW_PER_SECTION = 6; // 한 번 수집에 섹션당 새 기사 최대 수 (8섹션 × 6 = 최대 48건)
const MAX_PER_FEED = 7; // 키워드/피드당 최신 몇 건만 (양이 많을수록 LLM 비용·시간이 늘어남)
const BODY_CHARS = 1200; // LLM에 넘길 본문 길이 (리드 몇 문단이면 요약엔 충분)
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

// 작업을 최대 limit개씩 동시에 실행
async function runPool<T>(tasks: T[], limit: number, run: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await run(tasks[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

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

type MediaField = { $?: { url?: string; medium?: string; type?: string } };
const parser = new Parser<Record<string, unknown>, { mediaContent?: MediaField; mediaThumbnail?: MediaField }>({
  customFields: { item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"]] },
});

// 로고·기본 이미지처럼 기사 사진이 아닌 것 걸러내기
const NOT_PHOTO = /logo|default|noimage|no_image|blank|placeholder|favicon|icon|sprite|\.svg(\?|$)/i;
function pickImage(raw: string | undefined, base: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw.trim(), base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.protocol = "https:"; // 사이트가 https라 http 이미지는 브라우저가 막음
    return NOT_PHOTO.test(url.pathname) ? undefined : url.href;
  } catch {
    return undefined;
  }
}

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
      ...(src.keepDays ? { keepDays: src.keepDays } : {}),
      title,
      link: it.link ?? "",
      source: String((it as { source?: string }).source ?? feed.title ?? pressName(url)),
      publishedAt: new Date(it.isoDate ?? it.pubDate ?? Date.now()).toISOString(),
      snippet: stripHtml(it.contentSnippet ?? it.content ?? ""),
      image: pickImage(
        (it.enclosure?.type?.startsWith("image") ? it.enclosure.url : undefined) ??
          it.mediaContent?.$?.url ??
          it.mediaThumbnail?.$?.url ??
          // 본문 HTML 안의 첫 이미지 (NASA 같은 피드)
          (it.content ?? "").match(/<img[^>]+src=["']([^"']+)/i)?.[1],
        it.link ?? url,
      ),
    };
  });
}

/* ================= 수집: 네이버 뉴스 검색 (NAVER API HUB) ================= */

type NaverNews = { title: string; originallink: string; link: string; description: string; pubDate: string };

async function fetchNaver(src: { category: string; query: string; keepDays?: number }): Promise<NewsItem[]> {
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
      ...(src.keepDays ? { keepDays: src.keepDays } : {}),
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
    const message = (e as Error).message.split("\n")[0].slice(0, 120);
    console.warn(`⚠️  피드 실패 (${src.category}) ${label}: ${message}`);
    report.failedFeeds.push({ category: src.category, source: label, error: message });
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
    signal: AbortSignal.timeout(7_000),
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
): Promise<{ text: string; siteName?: string; title?: string; image?: string } | null> {
  if (!url || url.includes("news.google.com")) return null; // 구글 리다이렉트 링크는 건너뜀
  try {
    const html = await fetchHtml(url);
    const { document } = parseHTML(html);
    const siteName =
      document.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() || undefined;
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() || undefined;
    const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content")?.trim() || undefined;
    const image = pickImage(
      meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]') ?? meta('meta[property="og:image:url"]'),
      url,
    );
    const article = new Readability(document as unknown as Document).parse();
    const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();
    const title = ogTitle ?? article?.title ?? undefined;
    return { text: text.length >= 200 ? text : "", siteName, title, image };
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
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        count: items.length,
        newCount,
        summarized: items.filter((n) => n.summary).length,
        ...report,
      },
      null,
      2,
    ),
  );
}

const PROMPT = `다음 뉴스 목록 각각에 대해 JSON 배열로만 답해.
각 원소: {
  "idx": number,
  "fit": "이 기사가 실제로 속하는 섹션 하나 (경제, 국제, 사회, IT, 우주, 예술, 엔터, 책 중). 검색 키워드가 비유로만 쓰였거나(예: '의료의 블랙홀', '우주 최강') 어느 섹션에도 안 맞으면 null",
  "titleKo": "제목이 한국어가 아니면 자연스러운 한국어 제목, 한국어면 null",
  "summary": "한국어 요약. body가 있으면 핵심 사실(누가, 무엇을, 왜, 수치)을 담아 3~4문장. body가 null이면 snippet 기준으로 1~2문장",
  "tags": ["키워드", 최대 3개],
  "essayPoint": "경제·국제·사회 카테고리만: 금융감독원 논술 관점에서 이 기사의 쟁점과 연결되는 개념을 2문장으로 (경제: 금융소비자보호, 건전성 규제, 자본시장 공정성 등 / 국제: 통화정책 파급, 환율과 금융안정, 글로벌 리스크 등 / 사회: 저출생·고령화·기후 같은 사회 문제가 금융과 가계에 미치는 영향 등). 다른 카테고리는 null",
  "spaceFact": "우주 카테고리만: 이 기사와 연결된, 일반인이 '오 신기하다' 할 만한 우주 지식을 2~3문장으로 쉽게 설명 (기사에 나온 천체나 현상이 무엇이고 왜 흥미로운지). 다른 카테고리는 null"
}
category는 검색 키워드로 붙은 임시 섹션이라 틀릴 수 있어. essayPoint와 spaceFact는 category가 아니라 fit 기준으로 판단해.
summary와 essayPoint는 제공된 title, snippet, body에 있는 내용만 근거로 쓰고 지어내지 마. spaceFact는 널리 확립된 과학 지식만 써.`;

// 이미 요약된 기사 중 제목이 잘린 것만 원문 제목으로 복원 (LLM 호출 없음)
async function fixTruncatedTitles(items: NewsItem[]): Promise<void> {
  const targets = items.filter((n) => n.summary && !n.titleTried && TRUNCATED.test(n.title));
  for (let i = 0; i < targets.length; i += 8) {
    const chunk = targets.slice(i, i + 8);
    const bodies = await Promise.all(chunk.map((n) => fetchBody(n.link)));
    chunk.forEach((n, idx) => {
      restoreTitle(n, bodies[idx]?.title, bodies[idx]?.siteName);
      if (!n.image && bodies[idx]?.image) n.image = bodies[idx]!.image;
      n.titleTried = true;
    });
  }
  if (targets.length) {
    const left = targets.filter((n) => TRUNCATED.test(n.title)).length;
    console.log(`✂️  잘린 제목 복원 ${targets.length - left}/${targets.length}`);
  }
}

async function enrich(items: NewsItem[]): Promise<void> {
  const SECTIONS_ALL = ["경제", "국제", "사회", "IT", "우주", "예술", "엔터", "책"];
  const needsSummary = items.filter(
    (n) => !n.hidden && (!n.summary || (n.category === "우주" && !n.spaceFact)),
  );
  // 섹션 확인을 아직 안 한 예전 기사는 한 번에 40건씩만 다시 확인 (매시간 조금씩 정리)
  const recheck = items.filter((n) => !n.hidden && n.summary && !n.checked && !needsSummary.includes(n)).slice(0, 40);
  const todo = [...needsSummary, ...recheck];
  const isRecheck = new Set(recheck); // 재검사는 이미 요약이 있으니 원문을 다시 안 받음
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("ℹ️  GEMINI_API_KEY 없음 → LLM 요약 건너뜀");
    return;
  }
  if (todo.length === 0) return;

  const BATCH = 8; // 본문이 붙어서 조금 더 작게

  const batches: NewsItem[][] = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  let done = 0;
  let saving = Promise.resolve();

  const runBatch = async (batch: NewsItem[]) => {

    const bodies = await Promise.all(
      batch.map((n) =>
        isRecheck.has(n) ? Promise.resolve({ text: n.summary ?? "", siteName: undefined, title: undefined, image: undefined }) : fetchBody(n.link),
      ),
    );
    batch.forEach((n, idx) => {
      const site = bodies[idx]?.siteName;
      if (site && site.length <= 20) n.source = site;
      restoreTitle(n, bodies[idx]?.title, site);
      if (!n.image && bodies[idx]?.image) n.image = bodies[idx]!.image;
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
        fit: string | null;
        summary: string;
        tags: string[];
        essayPoint: string | null;
        spaceFact: string | null;
        titleKo: string | null;
      }[] = JSON.parse(json);
      for (const o of out) {
        const n = batch[o.idx];
        if (!n) continue;
        n.checked = true;
        if (!o.fit || !SECTIONS_ALL.includes(o.fit)) {
          n.hidden = true; // 어디에도 안 맞는 기사
          report.hidden++;
          continue;
        }
        if (o.fit !== n.category) {
          report.moved.push(`${n.category}→${o.fit}`);
          n.category = o.fit;
          delete n.essayPoint;
          delete n.spaceFact;
        }
        n.summary = o.summary;
        n.tags = o.tags;
        if (o.essayPoint) n.essayPoint = o.essayPoint;
        if (o.spaceFact) n.spaceFact = o.spaceFact;
        if (o.titleKo) n.titleKo = o.titleKo;
      }
      report.summarizedNow += out.filter((o) => batch[o.idx] && o.summary).length;
      report.bodyFound += gotBody;
      done += batch.length;
      console.log(`🤖 요약 ${done}/${todo.length} (본문 확보 ${gotBody}/${batch.length})`);
      saving = saving.then(() => save(items)); // 중간에 끊겨도 여기까지는 저장 (동시에 안 쓰게 순서대로)
      await saving;
      await sleep(1000); // 429(한도)가 나면 callGemini가 알아서 쉬었다 재시도함
    } catch (e) {
      report.llmFailedBatches++;
      console.warn(`⚠️  LLM 배치 실패: ${(e as Error).message}`);
    }
  };

  console.log(`⏳ 요약할 기사 ${todo.length}건 (${batches.length}묶음, 2묶음씩 동시에)`);
  await runPool(batches, 2, runBatch);
}

/* ================= 오늘의 우주 사진 (NASA APOD) ================= */
// NASA "Astronomy Picture of the Day": 매일 한 장의 진짜 우주 사진 + 천문학자 설명
// 새 사진이 올라왔을 때만 Gemini로 한국어 제목·설명을 만들어 space.json에 저장

type SpacePhoto = {
  date: string; // APOD 날짜 (YYYY-MM-DD, 미국 기준)
  title: string;
  titleKo: string;
  story: string; // 한국어로 쉽게 풀어쓴 설명
  image: string;
  hdImage?: string;
  credit: string;
  link: string;
};

type Apod = {
  date: string;
  title: string;
  explanation: string;
  media_type: string;
  url: string;
  hdurl?: string;
  thumbnail_url?: string;
  copyright?: string;
};

// 1) NASA API (빠를 땐 빠른데 자주 느림) → 2) APOD 웹페이지에서 직접 읽기
async function fetchApod(): Promise<Apod | null> {
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  try {
    const start = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=${key}&start_date=${start}&thumbs=true`,
      { signal: AbortSignal.timeout(45_000) },
    );
    if (!res.ok) throw new Error(`NASA ${res.status}`);
    const list: Apod[] = await res.json();
    // 최근 7일 중 가장 최신 "사진" (가끔 영상인 날이 있어서)
    const pick = list
      .filter((a) => a.media_type === "image" || a.thumbnail_url)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (pick) return pick;
  } catch (e) {
    console.warn(`   NASA API 실패(${(e as Error).message}) → APOD 웹페이지에서 직접 읽기`);
  }

  try {
    const base = "https://apod.nasa.gov/apod/";
    const { document } = parseHTML(await fetchHtml(`${base}astropix.html`));
    const img = document.querySelector("img")?.getAttribute("src");
    if (!img) throw new Error("오늘은 사진이 아니라 영상");
    const hd = document.querySelector('a[href^="image/"]')?.getAttribute("href");
    const title = document.querySelector("center b")?.textContent?.trim() ?? "Astronomy Picture of the Day";
    const explanation = [...document.querySelectorAll("p")]
      .map((p) => p.textContent ?? "")
      .find((t) => t.includes("Explanation:"))
      ?.replace(/[\s\S]*Explanation:/, "")
      .replace(/\s+/g, " ")
      .trim();
    const credit = document.body?.textContent?.match(/(?:Image Credit|Credit)[^:]*:\s*([^\n]+)/)?.[1]?.trim();
    // 페이지에 날짜가 "2026 October 26" 형식으로 있음
    const dateText = document.body?.textContent?.match(/(\d{4}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})/);
    const date = dateText ? new Date(`${dateText[2]} ${dateText[3]}, ${dateText[1]} UTC`).toISOString().slice(0, 10) : kstToday();
    return {
      date,
      title,
      explanation: explanation ?? title,
      media_type: "image",
      url: new URL(img, base).href,
      hdurl: hd ? new URL(hd, base).href : undefined,
      copyright: credit,
    };
  } catch (e) {
    console.warn(`⚠️  오늘의 우주 사진 실패: ${(e as Error).message}`);
    return null;
  }
}

async function makeSpacePhoto(): Promise<void> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return;
  const file = `${DATA_DIR}/space.json`;
  let current: SpacePhoto | null = null;
  for (const f of [file, "public/data/space.json"]) {
    try {
      current = JSON.parse(await readFile(f, "utf8"));
      break;
    } catch {}
  }

  const apod = await fetchApod();
  if (!apod) return;
  if (current?.date === apod.date) return; // 새 사진 없음

  const prompt = `NASA의 오늘의 천문 사진 설명이야. JSON 객체 하나로만 답해.
{
  "titleKo": "자연스러운 한국어 제목",
  "story": "일반인이 '오 신기하다' 할 수 있게 사진 속 천체나 현상을 3~4문장으로 쉽게 설명. 원문 설명에 있는 사실만 써. 문체는 '~입니다/~습니다'"
}

제목: ${apod.title}
설명: ${apod.explanation}`;

  try {
    const text = await callGemini(geminiKey, prompt);
    const o = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const photo: SpacePhoto = {
      date: apod.date,
      title: apod.title,
      titleKo: String(o.titleKo ?? apod.title),
      story: String(o.story ?? ""),
      image: apod.media_type === "image" ? apod.url : apod.thumbnail_url!,
      hdImage: apod.media_type === "image" ? apod.hdurl : undefined,
      credit: apod.copyright ? apod.copyright.replace(/\s+/g, " ").trim() : "NASA",
      link: `https://apod.nasa.gov/apod/ap${apod.date.slice(2).replace(/-/g, "")}.html`,
    };
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(file, JSON.stringify(photo, null, 2));
    report.spacePhoto = photo.titleKo;
    console.log(`🌌 오늘의 우주 사진: ${photo.titleKo}`);
  } catch (e) {
    console.warn(`⚠️  오늘의 우주 사진 설명 실패: ${(e as Error).message}`);
  }
}

/* ================= 오늘의 개념 (하루 한 번) ================= */

type Concept = {
  date: string; // KST 기준 YYYY-MM-DD
  term: string;
  definition: string;
  issues: string[];
  essayAngle: string;
  relatedIds: string[];
};

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

async function makeConcept(items: NewsItem[]): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;
  const file = `${DATA_DIR}/concept.json`;
  let history: Concept[] = [];
  for (const f of [file, "public/data/concept.json"]) {
    try {
      history = JSON.parse(await readFile(f, "utf8")).history ?? [];
      break;
    } catch {}
  }
  const today = kstToday();
  if (history[0]?.date === today) return; // 오늘 건 이미 있음

  const pool = items
    .filter((n) => ["경제", "국제", "사회"].includes(n.category) && n.summary)
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
    const text = await callGemini(apiKey, prompt);
    const c = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const ids = new Set(pool.map((p) => p.id));
    const concept: Concept = {
      date: today,
      term: String(c.term),
      definition: String(c.definition),
      issues: (c.issues ?? []).map(String).slice(0, 3),
      essayAngle: String(c.essayAngle ?? ""),
      relatedIds: (c.relatedIds ?? []).map(String).filter((id: string) => ids.has(id)).slice(0, 3),
    };
    history = [concept, ...history].slice(0, 30);
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(file, JSON.stringify({ history }, null, 2));
    report.concept = concept.term;
    console.log(`📘 오늘의 개념: ${concept.term}`);
  } catch (e) {
    console.warn(`⚠️  오늘의 개념 실패: ${(e as Error).message}`);
  }
}

/* ================= GitHub Actions 요약 카드 ================= */

const ORDER = ["경제", "국제", "사회", "IT", "우주", "예술", "엔터", "책"];

const rank = (c: string) => (ORDER.includes(c) ? ORDER.indexOf(c) : ORDER.length);

function categoryLine(byCat: Record<string, number>): string {
  return Object.entries(byCat)
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([c, n]) => `${c} ${n}`)
    .join(" · ");
}

async function writeActionsSummary(total: number): Promise<void> {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const lines = [
    "## 📰 뉴스 수집 결과",
    "",
    newCount > 0
      ? `**새 기사 ${newCount}건** · 이번에 요약 ${report.summarizedNow}건 (본문 확보 ${report.bodyFound}건) · 보관 중 ${total}건`
      : `**새 기사 없음** · 보관 중 ${total}건`,
  ];
  if (newCount > 0) lines.push("", categoryLine(report.newByCategory));
  if (report.concept) lines.push("", `📘 오늘의 개념: **${report.concept}**`);
  if (report.spacePhoto) lines.push("", `🌌 오늘의 우주 사진: **${report.spacePhoto}**`);
  if (report.hidden) lines.push("", `🙈 섹션에 안 맞아서 숨긴 기사 ${report.hidden}건`);
  if (report.moved.length) lines.push("", `↪️ 섹션을 옮긴 기사: ${report.moved.join(", ")}`);
  if (report.llmFailedBatches) lines.push("", `⚠️ 요약 실패한 배치 ${report.llmFailedBatches}개 (다음 수집 때 다시 시도)`);
  if (report.failedFeeds.length) {
    lines.push("", "### ⚠️ 실패한 피드", "", "| 섹션 | 소스 | 이유 |", "|---|---|---|");
    for (const f of report.failedFeeds) lines.push(`| ${f.category} | ${f.source} | ${f.error.replace(/\|/g, "/")} |`);
  }
  await appendFile(file, lines.join("\n") + "\n");
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
  // 한 번 수집할 때 섹션별로 최신 MAX_NEW_PER_SECTION건만 새로 받음 (나머지는 다음 수집 때 다시 후보가 됨)
  const candidates = fetched
    .filter((n) => n.key && n.link && !merged.has(n.key))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const taken: Record<string, number> = {};
  for (const n of candidates) {
    if (merged.has(n.key)) continue; // 같은 기사가 여러 키워드에 걸린 경우
    if ((taken[n.category] ?? 0) >= MAX_NEW_PER_SECTION) continue;
    taken[n.category] = (taken[n.category] ?? 0) + 1;
    merged.set(n.key, cleanGoogle(n));
  }

  const DAY = 24 * 60 * 60 * 1000;
  const items = [...merged.values()]
    .filter((n) => Date.now() - new Date(n.publishedAt).getTime() <= (n.keepDays ?? KEEP_DAYS) * DAY)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const fresh = items.filter((n) => !prev.has(n.key));
  newCount = fresh.length;
  report.fetched = fetched.length;

  console.log(
    `📥 수집 ${fetched.length}건 → 유지 ${items.length}건 (요약 필요 ${items.filter((n) => !n.summary).length}건)`,
  );
  await fixTruncatedTitles(items);
  await enrich(items);
  // 숨긴 기사는 빼고, 옮겨진 섹션 기준으로 새 기사 수 다시 계산
  const freshVisible = fresh.filter((n) => !n.hidden);
  newCount = freshVisible.length;
  report.newByCategory = {};
  for (const n of freshVisible) report.newByCategory[n.category] = (report.newByCategory[n.category] ?? 0) + 1;
  await save(items);
  await makeConcept(items.filter((n) => !n.hidden));
  await makeSpacePhoto();
  await save(items); // 오늘의 개념까지 meta.json에 반영
  await writeActionsSummary(items.length);
  console.log(`✅ ${items.length}건 저장 → ${OUTPUT} (새 기사 ${newCount}건)`);
}

main();
