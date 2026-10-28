// 공통 유틸
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DATA_DIR, SHARED_DIR, UA, type FeedSource } from "./config.ts";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

// 작업을 최대 limit개씩 동시에 실행
export async function runPool<T>(tasks: T[], limit: number, run: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await run(tasks[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// 내 결과 → 없으면 봇이 만든 결과 순서로 data 파일 읽기
export async function readData<T>(name: string): Promise<T | null> {
  for (const dir of [DATA_DIR, SHARED_DIR]) {
    try {
      return JSON.parse(await readFile(`${dir}/${name}`, "utf8"));
    } catch {}
  }
  return null;
}

// LLM 응답에서 JSON 부분만 꺼내기 ([...] 또는 {...})
export function parseJson<T>(text: string, open: "[" | "{"): T {
  const close = open === "[" ? "]" : "}";
  return JSON.parse(text.slice(text.indexOf(open), text.lastIndexOf(close) + 1));
}

/* ---------- 글자 정리 ---------- */

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

export function stripHtml(s = "", max = 300): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// 같은 기사가 여러 피드에 걸리는 걸 막기 위한 키 + 그 해시로 만든 10자리 ID
export function withIds(title: string): { id: string; key: string } {
  const key = title
    .replace(/\s+-\s+[^-]+$/, "") // " - 부제/언론사" 꼬리 제거 (기존 데이터와 같은 key를 내려고 유지)
    .replace(/[\s\p{P}]/gu, "")
    .toLowerCase();
  return { key, id: createHash("sha1").update(key).digest("hex").slice(0, 10) };
}

// 모든 소스가 공통으로 채우는 필드
export function baseItem(src: FeedSource, title: string) {
  return {
    ...withIds(title),
    category: src.category,
    ...(src.label ? { label: src.label } : {}),
    ...(src.keepDays ? { keepDays: src.keepDays } : {}),
    title,
  };
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
export function pressName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^(www|m|news)\./, "");
    const hit = Object.keys(PRESS).find((d) => host === d || host.endsWith("." + d));
    return hit ? PRESS[hit] : host;
  } catch {
    return "";
  }
}

// 로고·기본 이미지처럼 기사 사진이 아닌 것 걸러내기
const NOT_PHOTO = /logo|default|noimage|no_image|blank|placeholder|favicon|icon|sprite|\.svg(\?|$)/i;
export function pickImage(raw: string | undefined, base: string): string | undefined {
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

// 국내 사이트는 EUC-KR도 있어서 charset을 보고 디코딩
export async function fetchHtml(url: string, timeout = 7_000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,*/*", "Accept-Language": "ko-KR,ko;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
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
