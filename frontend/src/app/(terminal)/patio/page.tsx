import Link from "next/link";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { ContextPanel } from "@/components/layout/context-panel";
import { Cartao, PageHeader, Secao } from "@/components/layout/page-header";
import { Acao, ChipLink } from "@/components/terminal/actions";
import { Legenda } from "@/components/terminal/legend";
import {
  PainelOcorrencia,
  PainelRecurso,
  chipsAtencao,
  type Params,
} from "@/components/terminal/paineis";
import { ResourceChip } from "@/components/terminal/resource-cells";
import {
  DocaView,
  EquipView,
  VagaView,
  visualDoca,
  visualEquip,
  visualRecurso,
} from "@/components/terminal/recurso-views";
import { EntryRow } from "@/components/terminal/rows";
import type { VisualRecurso } from "@/components/terminal/indicators";
import {
  ROTULO_TIPO_OCORRENCIA,
  etapaDesde,
  etapaLonga,
  formatarDuracao,
  minutosDesde,
  parametro,
  resolverRecurso,
} from "@/lib/terminal";
import { carregarTerminal, montarHref } from "@/lib/terminal-contexto";
import type { DocaProposta } from "@/types/terminal-proposto";

export const metadata = { title: "Pátio e docas · Terminal Portuário" };

type Filtro = "todos" | "livres" | "ocupados" | "indisponiveis";

/**
 * Categoria de filtro a partir do visual do recurso. Interrupção e restrição são
 * condições de uma doca livre: contam como livre. Área interditada e manutenção
 * contam como indisponível.
 */
