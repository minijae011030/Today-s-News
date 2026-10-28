// 원문 읽기: 본문 · 사진 · 제목 복원 · 보도자료 PDF
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy } from "unpdf";
import { PRESS_LABEL, UA, report, type NewsItem } from "./config.ts";
import { fetchHtml, pickImage } from "./util.ts";

type Page = { text: string; siteName?: string; titles: string[]; image?: string; pdf?: string };
type Doc = ReturnType<typeof parseHTML>["document"];

// 첨부파일 중 PDF 링크 (보도자료 게시판: 파일명 글자나 주소에 .pdf가 있음. hwp/hwpx는 건너뜀)
function findPdf(document: Doc, base: string): string | undefined {
  for (const a of [...document.querySelectorAll("a")]) {
    const href = a.getAttribute("href") ?? "";
    const text = `${a.textContent ?? ""} ${a.getAttribute("title") ?? ""}`;
    if (!/\.pdf\b/i.test(href) && !/\.pdf\b/i.test(text)) continue;
    if (!href || href.startsWith("#") || href.startsWith("javascript")) continue;
    try {
      return new URL(href, base).href;
    } catch {}
  }
  return undefined;
}

// PDF 받아서 글자만 뽑기 (스캔 이미지 PDF면 빈 문자열)
async function fetchPdfText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return "";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 20 * 1024 * 1024) return ""; // 20MB 넘으면 건너뜀
    const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
    return (Array.isArray(text) ? text.join(" ") : text).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function fetchPage(url: string): Promise<Page | null> {
  if (!url) return null;
  try {
    const { document } = parseHTML(await fetchHtml(url));
    const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content")?.trim() || undefined;
    // Readability는 문서를 직접 고쳐서(첨부파일 목록 등을 지움) 필요한 건 먼저 읽어둠
    // 제목 후보: 사이트마다 og:title, <title>, h1 중 어디가 온전한지 달라서 다 모아둠
    const titles = [
      meta('meta[property="og:title"]'),
      meta('meta[name="twitter:title"]'),
      document.querySelector("title")?.textContent?.trim(),
      document.querySelector("h1")?.textContent?.trim(),
    ].filter((t): t is string => !!t);
    const page = {
      siteName: meta('meta[property="og:site_name"]'),
      titles,
      image: pickImage(meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]'), url),
      pdf: findPdf(document, url),
    };
    const article = new Readability(document as unknown as Document).parse();
    const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();
    if (article?.title) page.titles.push(article.title);
    return { ...page, text: text.length >= 200 ? text : "" };
  } catch {
    return null;
  }
}

// 예전 버그로 PDF 링크를 못 찾은 보도자료: 링크만 다시 찾아 채움 (LLM 호출 없음)
// 끝까지 PDF가 없으면 ""로 표시해서 다음엔 다시 안 찾음
export async function fillMissingPdfs(items: NewsItem[]): Promise<void> {
  const targets = items.filter((n) => n.label === PRESS_LABEL && n.summary && n.attachment === undefined);
  await Promise.all(
    targets.map(async (n) => {
      const page = await fetchPage(n.link);
      if (page) n.attachment = page.pdf ?? "";
    }),
  );
  const found = targets.filter((n) => n.attachment).length;
  if (targets.length) console.log(`📄 보도자료 PDF 링크 복구 ${found}/${targets.length}`);
}

