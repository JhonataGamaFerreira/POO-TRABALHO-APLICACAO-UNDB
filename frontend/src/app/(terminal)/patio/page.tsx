import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContextPanel } from "@/components/layout/context-panel";
import { PageHeader, Secao } from "@/components/layout/page-header";
import { DetalheRecurso } from "@/components/terminal/details";
import { ResourceChip } from "@/components/terminal/resource-cells";
import { Legenda } from "@/components/terminal/legend";
import {
  DocaView,
  EquipView,
  VagaView,
  rotuloRecurso,
  visualRecurso,
} from "@/components/terminal/recurso-views";
import { EntryRow } from "@/components/terminal/rows";
import { cn } from "@/lib/utils";
import {
  ROTULO_TIPO_OCORRENCIA,
  etapaLonga,
  parametro,
  resolverRecurso,
  resumoCarga,
} from "@/lib/terminal";
import { carregarTerminal, montarHref } from "@/lib/terminal-contexto";
import type { EstadoRecurso } from "@/types/terminal";

export const metadata = { title: "Pátio e docas · Terminal Portuário" };

type Filtro = "todos" | "livres" | "ocupados" | "manutencao";
const FILTROS: Array<{ id: Filtro; rotulo: string }> = [
  { id: "todos", rotulo: "Todos" },
  { id: "livres", rotulo: "Livres" },
  { id: "ocupados", rotulo: "Ocupados" },
  { id: "manutencao", rotulo: "Em manutenção" },
];

function passaFiltro(estado: EstadoRecurso, filtro: Filtro) {
  if (filtro === "todos") return true;
  if (filtro === "livres") return estado === "LIVRE" || estado === "DISPONIVEL";
  if (filtro === "ocupados") return estado === "OCUPADO";
  return estado === "EM_MANUTENCAO";
}

