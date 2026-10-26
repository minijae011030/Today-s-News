import { Notice } from "./components/atoms/Notice";
import { PageLayout } from "./components/templates/PageLayout";
import { useNews } from "./hooks/useNews";
import { useRoute } from "./hooks/useRoute";
import { ArticlePage } from "./pages/ArticlePage";
import { FrontPage } from "./pages/FrontPage";
import { SectionPage } from "./pages/SectionPage";

export default function App() {
  const route = useRoute();
  const { items, error, version, concept, refresh } = useNews();

  const activeSection =
    route.name === "section"
      ? route.section
      : route.name === "article"
        ? items?.find((n) => n.id === route.id)?.category
        : undefined;

  return (
    <PageLayout
      activeSection={activeSection}
      isFront={route.name === "front"}
      items={items}
      version={version}
      onRefresh={refresh}
    >
      {error && (
        <Notice>
          뉴스 데이터를 불러오지 못했어요. 터미널에서{" "}
          <code>npm run collect</code>를 실행해 주세요.
        </Notice>
      )}
      {items && items.length === 0 && (
        <Notice>
          아직 수집된 기사가 없어요. <code>npm run collect</code>로 첫 수집을
          시작하세요.
        </Notice>
      )}

      {items && items.length > 0 && route.name === "front" && (
        <FrontPage items={items} concept={concept} />
      )}
      {items && route.name === "section" && (
        <SectionPage
          section={route.section}
          page={route.page}
          items={items.filter((n) => n.category === route.section)}
        />
      )}
      {items && route.name === "article" && (
        <ArticlePage
          item={items.find((n) => n.id === route.id)}
          items={items}
        />
      )}
    </PageLayout>
  );
}
