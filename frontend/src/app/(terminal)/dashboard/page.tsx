import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContextPanel } from "@/components/layout/context-panel";
import { PageHeader, Secao } from "@/components/layout/page-header";
import { DetalheOcorrencia } from "@/components/terminal/details";
import { Legenda } from "@/components/terminal/legend";
import { DocaView } from "@/components/terminal/recurso-views";
import { FlowStage, OccurrenceRow, TruckRow } from "@/components/terminal/rows";
import {
  ETAPAS,
  ROTULO_SEVERIDADE,
  ROTULO_TIPO_OCORRENCIA,
  etapaLonga,
  formatarDuracao,
  maiorSeveridade,
  nivelVisual,
  parametro,
  resolverRecurso,
  resumoCarga,
} from "@/lib/terminal";
import { carregarTerminal, montarHref } from "@/lib/terminal-contexto";

export const metadata = { title: "Painel · Terminal Portuário" };

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = await carregarTerminal();
  const selecionadaId = parametro(sp, "ocorrencia");
  const selecionada = t.abertas.find((o) => o.id === selecionadaId);
  const opSelecionada = selecionada ? t.idx.operacaoPorId.get(selecionada.operacao_id) : undefined;

  const { dashboard, tempos } = t;
  const proximos = t.fila.slice(0, 3);
  const vagas = dashboard.recursos.vagas;
  const equips = dashboard.recursos.equipamentos;
  const totalVagas = t.recursos.vagas.length;
  const totalEquips = t.recursos.equipamentos.length;

  return (
    <div className="flex">
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-6">
        <PageHeader
          titulo="Painel"
          descricao="Situação atual do terminal: o que pede atenção, onde estão os caminhões e quais recursos estão em uso."
        />

        <Secao
          titulo="Atenção agora"
          contagem={`${t.abertas.length} ${t.abertas.length === 1 ? "aberta" : "abertas"}`}
          nota="Ocorrências abertas, na ordem em que a API as entrega."
        >
          {t.abertas.length ? (
            <div className="mt-2">
              {t.abertas.map((o) => (
                <OccurrenceRow
                  key={o.id}
                  href={montarHref("/dashboard", { ocorrencia: o.id })}
                  selecionado={o.id === selecionada?.id}
                  numero={t.numeroOcorrencia(o)}
                  nivel={nivelVisual(o.severidade)}
                  rotuloSeveridade={ROTULO_SEVERIDADE[o.severidade]}
                  titulo={t.titulo(o)}
                  descricao={o.descricao}
                  metrica={t.idadeOcorrencia(o)}
                  legenda="aberta há"
                />
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-sm text-t2">Nenhuma ocorrência aberta no momento.</p>
          )}
        </Secao>

        <Secao
          titulo="Fluxo do terminal"
          contagem={`${dashboard.total_operacoes} operações`}
          nota="Quantidade por etapa e média de tempo por etapa, ambas informadas pelo backend."
        >
          <div className="grid grid-cols-2 gap-px px-5 py-4 sm:grid-cols-4 xl:grid-cols-8">
            {ETAPAS.map((e, i) => {
              const media = tempos.media_por_etapa_minutos[e.estado];
              return (
                <FlowStage
                  key={e.estado}
                  indice={i + 1}
                  nome={e.curto}
                  quantidade={dashboard.por_estado[e.estado]}
                  media={media !== undefined ? formatarDuracao(media) : undefined}
                  nota={e.estado === "FINALIZADO" ? "sem média" : undefined}
                  afetados={opSelecionada?.estado === e.estado ? 1 : undefined}
                />
              );
            })}
          </div>
        </Secao>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Secao
            titulo="Docas"
            contagem={`${t.recursos.docas.length} docas`}
          >
            <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
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
            contagem={`${t.fila.length} na fila`}
            nota="Ordem definida pelo backend."
          >
            <div className="mt-2">
              {proximos.map((i) => {
                const op = t.idx.operacaoPorId.get(i.operacao_id);
                const sev = op ? maiorSeveridade(op.ocorrencias) : null;
                return (
                  <TruckRow
                    key={i.operacao_id}
                    href={montarHref("/fila", { caminhao: i.placa })}
                    selecionado={false}
                    posicao={i.posicao}
                    placa={i.placa}
                    carga={i.carga.descricao}
                    situacao={etapaLonga(i.estado)}
                    espera={formatarDuracao(i.espera_minutos)}
                    nivel={sev ? nivelVisual(sev) : "none"}
                    rotuloSeveridade={sev ? ROTULO_SEVERIDADE[sev] : undefined}
                    complemento={`${i.pontuacao} pts`}
                  />
                );
              })}
            </div>
            <Link
              href="/fila"
              className="flex items-center justify-between border-t border-line px-5 py-3 text-sm font-medium text-brand hover:bg-canvas"
            >
              Ver fila completa ({t.fila.length})
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Secao>
        </div>

        <Secao titulo="Vagas e equipamentos">
          <dl className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-t2">Vagas livres</dt>
              <dd className="font-mono text-2xl font-medium text-t1">
                {vagas.LIVRE}
                <span className="text-base text-t3"> de {totalVagas}</span>
              </dd>
              <dd className="text-xs text-t3">
                {vagas.OCUPADO} ocupadas · {vagas.EM_MANUTENCAO} em manutenção
              </dd>
            </div>
            <div>
              <dt className="text-sm text-t2">Equipamentos disponíveis</dt>
              <dd className="font-mono text-2xl font-medium text-t1">
                {equips.DISPONIVEL}
                <span className="text-base text-t3"> de {totalEquips}</span>
              </dd>
              <dd className="text-xs text-t3">
                {equips.OCUPADO} em uso · {equips.EM_MANUTENCAO} em manutenção
              </dd>
            </div>
          </dl>
          <div className="border-t border-line px-5 py-3">
            <Link
              href="/patio"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
            >
              Abrir Pátio e docas
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </Secao>

        <Legenda />
      </main>

      {selecionada && (
        <ContextPanel rotulo="Detalhe da ocorrência" fecharHref="/dashboard">
          {(() => {
            const recurso = resolverRecurso(selecionada, t.idx, t.recursos);
            const op = opSelecionada;
            const noPatio = montarHref("/patio", { ocorrencia: selecionada.id, origem: "painel" });
            return (
              <DetalheOcorrencia
                numero={t.numeroOcorrencia(selecionada)}
                titulo={t.titulo(selecionada)}
                nivel={nivelVisual(selecionada.severidade)}
                rotuloSeveridade={ROTULO_SEVERIDADE[selecionada.severidade]}
                ocorrencia={selecionada}
                rotuloTipo={ROTULO_TIPO_OCORRENCIA[selecionada.tipo]}
                recursoRotulo={recurso ? recurso.codigo : null}
                idade={t.idadeOcorrencia(selecionada)}
                caminhao={
                  op
                    ? {
                        placa: op.caminhao.placa,
                        etapa: etapaLonga(op.estado),
                        carga: resumoCarga(op.carga) || op.carga.descricao,
                      }
                    : null
                }
                linkPatio={noPatio}
                linkFila={op ? montarHref("/fila", { caminhao: op.caminhao.placa }) : null}
              />
            );
          })()}
        </ContextPanel>
      )}
    </div>
  );
}
