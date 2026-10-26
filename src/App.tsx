import { useEffect, useMemo, useState } from 'react'
import './App.css'

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
}

const CATEGORIES = ['전체', '경제', '우주', 'IT', '예술'] as const

export default function App() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [tab, setTab] = useState<(typeof CATEGORIES)[number]>('전체')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/news.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setItems)
      .catch(() => setError('아직 데이터가 없어. npm run collect 먼저 돌려봐.'))
  }, [])

  const visible = useMemo(
    () => (tab === '전체' ? items : items.filter((n) => n.category === tab)),
    [items, tab],
  )

  return (
    <main className="app">
      <header>
        <h1>오늘의 세상</h1>
        <nav>
          {CATEGORIES.map((c) => (
            <button key={c} className={c === tab ? 'active' : ''} onClick={() => setTab(c)}>
              {c}
            </button>
          ))}
        </nav>
      </header>

      {error && <p className="empty">{error}</p>}

      <ul className="list">
        {visible.map((n) => (
          <li key={n.id}>
            <a href={n.link} target="_blank" rel="noreferrer">
              <span className="meta">
                {n.category} · {n.source} · {new Date(n.publishedAt).toLocaleString('ko-KR')}
              </span>
              <strong>{n.title}</strong>
              {n.summary && <p>{n.summary}</p>}
              {n.essayPoint && <p className="essay">✍️ {n.essayPoint}</p>}
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
