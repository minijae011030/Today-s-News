import { useCallback, useEffect, useState } from "react";
import { fetchData } from "../lib/data";
import type { Concept, NewsItem, SpacePhoto } from "../types/news";

/** 기사 목록 + 오늘의 개념 + 당겨서 새로고침 */
export function useNews() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0); // 새로고침할 때마다 +1 (푸터도 다시 불러오게)
  const [concept, setConcept] = useState<Concept | null>(null);
  const [space, setSpace] = useState<SpacePhoto | null>(null);

  const load = useCallback(async (): Promise<NewsItem[]> => {
    const r = await fetchData("news.json");
    if (!r.ok) throw new Error(String(r.status));
    const all: NewsItem[] = await r.json();
    // 섹션 개편 전 데이터도 새 섹션으로 보이게 (다음 수집 때 데이터도 바뀜)
    const migrate: Record<string, string> = { 국제: "경제", 우주: "과학", 예술: "문화", 책: "문화", 엔터: "문화" };
    return all
      .filter((n) => !n.hidden && n.category !== "사회") // 섹션에 안 맞는 기사·없앤 섹션은 숨김
      .map((n) =>
        n.label === "보도자료" // 보도자료는 경제 탭에 있다가 따로 탭이 생김
          ? { ...n, category: "보도자료" }
          : migrate[n.category]
            ? { ...n, category: migrate[n.category] }
            : n,
      );
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
    // 오늘의 우주 사진 (NASA APOD)
    fetchData("space.json")
      .then((r) => (r.ok ? r.json() : null))
      // 진짜 APOD 사진·영상일 때만 1면 톱으로 (아니면 기사로 대체)
      .then((d) => {
        const apod = /apod\.nasa\.gov\/apod\/image\/|assets\.science\.nasa\.gov\/.*\/apod\//;
        const ok =
          (d?.image && (apod.test(d.image) || /img\.youtube\.com|vimeocdn/.test(d.image))) ||
          (d?.video && apod.test(d.video)) ||
          (d?.embed && /youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\//.test(d.embed));
        setSpace(ok ? d : null);
      })
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

  return { items, error, version, concept, space, refresh };
}
