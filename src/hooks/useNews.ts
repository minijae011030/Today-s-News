import { useCallback, useEffect, useState } from "react";
import { fetchData } from "../lib/data";
import type { Concept, NewsItem } from "../types/news";

/** 기사 목록 + 오늘의 개념 + 당겨서 새로고침 */
export function useNews() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0); // 새로고침할 때마다 +1 (푸터도 다시 불러오게)
  const [concept, setConcept] = useState<Concept | null>(null);

  const load = useCallback(async (): Promise<NewsItem[]> => {
    const r = await fetchData("news.json");
    if (!r.ok) throw new Error(String(r.status));
    const all: NewsItem[] = await r.json();
    return all.filter((n) => !n.hidden); // 섹션에 안 맞는 기사는 숨김
  }, []);

  useEffect(() => {
    load()
      .then(setItems)
      .catch(() => setError(true));
  }, [load]);

  // 오늘의 개념 (하루 한 번 갱신, 새로고침하면 다시 확인)
  useEffect(() => {
    fetchData("concept.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConcept(d?.history?.[0] ?? null))
      .catch(() => {});
  }, [version]);

  // 당겨서 새로고침: 새로 들어온 기사 수를 돌려줌
  const refresh = useCallback(async (): Promise<number | null> => {
    try {
      const next = await load();
      const before = new Set(items?.map((n) => n.id));
      setItems(next);
      setError(false);
      setVersion((v) => v + 1);
      return next.filter((n) => !before.has(n.id)).length;
    } catch {
      return null;
    }
  }, [load, items]);

  return { items, error, version, concept, refresh };
}
