import { useEffect, useState } from "react";

/**
 * 새 기사 알림 켜기 (웹 푸시)
 * 개인용이라 서버가 없어서, 구독 정보(JSON)를 복사해 GitHub Secret에 넣는 방식이에요.
 * 아이폰은 iOS 16.4 이상 + 홈 화면에 추가한 앱에서만 동작해요.
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

type State = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on";

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
  const [subscription, setSubscription] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        setSubscription(JSON.stringify(sub));
        setState("on");
      } else setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  if (!PUBLIC_KEY || state === "checking") return null;

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
      setSubscription(JSON.stringify(sub));
      setState("on");
    } catch {
      setState("unsupported");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(subscription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      {state === "off" && (
        <button type="button" onClick={enable} disabled={busy} className={`mt-3 ${button}`}>
          {busy ? "켜는 중…" : "알림 켜기"}
        </button>
      )}
      {state === "on" && (
        <>
          <p className="mt-2">알림이 켜져 있어요. 새 기사가 들어오면 알려드려요.</p>
          <button type="button" onClick={copy} className={`mt-3 ${button}`}>
            {copied ? "복사했어요" : "구독 정보 복사"}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            처음 한 번만, 복사한 내용을 GitHub 저장소의 Secret <code>PUSH_SUBSCRIPTION</code>에 붙여 넣어 주세요.
          </p>
        </>
      )}
    </div>
  );
}
