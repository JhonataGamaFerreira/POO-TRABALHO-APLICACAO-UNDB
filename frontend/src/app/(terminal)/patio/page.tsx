import { Suspense } from "react";
import { EsqueletoPagina } from "@/components/layout/esqueleto";
import { PatioView } from "@/components/views/patio-view";

export const metadata = { title: "Pátio e docas · Terminal Portuário" };

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoPagina />}>
      <PatioView />
    </Suspense>
  );
}
