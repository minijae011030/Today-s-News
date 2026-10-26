/**
 * 뉴스 수집 스크립트
 * feeds.json → RSS 수집 → 중복 제거 → (선택) LLM 요약 → public/data/news.json
 *
 * 실행: npm run collect
 * ANTHROPIC_API_KEY가 있으면 LLM 요약까지, 없으면 수집만 해.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import Parser from 'rss-parser'
import Anthropic from '@anthropic-ai/sdk'

type FeedSource =
  | { category: string; type: 'rss'; url: string }
  | { category: string; type: 'google'; query: string }

export type NewsItem = {
  id: string
  category: string
  title: string
  link: string
  source: string
  publishedAt: string
  snippet: string
  // LLM이 채우는 필드
  summary?: string
  tags?: string[]
  essayPoint?: string // 경제 카테고리 전용: 논술 포인트
}

const OUTPUT = 'public/data/news.json'
const KEEP_DAYS = 3
const MAX_PER_FEED = 15
const MODEL = 'claude-haiku-5-5'

const parser = new Parser({ timeout: 15_000 })

function toUrl(src: FeedSource): string {
  if (src.type === 'rss') return src.url
  const q = encodeURIComponent(`${src.query} when:2d`)
  return `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`
}

function stripHtml(s = ''): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
}

// 같은 기사가 여러 피드에 걸리는 걸 막기 위한 키
function normalizeTitle(t: string): string {
  return t
    .replace(/\s+-\s+[^-]+$/, '') // 구글 뉴스의 " - 언론사" 꼬리 제거
    .replace(/[\s\p{P}]/gu, '')
    .toLowerCase()
}

async function fetchFeed(src: FeedSource): Promise<NewsItem[]> {
  const url = toUrl(src)
  try {
    const feed = await parser.parseURL(url)
    return (feed.items ?? []).slice(0, MAX_PER_FEED).map((it) => {
      const title = (it.title ?? '').trim()
      const sourceName =
        (it as { source?: string }).source ?? feed.title ?? new URL(url).hostname
      return {
        id: normalizeTitle(title),
        category: src.category,
        title,
        link: it.link ?? '',
        source: String(sourceName),
        publishedAt: new Date(it.isoDate ?? it.pubDate ?? Date.now()).toISOString(),
        snippet: stripHtml(it.contentSnippet ?? it.content ?? ''),
      }
    })
  } catch (e) {
    console.warn(`⚠️  피드 실패 (${src.category}) ${url}: ${(e as Error).message}`)
    return []
  }
}

async function loadPrevious(): Promise<Map<string, NewsItem>> {
  try {
    const prev: NewsItem[] = JSON.parse(await readFile(OUTPUT, 'utf8'))
    return new Map(prev.map((n) => [n.id, n]))
  } catch {
    return new Map()
  }
}

async function enrich(items: NewsItem[]): Promise<void> {
  const todo = items.filter((n) => !n.summary)
  if (!process.env.ANTHROPIC_API_KEY || todo.length === 0) return

  const client = new Anthropic()
  const BATCH = 20

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH)
    const input = batch.map((n, idx) => ({
      idx,
      category: n.category,
      title: n.title,
      snippet: n.snippet,
    }))

    const prompt = `다음 뉴스 목록 각각에 대해 JSON 배열로만 답해.
각 원소: {"idx": number, "summary": "한 문장 한국어 요약", "tags": ["키워드", 최대 3개], "essayPoint": "경제 카테고리만: 금융감독원 논술 관점의 쟁점이나 관련 개념 한 문장. 다른 카테고리는 null"}
제목과 요약에 없는 사실은 지어내지 마.

${JSON.stringify(input)}`

    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
      const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
      const out: { idx: number; summary: string; tags: string[]; essayPoint: string | null }[] =
        JSON.parse(json)
      for (const o of out) {
        const n = batch[o.idx]
        if (!n) continue
        n.summary = o.summary
        n.tags = o.tags
        if (o.essayPoint) n.essayPoint = o.essayPoint
      }
      console.log(`🤖 LLM 요약 ${i + batch.length}/${todo.length}`)
    } catch (e) {
      console.warn(`⚠️  LLM 배치 실패: ${(e as Error).message}`)
    }
  }
}

async function main() {
  const sources: FeedSource[] = JSON.parse(await readFile('feeds.json', 'utf8'))
  const prev = await loadPrevious()

  const fetched = (await Promise.all(sources.map(fetchFeed))).flat()

  // 이전 데이터 + 새 데이터 병합 (이전 LLM 결과는 재사용해서 비용 절약)
  const merged = new Map(prev)
  for (const n of fetched) {
    if (!n.id || !n.link) continue
    if (!merged.has(n.id)) merged.set(n.id, n)
  }

  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000
  const items = [...merged.values()]
    .filter((n) => new Date(n.publishedAt).getTime() >= cutoff)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))

  await enrich(items)

  await mkdir('public/data', { recursive: true })
  await writeFile(OUTPUT, JSON.stringify(items, null, 2))
  console.log(`✅ ${items.length}건 저장 → ${OUTPUT}`)
}

main()
