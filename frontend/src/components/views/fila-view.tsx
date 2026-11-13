"use client";

import { EsqueletoPagina } from "@/components/layout/esqueleto";
import { useContextoTerminal, useParametros } from "@/store/use-contexto";
import { ContextPanel } from "@/components/layout/context-panel";
import { Cartao, CabecalhoCartao, PageHeader } from "@/components/layout/page-header";
import { Acao } from "@/components/terminal/actions";
import { PainelCaminhao } from "@/components/terminal/paineis";
import { EntryRow, TruckRow } from "@/components/terminal/rows";
import {
  ROTULO_SEVERIDADE,
  etapaLonga,
  etapaDesde,
  formatarDuracao,
  minutosDesde,
  nivelVisual,
  recursosDaOperacao,
  rotuloEspeciais,
  parametro,
} from "@/lib/terminal";
import { montarHref } from "@/lib/terminal-contexto";

export function FilaView() {
  const sp = useParametros();
  const t = useContextoTerminal();
  if (!t) return <EsqueletoPagina />;

  const q = (parametro(sp, "q") ?? "").trim();
  const placaSelecionada = parametro(sp, "caminhao");
  const op = placaSelecionada ? t.idx.operacaoPorPlaca.get(placaSelecionada) : undefined;

  const termo = q.toUpperCase();
  const fila = termo ? t.fila.filter((i) => i.placa.includes(termo)) : t.fila;

  // Pré-entrada: caminhões ainda em documentação ou inspeção.
  const preEntrada = t.operacoes.filter(
    (o) =>
      (o.estado === "AGUARDANDO_DOCUMENTACAO" || o.estado === "AGUARDANDO_INSPECAO") &&
      (!termo || o.caminhao.placa.includes(termo)),
  );

  // Execução: caminhões que já saíram da fila e ainda não foram liberados.
  const emExecucao = t.operacoes.filter(
    (o) =>
      (o.estado === "EM_OPERACAO" || o.estado === "AGUARDANDO_LIBERACAO") &&
      (!termo || o.caminhao.placa.includes(termo)),
  );

  const hrefCaminhao = (placa: string) => montarHref("/fila", { caminhao: placa, q });
  const fecharHref = montarHref("/fila", { q });

  return (
    <div className="flex">
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">
        <PageHeader titulo="Fila de atendimento" />

        {q && (
          <p className="flex flex-wrap items-center gap-3 text-sm text-t2">
            Filtrando por placa: <span className="font-mono font-medium text-t1">{q}</span>
            <Acao href="/fila" variante="link">
              Limpar busca
            </Acao>
          </p>
        )}

        <Cartao>
          <CabecalhoCartao titulo="Na fila" contagem={`${fila.length}${termo ? ` de ${t.fila.length}` : ""}`} />
          {fila.length ? (
            fila.map((i) => {
              const o = t.idx.operacaoPorId.get(i.operacao_id);
              const sev = t.ctx.sevPorOperacao.get(i.operacao_id);
              return (
                <TruckRow
                  key={i.operacao_id}
                  href={hrefCaminhao(i.placa)}
                  selecionado={i.placa === placaSelecionada}
                  posicao={i.posicao}
                  placa={i.placa}
                  linha2={i.carga.descricao}
                  linha3={etapaLonga(i.estado)}
                  espera={formatarDuracao(i.espera_minutos)}
                  nivel={sev ? nivelVisual(sev) : "none"}
                  rotuloSeveridade={sev ? ROTULO_SEVERIDADE[sev] : undefined}
                  marca={o ? rotuloEspeciais(o.carga.caracteristicas) || undefined : undefined}
                />
              );
            })
          ) : (
            <p className="px-5 py-8 text-sm text-t2">
              {termo
                ? `Nenhum caminhão na fila com a placa “${q}”.`
                : "Nenhum caminhão na fila no momento."}
            </p>
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Pré-entrada" contagem={String(preEntrada.length)} />
          <div className="flex flex-col px-4 py-3">
            {preEntrada.length ? (
              preEntrada.map((o) => (
                <EntryRow
                  key={o.id}
                  href={hrefCaminhao(o.caminhao.placa)}
                  placa={o.caminhao.placa}
                  detalhe={etapaLonga(o.estado)}
                  atencao={t.ocorrenciasDaOperacao(o.id).some((x) => x.estado === "ABERTA")}
                />
              ))
            ) : (
              <p className="text-sm text-t2">Nenhum caminhão em pré-entrada.</p>
            )}
          </div>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Em operação e liberação" contagem={String(emExecucao.length)} />
          <div className="flex flex-col px-4 py-3">
            {emExecucao.length ? (
              emExecucao.map((o) => {
                const rec = recursosDaOperacao(o, t.idx);
                const local = [rec.doca, rec.equipamento].filter(Boolean).join(" · ");
                return (
                  <EntryRow
                    key={o.id}
                    href={hrefCaminhao(o.caminhao.placa)}
                    placa={o.caminhao.placa}
                    detalhe={`${etapaLonga(o.estado)}${local ? ` · ${local}` : ""}`}
                    tempo={formatarDuracao(minutosDesde(etapaDesde(o), t.ctx.agora))}
                    atencao={t.ocorrenciasDaOperacao(o.id).some((x) => x.estado === "ABERTA")}
                  />
                );
              })
            ) : (
              <p className="text-sm text-t2">Nenhum caminhão em operação ou aguardando liberação.</p>
            )}
          </div>
        </Cartao>
      </main>

      {op && (
        <ContextPanel rotulo="Detalhe do caminhão" fecharHref={fecharHref}>
          <PainelCaminhao t={t} op={op} />
        </ContextPanel>
      )}
    </div>
  );
}
