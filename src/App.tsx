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
      {/* 안내는 한 번에 하나만: 전체가 비었으면 여기서만 알려주고 페이지는 안 그림 */}
      {error && <Notice>We couldn&rsquo;t load today&rsquo;s stories. Pull down to try again.</Notice>}
      {!error && items && items.length === 0 && <Notice>No stories yet.</Notice>}

      {items && items.length > 0 && route.name === "front" && (
        <FrontPage items={items} concept={concept} />
      )}
      {items && items.length > 0 && route.name === "section" && (
        <SectionPage
          section={route.section}
          page={route.page}
          items={items.filter((n) => n.category === route.section)}
        />
      )}
      {items && items.length > 0 && route.name === "article" && (
        <ArticlePage
          item={items.find((n) => n.id === route.id)}
          items={items}
        />
      )}
    </PageLayout>
  );
}
