// 오늘의 우주 사진 (NASA APOD: Astronomy Picture of the Day)
// APOD 페이지(science.nasa.gov/apod)에서 직접 읽고, 새 사진일 때만 Gemini로 한국어 제목·설명을 만들어 space.json에 저장
// (api.nasa.gov는 로고를 주거나 타임아웃이 잦아서 안 씀)
import { mkdir, writeFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { DATA_DIR, report } from "./config.ts";
import { callGemini, geminiKey } from "./gemini.ts";
import { fetchHtml, kstToday, parseJson, readData } from "./util.ts";

const PAGE = "https://science.nasa.gov/apod/";
const SPACE_VERSION = 2; // 파싱 방식이 바뀌면 올려서 기존 space.json을 다시 만들게 함
const APOD_IMAGE = /assets\.science\.nasa\.gov\/.*\/apod\//; // 헤더 NASA 로고 같은 엉뚱한 이미지 방지

type SpacePhoto = {
  v: number;
  date: string; // APOD 날짜 (YYYY-MM-DD, 미국 기준)
  title: string;
  titleKo: string;
  story: string; // 한국어로 쉽게 풀어쓴 설명
  image: string;
  hdImage: string;
  credit: string;
  link: string;
};
type Apod = Omit<SpacePhoto, "v" | "titleKo" | "story"> & { explanation: string };

async function fetchApod(): Promise<Apod> {
  const { document } = parseHTML(await fetchHtml(PAGE, 20_000));
  const img = [...document.querySelectorAll("img")].find((el) => APOD_IMAGE.test(el.getAttribute("src") ?? ""));
  const src = img?.getAttribute("src");
  if (!src) throw new Error("오늘은 사진이 아니라 영상이라 어제 사진 유지");
  const link = new URL(img?.closest("a")?.getAttribute("href") ?? PAGE, PAGE).href;

  // 제목: "Suggested Searches" 같은 메뉴 h2도 있어서, 사진 링크 주소(…/m42-the-great-nebula-in-orion/)에 든 h2를 고름
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const h2s = [...document.querySelectorAll("h2")].map((h) => (h.textContent ?? "").trim()).filter(Boolean);
  const title =
    h2s.find((t) => slug(t).length > 3 && link.includes(slug(t))) ??
    h2s.find((t) => !/suggested searches|featured|keep exploring|related/i.test(t));
  // 설명: 페이지 소개문도 있어서, 가장 긴 문단을 고름
  const explanation = [...document.querySelectorAll("p")]
    .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((t) => !/Authors|Service of|Discover the cosmos/i.test(t))
    .sort((a, b) => b.length - a.length)[0];
  if (!title || !explanation) throw new Error("제목/설명을 못 찾음");

  const body = document.body?.textContent ?? "";
  const credit = body.match(/Credit[^:\n]*:\s*([^\n]+)/)?.[1]?.replace(/\s+/g, " ").trim() || "NASA";
  const m = body.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/,
  );
  const date = m ? new Date(`${m[1]} ${m[2]}, ${m[3]} UTC`).toISOString().slice(0, 10) : kstToday();
  const url = new URL(src, PAGE);
  // 같은 이미지를 더 크게 (크기 파라미터만 바꿈)
  return { date, title, explanation, credit, link, image: url.href, hdImage: `${url.origin}${url.pathname}?w=4096&h=4096&fit=clip` };
}

export async function makeSpacePhoto(): Promise<void> {
  const apiKey = geminiKey();
  if (!apiKey) return;
  let apod: Apod;
  try {
    apod = await fetchApod();
  } catch (e) {
    console.warn(`   오늘의 우주 사진 건너뜀: ${(e as Error).message}`);
    return;
  }
  const current = await readData<SpacePhoto>("space.json");
  if (current?.date === apod.date && current.v === SPACE_VERSION) return; // 새 사진 없음

  const prompt = `NASA의 오늘의 천문 사진 설명이야. JSON 객체 하나로만 답해.
{
  "titleKo": "자연스러운 한국어 제목",
  "story": "일반인이 '오 신기하다' 할 수 있게 사진 속 천체나 현상을 3~4문장으로 쉽게 설명. 원문 설명에 있는 사실만 써. 문체는 '~입니다/~습니다'"
}

제목: ${apod.title}
설명: ${apod.explanation}`;

  try {
    const o = parseJson<{ titleKo?: string; story?: string }>(await callGemini(apiKey, prompt), "{");
    const { explanation: _, ...rest } = apod;
    const photo: SpacePhoto = { v: SPACE_VERSION, ...rest, titleKo: o.titleKo ?? apod.title, story: o.story ?? "" };
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(`${DATA_DIR}/space.json`, JSON.stringify(photo, null, 2));
    report.spacePhoto = photo.titleKo;
    console.log(`🌌 오늘의 우주 사진: ${photo.titleKo}`);
  } catch (e) {
    console.warn(`⚠️  오늘의 우주 사진 설명 실패: ${(e as Error).message}`);
  }
}
