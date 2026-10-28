// 원문 읽기: 본문 · 사진 · 제목 복원 · 보도자료 PDF
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractText, getDocumentProxy } from "unpdf";
import { PRESS_LABEL, UA, report, type NewsItem } from "./config.ts";
import { fetchHtml, pickImage } from "./util.ts";

type Page = { text: string; siteName?: string; title?: string; image?: string; pdf?: string };
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
    const article = new Readability(document as unknown as Document).parse();
    const text = (article?.textContent ?? "").replace(/\s+/g, " ").trim();
    return {
      text: text.length >= 200 ? text : "",
      siteName: meta('meta[property="og:site_name"]'),
      title: meta('meta[property="og:title"]') ?? article?.title ?? undefined,
      image: pickImage(meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]'), url),
      pdf: findPdf(document, url),
    };
  } catch {
    return null;
  }
}

// 잘린 제목("...")이면 원문 og:title로 복원. 앞부분이 같은 경우만 바꿔서 엉뚱한 제목은 막음
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

// 원문을 읽어서 기사 정보(언론사·제목·사진·첨부)를 채우고, LLM에 넘길 본문을 돌려줌
export async function readArticle(n: NewsItem): Promise<string> {
  const page = await fetchPage(n.link);
  n.titleTried = true;
  if (!page) return "";

  const isPress = n.label === PRESS_LABEL;
  // 보도자료는 source로 기관을 구분하니 그대로 둠
  if (!isPress && page.siteName && page.siteName.length <= 20) n.source = page.siteName;
  restoreTitle(n, page.title, page.siteName);
  if (!n.image && page.image) n.image = page.image;

  // 보도자료는 핵심이 첨부 PDF에 있음 → PDF 글자를 본문으로
  if (isPress && page.pdf) {
    n.attachment = page.pdf;
    const pdfText = await fetchPdfText(page.pdf);
    if (pdfText.length > 200) {
      report.pdfRead++;
      return pdfText;
    }
  }
  return page.text;
}
