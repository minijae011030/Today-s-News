// APOD만 빠르게 확인 (Gemini 안 씀, 수집 안 돌림)
// 실행: node scripts/apod-check.mjs
import { parseHTML } from "linkedom";
try { process.loadEnvFile(); } catch {}

const key = process.env.NASA_API_KEY || "DEMO_KEY";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130 Safari/537.36";

console.log("① NASA API");
try {
  const r = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}&thumbs=true`, { signal: AbortSignal.timeout(45000) });
  console.log("  status", r.status);
  const j = await r.json();
  console.log("  ", JSON.stringify({ date: j.date, title: j.title, media_type: j.media_type, url: j.url, hdurl: j.hdurl }, null, 2));
} catch (e) { console.log("  실패:", e.message); }

console.log("\n② science.nasa.gov/apod/ 페이지");
try {
  const r = await fetch("https://science.nasa.gov/apod/", { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  console.log("  status", r.status, r.url);
  const { document } = parseHTML(await r.text());
  const imgs = [...document.querySelectorAll("img")].map((el) => el.getAttribute("src"));
  console.log("  이미지들:", imgs.slice(0, 6));
  const pick = [...document.querySelectorAll("img")].find((el) => /assets\.science\.nasa\.gov\/.*\/apod\//.test(el.getAttribute("src") ?? ""));
  console.log("  고른 사진:", pick?.getAttribute("src"));
  const entry = pick?.closest("a")?.getAttribute("href") ?? "";
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const h2s = [...document.querySelectorAll("h2")].map((h) => h.textContent.trim()).filter(Boolean);
  const title = h2s.find((t) => slug(t).length > 3 && entry.includes(slug(t))) ?? h2s.find((t) => !/suggested searches|featured|keep exploring|related/i.test(t));
  console.log("  링크:", entry);
  console.log("  제목:", title);
  const ex = [...document.querySelectorAll("p")].map((p) => p.textContent.replace(/\s+/g, " ").trim()).filter((t) => !/Authors|Service of|Discover the cosmos/i.test(t)).sort((a, b) => b.length - a.length)[0];
  console.log("  설명:", ex?.slice(0, 160));
  console.log("  촬영:", document.body.textContent.match(/Credit[^:\n]*:\s*([^\n]+)/)?.[1]?.trim());
} catch (e) { console.log("  실패:", e.message); }
