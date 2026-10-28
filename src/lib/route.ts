/* 해시 라우팅: #/ , #/section/보도자료?page=2&filter=금융감독원 , #/article/<id> , #/search?q=금리 */
export type Route =
  | { name: "front" }
  | { name: "section"; section: string; page: number; filter?: string }
  | { name: "article"; id: string }
  | { name: "search"; q: string; page: number };

export function parseHash(): Route {
  const [path, query = ""] = window.location.hash.split("?");
  const [, kind, raw] = path.split("/");
  const value = raw ? decodeURIComponent(raw) : "";
  const params = new URLSearchParams(query);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filter = params.get("filter") || undefined;
  if (kind === "section" && value)
    return { name: "section", section: value, page, filter };
  if (kind === "article" && value) return { name: "article", id: value };
  if (kind === "search") return { name: "search", q: params.get("q") ?? "", page };
  return { name: "front" };
}

export const href = {
  front: "#/",
  section: (s: string, page = 1, filter?: string) => {
    const q = new URLSearchParams();
    if (page > 1) q.set("page", String(page));
    if (filter) q.set("filter", filter);
    const qs = q.toString();
    return `#/section/${encodeURIComponent(s)}${qs ? `?${qs}` : ""}`;
  },
  article: (id: string) => `#/article/${encodeURIComponent(id)}`,
  search: (q = "", page = 1) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `#/search${qs ? `?${qs}` : ""}`;
  },
};
