import { useEffect, useState } from "react";
import { isIOS, isStandalone, usePush } from "../../hooks/usePush";

/**
 * 화면 아래에서 올라오는 안내 시트 (쿠키 배너 같은 것)
 *  1) 아이폰 Safari 탭으로 보는 중 → "홈 화면에 추가" 방법 안내
 *  2) 안드로이드·데스크톱 크롬 → "앱으로 설치" 버튼 (브라우저 설치 창 띄움)
 *  3) 앱으로 열었는데 알림이 꺼져 있음 → "알림 켜기"
 * "나중에"를 누르면 7일 동안 다시 안 뜸
 */

type Kind = "install-ios" | "install" | "notify";

const SNOOZE_DAYS = 7;
const key = (k: Kind) => `prompt-snooze:${k}`;

function snoozed(k: Kind): boolean {
  try {
    const until = Number(localStorage.getItem(key(k)));
    return until > Date.now();
  } catch {
    return false;
  }
}
function snooze(k: Kind) {
  try {
    localStorage.setItem(key(k), String(Date.now() + SNOOZE_DAYS * 86400_000));
  } catch {}
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function AppPrompt() {
  const push = usePush();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ready, setReady] = useState(false); // 화면 뜨자마자 덮지 않게 잠깐 기다림
  const [closed, setClosed] = useState<Kind | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 미니바 대신 우리 시트로
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const t = setTimeout(() => setReady(true), 1500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      clearTimeout(t);
    };
  }, []);

  let kind: Kind | null = null;
  if (!isStandalone()) {
    if (isIOS()) kind = "install-ios";
    else if (installEvent) kind = "install";
  } else if (push.state === "off") {
    kind = "notify";
  }
  if (!ready || !kind || kind === closed || snoozed(kind)) return null;

  const later = () => {
    snooze(kind!);
    setClosed(kind);
  };

  const install = async () => {
    await installEvent?.prompt();
    await installEvent?.userChoice;
    setInstallEvent(null);
  };

  const notify = async () => {
    await push.enable();
    setClosed("notify");
  };

  const primary =
    "bg-ink px-4 py-2.5 text-sm font-semibold text-paper hover:bg-ink-soft disabled:opacity-50";
  const secondary = "px-3 py-2.5 text-sm text-ink-soft underline-offset-2 hover:text-ink hover:underline";

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-labelledby="app-prompt-title"
      className="app-prompt fixed inset-x-0 bottom-0 z-40 border-t-4 border-double border-ink bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-170 px-5 pt-5 pb-4">
        {kind === "install-ios" && (
          <>
            <h2 id="app-prompt-title" className="font-serif text-lg font-bold">
              Add to Home Screen
            </h2>
            <p className="mt-2 font-serif leading-[1.75] text-ink-soft">
              Tap <ShareIcon /> in Safari, then choose <b className="text-ink">Add to Home Screen</b>.
              Today&rsquo;s News will open like an app, and you can get notified about new stories.
            </p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={later} className={primary}>
                Got it
              </button>
            </div>
          </>
        )}

        {kind === "install" && (
          <>
            <h2 id="app-prompt-title" className="font-serif text-lg font-bold">
              Install the app
            </h2>
            <p className="mt-2 font-serif leading-[1.75] text-ink-soft">
              Open Today&rsquo;s News in one tap.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={later} className={secondary}>
                Not now
              </button>
              <button type="button" onClick={install} className={primary}>
                Install
              </button>
            </div>
          </>
        )}

        {kind === "notify" && (
          <>
            <h2 id="app-prompt-title" className="font-serif text-lg font-bold">
              Get notified about new stories?
            </h2>
            <p className="mt-2 font-serif leading-[1.75] text-ink-soft">
              We&rsquo;ll send a short briefing twice a day, at 7 a.m. and 7 p.m. You can turn this off anytime at the bottom of the page.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={later} className={secondary}>
                Not now
              </button>
              <button type="button" onClick={notify} disabled={push.busy} className={primary}>
                {push.busy ? "Turning on…" : "Turn on"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** iOS 공유 아이콘 (네모에서 화살표가 위로) */
function ShareIcon() {
  return (
    <svg
      aria-label="Share"
      viewBox="0 0 24 24"
      className="mx-0.5 inline size-[1.1em] -translate-y-px fill-none stroke-current stroke-[1.8]"
    >
      <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 10H5v11h14V10h-2" strokeLinejoin="round" />
    </svg>
  );
}
