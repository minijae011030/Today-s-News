/* 해시 라우팅: #/ , #/section/경제?page=2&label=보도자료 , #/article/<id> */
export type Route =
  | { name: "front" }
  | { name: "section"; section: string; page: number; label?: string }
  | { name: "article"; id: string };

export function parseHash(): Route {
  const [path, query = ""] = window.location.hash.split("?");
  const [, kind, raw] = path.split("/");
  const value = raw ? decodeURIComponent(raw) : "";
  const params = new URLSearchParams(query);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const label = params.get("label") || undefined;
  if (kind === "section" && value)
    return { name: "section", section: value, page, label };
  if (kind === "article" && value) return { name: "article", id: value };
  return { name: "front" };
}

export const href = {
  front: "#/",
  section: (s: string, page = 1, label?: string) => {
    const q = new URLSearchParams();
    if (page > 1) q.set("page", String(page));
    if (label) q.set("label", label);
    const qs = q.toString();
    return `#/section/${encodeURIComponent(s)}${qs ? `?${qs}` : ""}`;
  },
  article: (id: string) => `#/article/${encodeURIComponent(id)}`,
};
