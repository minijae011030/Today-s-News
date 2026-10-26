import { useEffect, useState } from "react";
import { fetchData } from "../lib/data";

/** 마지막 수집 시각 (meta.json) */
export function useUpdatedAt(version: number): string | null {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchData("meta.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => m?.updatedAt && setUpdatedAt(m.updatedAt))
      .catch(() => {});
  }, [version]);

  return updatedAt;
}
