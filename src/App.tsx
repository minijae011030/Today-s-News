import { useEffect, useState, type ReactNode } from 'react'

type NewsItem = {
  id: string
  category: string
  title: string
  link: string
  source: string
  publishedAt: string
  snippet: string
  summary?: string
  tags?: string[]
  essayPoint?: string
  spaceFact?: string
  titleKo?: string
}

const titleOf = (n: NewsItem) => n.titleKo ?? n.title

const SECTIONS = ['경제', '우주', 'IT', '예술', '엔터'] as const

/* ---------- 해시 라우팅: #/ , #/section/경제 , #/article/<id> ---------- */
type Route =
  | { name: 'front' }
  | { name: 'section'; section: string }
  | { name: 'article'; id: string }

function parseHash(): Route {
  const [, kind, raw] = window.location.hash.split('/')
  const value = raw ? decodeURIComponent(raw) : ''
  if (kind === 'section' && value) return { name: 'section', section: value }
  if (kind === 'article' && value) return { name: 'article', id: value }
  return { name: 'front' }
}

function useRoute(): Route {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

const href = {
  front: '#/',
  section: (s: string) => `#/section/${encodeURIComponent(s)}`,
  article: (id: string) => `#/article/${encodeURIComponent(id)}`,
}

/* ---------- 포맷 ---------- */
const longDate = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.round(h / 24)}일 전`
}

/* ---------- App ---------- */
export default function App() {
  const route = useRoute()
  const [items, setItems] = useState<NewsItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/news.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setItems)
      .catch(() => setError(true))
  }, [])

  const activeSection =
    route.name === 'section'
      ? route.section
      : route.name === 'article'
        ? items?.find((n) => n.id === route.id)?.category
        : undefined

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-24 sm:px-6">
      <Masthead items={items} active={activeSection} isFront={route.name === 'front'} />

      {error && (
        <Notice>
          뉴스 데이터를 불러오지 못했어요. 터미널에서 <code>npm run collect</code>를 실행해 주세요.
        </Notice>
      )}
      {items && items.length === 0 && (
        <Notice>
          아직 수집된 기사가 없어요. <code>npm run collect</code>로 첫 수집을 시작하세요.
        </Notice>
      )}

      {items && items.length > 0 && route.name === 'front' && <FrontPage items={items} />}
      {items && route.name === 'section' && (
        <SectionPage section={route.section} items={items.filter((n) => n.category === route.section)} />
      )}
      {items && route.name === 'article' && (
        <ArticlePage item={items.find((n) => n.id === route.id)} items={items} />
      )}
    </div>
  )
}

/* ---------- 마스트헤드 ---------- */
function Masthead({
  items,
  active,
  isFront,
}: {
  items: NewsItem[] | null
  active?: string
  isFront: boolean
}) {
  const summarized = items?.filter((n) => n.summary).length ?? 0
  return (
    <header className="pt-4">
      <div className="flex items-end justify-between gap-4 text-xs text-ink-soft">
        <span>{longDate.format(new Date())}</span>
        {items && (
          <span className="text-right">
            기사 {items.length}건, 요약 {summarized}건
          </span>
        )}
      </div>

      <a href={href.front} className="block py-3 text-center sm:py-5">
        <h1 className="font-masthead text-[clamp(2.6rem,9vw,5rem)] leading-none font-black tracking-tight">
          Today&rsquo;s News
        </h1>
      </a>

      <nav className="border-y border-ink">
        <ul className="flex justify-center gap-5 overflow-x-auto py-2.5 text-sm sm:gap-8">
          <NavLink href={href.front} current={isFront}>
            1면
          </NavLink>
          {SECTIONS.map((s) => (
            <NavLink key={s} href={href.section(s)} current={active === s}>
              {s}
            </NavLink>
          ))}
        </ul>
      </nav>
      <div className="mt-[3px] border-t border-ink" />
    </header>
  )
}

function NavLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <li className="shrink-0">
      <a
        href={href}
        aria-current={current ? 'page' : undefined}
        className={`pb-0.5 ${current ? 'font-semibold border-b-2 border-ink' : 'text-ink-soft hover:text-ink'}`}
      >
        {children}
      </a>
    </li>
  )
}

/* ---------- 1면 ---------- */
function FrontPage({ items }: { items: NewsItem[] }) {
  const lead = items.find((n) => n.summary) ?? items[0]
  const side = items.filter((n) => n.id !== lead.id).slice(0, 5)

  return (
    <main>
      <section className="grid gap-8 border-b border-rule py-6 md:grid-cols-3 md:gap-0">
        <article className="md:col-span-2 md:border-r md:border-rule md:pr-8">
          <Kicker category={lead.category} publishedAt={lead.publishedAt} />
          <a href={href.article(lead.id)} className="group block">
            <h2 className="mt-2 font-serif text-[clamp(1.6rem,3.2vw,2.4rem)] leading-[1.25] font-bold group-hover:text-ink-soft">
              {titleOf(lead)}
            </h2>
            {lead.summary && (
              <p className="mt-4 max-w-[60ch] font-serif text-lg leading-[1.8] text-ink-soft">{lead.summary}</p>
            )}
          </a>
          {lead.essayPoint && <EssayPoint text={lead.essayPoint} className="mt-5" />}
        </article>

        <ol className="md:pl-8">
          {side.map((n, i) => (
            <li key={n.id} className={i > 0 ? 'mt-4 border-t border-rule pt-4' : ''}>
              <Kicker category={n.category} publishedAt={n.publishedAt} />
              <a href={href.article(n.id)} className="mt-1 block font-serif text-[1.05rem] leading-snug font-semibold hover:text-ink-soft">
                {titleOf(n)}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-5">
        {SECTIONS.map((s) => {
          const list = items.filter((n) => n.category === s).slice(0, 5)
          if (list.length === 0) return null
          return (
            <section key={s} className="border-t-2 border-ink pt-3 mt-8">
              <a href={href.section(s)} className="font-serif text-xl font-bold hover:text-ink-soft">
                {s}
              </a>
              <ul className="mt-2">
                {list.map((n, i) => (
                  <li key={n.id} className={i > 0 ? 'border-t border-rule' : ''}>
                    <a href={href.article(n.id)} className="block py-3 font-serif text-[0.97rem] leading-snug hover:text-ink-soft">
                      {titleOf(n)}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </main>
  )
}

/* ---------- 섹션 ---------- */
function SectionPage({ section, items }: { section: string; items: NewsItem[] }) {
  return (
    <main className="mx-auto max-w-[760px]">
      <h2 className="mt-8 font-serif text-4xl font-bold">{section}</h2>
      <p className="mt-1 text-sm text-muted">최근 3일, {items.length}건</p>

      {items.length === 0 && <Notice>이 섹션에는 아직 기사가 없어요.</Notice>}

      <ul className="mt-6 border-t border-ink">
        {items.map((n) => (
          <li key={n.id} className="border-b border-rule py-6">
            <a href={href.article(n.id)} className="group grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-6">
              <span className="text-xs text-muted sm:pt-1.5">{timeAgo(n.publishedAt)}</span>
              <span>
                <span className="block font-serif text-xl leading-snug font-bold group-hover:text-ink-soft">
                  {titleOf(n)}
                </span>
                {n.summary && (
                  <span className="mt-2 block font-serif leading-[1.75] text-ink-soft">{n.summary}</span>
                )}
                <span className="mt-2 block text-xs text-muted">{n.source}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}

/* ---------- 기사 상세 (내가 정리한 버전) ---------- */
function ArticlePage({ item, items }: { item?: NewsItem; items: NewsItem[] }) {
  if (!item) {
    return (
      <Notice>
        이 기사는 보관 기간(3일)이 지나 목록에서 빠졌어요. <a className="underline" href={href.front}>1면으로 가기</a>
      </Notice>
    )
  }

  const related = items.filter((n) => n.category === item.category && n.id !== item.id).slice(0, 4)
  const showSnippet = item.snippet && !item.snippet.startsWith(item.title.slice(0, 15))

  return (
    <main className="mx-auto max-w-[680px] pt-8">
      <a href={href.section(item.category)} className="text-sm font-semibold hover:underline">
        {item.category}
      </a>

      <h2 className="mt-3 font-serif text-[clamp(1.8rem,4.5vw,2.6rem)] leading-[1.25] font-bold">{titleOf(item)}</h2>

      {item.summary ? (
        <p className="mt-5 font-serif text-xl leading-[1.7] text-ink-soft">{item.summary}</p>
      ) : (
        <p className="mt-5 text-sm text-muted">아직 요약되지 않은 기사예요. 다음 수집 때 요약이 붙어요.</p>
      )}

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-y border-rule py-3 text-sm text-ink-soft">
        <span className="font-semibold text-ink">{item.source}</span>
        <time dateTime={item.publishedAt}>
          {new Date(item.publishedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
        </time>
      </div>

      {item.essayPoint && (
        <section className="mt-8">
          <h3 className="font-sans text-sm font-semibold">논술 포인트</h3>
          <EssayPoint text={item.essayPoint} className="mt-2 text-lg" />
        </section>
      )}

      {item.spaceFact && (
        <section className="mt-8 border-y border-ink py-5">
          <h3 className="font-sans text-sm font-semibold">알고 보면 재밌는 우주 이야기</h3>
          <p className="mt-2 font-serif text-lg leading-[1.85]">{item.spaceFact}</p>
        </section>
      )}

      {item.titleKo && (
        <p className="mt-6 text-sm text-muted">원제: {item.title}</p>
      )}

      {showSnippet && (
        <section className="mt-8">
          <h3 className="font-sans text-sm font-semibold">원문 발췌</h3>
          <p className="mt-2 border-l-2 border-rule pl-4 font-serif leading-[1.8] text-ink-soft">{item.snippet}</p>
        </section>
      )}

      {item.tags && item.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <li key={t} className="border border-rule px-2.5 py-1 text-xs text-ink-soft">
              {t}
            </li>
          ))}
        </ul>
      )}

      <a
        href={item.link}
        target="_blank"
        rel="noreferrer"
        className="mt-10 inline-block bg-ink px-5 py-3 text-sm font-semibold text-paper hover:bg-ink-soft"
      >
        원문 기사 읽기
      </a>

      {related.length > 0 && (
        <aside className="mt-16 border-t-2 border-ink pt-3">
          <h3 className="font-serif text-lg font-bold">{item.category}의 다른 기사</h3>
          <ul>
            {related.map((n, i) => (
              <li key={n.id} className={i > 0 ? 'border-t border-rule' : ''}>
                <a href={href.article(n.id)} className="block py-3 font-serif leading-snug hover:text-ink-soft">
                  {titleOf(n)}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  )
}

/* ---------- 작은 조각들 ---------- */
function Kicker({ category, publishedAt }: { category: string; publishedAt: string }) {
  return (
    <p className="flex gap-3 text-xs">
      <span className="font-semibold">{category}</span>
      <span className="text-muted">{timeAgo(publishedAt)}</span>
    </p>
  )
}

function EssayPoint({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p className={`font-serif leading-[1.9] ${className}`}>
      <span className="highlight">{text}</span>
    </p>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mx-auto mt-16 max-w-[60ch] text-center text-ink-soft">{children}</p>
}
