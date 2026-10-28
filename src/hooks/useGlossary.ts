import { useEffect, useMemo, useState } from "react";
import { fetchData } from "../lib/data";
import { buildLookup } from "../lib/glossary";
import type { Concept, GlossaryEntry } from "../types/news";

/** 용어 사전 + 오늘의 개념 기록 (용어 팝업·사전 페이지용) */
export function useGlossary(version: number) {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);

  useEffect(() => {
    fetchData("glossary.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetchData("concept.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConcepts(d?.history ?? []))
      .catch(() => {});
  }, [version]);

  const lookup = useMemo(() => buildLookup(entries, concepts), [entries, concepts]);
  return { entries, lookup };
}
