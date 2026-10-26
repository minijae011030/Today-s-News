import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages는 https://<아이디>.github.io/<레포>/ 경로라서 배포 때만 base를 바꿔줌
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: "Today's News",
        short_name: 'Today',
        description: '경제·우주·IT·예술·엔터 뉴스 큐레이터',
        lang: 'ko',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          // TODO: 192/512 PNG 아이콘 만들어서 public/에 넣기
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // 뉴스 데이터: 네트워크 우선, 오프라인이면 캐시
            urlPattern: ({ url }) => url.pathname.endsWith('/data/news.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'news-data', networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
})
