// 데이터 커밋 메시지 만들기: "chore: update news (+23 · 경제 6 · 국제 4 …)"
import { readFileSync } from "node:fs";

const ORDER = ["경제", "정치", "사회", "IT", "과학", "문화"];
let meta = {};
try {
  meta = JSON.parse(readFileSync("public/data/meta.json", "utf8"));
} catch {}

const n = meta.newCount ?? 0;
const cats = Object.entries(meta.newByCategory ?? {})
  .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
  .map(([c, k]) => `${c} ${k}`)
  .join(" · ");
const extra = [cats, meta.concept && `개념: ${meta.concept}`].filter(Boolean).join(" · ");
console.log(`chore: update news (+${n}${extra ? ` · ${extra}` : ""})`);
