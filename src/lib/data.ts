// 로컬 개발 중에는 내가 직접 수집한 data-local을 먼저 보고, 없으면 배포용 data로
export function fetchData(name: string): Promise<Response> {
  const base = import.meta.env.BASE_URL;
  const init: RequestInit = { cache: "no-store" }; // 새로고침 때 항상 최신으로
  const shared = () => fetch(`${base}data/${name}`, init);
  if (!import.meta.env.DEV) return shared();
  return fetch(`${base}data-local/${name}`, init)
    .then((r) =>
      r.ok && r.headers.get("content-type")?.includes("json") ? r : shared(),
    )
    .catch(shared);
}
