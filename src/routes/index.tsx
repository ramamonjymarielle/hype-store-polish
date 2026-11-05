import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const HypeApp = lazy(() => import("@/hype/App"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HYPE – Be hype, Stay ahead" },
      {
        name: "description",
        content:
          "Le drop streetwear à ne pas manquer à Antananarivo. Sacs, t-shirts, hoodies et casquettes en séries limitées.",
      },
      { property: "og:title", content: "HYPE – Be hype, Stay ahead" },
      {
        property: "og:description",
        content: "Le drop streetwear à ne pas manquer à Antananarivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" />}>
      <Suspense fallback={<div className="min-h-screen" />}>
        <HypeApp />
      </Suspense>
    </ClientOnly>
  );
}
