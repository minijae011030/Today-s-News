// 지난 보도자료 채우기: 보관 기간(30일) 안의 금감원·금융위 보도자료 중 아직 없는 걸 게시판을 뒤로 넘겨가며 모음
// - 한 번에 PRESS_BACKFILL_PER_RUN건씩만 (요약은 평소처럼 enrich가 함) → 몇 번의 수집에 나눠서 채워짐
// - 다 채우면 그날은 다시 안 봄 (state.json), 다음 날 한 번 더 확인
import { mkdir, writeFile } from "node:fs/promises";
import { DATA_DIR, PRESS_BACKFILL_PER_RUN, PRESS_KEEP_DAYS, PRESS_LABEL, type FeedSource, type NewsItem } from "./config.ts";
import { StoryIndex } from "./dedupe.ts";
import { fetchBoardSince } from "./sources.ts";
import { kstToday, readData } from "./util.ts";

type State = { pressBackfillDoneOn?: string };

export async function backfillPress(sources: FeedSource[], items: NewsItem[]): Promise<NewsItem[]> {
  const state = (await readData<State>("state.json")) ?? {};
  const today = kstToday();
  if (state.pressBackfillDoneOn === today) return [];

  const since = new Date(Date.parse(today) - (PRESS_KEEP_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  const known = new Set(items.map((n) => n.key));
  const stories = new StoryIndex(items.filter((n) => n.label === PRESS_LABEL));
  const found: NewsItem[] = [];
  for (const src of sources) {
    if (src.type !== "board") continue;
    for (const n of await fetchBoardSince(src, since)) {
      if (known.has(n.key) || stories.findSame(n)) continue;
      known.add(n.key);
      found.push({ ...n, keepDays: PRESS_KEEP_DAYS });
    }
  }
  const picked = found.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, PRESS_BACKFILL_PER_RUN);
  if (found.length <= PRESS_BACKFILL_PER_RUN) {
    // 이번에 다 채움 → 오늘은 끝
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(`${DATA_DIR}/state.json`, JSON.stringify({ ...state, pressBackfillDoneOn: today }, null, 2));
  }
  if (picked.length) console.log(`🗂  지난 보도자료 채우기 +${picked.length}건 (남은 것 ${found.length - picked.length}건, ${since}부터)`);
  return picked;
}
