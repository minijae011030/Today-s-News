/**
 * 하루 두 번(아침 7시·저녁 7시) 브리핑 알림 보내기
 * - 매시간 수집 뒤에 실행되지만, 그 두 시각에만 실제로 보냄 (나머지 시각은 건너뜀)
 * - 지난 12시간 동안 들어온 기사를 모아서: 보도자료 제목 1~2개 + 새 기사 수
 * 실행: npm run notify  (GitHub Actions에서 배포가 끝난 뒤 실행)
 * 테스트: FORCE_NOTIFY=1 DRY_RUN=1 npm run notify  (시각과 상관없이, 보내지 않고 내용만 출력)
 *
 * 필요한 환경변수
 *  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY : npx web-push generate-vapid-keys 로 만든 키
 *  SUPABASE_URL, SUPABASE_SECRET_KEY   : 구독 목록을 읽을 Supabase (secret = 예전 service_role 키)
 *  SITE_URL                            : 알림 눌렀을 때 열 주소
 */
import { appendFile, readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import webpush, { type PushSubscription } from "web-push";

try {
  process.loadEnvFile();
} catch {}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
const SITE_URL = process.env.SITE_URL ?? "https://minijae011030.github.io/TodaysNews/";

const BRIEFING_HOURS = [7, 19]; // KST
const WINDOW = 12 * 3600_000; // 지난 브리핑 이후 12시간
const AGENCY: Record<string, string> = { 금융감독원: "금감원", 금융위원회: "금융위" };

type Item = { title: string; source: string; category: string; label?: string; publishedAt: string; hidden?: boolean; coverage?: number };

const kstHour = () =>
  Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Seoul" }).format(new Date()));

// 방금 배포된 사이트에서 최신 기사 목록 읽기 (Actions의 checkout은 이번 수집 커밋 전 상태라서)
async function loadItems(): Promise<Item[]> {
  try {
    const r = await fetch(`${SITE_URL}data/news.json?t=${Date.now()}`, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch {}
  for (const f of ["public/data/news.json", "public/data-local/news.json"]) {
    try {
      return JSON.parse(await readFile(f, "utf8"));
    } catch {}
  }
  return [];
}

const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

// 알림 내용: 보도자료가 있으면 제목을, 없으면 가장 많이 보도된 기사 제목을
function briefing(items: Item[]) {
  const since = Date.now() - WINDOW;
  const fresh = items.filter((n) => !n.hidden && !/^\s*\[(포토|사진|영상)/.test(n.title) && Date.parse(n.publishedAt) >= since);
  const press = fresh.filter((n) => n.label === "보도자료");
  const news = fresh.filter((n) => n.label !== "보도자료");
  const morning = kstHour() < 12;
  // 보도자료 첫 줄 + 가장 많이 보도된 기사 한 줄
  const pressLine = press[0] && `[${AGENCY[press[0].source] ?? press[0].source}] ${cut(press[0].title, 40)}`;
  const study = news.filter((n) => n.category === "경제" || n.category === "정치");
  const top = [...(study.length ? study : news)].sort((a, b) => (b.coverage ?? 1) - (a.coverage ?? 1))[0];
  const newsLine = top && cut(top.title, 40);
  const counts = [press.length && `보도자료 ${press.length}건`, news.length && `기사 ${news.length}건`].filter(Boolean).join(" · ");
  return {
    total: fresh.length,
    title: `Today's News · ${morning ? "아침" : "저녁"} 브리핑`,
    body: [pressLine, newsLine, counts && `새로 들어온 ${counts}`].filter(Boolean).join("\n"),
  };
}

// GitHub Actions 실행 요약 카드에 한 줄 추가
async function summary(line: string) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function main() {
  if (process.env.DRY_RUN) {
    const b = briefing(await loadItems());
    console.log(`[미리보기] ${b.title}\n${b.body}\n(지난 12시간 ${b.total}건)`);
    return;
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.log("ℹ️  푸시 키나 Supabase 설정이 없어서 알림을 건너뜀");
    return;
  }
  if (!process.env.FORCE_NOTIFY && !BRIEFING_HOURS.includes(kstHour())) {
    console.log(`ℹ️  알림은 ${BRIEFING_HOURS.join("시·")}시에만 보냄 → 건너뜀`);
    return;
  }
  const b = briefing(await loadItems());
  if (b.total === 0) {
    console.log("ℹ️  지난 12시간 새 기사 없음 → 알림 안 보냄");
    return;
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from("push_subscriptions").select("endpoint, subscription");
  if (error) {
    await summary(`⚠️ 구독 목록을 읽지 못했습니다: ${error.message}`);
    return;
  }
  if (!data?.length) {
    await summary("ℹ️ 등록된 기기 없음 (앱에서 알림 켜기를 눌러 주세요)");
    return;
  }

  webpush.setVapidDetails("https://github.com/minijae011030/TodaysNews", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({ title: b.title, body: b.body, url: SITE_URL, count: b.total });
  console.log(`${b.title}\n${b.body}`);

  let sent = 0;
  for (const row of data) {
    try {
      await webpush.sendNotification(row.subscription as PushSubscription, payload, { TTL: 3 * 60 * 60 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // 앱을 지웠거나 구독이 만료된 기기 → 목록에서 정리
        await db.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        console.log("🧹 만료된 구독 1건 정리");
      } else {
        console.error(`⚠️  알림 실패: ${(e as Error).message}`);
      }
    }
  }
  await summary(`🔔 ${b.title} 보냄 ${sent}/${data.length}대: ${b.body.replace(/\n/g, " / ")}`);
}

main();
