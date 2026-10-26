import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * 웹 푸시 알림 상태 + 켜기/끄기 (푸터 버튼과 하단 안내 시트가 같이 씀)
 * 켜면 구독 정보를 Supabase에 저장하고, GitHub Actions가 거기서 읽어 알림을 보내요.
 * 아이폰은 iOS 16.4 이상 + 홈 화면에 추가한 앱에서만 동작해요.
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState =
  | "checking"
  | "not-configured" // 키가 빌드에 없음
  | "unsupported"
  | "needs-install" // 아이폰 Safari 탭: 홈 화면에 추가해야 함
  | "denied"
  | "off"
  | "on"
  | "error";

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function saveSubscription(sub: PushSubscription) {
  const { error } = await supabase!.rpc("save_push_subscription", {
    sub: sub.toJSON(),
    ua: navigator.userAgent,
  });
  if (error) throw error;
}

// 여러 컴포넌트가 같은 상태를 보도록 모듈 단위로 공유
let shared: PushState = "checking";
const listeners = new Set<(s: PushState) => void>();
const setShared = (s: PushState) => {
  shared = s;
  listeners.forEach((l) => l(s));
};
let checked = false;

async function check() {
  if (checked) return;
  checked = true;
  if (!PUBLIC_KEY || !supabase) return setShared("not-configured");
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return setShared(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
  if (Notification.permission === "denied") return setShared("denied");
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      // 이미 켜져 있으면 저장소와 다시 맞춰둠 (구독이 바뀌었거나 지워졌을 때 대비)
      await saveSubscription(sub).catch(() => {});
      setShared("on");
    } else setShared("off");
  } catch {
    setShared("unsupported");
  }
}

export function usePush() {
  const [state, setState] = useState<PushState>(shared);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listeners.add(setState);
    check();
    setState(shared);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const enable = useCallback(async () => {
    if (!PUBLIC_KEY || !supabase) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setShared(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
      });
      try {
        await saveSubscription(sub);
      } catch {
        await sub.unsubscribe(); // 저장 못 하면 알림이 안 오니까 되돌림
        return setShared("error");
      }
      setShared("on");
    } catch {
      setShared("unsupported");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase?.rpc("delete_push_subscription", { endpoint_url: sub.endpoint });
        await sub.unsubscribe();
      }
      setShared("off");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