// 원문 페이지의 제목 후보들로 제목 바로잡기
//  1) 잘린 제목("...")이면 온전한 제목으로 복원
//  2) 글자는 같은데 띄어쓰기만 다르면(예전 태그 제거 버그: "코스피 ,") 원문 띄어쓰기로
// 사이트마다 따옴표 모양("" vs “”), 띄어쓰기, 앞뒤에 붙는 매체 이름([라이브뉴스], - 스마트경제)이 달라서
// 글자·숫자만 남겨 비교하고, 잘린 제목의 앞부분이 들어 있는 후보만 씀 (엉뚱한 제목 방지)
const TRUNCATED = /(\.\.\.|…)\s*$/;
export const isTruncated = (t: string) => TRUNCATED.test(t);
const bare = (t: string) => t.replace(/[^\p{L}\p{N}]/gu, "");
function restoreTitle(n: NewsItem, candidates: string[], siteName?: string): void {
  const truncated = TRUNCATED.test(n.title);
  const cut = n.title.replace(TRUNCATED, "").trim();
  const prefix = bare(cut).slice(0, 12);
  for (const raw of candidates) {
    let t = raw.replace(/\s+/g, " ").trim();
    // 끝에 붙은 매체 이름: " - 스마트경제", " | 한겨레", ":브레이크뉴스"
    t = t.replace(/\s*[|\-–:]\s*[^|\-–:]{1,25}$/, (m) => (siteName && m.includes(siteName)) || m.length <= 27 ? "" : m);
    // 앞에 붙은 매체 표시 ([라온신문], ≪브레이크뉴스≫): 원래 제목이 그걸로 시작하지 않을 때만 뗌
    if (!/^[[≪<【]/.test(cut)) t = t.replace(/^\s*(\[[^\]]{1,15}\]|≪[^≫]{1,15}≫|【[^】]{1,15}】)\s*/, "");
    const b = bare(t);
    if (truncated && prefix.length >= 6 && b.startsWith(prefix) && b.length >= bare(cut).length && !TRUNCATED.test(t)) {
      n.title = t;
      return;
    }
    if (!truncated && b === bare(n.title)) {
      n.title = t; // 글자는 그대로, 띄어쓰기·따옴표만 원문대로
      return;
    }
  }
}

// 예전 기사 제목 바로잡기 (원문 페이지만 읽음, LLM 호출 없음): 잘린 제목 먼저, 그다음 네이버에서 온 최신 기사순
// 한 번에 40건, 기사마다 한 번만
export async function fixTitles(items: NewsItem[]): Promise<void> {
  const targets = items
    .filter((n) => !n.hidden && n.titleFix !== 2 && (TRUNCATED.test(n.title) || !n.label))
    .sort((a, b) => Number(TRUNCATED.test(b.title)) - Number(TRUNCATED.test(a.title)))
    .slice(0, 40);
  if (!targets.length) return;
  await Promise.all(
    targets.map(async (n) => {
      const page = await fetchPage(n.link);
      if (page) restoreTitle(n, page.titles, page.siteName);
      n.titleFix = 2;
    }),
  );
  const left = targets.filter((n) => TRUNCATED.test(n.title)).length;
  console.log(`✂️  제목 바로잡기 ${targets.length}건 확인 (잘린 채 남은 것 ${left}건)`);
}

// 원문을 읽어서 기사 정보(언론사·제목·사진·첨부)를 채우고, LLM에 넘길 본문을 돌려줌
export async function readArticle(n: NewsItem): Promise<string> {
  const page = await fetchPage(n.link);
  n.titleTried = true;
  if (!page) return "";

  const isPress = n.label === PRESS_LABEL;
  // 보도자료는 source로 기관을 구분하니 그대로 둠
  if (!isPress && page.siteName && page.siteName.length <= 20) n.source = page.siteName;
  restoreTitle(n, page.titles, page.siteName);
  n.titleFix = 2; // 새 기사는 여기서 바로잡혔으니 다시 안 봄
  if (!n.image && page.image) n.image = page.image;

  // 보도자료는 핵심이 첨부 PDF에 있음 → PDF 글자를 본문으로
  if (isPress) n.attachment = page.pdf ?? "";
  if (isPress && page.pdf) {
    const pdfText = await fetchPdfText(page.pdf);
    if (pdfText.length > 200) {
      report.pdfRead++;
      return pdfText;
    }
  }
  return page.text;
}
