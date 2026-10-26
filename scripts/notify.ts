/**
 * 새 기사가 있으면 등록된 모든 기기로 웹 푸시 알림 보내기
 * 실행: npm run notify  (GitHub Actions에서 배포가 끝난 뒤 실행)
 *
 * 필요한 환경변수
 *  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY : npx web-push generate-vapid-keys 로 만든 키
 *  SUPABASE_URL, SUPABASE_SECRET_KEY   : 구독 목록을 읽을 Supabase (secret = 예전 service_role 키)
 *  NEW_COUNT                           : 새 기사 수 (없으면 meta.json에서 읽음)
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

async function newCount(): Promise<number> {
  if (process.env.NEW_COUNT) return Number(process.env.NEW_COUNT) || 0;
  for (const dir of ["public/data", "public/data-local"]) {
    try {
      const meta = JSON.parse(await readFile(`${dir}/meta.json`, "utf8"));
      return Number(meta.newCount) || 0;
    } catch {}
  }
  return 0;
}

// GitHub Actions 실행 요약 카드에 한 줄 추가
async function summary(line: string) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function main() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.log("ℹ️  푸시 키나 Supabase 설정이 없어서 알림을 건너뜀");
    return;
  }
  const count = await newCount();
  if (count === 0) {
    console.log("ℹ️  새 기사 없음 → 알림 안 보냄");
    return;
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const { data, error } = await db.from("push_subscriptions").select("endpoint, subscription");
  if (error) {
    await summary(`⚠️ 구독 목록을 못 읽었어요: ${error.message}`);
    return;
  }
  if (!data?.length) {
    await summary("ℹ️ 등록된 기기 없음 (앱에서 알림 켜기를 눌러 주세요)");
    return;
  }

  webpush.setVapidDetails("https://github.com/minijae011030/TodaysNews", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const payload = JSON.stringify({
    title: "Today's News",
    body: "새 뉴스가 추가되었어요",
    url: SITE_URL,
    count,
  });

  let sent = 0;
  for (const row of data) {
    try {
      await webpush.sendNotification(row.subscription as PushSubscription, payload, { TTL: 60 * 60 });
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
  await summary(`🔔 알림 보냄 ${sent}/${data.length}대 (새 기사 ${count}건)`);
}

main();