function categoria(v: VisualRecurso): Exclude<Filtro, "todos"> {
  if (v === "occupied") return "ocupados";
  if (v === "maintenance" || v === "blocked") return "indisponiveis";
  return "livres";
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function PatioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = await carregarTerminal();

  const filtroParam = parametro(sp, "filtro");
  const filtro: Filtro =
    filtroParam === "livres" || filtroParam === "ocupados" || filtroParam === "indisponiveis"
      ? filtroParam
      : "todos";
  const recursoParam = parametro(sp, "recurso");
  const origem = parametro(sp, "origem");
  const consultaParam = parametro(sp, "consulta");
  const ocorrenciaFoco = t.abertas.find((o) => o.id === parametro(sp, "ocorrencia"));
  const [tipoSel, idSel] = recursoParam?.split(":") ?? [];

  /* ----- foco da ocorrência: o que ela afeta e qual é o recurso dela ----- */
  const afetadas = ocorrenciaFoco ? t.operacoesAfetadas(ocorrenciaFoco) : [];
  const afetados = new Set<string>();
  for (const { op } of afetadas) {
    if (op.vaga) afetados.add(op.vaga.id);
    if (op.doca) afetados.add(op.doca.id);
  }
  const focoRecurso = ocorrenciaFoco ? resolverRecurso(ocorrenciaFoco, t.idx, t.recursos) : null;
  if (focoRecurso?.tipo === "area") {
    [...t.recursos.vagas, ...t.recursos.docas]
      .filter((x) => x.area.id === focoRecurso.id)
      .forEach((x) => afetados.add(x.id));
  }
  const consultaPlaca = consultaParam ?? (ocorrenciaFoco ? afetadas[0]?.op.caminhao.placa : undefined);

  /* ----- links (preservam filtro, foco, origem e consulta) ----- */
  const base: Params = {
    filtro: filtro === "todos" ? undefined : filtro,
    ocorrencia: ocorrenciaFoco?.id,
    origem,
    consulta: consultaParam,
  };
  const hrefRecurso = (tipo: string, id: string) =>
    montarHref("/patio", { ...base, recurso: `${tipo}:${id}` });
  const hrefFiltro = (f: Filtro) =>
    montarHref("/patio", { ...base, filtro: f === "todos" ? undefined : f });
  const fecharHref = recursoParam
    ? montarHref("/patio", base)
    : montarHref("/patio", { filtro: base.filtro });

  const selecionado = (tipo: string, id: string) =>
    recursoParam ? tipoSel === tipo && idSel === id : focoRecurso?.tipo === tipo && focoRecurso.id === id;

  /* ----- consulta de docas compatíveis: marca as docas na planta (B3) ----- */
  const opConsulta = consultaPlaca ? t.idx.operacaoPorPlaca.get(consultaPlaca) : undefined;
  const compativeis = new Map(
    (opConsulta ? (t.compatPorOperacao.get(opConsulta.id)?.docas ?? []) : []).map((d) => [d.doca_id, d]),
  );
  const docaSelecionada = tipoSel === "doca";
  const marcaDoca = (d: DocaProposta) => {
    if (afetados.has(d.id)) return { texto: "afetado" };
    const c = compativeis.get(d.id);
    if (!docaSelecionada || !c || d.id === idSel) return undefined;
    const texto = c.disponivel
      ? "compatível · livre"
      : d.estado === "OCUPADO"
        ? "compatível · ocupada"
        : d.interrupcao
          ? "compatível · interrompida"
          : "compatível · com restrição";
    return { texto, tom: "dark" as const };
  };

  /* ----- contagens (docas + vagas, como no wireframe) ----- */
  const docas = t.recursos.docas as DocaProposta[];
  const vagas = t.recursos.vagas;
  const visualDocas = docas.map(visualDoca);
  const visualVagas = vagas.map((v) => visualRecurso(v.estado, v.area.interditada));
  const todos = [...visualDocas, ...visualVagas];
  const contagem = (f: Filtro) => (f === "todos" ? todos.length : todos.filter((v) => categoria(v) === f).length);
  const passa = (v: VisualRecurso) => filtro === "todos" || categoria(v) === filtro;
  const conta = (lista: VisualRecurso[], v: VisualRecurso | VisualRecurso[]) =>
    lista.filter((x) => (Array.isArray(v) ? v.includes(x) : x === v)).length;

  const resumoDocas = [
    plural(docas.length, "doca", "docas"),
    `${conta(visualDocas, "occupied")} ocupadas`,
    conta(visualDocas, ["free", "interrupted"])
      ? plural(conta(visualDocas, ["free", "interrupted"]), "livre", "livres")
      : null,
    conta(visualDocas, "maintenance") ? `${conta(visualDocas, "maintenance")} em manutenção` : null,
    conta(visualDocas, "blocked") ? plural(conta(visualDocas, "blocked"), "bloqueada", "bloqueadas") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const resumoVagas = [
    plural(vagas.length, "vaga", "vagas"),
    `${conta(visualVagas, "occupied")} ocupadas`,
    plural(conta(visualVagas, "free"), "livre", "livres"),
    conta(visualVagas, "blocked") ? plural(conta(visualVagas, "blocked"), "bloqueada", "bloqueadas") : null,
    conta(visualVagas, "maintenance") ? `${conta(visualVagas, "maintenance")} em manutenção` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const equips = t.recursos.equipamentos;
  const equipsQuebrados = equips.filter((e) => visualEquip(e, t.ctx) === "blocked").length;
  const resumoEquips = [
    plural(equips.length, "equipamento", "equipamentos"),
    `${equips.filter((e) => e.estado === "OCUPADO").length} em uso`,
    equipsQuebrados ? plural(equipsQuebrados, "quebrado", "quebrados") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /* ----- atenção no pátio ----- */
  const chips = chipsAtencao(t);

  /* ----- entrada (antes das vagas) ----- */
  const naEtapa = (op: (typeof t.operacoes)[number]) =>
    formatarDuracao(minutosDesde(etapaDesde(op), t.ctx.agora));
  const preEntrada = t.operacoes.filter(
    (o) => o.estado === "AGUARDANDO_DOCUMENTACAO" || o.estado === "AGUARDANDO_INSPECAO",
  );
  const filaExterna = t.operacoes.filter((o) => o.estado === "AGUARDANDO_ENTRADA");
  const abertaDe = (opId: string) =>
    t.ocorrencias.find(
      (o) => o.estado === "ABERTA" && t.afetadasDe(o).some((a) => a.operacao_id === opId),
    );

  /* ----- painel contextual ----- */
  let painel: React.ReactNode = null;
  let rotuloPainel = "Detalhe";
  if (recursoParam && idSel) {
    painel = <PainelRecurso t={t} tipo={tipoSel} id={idSel} base={base} consulta={consultaPlaca} />;
    rotuloPainel = "Detalhe do recurso";
  } else if (ocorrenciaFoco) {
    painel = (
      <PainelOcorrencia
        t={t}
        o={ocorrenciaFoco}
        modo={{
          tela: "patio",
          base: { filtro: base.filtro, ocorrencia: ocorrenciaFoco.id, origem, consulta: consultaParam },
          consulta: consultaParam,
        }}
      />
    );
    rotuloPainel = "Detalhe da ocorrência";
  }

  return (
    <div className="flex">
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PageHeader titulo="Pátio e docas" />
          {ocorrenciaFoco &&
            (origem === "painel" ? (
              <Acao
                href={montarHref("/dashboard", { ocorrencia: ocorrenciaFoco.id })}
                variante="outline"
                tamanho="sm"
                scroll
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Painel · Ocorrência {t.numeroOcorrencia(ocorrenciaFoco)}
              </Acao>
            ) : (
              <Acao href={montarHref("/patio", { filtro: base.filtro })} variante="ghost" tamanho="sm">
                Ocorrência {t.numeroOcorrencia(ocorrenciaFoco)} em foco
                <X className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Limpar foco</span>
              </Acao>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="group" aria-label="Filtro por estado">
          <span className="text-sm text-t3">Estado</span>
          <ChipLink href={hrefFiltro("todos")} selecionado={filtro === "todos"} contagem={contagem("todos")}>
            Todos
          </ChipLink>
          <ChipLink href={hrefFiltro("livres")} selecionado={filtro === "livres"} contagem={contagem("livres")}>
            Livres
          </ChipLink>
          <ChipLink href={hrefFiltro("ocupados")} selecionado={filtro === "ocupados"} contagem={contagem("ocupados")}>
            Ocupados
          </ChipLink>
          <ChipLink
            href={hrefFiltro("indisponiveis")}
            selecionado={filtro === "indisponiveis"}
            contagem={contagem("indisponiveis")}
          >
            Indisponíveis
          </ChipLink>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Atenção no pátio">
            <span className="mr-1 flex items-center gap-2 text-sm font-semibold text-t1">
              Atenção no pátio
              <span className="rounded-full bg-sev-critical-bg px-2 text-xs font-bold text-critical">
                {chips.length}
              </span>
            </span>
            {chips.map((c) => (
              <ResourceChip
                key={c.chave}
                href={hrefRecurso(c.tipo, c.id)}
                selecionado={selecionado(c.tipo, c.id)}
                visual={c.visual}
                codigo={c.codigo}
                rotulo={c.rotulo}
              />
            ))}
          </div>
        )}

        <Secao titulo="Docas · cais" contagem={resumoDocas}>
          <div className="grid grid-cols-2 gap-2 border-t border-line-strong pt-3 sm:grid-cols-4 lg:grid-cols-8">
            {docas.map((d, i) => (
              <DocaView
                key={d.id}
                doca={d}
                ctx={t.ctx}
                href={hrefRecurso("doca", d.id)}
                selecionado={selecionado("doca", d.id)}
                atenuado={!passa(visualDocas[i])}
                marca={marcaDoca(d)}
                mostrarEquipamento
              />
            ))}
          </div>
          <div
            aria-hidden="true"
            className="mt-3 rounded-ds-sm bg-canvas py-1 text-center text-xs tracking-wide text-t3"
          >
            Circulação
          </div>
        </Secao>

        <Secao titulo="Pátio · vagas" contagem={resumoVagas}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {vagas.map((v, i) => (
              <VagaView
                key={v.id}
                vaga={v}
                ctx={t.ctx}
                href={hrefRecurso("vaga", v.id)}
                selecionado={selecionado("vaga", v.id)}
                atenuado={!passa(visualVagas[i])}
                marca={afetados.has(v.id) ? { texto: "afetado" } : undefined}
              />
            ))}
          </div>
        </Secao>

        <Secao
          titulo="Entrada"
          contagem="fluxo antes das vagas"
          nota={
            <Link
              href="/fila"
              className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline active:opacity-80"
            >
              Ver na Fila
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Cartao className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-t1">Pré-entrada · {preEntrada.length}</h3>
              {preEntrada.length ? (
                preEntrada.map((o) => {
                  const oc = abertaDe(o.id);
                  return (
                    <EntryRow
                      key={o.id}
                      href={montarHref("/fila", { caminhao: o.caminhao.placa })}
                      placa={o.caminhao.placa}
                      detalhe={(oc ? ROTULO_TIPO_OCORRENCIA[oc.tipo] : etapaLonga(o.estado)).toLowerCase()}
                      tempo={naEtapa(o)}
                      atencao={!!oc}
                    />
                  );
                })
              ) : (
                <p className="text-sm text-t3">Nenhum caminhão em pré-entrada.</p>
              )}
            </Cartao>
            <Cartao className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-t1">
                Fila externa · {filaExterna.length} aguardando entrada
              </h3>
              {filaExterna.length ? (
                filaExterna.map((o) => (
                  <EntryRow
                    key={o.id}
                    href={montarHref("/fila", { caminhao: o.caminhao.placa })}
                    placa={o.caminhao.placa}
                    tempo={naEtapa(o)}
                    atencao={!!abertaDe(o.id)}
                  />
                ))
              ) : (
                <p className="text-sm text-t3">Nenhum caminhão aguardando entrada.</p>
              )}
            </Cartao>
          </div>
        </Secao>

        <Secao titulo="Equipamentos" contagem={resumoEquips}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {equips.map((e) => (
              <EquipView
                key={e.id}
                equip={e}
                ctx={t.ctx}
                href={hrefRecurso("equipment", e.id)}
                selecionado={selecionado("equipment", e.id)}
              />
            ))}
          </div>
        </Secao>

        <Legenda />
      </main>

      {painel && (
        <ContextPanel rotulo={rotuloPainel} fecharHref={fecharHref}>
          {painel}
        </ContextPanel>
      )}
    </div>
  );
}
