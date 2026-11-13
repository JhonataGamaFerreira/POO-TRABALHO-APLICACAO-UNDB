/**
 * Painéis contextuais montados a partir dos dados carregados (server). Só
 * juntam informações que a API (ou a PROPOSTA de contrato) já entrega; não
 * decidem compatibilidade, prioridade nem alocação.
 */
import {
  ROTULO_IMPACTO,
  ROTULO_SEVERIDADE,
  ROTULO_TIPO_OCORRENCIA,
  etapaDesde,
  etapaLonga,
  formatarDuracao,
  formatarHora,
  minutosDesde,
  nivelVisual,
  recursosDaOperacao,
  resolverRecurso,
  rotuloEspeciais,
  type RecursoResolvido,
} from "@/lib/terminal";
import { montarHref, type TerminalCarregado } from "@/lib/terminal-contexto";
import { AcoesOcorrencia, AcoesRecurso } from "./acoes-recursos";
import { AcoesOperacao } from "./acoes-operacao";
import type { Operacao } from "@/types/terminal";
import type { DocaProposta, OcorrenciaProposta } from "@/types/terminal-proposto";
import {
  CartaoCaminhao,
  ConsultaDocas,
  DetalheCaminhao,
  DetalheOcorrencia,
  DetalheRecurso,
  ResumoConsulta,
  type DocaCompativelView,
} from "./details";
import type { VisualRecurso } from "./indicators";
import { visualDoca, visualEquip, visualRecurso } from "./recurso-views";

type T = TerminalCarregado;
export type Params = Record<string, string | undefined>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nCaminhoes = (n: number) => `${n} ${n === 1 ? "caminhão" : "caminhões"}`;
const rotuloOperacao = (tipo: "carga" | "descarga") => (tipo === "carga" ? "Carga" : "Descarga");

/** Segunda linha de um caminhão: características especiais ou a descrição da carga. */
export const resumoCaminhao = (op: Operacao) =>
  rotuloEspeciais(op.carga.caracteristicas) || op.carga.descricao;

/* ---------- Consulta de docas compatíveis (endpoint PROPOSTO) ---------- */

function docasCompativeis(t: T, op: Operacao, hrefDoca: (docaId: string) => string) {
  const c = t.compatPorOperacao.get(op.id);
  if (!c) return null;
  const docas = c.docas.map((cd) => {
    const d = t.idx.docaPorId.get(cd.doca_id) as DocaProposta | undefined;
    return {
      id: cd.doca_id,
      codigo: t.idx.codigoDoca.get(cd.doca_id) ?? "Doca",
      situacao: cd.situacao,
      disponivel: cd.disponivel,
      restrita: !!d?.restricao,
      href: hrefDoca(cd.doca_id),
    };
  });
  const item = t.filaPorOperacao.get(op.id);
  const especiais = rotuloEspeciais(op.carga.caracteristicas).toLowerCase().replaceAll(" · ", ", ");
  const contexto = [especiais, item ? `${item.posicao}º da fila` : ""].filter(Boolean).join(", ");
  return { docas, contexto };
}

/* ---------- Ocorrência ---------- */

export type ModoOcorrencia =
  | { tela: "painel" }
  | { tela: "patio"; base: Params; consulta?: string };

function descreverRecurso(
  t: T,
  r: RecursoResolvido,
  o: OcorrenciaProposta,
): { visual: VisualRecurso; rotulo: string } {
  if (r.tipo === "equipment") {
    const e = t.idx.equipPorId.get(r.id);
    if (!e) return { visual: "free", rotulo: "Equipamento" };
    const visual = visualEquip(e, t.ctx);
    return {
      visual,
      rotulo:
        o.tipo === "EQUIPAMENTO_QUEBRADO"
          ? "Equipamento · quebrado"
          : `Equipamento · ${e.estado === "OCUPADO" ? "em uso" : e.estado === "EM_MANUTENCAO" ? "em manutenção" : "disponível"}`,
    };
  }
  if (r.tipo === "doca") {
    const d = t.idx.docaPorId.get(r.id);
    return { visual: d ? visualDoca(d) : "free", rotulo: "Doca" };
  }
  if (r.tipo === "vaga") {
    const v = t.idx.vagaPorId.get(r.id);
    return { visual: v ? visualRecurso(v.estado, v.area.interditada) : "free", rotulo: "Vaga" };
  }
  const interditada = [...t.recursos.vagas, ...t.recursos.docas].some(
    (x) => x.area.id === r.id && x.area.interditada,
  );
  return { visual: interditada ? "blocked" : "free", rotulo: "Área" };
}

