/**
 * 새 기사가 있으면 폰으로 웹 푸시 알림 보내기
 * 실행: npm run notify  (GitHub Actions에서 배포가 끝난 뒤 실행)
 *
 * 필요한 환경변수
 *  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY : npx web-push generate-vapid-keys 로 만든 키
 *  PUSH_SUBSCRIPTION                   : 앱 푸터에서 "구독 정보 복사"로 받은 JSON
 *  NEW_COUNT                           : 새 기사 수 (없으면 meta.json에서 읽음)
 *  SITE_URL                            : 알림 눌렀을 때 열 주소
 */
import { readFile } from "node:fs/promises";
import webpush from "web-push";

try {
  process.loadEnvFile();
} catch {}

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBSCRIPTION } = process.env;
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

async function main() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
    console.log("ℹ️  푸시 키나 구독 정보가 없어서 알림을 건너뜀");
    return;
  }
  const count = await newCount();
  if (count === 0) {
    console.log("ℹ️  새 기사 없음 → 알림 안 보냄");
    return;
  }

  webpush.setVapidDetails("https://github.com/minijae011030/TodaysNews", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const payload = JSON.stringify({
    title: "Today's News",
    body: "새 뉴스가 추가되었어요",
    url: SITE_URL,
    count,
  });

  try {
    await webpush.sendNotification(JSON.parse(PUSH_SUBSCRIPTION), payload, { TTL: 60 * 60 });
    console.log(`🔔 알림 보냄 (새 기사 ${count}건)`);
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      console.error("⚠️  구독이 만료됐어요. 앱에서 알림을 다시 켜고 PUSH_SUBSCRIPTION을 새로 넣어주세요.");
    } else {
      console.error(`⚠️  알림 실패: ${(e as Error).message}`);
    }
    process.exitCode = 0; // 알림 실패로 배포 전체를 실패 처리하진 않음
  }
}

main();
