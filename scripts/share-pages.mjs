// 기사 공유용 페이지 만들기 (npm run build 뒤에 자동 실행: postbuild)
// 카톡·슬랙 같은 미리보기 봇은 JS를 안 돌리고 #/article/… 해시도 구분 못 해서,
// 기사마다 /a/<id>/index.html 을 만들어 og:title·설명·사진을 넣고, 사람이 열면 앱의 기사 화면으로 넘김
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const DIST = "dist";
const SITE = (process.env.SITE_URL ?? "https://minijae011030.github.io/TodaysNews/").replace(/\/?$/, "/");
const DEFAULT_IMAGE = `${SITE}og-image.png`;
const AGENCY = { 금융감독원: "금감원", 금융위원회: "금융위" };

const file = `${DIST}/data/news.json`;
if (!existsSync(file)) {
  console.log("ℹ️  dist/data/news.json 없음 → 공유 페이지 건너뜀");
  process.exit(0);
}
const items = JSON.parse(readFileSync(file, "utf8")).filter((n) => !n.hidden && n.summary);

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// 화면과 같은 제목 정리 (말머리·보도자료 부제 떼기)
function cleanTitle(n) {
  let t = (n.titleKo ?? n.title).replace(/\s+/g, " ").trim();
  if (n.label === "보도자료") {
    t = t.replace(/\.?\s*금일 등록된 게시글\s*$/, "").replace(/\s*-\s*$/, "");
    return t.match(/^(.{10,}?)\s+-\s*(.+)$/)?.[1] ?? t;
  }
  return t.replace(/^[[【][^\]】]{1,20}[\]】]\s*/, "").replace(/\s*[[【][^\]】]{1,15}[\]】]$/, "");
}

for (const n of items) {
  const title = cleanTitle(n);
  const kicker = n.label === "보도자료" ? `[${AGENCY[n.source] ?? n.source} 보도자료] ` : "";
  const url = `${SITE}a/${n.id}/`;
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>${esc(kicker + title)} | Today's News</title>
<meta name="description" content="${esc(cut(n.summary, 150))}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Today's News">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(kicker + title)}">
<meta property="og:description" content="${esc(cut(n.summary, 150))}">
<meta property="og:image" content="${esc(n.label === "보도자료" && n.image ? n.image : DEFAULT_IMAGE)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=../../#/article/${n.id}">
<script>location.replace("../../#/article/${n.id}")</script>
</head><body><a href="../../#/article/${n.id}">${esc(title)}</a></body></html>`;
  mkdirSync(`${DIST}/a/${n.id}`, { recursive: true });
  writeFileSync(`${DIST}/a/${n.id}/index.html`, html);
}
console.log(`🔗 공유 페이지 ${items.length}개 만듦 (dist/a/<id>/)`);