export default async function PatioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = await carregarTerminal();
  const filtroParam = parametro(sp, "filtro");
  const filtro: Filtro = FILTROS.some((f) => f.id === filtroParam) ? (filtroParam as Filtro) : "todos";
  const recursoParam = parametro(sp, "recurso");
  const ocorrenciaId = parametro(sp, "ocorrencia");
  const origem = parametro(sp, "origem");

  const [tipoSel, idSel] = recursoParam?.split(":") ?? [];
  const ocorrenciaFoco = t.abertas.find((o) => o.id === ocorrenciaId);

  // Elementos afetados: só o que a própria ocorrência referencia (recurso ou área).
  const afetados = new Set<string>();
  if (ocorrenciaFoco) {
    const r = resolverRecurso(ocorrenciaFoco, t.idx, t.recursos);
    if (r?.tipo === "area") {
      [...t.recursos.vagas, ...t.recursos.docas]
        .filter((x) => x.area.id === r.id)
        .forEach((x) => afetados.add(`${x.id}`));
    } else if (r) {
      afetados.add(r.id);
    }
  }

  const base = { filtro: filtro === "todos" ? undefined : filtro, ocorrencia: ocorrenciaId, origem };
  const hrefRecurso = (tipo: string, id: string) =>
    montarHref("/patio", { ...base, recurso: `${tipo}:${id}` });
  const fecharHref = montarHref("/patio", base);

  // Chips de atenção: manutenção e recursos com ocorrência aberta (dados da API).
  const chips: Array<{ chave: string; tipo: string; id: string; codigo: string; rotulo: string; visual: ReturnType<typeof visualRecurso> }> = [];
  const add = (c: (typeof chips)[number]) => {
    if (!chips.some((x) => x.chave === c.chave)) chips.push(c);
  };
  t.recursos.docas.forEach((d) => {
    if (d.estado === "EM_MANUTENCAO")
      add({ chave: d.id, tipo: "doca", id: d.id, codigo: t.idx.codigoDoca.get(d.id) ?? "Doca", rotulo: "Em manutenção", visual: "maintenance" });
  });
  t.recursos.vagas.forEach((v) => {
    if (v.estado === "EM_MANUTENCAO")
      add({ chave: v.id, tipo: "vaga", id: v.id, codigo: t.idx.codigoVaga.get(v.id) ?? "Vaga", rotulo: "Em manutenção", visual: "maintenance" });
  });
  t.recursos.equipamentos.forEach((e) => {
    if (e.estado === "EM_MANUTENCAO")
      add({ chave: e.id, tipo: "equipment", id: e.id, codigo: e.nome, rotulo: "Em manutenção", visual: "maintenance" });
  });
  t.abertas.forEach((o) => {
    if (!o.recurso_tipo || o.recurso_tipo === "area" || !o.recurso_id) return;
    const r = resolverRecurso(o, t.idx, t.recursos);
    if (!r) return;
    const recurso =
      r.tipo === "vaga" ? t.idx.vagaPorId.get(r.id)
      : r.tipo === "doca" ? t.idx.docaPorId.get(r.id)
      : t.idx.equipPorId.get(r.id);
    const interditada = recurso && "area" in recurso ? recurso.area.interditada : false;
    add({
      chave: r.id,
      tipo: r.tipo,
      id: r.id,
      codigo: r.codigo,
      rotulo: `ocorrência: ${ROTULO_TIPO_OCORRENCIA[o.tipo].toLowerCase()}`,
      visual: recurso ? visualRecurso(recurso.estado, interditada) : "free",
    });
  });

  const entrada = t.operacoes.filter(
    (o) =>
      o.estado === "AGUARDANDO_DOCUMENTACAO" ||
      o.estado === "AGUARDANDO_INSPECAO" ||
      o.estado === "AGUARDANDO_ENTRADA",
  );

  // Painel contextual do recurso selecionado.
  let painel: React.ReactNode = null;
  const ligacoesPatio = (id: string, areaId?: string) =>
    t.ligacoes(
      t.ocorrencias.filter(
        (o) => o.recurso_id === id || (areaId !== undefined && o.recurso_tipo === "area" && o.recurso_id === areaId),
      ),
      (o) => montarHref("/patio", { ...base, ocorrencia: o.id, origem: undefined }),
    );
  const caminhaoDe = (opId: string | null) => {
    const o = opId ? t.idx.operacaoPorId.get(opId) : undefined;
    return o
      ? {
          placa: o.caminhao.placa,
          carga: resumoCarga(o.carga) || o.carga.descricao,
          etapa: etapaLonga(o.estado),
          operacao: o.tipo === "carga" ? "Carga" : "Descarga",
          href: montarHref("/fila", { caminhao: o.caminhao.placa }),
        }
      : null;
  };
  if (tipoSel === "vaga" && idSel && t.idx.vagaPorId.has(idSel)) {
    const v = t.idx.vagaPorId.get(idSel)!;
    painel = (
      <DetalheRecurso
        tipoRotulo="Vaga"
        codigo={t.idx.codigoVaga.get(v.id) ?? "Vaga"}
        visual={visualRecurso(v.estado, v.area.interditada)}
        rotuloEstado={rotuloRecurso(v.estado, "vaga")}
        area={v.area}
        caminhao={caminhaoDe(v.operacao_id)}
        ocorrencias={ligacoesPatio(v.id, v.area.id)}
      />
    );
  } else if (tipoSel === "doca" && idSel && t.idx.docaPorId.has(idSel)) {
    const d = t.idx.docaPorId.get(idSel)!;
    const op = d.operacao_id ? t.idx.operacaoPorId.get(d.operacao_id) : undefined;
    painel = (
      <DetalheRecurso
        tipoRotulo="Doca"
        codigo={t.idx.codigoDoca.get(d.id) ?? "Doca"}
        visual={visualRecurso(d.estado, d.area.interditada)}
        rotuloEstado={rotuloRecurso(d.estado, "doca")}
        area={d.area}
        extras={[
          { rotulo: "Tipo", valor: d.tipo ? (d.tipo === "carga" ? "Carga" : "Descarga") : "Não informado" },
          ...(op ? [{ rotulo: "Equipamento", valor: op.equipamento?.nome ?? "—" }] : []),
        ]}
        caminhao={caminhaoDe(d.operacao_id)}
        ocorrencias={ligacoesPatio(d.id, d.area.id)}
      />
    );
  } else if (tipoSel === "equipment" && idSel && t.idx.equipPorId.has(idSel)) {
    const e = t.idx.equipPorId.get(idSel)!;
    painel = (
      <DetalheRecurso
        tipoRotulo="Equipamento"
        codigo={e.nome}
        visual={visualRecurso(e.estado, false)}
        rotuloEstado={rotuloRecurso(e.estado, "equipment")}
        extras={[
          {
            rotulo: "Tipos",
            valor: e.tipos_compativeis.map((x) => (x === "carga" ? "Carga" : "Descarga")).join(", ") || "—",
          },
          { rotulo: "Carga frágil", valor: e.aceita_carga_fragil ? "Aceita" : "Não aceita" },
        ]}
        caminhao={caminhaoDe(e.operacao_id)}
        ocorrencias={ligacoesPatio(e.id)}
      />
    );
  }

  const selecionado = (tipo: string, id: string) => tipoSel === tipo && idSel === id;

  return (
    <div className="flex">
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-6">
        <PageHeader
          titulo="Pátio e docas"
          descricao="Vagas, docas e equipamentos com o estado informado pelo backend. A alocação não é feita por esta tela."
        />

        {ocorrenciaFoco && (
          <div className="flex flex-wrap items-center gap-3 rounded-ds-lg border border-line-brand bg-selected px-4 py-2 text-sm text-t1">
            <span>
              Em foco: <strong>{t.titulo(ocorrenciaFoco)}</strong>.{" "}
              {afetados.size
                ? "Os elementos ligados estão marcados como “afetado”."
                : "A ocorrência não está ligada a uma vaga, doca ou equipamento específico; nada é marcado."}
            </span>
            {origem === "painel" && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 rounded-full border border-line-brand px-2.5 py-1 font-medium text-brand hover:bg-surface"
              >
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Voltar ao Painel
              </Link>
            )}
            <Link href={montarHref("/patio", { filtro: base.filtro })} className="ml-auto text-brand hover:underline">
              Limpar foco
            </Link>
          </div>
        )}

        <nav aria-label="Filtro por estado" className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-t3">Mostrar:</span>
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={montarHref("/patio", { ...base, filtro: f.id === "todos" ? undefined : f.id, recurso: recursoParam })}
              scroll={false}
              aria-current={filtro === f.id ? "true" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-sm",
                filtro === f.id
                  ? "border-line-brand bg-line-brand font-medium text-on-brand"
                  : "border-line bg-surface text-t1 hover:bg-canvas",
              )}
            >
              {f.rotulo}
            </Link>
          ))}
          <span className="text-xs text-t3">O que não corresponde ao filtro fica atenuado.</span>
        </nav>

        {chips.length > 0 && (
          <Secao titulo="Atenção no pátio" contagem={String(chips.length)}>
            <div className="flex flex-wrap gap-2 p-5">
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
          </Secao>
        )}

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Secao titulo="Docas" contagem={`${t.recursos.docas.length}`}>
              <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
                {t.recursos.docas.map((d) => (
                  <DocaView
                    key={d.id}
                    doca={d}
                    ctx={t.ctx}
                    href={hrefRecurso("doca", d.id)}
                    selecionado={selecionado("doca", d.id)}
                    atenuado={!passaFiltro(d.estado, filtro)}
                    afetado={afetados.has(d.id)}
                  />
                ))}
              </div>
            </Secao>

            <Secao titulo="Vagas do pátio" contagem={`${t.recursos.vagas.length}`}>
              <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3 xl:grid-cols-4">
                {t.recursos.vagas.map((v) => (
                  <VagaView
                    key={v.id}
                    vaga={v}
                    ctx={t.ctx}
                    href={hrefRecurso("vaga", v.id)}
                    selecionado={selecionado("vaga", v.id)}
                    atenuado={!passaFiltro(v.estado, filtro)}
                    afetado={afetados.has(v.id)}
                  />
                ))}
              </div>
            </Secao>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Secao titulo="Entrada" contagem={`${entrada.length}`} nota="Ainda sem vaga: documentação, inspeção ou entrada.">
              <div className="px-5 py-3">
                {entrada.length ? (
                  entrada.map((o) => (
                    <EntryRow
                      key={o.id}
                      href={montarHref("/fila", { caminhao: o.caminhao.placa })}
                      placa={o.caminhao.placa}
                      detalhe={etapaLonga(o.estado)}
                      atencao={o.ocorrencias.some((x) => x.estado === "ABERTA")}
                    />
                  ))
                ) : (
                  <p className="text-sm text-t2">Nenhum caminhão aguardando entrada.</p>
                )}
              </div>
            </Secao>

            <Secao titulo="Equipamentos" contagem={`${t.recursos.equipamentos.length}`}>
              <div className="flex flex-col gap-2 p-5">
                {t.recursos.equipamentos.map((e) => (
                  <EquipView
                    key={e.id}
                    equip={e}
                    ctx={t.ctx}
                    href={hrefRecurso("equipment", e.id)}
                    selecionado={selecionado("equipment", e.id)}
                    atenuado={!passaFiltro(e.estado, filtro)}
                    afetado={afetados.has(e.id)}
                  />
                ))}
              </div>
            </Secao>
          </div>
        </div>

        <Legenda />
      </main>

      {painel && (
        <ContextPanel rotulo="Detalhe do recurso" fecharHref={fecharHref}>
          {painel}
        </ContextPanel>
      )}
    </div>
  );
}
