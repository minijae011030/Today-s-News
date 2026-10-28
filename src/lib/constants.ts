export const PRESS = "보도자료"; // 금감원·금융위 보도자료 탭
export const SECTIONS = [PRESS, "경제", "정치", "IT", "과학", "문화"] as const;

// 보도자료 기관 줄임말 (라벨·필터용)
export const AGENCY_SHORT: Record<string, string> = { 금융감독원: "금감원", 금융위원회: "금융위" };

export const PAGE_SIZE = 10;

export const REPO_URL = "https://github.com/minijae011030/TodaysNews";
