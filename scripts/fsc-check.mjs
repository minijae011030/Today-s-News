// 금융위 보도자료 게시판 확인용 (Gemini 호출 없음): node scripts/fsc-check.mjs
import { parseHTML } from "linkedom";
const url = "https://www.fsc.go.kr/no010101";
const list = new URL(url);
const html = await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
const { document } = parseHTML(html);
const seen = new Set();
for (const a of document.querySelectorAll("a")) {
  const href = a.getAttribute("href") ?? "";
  const id = href.split("?")[0].match(new RegExp(`^${list.pathname}/(\\d+)$`))?.[1];
  if (!id || seen.has(id)) continue;
  seen.add(id);
  const date = (a.closest("li")?.textContent ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0];
  console.log(id, date, a.textContent.trim().slice(0, 40));
  if (seen.size >= 5) break;
}
const detail = parseHTML(await (await fetch(`${list.origin}/no010101/${[...seen][0]}`, { headers: { "User-Agent": "Mozilla/5.0" } })).text()).document;
const pdf = [...detail.querySelectorAll("a")].find((a) => /\.pdf/i.test(`${a.textContent} ${a.getAttribute("title")}`));
console.log("PDF:", pdf?.getAttribute("href"));
