import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// 브라우저용 공개 키 (publishable key, 예전 이름은 anon key)
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** 설정이 없으면 null (알림 버튼이 숨겨짐) */
export const supabase =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
