/**
 * 뉴스 수집 스크립트
 * feeds.json → (네이버 뉴스 검색 / RSS / 게시판) 수집 → 중복 제거 → 새 기사 고르기
 *   → 원문·PDF 읽기 → Gemini 요약 → public/data/news.json
 *   + 오늘의 개념(concept.json), 오늘의 우주 사진(space.json)
 *
 * 실행: npm run collect
 * 환경변수(.env): GEMINI_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 *
 * scripts/collect/
 *   config.ts   설정·타입·실행 기록     sources.ts  RSS·네이버·게시판 수집
 *   article.ts  원문·PDF 읽기           gemini.ts   Gemini 호출
 *   enrich.ts   요약·섹션 확인          concept.ts  오늘의 개념
 *   space.ts    오늘의 우주 사진        output.ts   저장·Actions 요약
 */
import { readFile } from "node:fs/promises";
import { DROPPED, KEEP_DAYS, MAX_NEW_PER_BUCKET, MIGRATE, PRESS_LABEL, report, type FeedSource, type NewsItem } from "./collect/config.ts";
import { fillMissingPdfs } from "./collect/article.ts";
import { makeConcept } from "./collect/concept.ts";
import { enrich } from "./collect/enrich.ts";
import { save, writeActionsSummary } from "./collect/output.ts";
import { fetchSource } from "./collect/sources.ts";
import { makeSpacePhoto } from "./collect/space.ts";
import { readData } from "./collect/util.ts";

const DAY = 24 * 60 * 60 * 1000;

// 지난 수집 결과 (요약은 재사용해서 비용 절약). 섹션 개편 전 데이터는 새 섹션으로 옮김
// (보도자료는 경제 탭 안에 있다가 따로 탭이 생김)
async function loadPrevious(): Promise<Map<string, NewsItem>> {
  const prev = (await readData<NewsItem[]>("news.json")) ?? [];
  return new Map(
    prev
      .filter((n) => !DROPPED.has(n.category))
      .map((n) => [n.key, { ...n, category: n.label === PRESS_LABEL ? PRESS_LABEL : (MIGRATE[n.category] ?? n.category) }]),
  );
}

// 묶음(섹션, 보도자료는 기관별)마다 "이미 실린 가장 최근 기사"보다 새 기사만, 최신순으로 최대 MAX_NEW_PER_BUCKET건.
// (이게 없으면 상한에 걸려 못 받은 예전 기사들이 다음 수집마다 줄줄이 다시 들어옴)
function pickNew(fetched: NewsItem[], known: Map<string, NewsItem>): NewsItem[] {
  const bucket = (n: NewsItem) => (n.label ? `${n.category}:${n.label}:${n.source}` : n.category);
  const latest: Record<string, string> = {};
  for (const n of known.values()) {
    const b = bucket(n);
    if (!latest[b] || n.publishedAt > latest[b]) latest[b] = n.publishedAt;
  }
  const taken: Record<string, number> = {};
  const seen = new Set<string>();
  const picked: NewsItem[] = [];
  for (const n of [...fetched].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    const b = bucket(n);
    if (!n.key || !n.link || known.has(n.key) || seen.has(n.key)) continue; // 같은 기사가 여러 키워드에 걸린 경우
    if (latest[b] && n.publishedAt <= latest[b]) continue;
    if ((taken[b] ?? 0) >= MAX_NEW_PER_BUCKET) continue;
    taken[b] = (taken[b] ?? 0) + 1;
    seen.add(n.key);
    picked.push(n);
  }
  return picked;
}

async function main() {
  const sources: FeedSource[] = JSON.parse(await readFile("feeds.json", "utf8"));
  const prev = await loadPrevious();
  const fetched = (await Promise.all(sources.map(fetchSource))).flat();
  const fresh = pickNew(fetched, prev);

  const items = [...prev.values(), ...fresh]
    .filter((n) => Date.now() - new Date(n.publishedAt).getTime() <= (n.keepDays ?? KEEP_DAYS) * DAY)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  report.fetched = fetched.length;
  console.log(`📥 수집 ${fetched.length}건 → 새 기사 ${fresh.length}건 · 보관 ${items.length}건`);

  await fillMissingPdfs(items);
  await enrich(items, () => save(items));

  // 숨긴 기사는 빼고, 옮겨진 섹션 기준으로 새 기사 수 계산 (알림·커밋 메시지용)
  for (const n of fresh.filter((n) => !n.hidden)) {
    report.newCount++;
    report.newByCategory[n.category] = (report.newByCategory[n.category] ?? 0) + 1;
  }
  await makeConcept(items);
  await makeSpacePhoto();
  await save(items);
  await writeActionsSummary(items.length);
  console.log(`✅ ${items.length}건 저장 (새 기사 ${report.newCount}건)`);
}

main();
