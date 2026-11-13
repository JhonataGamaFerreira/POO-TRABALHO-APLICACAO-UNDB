"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EsqueletoPagina } from "@/components/layout/esqueleto";
import { useContextoTerminal, useParametros } from "@/store/use-contexto";
import { ContextPanel } from "@/components/layout/context-panel";
import { Cartao, PageHeader, Secao } from "@/components/layout/page-header";
import { FormChegada } from "@/components/terminal/form-chegada";
import { Legenda } from "@/components/terminal/legend";
import { PainelOcorrencia, resumoCaminhao } from "@/components/terminal/paineis";
import { ResourceMini } from "@/components/terminal/resource-cells";
import { DocaView, visualEquip, visualRecurso } from "@/components/terminal/recurso-views";
import { FlowStage, OccurrenceRow, TruckRow } from "@/components/terminal/rows";
import {
  ETAPAS,
  ROTULO_SEVERIDADE,
  etapaLonga,
  formatarData,
  formatarDuracao,
  nivelVisual,
  parametro,
} from "@/lib/terminal";
import { juntar, montarHref } from "@/lib/terminal-contexto";

export function PainelView() {
  const sp = useParametros();
  const t = useContextoTerminal();
  if (!t) return <EsqueletoPagina />;

  const registrando = parametro(sp, "registrar") === "chegada";
  const selecionada = registrando ? undefined : t.abertas.find((o) => o.id === parametro(sp, "ocorrencia"));

  // Operações afetadas pela ocorrência selecionada, por etapa e por caminhão.
  const afetadas = selecionada ? t.operacoesAfetadas(selecionada) : [];
  const afetadosPorEtapa = new Map<string, number>();
  for (const { op } of afetadas) afetadosPorEtapa.set(op.estado, (afetadosPorEtapa.get(op.estado) ?? 0) + 1);
  const idsAfetados = new Set(afetadas.map((a) => a.op.id));

  const proximos = t.fila.slice(0, 3);

  // Vagas: contagens derivadas do estado do recurso + área interditada.
  const vagas = t.recursos.vagas;
  const vagasOcupadas = vagas.filter((v) => v.estado === "OCUPADO").length;
  const vagasLivres = vagas.filter((v) => v.estado === "LIVRE" && !v.area.interditada).length;
  const vagasBloqueadas = vagas.filter((v) => v.area.interditada);
  const vagasManutencao = vagas.filter((v) => v.estado === "EM_MANUTENCAO").length;

  // Equipamentos: "quebrado" = em manutenção + ocorrência EQUIPAMENTO_QUEBRADO aberta.
  const equips = t.recursos.equipamentos;
  const equipsEmUso = equips.filter((e) => e.estado === "OCUPADO").length;
  const equipsQuebrados = equips.filter((e) => visualEquip(e, t.ctx) === "blocked");

  const hrefOcorrencia = (id: string) => montarHref("/dashboard", { ocorrencia: id });

  return (
    <div className="flex">
      <main className="flex min-w-0 flex-1 flex-col gap-8 p-6">
        <PageHeader
          titulo="Painel"
          lateral={formatarData(t.ctx.agora)}
        />

        <Secao
          titulo="Atenção agora"
          selo={`${t.abertas.length} ${t.abertas.length === 1 ? "aberta" : "abertas"}`}
          nota="Ordenado por impacto"
        >
          <Cartao>
            {t.abertas.length ? (
              t.abertas.map((o) => {
                const m = t.metrica(o);
                return (
                  <OccurrenceRow
                    key={o.id}
                    href={hrefOcorrencia(o.id)}
                    selecionado={o.id === selecionada?.id}
                    numero={t.numeroOcorrencia(o)}
                    nivel={nivelVisual(o.severidade)}
                    rotuloSeveridade={ROTULO_SEVERIDADE[o.severidade]}
                    titulo={t.titulo(o)}
                    descricao={t.descricaoLinha(o)}
                    metrica={m.valor}
                    legenda={m.legenda}
                  />
                );
              })
            ) : (
              <p className="px-5 py-8 text-sm text-t2">Nenhuma ocorrência aberta no momento.</p>
            )}
          </Cartao>
        </Secao>

        <Secao
          titulo="Fluxo do terminal"
          contagem={`${t.ativos} caminhões ativos`}
          nota="Tempo médio por etapa"
        >
          <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
            {ETAPAS.map((e, i) => {
              const etapa = t.etapas.find((x) => x.estado === e.estado);
              const finalizado = e.estado === "FINALIZADO";
              return (
                <FlowStage
                  key={e.estado}
                  indice={i + 1}
                  nome={e.curto}
                  quantidade={finalizado ? t.finalizadosHoje : (etapa?.quantidade ?? 0)}
                  media={
                    !finalizado && etapa?.media_minutos != null
                      ? formatarDuracao(etapa.media_minutos)
                      : undefined
                  }
                  faixa={etapa?.faixa_espera}
                  afetados={afetadosPorEtapa.get(e.estado)}
                  notas={finalizado ? ["hoje", `fora dos ${t.ativos}`] : undefined}
                />
              );
            })}
          </div>
        </Secao>

        <div className="grid gap-x-6 gap-y-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Secao titulo="Docas" contagem={`${t.recursos.docas.length} no total`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {t.recursos.docas.map((d) => (
                <DocaView
                  key={d.id}
                  doca={d}
                  ctx={t.ctx}
                  href={montarHref("/patio", { recurso: `doca:${d.id}` })}
                />
              ))}
            </div>
          </Secao>

          <Secao
            titulo="Próximos da fila"
            nota={
              <Link
                href="/fila"
                className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline active:opacity-80"
              >
                Ver fila completa ({t.fila.length})
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            }
          >
            <Cartao>
              {proximos.length ? (
                proximos.map((i) => {
                  const op = t.idx.operacaoPorId.get(i.operacao_id);
                  const sev = t.ctx.sevPorOperacao.get(i.operacao_id);
                  return (
                    <TruckRow
                      key={i.operacao_id}
                      href={montarHref("/fila", { caminhao: i.placa })}
                      selecionado={false}
                      posicao={i.posicao}
                      placa={i.placa}
                      linha2={op ? resumoCaminhao(op) : i.carga.descricao}
                      linha3={i.motivo_espera ?? etapaLonga(i.estado)}
                      espera={formatarDuracao(i.espera_minutos)}
                      nivel={sev ? nivelVisual(sev) : "none"}
                      rotuloSeveridade={sev ? ROTULO_SEVERIDADE[sev] : undefined}
                      marca={idsAfetados.has(i.operacao_id) ? "afetado" : undefined}
                    />
                  );
                })
              ) : (
                <p className="px-5 py-8 text-sm text-t2">Nenhum caminhão na fila no momento.</p>
              )}
            </Cartao>
          </Secao>
        </div>

        <Cartao className="grid md:grid-cols-2 md:divide-x md:divide-line">
          <section className="flex flex-col gap-3 p-5" aria-labelledby="vagas-titulo">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="vagas-titulo" className="text-base font-semibold text-t1">
                Vagas do pátio
              </h2>
              <span className="font-mono text-sm text-t2">
                {vagasOcupadas} de {vagas.length} ocupadas
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {vagas.map((v) => {
                const codigo = t.idx.codigoVaga.get(v.id) ?? "";
                const visual = visualRecurso(v.estado, v.area.interditada);
                return (
                  <ResourceMini
                    key={v.id}
                    href={montarHref("/patio", { recurso: `vaga:${v.id}` })}
                    visual={visual}
                    texto={codigo.replace(/^V/, "")}
                    titulo={`Vaga ${codigo}`}
                    estado={
                      v.area.interditada
                        ? "bloqueada"
                        : v.estado === "OCUPADO"
                          ? "ocupada"
                          : v.estado === "EM_MANUTENCAO"
                            ? "em manutenção"
                            : "livre"
                    }
                  />
                );
              })}
            </div>
            <p className="text-sm text-t2">
              {[
                `${vagasLivres} ${vagasLivres === 1 ? "livre" : "livres"}`,
                vagasBloqueadas.length
                  ? `${vagasBloqueadas.length} ${vagasBloqueadas.length === 1 ? "bloqueada" : "bloqueadas"} (${juntar(
                      vagasBloqueadas.map((v) => {
                        const motivo = (v.area as { motivo_interdicao?: string | null }).motivo_interdicao;
                        return `${t.idx.codigoVaga.get(v.id)}${motivo ? `, ${motivo}` : ""}`;
                      }),
                    )})`
                  : null,
                vagasManutencao ? `${vagasManutencao} em manutenção` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </section>

          <section className="flex flex-col gap-3 p-5" aria-labelledby="equip-titulo">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="equip-titulo" className="text-base font-semibold text-t1">
                Equipamentos
              </h2>
              <span className="font-mono text-sm text-t2">
                {equipsEmUso} em uso
                {equipsQuebrados.length ? ` · ${equipsQuebrados.length} quebrado${equipsQuebrados.length > 1 ? "s" : ""}` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {equips.map((e) => (
                <ResourceMini
                  key={e.id}
                  href={montarHref("/patio", { recurso: `equipment:${e.id}` })}
                  visual={visualEquip(e, t.ctx)}
                  texto={e.nome}
                  titulo={e.nome}
                  estado={
                    visualEquip(e, t.ctx) === "blocked"
                      ? "quebrado"
                      : e.estado === "OCUPADO"
                        ? "em uso"
                        : e.estado === "EM_MANUTENCAO"
                          ? "em manutenção"
                          : "disponível"
                  }
                />
              ))}
            </div>
            <p className="text-sm text-t2">
              {equipsQuebrados.length
                ? equipsQuebrados
                    .map((e) => {
                      const oc = t.abertas.find(
                        (o) => o.tipo === "EQUIPAMENTO_QUEBRADO" && o.recurso_id === e.id,
                      );
                      return `${e.nome} quebrado${oc ? ` (Ocorrência ${t.numeroOcorrencia(oc)})` : ""}`;
                    })
                    .join(" · ")
                : "Nenhum equipamento quebrado"}
            </p>
          </section>
        </Cartao>

        <Legenda />
      </main>

      {registrando && <FormChegada />}

      {selecionada && (
        <ContextPanel rotulo="Detalhe da ocorrência" fecharHref="/dashboard">
          <PainelOcorrencia t={t} o={selecionada} modo={{ tela: "painel" }} />
        </ContextPanel>
      )}
    </div>
  );
}
