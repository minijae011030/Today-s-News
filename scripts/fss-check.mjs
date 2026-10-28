// 금감원 보도자료 목록이 잘 읽히는지만 확인 (Gemini 안 씀)
// 실행: node scripts/fss-check.mjs
import { parseHTML } from "linkedom";

const url = "https://www.fss.or.kr/fss/bbs/B0000188/list.do?menuNo=200218";
const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh) Chrome/130 Safari/537.36" } });
console.log("status", r.status);
const { document } = parseHTML(await r.text());
const rows = [];
for (const a of document.querySelectorAll("a")) {
  const raw = `${a.getAttribute("href") ?? ""} ${a.getAttribute("onclick") ?? ""}`;
  const id = raw.match(/nttId=(\d+)/)?.[1];
  if (!id) continue;
  const row = a.closest("tr, li") ?? a.parentElement;
  rows.push({
    id,
    title: a.textContent.replace(/\s+/g, " ").trim(),
    date: (row?.textContent ?? "").match(/\d{4}[-.]\d{2}[-.]\d{2}/)?.[0],
  });
}
console.log(rows.slice(0, 5));
if (!rows.length) console.log("nttId 링크를 못 찾음. 첫 a 태그들:", [...document.querySelectorAll("a")].slice(40, 60).map((a) => a.getAttribute("href")));

// 첫 보도자료 상세 페이지에서 PDF 첨부 찾고 글자 뽑아보기
if (rows[0]) {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const detail = `https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=${rows[0].id}&menuNo=200218`;
  const d = parseHTML(await (await fetch(detail, { headers: { "User-Agent": "Mozilla/5.0" } })).text()).document;
  const links = [...d.querySelectorAll("a")]
    .map((a) => ({ text: a.textContent.replace(/\s+/g, " ").trim(), href: a.getAttribute("href") }))
    .filter((l) => /\.(pdf|hwp|hwpx)\b/i.test(`${l.text} ${l.href}`));
  console.log("\n첨부 링크:", links);
  const pdf = links.find((l) => /\.pdf\b/i.test(`${l.text} ${l.href}`) && l.href && !l.href.startsWith("javascript"));
  if (pdf) {
    const url = new URL(pdf.href, detail).href;
    const buf = new Uint8Array(await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).arrayBuffer());
    const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
    const t = (Array.isArray(text) ? text.join(" ") : text).replace(/\s+/g, " ");
    console.log("PDF 글자 수:", t.length, "\n앞부분:", t.slice(0, 200));
  }
}
