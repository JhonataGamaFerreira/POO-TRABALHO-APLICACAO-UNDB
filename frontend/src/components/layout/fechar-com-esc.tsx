"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Fecha o painel contextual com a tecla Esc. */
export function FecharComEsc({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(href, { scroll: false });
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [href, router]);
  return null;
}
