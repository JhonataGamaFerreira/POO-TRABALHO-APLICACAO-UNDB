import Link from "next/link";
import { ContextPanel } from "@/components/layout/context-panel";
import { PageHeader, Secao } from "@/components/layout/page-header";
import { DetalheCaminhao } from "@/components/terminal/details";
import { EntryRow, TruckRow } from "@/components/terminal/rows";
import {
  ROTULO_SEVERIDADE,
  etapaLonga,
  formatarDuracao,
  maiorSeveridade,
  nivelVisual,
  parametro,
  recursosDaOperacao,
  rotuloCaracteristica,
} from "@/lib/terminal";
import { carregarTerminal, montarHref } from "@/lib/terminal-contexto";

export const metadata = { title: "Fila · Terminal Portuário" };

export default async function FilaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = await carregarTerminal();
  const q = (parametro(sp, "q") ?? "").trim();
  const placaSelecionada = parametro(sp, "caminhao");
  const op = placaSelecionada ? t.idx.operacaoPorPlaca.get(placaSelecionada) : undefined;

  const termo = q.toUpperCase();
  const fila = termo ? t.fila.filter((i) => i.placa.includes(termo)) : t.fila;

  // Pré-entrada: operações que o backend ainda não coloca na fila.
  const preEntrada = t.operacoes.filter(
    (o) =>
      !t.filaPorOperacao.has(o.id) &&
      (o.estado === "AGUARDANDO_DOCUMENTACAO" || o.estado === "AGUARDANDO_INSPECAO") &&
      (!termo || o.caminhao.placa.includes(termo)),
  );

  const hrefCaminhao = (placa: string) => montarHref("/fila", { caminhao: placa, q });
  const fecharHref = montarHref("/fila", { q });

  const itemDaOp = op ? (t.filaPorOperacao.get(op.id) ?? null) : null;
  const linkPatio = op
    ? op.doca
      ? montarHref("/patio", { recurso: `doca:${op.doca.id}` })
      : op.vaga
        ? montarHref("/patio", { recurso: `vaga:${op.vaga.id}` })
        : null
    : null;

  return (
    <div className="flex">
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-6">
        <PageHeader
          titulo="Fila de atendimento"
          descricao="Ordem e pontuação calculadas pelo backend. Esta tela só exibe; não reordena nem prioriza."
        />

        {q && (
          <p className="flex items-center gap-3 text-sm text-t2">
            Filtrando por placa: <span className="font-mono font-medium text-t1">{q}</span>
            <Link href="/fila" className="font-medium text-brand hover:underline">
              Limpar busca
            </Link>
          </p>
        )}

        <Secao
          titulo="Na fila"
          contagem={`${fila.length}${termo ? ` de ${t.fila.length}` : ""}`}
        >
          {fila.length ? (
            <div className="mt-1">
              {fila.map((i) => {
                const o = t.idx.operacaoPorId.get(i.operacao_id);
                const sev = o ? maiorSeveridade(o.ocorrencias) : null;
                const especiais = i.carga.caracteristicas.filter((c) => c !== "comum");
                return (
                  <TruckRow
                    key={i.operacao_id}
                    href={hrefCaminhao(i.placa)}
                    selecionado={i.placa === placaSelecionada}
                    posicao={i.posicao}
                    placa={i.placa}
                    carga={i.carga.descricao}
                    situacao={etapaLonga(i.estado)}
                    espera={formatarDuracao(i.espera_minutos)}
                    nivel={sev ? nivelVisual(sev) : "none"}
                    rotuloSeveridade={sev ? ROTULO_SEVERIDADE[sev] : undefined}
                    etiqueta={especiais.map(rotuloCaracteristica).join(" · ") || undefined}
                    complemento={`${i.pontuacao} pts`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-t2">
              {termo
                ? `Nenhum caminhão na fila com a placa “${q}”.`
                : "Nenhum caminhão na fila no momento."}
            </p>
          )}
        </Secao>

        <Secao
          titulo="Pré-entrada"
          contagem={String(preEntrada.length)}
          nota="Ainda em documentação ou inspeção; não entram na fila do backend."
        >
          <div className="px-5 py-3">
            {preEntrada.length ? (
              preEntrada.map((o) => (
                <EntryRow
                  key={o.id}
                  href={hrefCaminhao(o.caminhao.placa)}
                  placa={o.caminhao.placa}
                  detalhe={etapaLonga(o.estado)}
                  atencao={o.ocorrencias.some((x) => x.estado === "ABERTA")}
                />
              ))
            ) : (
              <p className="text-sm text-t2">Nenhum caminhão em pré-entrada.</p>
            )}
          </div>
        </Secao>
      </main>

      {op && (
        <ContextPanel rotulo="Detalhe do caminhão" fecharHref={fecharHref}>
          <DetalheCaminhao
            op={op}
            item={itemDaOp}
            recursos={recursosDaOperacao(op, t.idx)}
            ocorrencias={t.ligacoes(
              t.ocorrencias.filter((o) => o.operacao_id === op.id),
              (o) => montarHref("/dashboard", { ocorrencia: o.id }),
            )}
            linkPatio={linkPatio}
          />
        </ContextPanel>
      )}
    </div>
  );
}
