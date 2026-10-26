// 서비스워커에 붙는 푸시 알림 처리 (vite-plugin-pwa가 importScripts로 불러옴)
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(data.title || "Today's News", {
      body: data.body || "새 뉴스가 추가되었습니다",
      icon: new URL("pwa-192x192.png", scope).href,
      badge: new URL("favicon-64x64.png", scope).href,
      tag: "new-news", // 알림이 쌓이지 않고 최신 것 하나로 교체
      renotify: true,
      data: { url: data.url || scope },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.registration.scope));
      if (open) {
        open.navigate(url);
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
