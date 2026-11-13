import { Suspense } from "react";
import { EsqueletoPagina } from "@/components/layout/esqueleto";
import { FilaView } from "@/components/views/fila-view";

export const metadata = { title: "Fila · Terminal Portuário" };

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoPagina />}>
      <FilaView />
    </Suspense>
  );
}
