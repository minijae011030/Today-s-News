/* 해시 라우팅: #/ , #/section/경제?page=2 , #/article/<id> */
export type Route =
  | { name: "front" }
  | { name: "section"; section: string; page: number }
  | { name: "article"; id: string };

export function parseHash(): Route {
  const [path, query = ""] = window.location.hash.split("?");
  const [, kind, raw] = path.split("/");
  const value = raw ? decodeURIComponent(raw) : "";
  const page = Math.max(1, Number(new URLSearchParams(query).get("page")) || 1);
  if (kind === "section" && value)
    return { name: "section", section: value, page };
  if (kind === "article" && value) return { name: "article", id: value };
  return { name: "front" };
}

export const href = {
  front: "#/",
  section: (s: string, page = 1) =>
    `#/section/${encodeURIComponent(s)}${page > 1 ? `?page=${page}` : ""}`,
  article: (id: string) => `#/article/${encodeURIComponent(id)}`,
};