/** Painel de ocorrência: wireframes A2 (Painel) e B2 (Pátio e docas). */
export function PainelOcorrencia({ t, o, modo }: { t: T; o: OcorrenciaProposta; modo: ModoOcorrencia }) {
  const noPatio = modo.tela === "patio";
  const afetadas = t.operacoesAfetadas(o);
  const r = resolverRecurso(o, t.idx, t.recursos);
  const vagas = afetadas.flatMap(({ op }) =>
    op.vaga ? [t.idx.codigoVaga.get(op.vaga.id) ?? ""] : [],
  );
  const m = t.metrica(o);
  const consultaPlaca = noPatio
    ? (modo.consulta ?? afetadas[0]?.op.caminhao.placa)
    : undefined;

  const hrefPatio = (extra: Params) => montarHref("/patio", noPatio ? { ...modo.base, ...extra } : extra);

  const afetaTexto = [
    nCaminhoes(afetadas.length),
    vagas.length
      ? noPatio
        ? vagas.join(", ")
        : `${vagas.length} ${vagas.length === 1 ? "vaga" : "vagas"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const campos = [
    { rotulo: "Tipo", valor: ROTULO_TIPO_OCORRENCIA[o.tipo] },
    ...(r ? [{ rotulo: "Recurso", valor: <span className="font-mono">{r.codigo}</span> }] : []),
    { rotulo: "Afeta", valor: afetaTexto },
    { rotulo: cap(m.legenda), valor: <span className="font-mono">{m.valor}</span> },
    ...(o.metrica_impacto
      ? [{ rotulo: "Aberta há", valor: <span className="font-mono">{t.idadeOcorrencia(o)}</span> }]
      : []),
    { rotulo: "Impacto", valor: ROTULO_IMPACTO[o.impacto] },
  ];

  const cartoes = afetadas.map(({ op, severidade }) => {
    const item = t.filaPorOperacao.get(op.id);
    const vaga = op.vaga ? t.idx.codigoVaga.get(op.vaga.id) : undefined;
    const placa = op.caminhao.placa;
    const consultando = noPatio && placa === consultaPlaca;
    return (
      <CartaoCaminhao
        key={op.id}
        placa={placa}
        nivel={nivelVisual(severidade)}
        rotuloSeveridade={ROTULO_SEVERIDADE[severidade]}
        espera={formatarDuracao(item?.espera_minutos ?? op.tempos_minutos.espera)}
        linha2={resumoCaminhao(op)}
        linha3={
          noPatio ? etapaLonga(op.estado) : `${etapaLonga(op.estado)}${vaga ? ` · ${vaga}` : ""}`
        }
        vaga={noPatio ? vaga : undefined}
        href={noPatio ? undefined : montarHref("/fila", { caminhao: placa })}
        selo={consultando ? "consultando" : undefined}
        destaque={consultando}
        acaoSecundaria={
          noPatio && !consultando && t.compatPorOperacao.has(op.id)
            ? { rotulo: "Consultar docas", href: hrefPatio({ consulta: placa }) }
            : undefined
        }
      />
    );
  });

  let consulta: React.ReactNode = null;
  if (noPatio) {
    const opConsulta = afetadas.find((a) => a.op.caminhao.placa === consultaPlaca)?.op;
    const c = opConsulta
      ? docasCompativeis(t, opConsulta, (id) => hrefPatio({ recurso: `doca:${id}`, consulta: consultaPlaca }))
      : null;
    if (opConsulta) {
      const views: DocaCompativelView[] = (c?.docas ?? []).map((d) => ({
        codigo: d.codigo,
        situacao: d.situacao,
        disponivel: d.disponivel,
        restrita: d.restrita,
        href: d.href,
      }));
      const restrita = c?.docas.find((d) => d.restrita);
      consulta = (
        <ConsultaDocas
          placa={opConsulta.caminhao.placa}
          contexto={c?.contexto}
          docas={views}
          semDados={!c}
          porQue={restrita ? { codigo: restrita.codigo, href: restrita.href } : undefined}
        />
      );
    }
  }

  return (
    <DetalheOcorrencia
      numero={t.numeroOcorrencia(o)}
      titulo={t.titulo(o)}
      nivel={nivelVisual(o.severidade)}
      rotuloSeveridade={ROTULO_SEVERIDADE[o.severidade]}
      descricao={o.descricao}
      campos={campos}
      afetados={cartoes}
      recurso={
        r
          ? {
              ...descreverRecurso(t, r, o),
              codigo: r.codigo,
              href: noPatio
                ? hrefPatio({ recurso: `${r.tipo}:${r.id}` })
                : montarHref("/patio", { recurso: `${r.tipo}:${r.id}`, ocorrencia: o.id, origem: "painel" }),
            }
          : null
      }
      consulta={consulta}
      linkPatio={noPatio ? undefined : montarHref("/patio", { ocorrencia: o.id, origem: "painel" })}
      voltarPainel={noPatio && modo.base.origem === "painel" ? montarHref("/dashboard", { ocorrencia: o.id }) : undefined}
      acoes={<AcoesOcorrencia id={o.id} tipo={o.tipo} aberta={o.estado === "ABERTA"} />}
    />
  );
}

/* ---------- Recurso (vaga, doca, equipamento) ---------- */

export function PainelRecurso({
  t,
  tipo,
  id,
  base,
  consulta,
}: {
  t: T;
  tipo: string;
  id: string;
  /** Parâmetros preservados nos links (filtro, ocorrência em foco, origem). */
  base: Params;
  /** Placa do caminhão em consulta de docas (contexto vindo da ocorrência). */
  consulta?: string;
}) {
  const hrefOcorrencia = (oid: string) =>
    montarHref("/patio", { filtro: base.filtro, ocorrencia: oid, origem: base.origem });
  const hrefDoca = (docaId: string) =>
    montarHref("/patio", { ...base, recurso: `doca:${docaId}`, consulta });

  const caminhaoDe = (opId: string | null | undefined) => {
    const o = opId ? t.idx.operacaoPorId.get(opId) : undefined;
    return o
      ? {
          placa: o.caminhao.placa,
          carga: resumoCaminhao(o),
          etapa: etapaLonga(o.estado),
          operacao: rotuloOperacao(o.tipo),
          href: montarHref("/fila", { caminhao: o.caminhao.placa }),
        }
      : null;
  };

  /** "Causa relacionada": ocorrência que explica o estado do recurso. */
  const causaDe = (ocorrenciaId: string | null | undefined, codigoRecurso: string) => {
    const o = ocorrenciaId ? t.ocorrencias.find((x) => x.id === ocorrenciaId) : undefined;
    if (!o) return null;
    // O código exibido é o do recurso da ocorrência (ex.: EQ-02), não o do recurso aberto.
    const recursoDaOcorrencia = resolverRecurso(o, t.idx, t.recursos);
    const codigoCausa = recursoDaOcorrencia?.codigo ?? codigoRecurso;
    const afetadas = t.operacoesAfetadas(o).length;
    const quebrado = o.tipo === "EQUIPAMENTO_QUEBRADO";
    return {
      o,
      bloco: {
        href: hrefOcorrencia(o.id),
        titulo: `${codigoCausa} · Ocorrência ${t.numeroOcorrencia(o)}`,
        detalhe: `${quebrado ? "Quebrada" : ROTULO_TIPO_OCORRENCIA[o.tipo]} · afeta ${nCaminhoes(afetadas)}`,
        visual: (quebrado ? "blocked" : "interrupted") as VisualRecurso,
      },
    };
  };

  const ligadas = (recursoId: string, areaId: string | undefined, excluir?: string) =>
    t.ligacoes(
      t.ocorrencias.filter(
        (o) =>
          o.id !== excluir &&
          (o.recurso_id === recursoId ||
            (areaId !== undefined && o.recurso_tipo === "area" && o.recurso_id === areaId)),
      ),
      (o) => hrefOcorrencia(o.id),
    );

  if (tipo === "vaga") {
    const v = t.idx.vagaPorId.get(id);
    if (!v) return null;
    const codigo = t.idx.codigoVaga.get(v.id) ?? "Vaga";
    const interditada = v.area.interditada;
    const motivo = (v.area as { motivo_interdicao?: string | null }).motivo_interdicao;
    return (
      <DetalheRecurso
        tipoRotulo="Vaga"
        codigo={codigo}
        visual={visualRecurso(v.estado, interditada)}
        rotuloVisual={
          interditada
            ? "Bloqueada · área interditada"
            : v.estado === "EM_MANUTENCAO"
              ? "Em manutenção"
              : v.estado === "OCUPADO"
                ? "Ocupada"
                : "Livre"
        }
        tomRotulo={interditada ? "attention" : "neutral"}
        campos={[{ rotulo: "Área", valor: v.area.nome }]}
        destaque={
          interditada
            ? {
                titulo: "Por que está bloqueada?",
                titulo2: "Área interditada",
                texto: motivo ? `${cap(motivo)}.` : "Área interditada para operação.",
              }
            : undefined
        }
        caminhao={caminhaoDe(v.operacao_id)}
        ocorrencias={ligadas(v.id, v.area.id)}
        acoes={<AcoesRecurso t={t} tipo="vaga" id={v.id} />}
      />
    );
  }

  if (tipo === "doca") {
    const d = t.idx.docaPorId.get(id) as DocaProposta | undefined;
    if (!d) return null;
    const codigo = t.idx.codigoDoca.get(d.id) ?? "Doca";
    const visual = visualDoca(d);
    const interrompida = visual === "interrupted" ? d.interrupcao : null;
    const opId = interrompida?.operacao_id ?? d.operacao_id;
    const op = opId ? t.idx.operacaoPorId.get(opId) : undefined;
    const restrita = !!d.restricao && visual === "free";
    const causaId = interrompida?.ocorrencia_id ?? d.restricao?.ocorrencia_id;
    const causa = causaDe(causaId, codigo);
    const opConsulta = consulta ? t.idx.operacaoPorPlaca.get(consulta) : undefined;
    const c = opConsulta ? docasCompativeis(t, opConsulta, hrefDoca) : null;

    const rotuloVisual =
      visual === "interrupted"
        ? "Livre · operação interrompida"
        : visual === "blocked"
          ? "Bloqueada · área interditada"
          : visual === "maintenance"
            ? "Em manutenção"
            : visual === "occupied"
              ? "Ocupada"
              : restrita
                ? "Livre · com restrição"
                : "Livre";

    const campos = [
      ...(d.tipo ? [{ rotulo: "Tipo", valor: rotuloOperacao(d.tipo) }] : []),
      { rotulo: "Área", valor: d.area.nome },
      ...(op?.equipamento ? [{ rotulo: "Equipamento", valor: op.equipamento.nome }] : []),
      ...(d.manutencao_ate && d.estado === "EM_MANUTENCAO"
        ? [{ rotulo: "Manutenção até", valor: <span className="font-mono">{formatarHora(d.manutencao_ate)}</span> }]
        : []),
      ...(interrompida
        ? [
            {
              rotulo: "Interrompida há",
              valor: (
                <span className="font-mono">
                  {formatarDuracao(minutosDesde(interrompida.interrompida_em, t.ctx.agora))}
                </span>
              ),
            },
          ]
        : []),
    ];

    let destaque: React.ComponentProps<typeof DetalheRecurso>["destaque"];
    if (interrompida && op) {
      destaque = {
        titulo: "Operação interrompida",
        titulo2: `${op.caminhao.placa} · ${rotuloOperacao(op.tipo)}`,
        texto: `Operação interrompida após ${formatarDuracao(interrompida.minutos_operados)} de trabalho.`,
      };
    } else if (d.restricao && restrita) {
      destaque = {
        titulo: "Por que não recebe?",
        titulo2: "Sem equipamento compatível livre",
        texto: d.restricao.texto,
      };
    } else if (visual === "blocked") {
      const motivo = (d.area as { motivo_interdicao?: string | null }).motivo_interdicao;
      destaque = {
        titulo: "Por que está bloqueada?",
        titulo2: "Área interditada",
        texto: motivo ? `${cap(motivo)}.` : "Área interditada para operação.",
      };
    }

    const resumo =
      c && opConsulta ? (
        <ResumoConsulta
          placa={opConsulta.caminhao.placa}
          contexto={c.contexto}
          docas={c.docas.map((x) => ({
            codigo: x.codigo,
            situacao: x.situacao,
            disponivel: x.disponivel,
            restrita: x.restrita,
          }))}
        />
      ) : null;

    return (
      <DetalheRecurso
        tipoRotulo="Doca"
        codigo={codigo}
        visual={visual}
        rotuloVisual={rotuloVisual}
        tomRotulo={restrita || visual === "interrupted" || visual === "blocked" ? "attention" : "neutral"}
        descricao={
          restrita
            ? "Esta doca está livre, mas o sistema não a considera alocável para cargas que dependam de equipamento."
            : undefined
        }
        campos={campos}
        destaque={destaque}
        consulta={resumo}
        caminhao={caminhaoDe(opId)}
        causa={causa?.bloco ?? null}
        ocorrencias={ligadas(d.id, d.area.id, causa?.o.id)}
        acaoPrimaria={
          causa ? { rotulo: `Ver Ocorrência ${t.numeroOcorrencia(causa.o)}`, href: hrefOcorrencia(causa.o.id) } : null
        }
        voltar={restrita ? { rotulo: "Ver fila completa →", href: "/fila" } : null}
        acoes={<AcoesRecurso t={t} tipo="doca" id={d.id} />}
      />
    );
  }

  if (tipo === "equipment") {
    const e = t.idx.equipPorId.get(id);
    if (!e) return null;
    const visual = visualEquip(e, t.ctx);
    const op = e.operacao_id ? t.idx.operacaoPorId.get(e.operacao_id) : undefined;
    const docaCodigo = op?.doca ? t.idx.codigoDoca.get(op.doca.id) : undefined;
    const quebrada = t.abertas.find(
      (o) => o.tipo === "EQUIPAMENTO_QUEBRADO" && o.recurso_tipo === "equipment" && o.recurso_id === e.id,
    );
    const causa = quebrada ? causaDe(quebrada.id, e.nome) : null;
    return (
      <DetalheRecurso
        tipoRotulo="Equipamento"
        codigo={e.nome}
        visual={visual}
        rotuloVisual={
          e.estado === "OCUPADO"
            ? `Em uso${docaCodigo ? ` · ${docaCodigo}` : ""}`
            : e.estado === "EM_MANUTENCAO"
              ? "Em manutenção"
              : "Disponível"
        }
        tomRotulo={visual === "blocked" ? "attention" : "neutral"}
        campos={[
          {
            rotulo: "Tipos",
            valor: e.tipos_compativeis.map(rotuloOperacao).join(", ") || "—",
          },
          { rotulo: "Carga frágil", valor: e.aceita_carga_fragil ? "Aceita" : "Não aceita" },
        ]}
        caminhao={caminhaoDe(e.operacao_id)}
        causa={causa?.bloco ?? null}
        ocorrencias={ligadas(e.id, undefined, causa?.o.id)}
        acaoPrimaria={
          causa ? { rotulo: `Ver Ocorrência ${t.numeroOcorrencia(causa.o)}`, href: hrefOcorrencia(causa.o.id) } : null
        }
        acoes={<AcoesRecurso t={t} tipo="equipment" id={e.id} />}
      />
    );
  }
  return null;
}

/* ---------- Caminhão (Fila) ---------- */

export function PainelCaminhao({ t, op }: { t: T; op: Operacao }) {
  const item = t.filaPorOperacao.get(op.id) ?? null;
  const media = t.etapas.find((e) => e.estado === op.estado)?.media_minutos ?? null;
  const linkPatio = op.doca
    ? montarHref("/patio", { recurso: `doca:${op.doca.id}` })
    : op.vaga
      ? montarHref("/patio", { recurso: `vaga:${op.vaga.id}` })
      : null;
  return (
    <DetalheCaminhao
      op={op}
      item={item}
      recursos={recursosDaOperacao(op, t.idx)}
      etapa={{
        desde: formatarDuracao(minutosDesde(etapaDesde(op), t.ctx.agora)),
        media: media !== null ? formatarDuracao(media) : null,
      }}
      ocorrencias={t.ligacoes(t.ocorrenciasDaOperacao(op.id), (o) =>
        montarHref("/dashboard", { ocorrencia: o.id }),
      )}
      linkPatio={linkPatio}
      acoes={<AcoesOperacao t={t} op={op} />}
      responsavelDe={(id) => (id ? (t.funcionarios.find((f) => f.id === id)?.nome ?? null) : null)}
    />
  );
}

/* ---------- Atenção no pátio ---------- */

export interface ChipAtencao {
  chave: string;
  tipo: "vaga" | "doca" | "equipment";
  id: string;
  codigo: string;
  rotulo: string;
  visual: VisualRecurso;
}

/**
 * Recursos que pedem atenção, a partir do que os dados já informam
 * (interrupção, restrição, manutenção, interdição, ocorrência de equipamento
 * quebrado). A ordem é só de apresentação (hipótese de design).
 */
export function chipsAtencao(t: T): ChipAtencao[] {
  const grupos: ChipAtencao[][] = [[], [], [], [], []];
  for (const d of t.recursos.docas as DocaProposta[]) {
    const codigo = t.idx.codigoDoca.get(d.id) ?? "Doca";
    const visual = visualDoca(d);
    const base = { chave: d.id, tipo: "doca" as const, id: d.id, codigo, visual };
    if (visual === "interrupted") grupos[0].push({ ...base, rotulo: "Interrompida" });
    else if (visual === "blocked") grupos[4].push({ ...base, rotulo: "Bloqueada" });
    else if (visual === "maintenance") grupos[3].push({ ...base, rotulo: "Em manutenção" });
    else if (d.restricao) grupos[2].push({ ...base, rotulo: "Livre, com restrição" });
  }
  for (const e of t.recursos.equipamentos) {
    const visual = visualEquip(e, t.ctx);
    const base = { chave: e.id, tipo: "equipment" as const, id: e.id, codigo: e.nome, visual };
    if (visual === "blocked") grupos[1].push({ ...base, rotulo: "Quebrado" });
    else if (e.estado === "EM_MANUTENCAO") grupos[3].push({ ...base, rotulo: "Em manutenção" });
  }
  for (const v of t.recursos.vagas) {
    const codigo = t.idx.codigoVaga.get(v.id) ?? "Vaga";
    const base = { chave: v.id, tipo: "vaga" as const, id: v.id, codigo };
    if (v.area.interditada) grupos[4].push({ ...base, rotulo: "Bloqueada", visual: "blocked" });
    else if (v.estado === "EM_MANUTENCAO") grupos[3].push({ ...base, rotulo: "Em manutenção", visual: "maintenance" });
  }
  return grupos.flat();
}

