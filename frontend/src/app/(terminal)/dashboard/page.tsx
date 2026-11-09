import { Suspense } from "react";
import { EsqueletoPagina } from "@/components/layout/esqueleto";
import { PainelView } from "@/components/views/painel-view";

export const metadata = { title: "Painel · Terminal Portuário" };

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoPagina />}>
      <PainelView />
    </Suspense>
  );
}
