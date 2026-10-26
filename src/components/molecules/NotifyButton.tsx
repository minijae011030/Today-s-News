import { usePush } from "../../hooks/usePush";

/** 푸터의 알림 설정 (켜고 끄기). 처음 안내는 하단 시트(AppPrompt)가 담당 */
export function NotifyButton() {
  const { state, busy, enable, disable } = usePush();

  if (state === "not-configured") {
    return import.meta.env.DEV ? (
      <p className="mt-6 text-xs text-muted">
        알림 버튼 숨김: .env에 VITE_VAPID_PUBLIC_KEY / VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY가 필요합니다.
      </p>
    ) : null;
  }
  if (state === "checking") return null;

  const button =
    "border border-ink px-3 py-1.5 text-sm font-semibold text-ink hover:bg-ink hover:text-paper disabled:opacity-50";

  return (
    <div className="mt-6">
      <h2 className="font-semibold text-ink">Notifications</h2>
      {state === "needs-install" && (
        <p className="mt-2 leading-relaxed">
          Add Today&rsquo;s News to your Home Screen to get notifications.
        </p>
      )}
      {state === "unsupported" && <p className="mt-2">Notifications aren&rsquo;t supported in this browser.</p>}
      {state === "denied" && (
        <p className="mt-2 leading-relaxed">
          Notifications are blocked. Turn them on in Settings, Notifications, Today.
        </p>
      )}
      {(state === "off" || state === "error") && (
        <>
          {state === "error" && <p className="mt-2">Couldn&rsquo;t turn on notifications. Please try again.</p>}
          <button type="button" onClick={enable} disabled={busy} className={`mt-3 ${button}`}>
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        </>
      )}
      {state === "on" && (
        <p className="mt-2">
          You&rsquo;re getting notifications.{" "}
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="text-muted underline underline-offset-2 hover:text-ink"
          >
            Turn off
          </button>
        </p>
      )}
    </div>
  );
}
