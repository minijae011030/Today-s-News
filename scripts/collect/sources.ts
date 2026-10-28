// 수집: RSS · 네이버 뉴스 검색 · RSS 없는 게시판
import Parser from "rss-parser";
import { parseHTML } from "linkedom";
import { MAX_PER_FEED, UA, report, type FeedSource, type NewsItem } from "./config.ts";
import { baseItem, fetchHtml, isMajorPress, kstToday, pickImage, pressName, stripHtml } from "./util.ts";

/* ---------- RSS ---------- */

type MediaField = { $?: { url?: string } };
const parser = new Parser<Record<string, unknown>, { mediaContent?: MediaField; mediaThumbnail?: MediaField }>({
  customFields: { item: [["media:content", "mediaContent"], ["media:thumbnail", "mediaThumbnail"]] },
});

// User-Agent 필요한 사이트(406) 대응 + 깨진 XML 보정
async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  const xml = await res.text();
  // 앞부분 태그 속성 사이 공백이 빠진 경우: a="1"b="2" → a="1" b="2"
  const head = xml.slice(0, 3000).replace(/"(?=[a-zA-Z_][\w:.-]*=")/g, '" ');
  // 이스케이프 안 된 & 보정
  return (head + xml.slice(3000)).replace(/&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
}

async function fetchRss(src: Extract<FeedSource, { type: "rss" }>): Promise<NewsItem[]> {
  const feed = await parser.parseString(await fetchXml(src.url));
  return (feed.items ?? []).slice(0, MAX_PER_FEED).map((it) => ({
    ...baseItem(src, stripHtml(it.title ?? "", 500)),
    link: it.link ?? "",
    source: feed.title ?? pressName(src.url),
    publishedAt: new Date(it.isoDate ?? it.pubDate ?? Date.now()).toISOString(),
    snippet: stripHtml(it.contentSnippet ?? it.content ?? ""),
    image: pickImage(
      (it.enclosure?.type?.startsWith("image") ? it.enclosure.url : undefined) ??
        it.mediaContent?.$?.url ??
        it.mediaThumbnail?.$?.url ??
        (it.content ?? "").match(/<img[^>]+src=["']([^"']+)/i)?.[1], // 본문 HTML 안의 첫 이미지 (NASA 등)
      it.link ?? src.url,
    ),
  }));
}

/* ---------- 네이버 뉴스 검색 (NAVER API HUB) ---------- */

type NaverNews = { title: string; originallink: string; link: string; description: string; pubDate: string };

async function fetchNaver(src: Extract<FeedSource, { type: "naver" }>): Promise<NewsItem[]> {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음");

  // 주요 언론사만 받을 땐(기본) 넉넉히 받아서 거른 뒤 MAX_PER_FEED건
  const majorOnly = !src.allPress;
  const display = majorOnly ? 30 : MAX_PER_FEED;
  const url = `https://naverapihub.apigw.ntruss.com/search/v1/news?query=${encodeURIComponent(src.query)}&display=${display}&sort=date`;
  const res = await fetch(url, {
    headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`네이버 ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data: { items?: NaverNews[] } = await res.json();

  const list = (data.items ?? []).filter((it) => !majorOnly || isMajorPress(it.originallink || it.link));
  return list.slice(0, MAX_PER_FEED).map((it) => {
    const link = it.originallink || it.link;
    return {
      ...baseItem(src, stripHtml(it.title, 500)),
      via: src.query,
      link,
      source: pressName(link),
      publishedAt: new Date(it.pubDate).toISOString(),
      snippet: stripHtml(it.description),
    };
  });
}

/* ---------- RSS 없는 게시판 ---------- */
// 목록에서 상세 링크를 찾아 제목·날짜를 뽑음
//  - 금감원: …/list.do?menuNo=… → 상세 …/view.do?nttId=123&menuNo=…
//  - 금융위: /no010101 → 상세 /no010101/123
type BoardSource = Extract<FeedSource, { type: "board" }>;

// 게시판 목록 한 페이지에서 글 뽑기
function parseBoard(src: BoardSource, html: string): NewsItem[] {
  const list = new URL(src.url);
  const listPath = list.pathname.replace(/\/$/, "");
  const { document } = parseHTML(html);
  const today = kstToday();
  const seen = new Set<string>();
  const out: NewsItem[] = [];

  for (const a of [...document.querySelectorAll("a")]) {
    const href = a.getAttribute("href") ?? "";
    const pathId = href.split("?")[0].match(new RegExp(`^${listPath}/(\\d+)$`))?.[1];
    const id = pathId ?? href.match(/nttId=(\d+)/)?.[1];
    if (!id || seen.has(id)) continue;
    const title = cleanBoardTitle(a.textContent ?? "");
    if (title.length < 5) continue;
    seen.add(id);

    let link: URL;
    if (pathId) {
      link = new URL(`${listPath}/${id}`, list.origin);
    } else {
      link = new URL(list.pathname.replace(/list\.do$/, "view.do"), list.origin);
      link.searchParams.set("nttId", id);
      const menuNo = list.searchParams.get("menuNo");
      if (menuNo) link.searchParams.set("menuNo", menuNo);
    }

    const m = (a.closest("tr, li")?.textContent ?? "").match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
    const date = m ? `${m[1]}-${m[2]}-${m[3]}` : today;
    out.push({
      ...baseItem(src, title),
      link: link.href,
      source: src.source,
      // 게시판은 날짜만 있어서, 오늘 글은 "처음 본 시각"을 씀 (그래야 같은 날 나중 글도 새 글로 잡힘)
      publishedAt: date === today ? new Date().toISOString() : new Date(`${date}T18:00:00+09:00`).toISOString(),
      snippet: "",
    });
  }
  return out;
}

const pageUrl = (src: BoardSource, page: number) => {
  const u = new URL(src.url);
  if (page > 1 && src.pageParam) u.searchParams.set(src.pageParam, String(page));
  return u.href;
};

// 평소 수집: 첫 페이지 최신 글만
async function fetchBoard(src: BoardSource): Promise<NewsItem[]> {
  const out = parseBoard(src, await fetchHtml(src.url, 15_000)).slice(0, MAX_PER_FEED);
  if (out.length === 0) throw new Error("목록에서 게시글을 못 찾음 (페이지 구조가 바뀌었을 수 있음)");
  return out;
}

/** 지난 글 채우기: since(YYYY-MM-DD)보다 오래된 글이 나올 때까지 목록을 뒤로 넘기며 모음 (최대 40페이지) */
export async function fetchBoardSince(src: BoardSource, since: string): Promise<NewsItem[]> {
  if (!src.pageParam) return [];
  const out: NewsItem[] = [];
  for (let page = 1; page <= 40; page++) {
    let items: NewsItem[];
    try {
      items = parseBoard(src, await fetchHtml(pageUrl(src, page), 15_000));
    } catch {
      break;
    }
    if (items.length === 0) break;
    const sinceTime = Date.parse(`${since}T00:00:00+09:00`);
    out.push(...items.filter((n) => Date.parse(n.publishedAt) >= sinceTime));
    if (items.some((n) => Date.parse(n.publishedAt) < sinceTime)) break; // 기간 밖까지 왔으면 끝
  }
  return out;
}

// 게시판 제목에 붙는 "새글", "금일 등록된 게시글" 같은 표시와 끝의 " -" 정리
export const cleanBoardTitle = (t: string) =>
  t
    .replace(/\s+/g, " ")
    .replace(/^(새글|NEW)\s*/i, "")
    .replace(/\s*금일 등록된 게시글\s*$/, "")
    .replace(/\s*-\s*$/, "")
    .trim();

// 소스 하나 수집 (실패해도 전체는 계속)
export async function fetchSource(src: FeedSource): Promise<NewsItem[]> {
  try {
    if (src.type === "board") return await fetchBoard(src);
    if (src.type === "naver") return await fetchNaver(src);
    return await fetchRss(src);
  } catch (e) {
    const name = src.type === "naver" ? src.query : src.url;
    const message = (e as Error).message.split("\n")[0].slice(0, 120);
    console.warn(`⚠️  피드 실패 (${src.category}) ${name}: ${message}`);
    report.failedFeeds.push({ category: src.category, source: name, error: message });
    return [];
  }
}
