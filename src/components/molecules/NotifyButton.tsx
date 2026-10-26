import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * 새 기사 알림 켜기 (웹 푸시)
 * 켜면 구독 정보를 Supabase에 저장하고, GitHub Actions가 거기서 읽어 알림을 보내요.
 * 아이폰은 iOS 16.4 이상 + 홈 화면에 추가한 앱에서만 동작해요.
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

type State = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on" | "error";

async function saveSubscription(sub: PushSubscription) {
  const { error } = await supabase!.rpc("save_push_subscription", {
    sub: sub.toJSON(),
    ua: navigator.userAgent,
  });
  if (error) throw error;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function NotifyButton() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // 이미 켜져 있으면 저장소와 다시 맞춰둠 (구독이 바뀌었거나 지워졌을 때 대비)
        await saveSubscription(sub).catch(() => {});
        setState("on");
      } else setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  // 키가 빌드에 안 들어갔으면 버튼을 숨김 (개발 중에만 이유를 보여줌)
  if (!PUBLIC_KEY || !supabase) {
    return import.meta.env.DEV ? (
      <p className="mt-6 text-xs text-muted">
        알림 버튼 숨김: .env에 {!PUBLIC_KEY ? "VITE_VAPID_PUBLIC_KEY" : "VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY"}가 없어요.
      </p>
    ) : null;
  }
  if (state === "checking") return null;

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      });
      try {
        await saveSubscription(sub);
      } catch {
        await sub.unsubscribe(); // 저장 못 하면 알림이 안 오니까 되돌림
        return setState("error");
      }
      setState("on");
    } catch {
      setState("unsupported");
    } finally {
      setBusy(false);
    }
  };

  // 끄기: 다시 켜면 새 구독 정보가 생기니까, 폰을 바꾸거나 다시 설정할 때도 이걸로 해결
  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase!.rpc("delete_push_subscription", { endpoint_url: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const button =
    "border border-ink px-3 py-1.5 text-sm font-semibold text-ink hover:bg-ink hover:text-paper disabled:opacity-50";

  return (
    <div className="mt-6">
      <h2 className="font-semibold text-ink">새 기사 알림</h2>
      {state === "needs-install" && (
        <p className="mt-2 leading-relaxed">
          아이폰은 Safari 공유 버튼에서 홈 화면에 추가한 뒤, 그 앱에서 알림을 켤 수 있어요.
        </p>
      )}
      {state === "unsupported" && <p className="mt-2">이 브라우저에서는 알림을 받을 수 없어요.</p>}
      {state === "denied" && (
        <p className="mt-2 leading-relaxed">
          알림이 차단돼 있어요. 설정 → 알림 → Today에서 허용으로 바꿔 주세요.
        </p>
      )}
      {state === "error" && (
        <>
          <p className="mt-2">알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.</p>
          <button type="button" onClick={enable} disabled={busy} className={`mt-3 ${button}`}>
            {busy ? "켜는 중…" : "다시 시도"}
          </button>
        </>
      )}
      {state === "off" && (
        <button type="button" onClick={enable} disabled={busy} className={`mt-3 ${button}`}>
          {busy ? "켜는 중…" : "알림 켜기"}
        </button>
      )}
      {state === "on" && (
        <p className="mt-2">
          알림이 켜져 있어요.{" "}
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="text-muted underline underline-offset-2 hover:text-ink"
          >
            끄기
          </button>
        </p>
      )}
    </div>
  );
}
