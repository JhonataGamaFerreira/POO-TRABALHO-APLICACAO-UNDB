import {
  ROTULO_SEVERIDADE,
  etapaLonga,
  formatarDuracao,
  formatarHora,
  minutosDesde,
  nivelVisual,
  rotuloEspeciais,
  rotuloEstadoRecurso,
  type Indice,
} from "@/lib/terminal";
import type {
  Doca,
  Equipamento,
  EstadoRecurso,
  ItemFila,
  SeveridadeOcorrencia,
  Vaga,
} from "@/types/terminal";
import type {
  DocaProposta,
  OcorrenciaProposta,
  OperacaoAfetada,
  RestricaoDoca,
  VagaProposta,
} from "@/types/terminal-proposto";
import { DockCell, EquipmentCard, YardSlot } from "./resource-cells";
import type { VisualRecurso } from "./indicators";

export interface ContextoRecursos {
  idx: Indice;
  filaPorOperacao: Map<string, ItemFila>;
  abertas: OcorrenciaProposta[];
  /** Maior severidade de impacto sobre cada operação (ocorrências abertas). */
  sevPorOperacao: Map<string, SeveridadeOcorrencia>;
  afetadasDe: (o: OcorrenciaProposta) => OperacaoAfetada[];
  /** Instante de referência (simulado) para "há N min". */
  agora: string;
}

type Etiqueta = { texto: string; tom?: "brand" | "dark" };

/**
 * Visual da vaga/equipamento. Área interditada é o que o backend informa
 * (`Area.interditada`); o visual "blocked" do DS é usado para ela (PROPOSTA).
 * Bloqueado/Quebrado/Interrompida como ESTADOS de recurso seguem pendentes.
 */
export function visualRecurso(estado: EstadoRecurso, interditada: boolean): VisualRecurso {
  if (interditada) return "blocked";
  if (estado === "EM_MANUTENCAO") return "maintenance";
  if (estado === "OCUPADO") return "occupied";
  return "free";
}

/**
 * Visual da doca. "interrupted" vem do campo PROPOSTO `interrupcao`: o estado
 * da API continua LIVRE (o backend libera a doca ao interromper).
 */
export function visualDoca(d: Doca | DocaProposta): VisualRecurso {
  const v = visualRecurso(d.estado, d.area.interditada);
  if (v === "free" && "interrupcao" in d && d.interrupcao) return "interrupted";
  return v;
}

/**
 * Equipamento "quebrado" não é estado da API: é `EM_MANUTENCAO` + ocorrência
 * aberta EQUIPAMENTO_QUEBRADO. O visual hachurado vermelho é uma composição
 * dessas duas informações; o estado do recurso exibido continua "Em manutenção".
 */
export function visualEquip(e: Equipamento, ctx: ContextoRecursos): VisualRecurso {
  const quebrado = ctx.abertas.some(
    (o) => o.tipo === "EQUIPAMENTO_QUEBRADO" && o.recurso_tipo === "equipment" && o.recurso_id === e.id,
  );
  return e.estado === "EM_MANUTENCAO" && quebrado ? "blocked" : visualRecurso(e.estado, false);
}

export function rotuloRecurso(
  estado: EstadoRecurso,
  tipo: "vaga" | "doca" | "equipment",
  interditada = false,
): string {
  const base = rotuloEstadoRecurso(estado, tipo);
  return interditada ? `${base} · área interditada` : base;
}

const RESTRICAO_CURTA: Record<RestricaoDoca["codigo"], string> = {
  SEM_EQUIPAMENTO_COMPATIVEL: "sem equip. compatível",
};

export function DocaView({
  doca,
  ctx,
  href,
  selecionado,
  atenuado,
  marca,
  mostrarEquipamento,
}: {
  doca: Doca | DocaProposta;
  ctx: ContextoRecursos;
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  marca?: Etiqueta;
  mostrarEquipamento?: boolean;
}) {
  const p = doca as Partial<DocaProposta>;
  const visual = visualDoca(doca);
  const interrompida = visual === "interrupted" ? p.interrupcao! : null;
  const opId = interrompida?.operacao_id ?? doca.operacao_id;
  const op = opId ? ctx.idx.operacaoPorId.get(opId) : undefined;
  const operado = interrompida ? interrompida.minutos_operados : op?.tempos_minutos.operacao;
  const estimado = (op as { duracao_estimada_minutos?: number | null } | undefined)?.duracao_estimada_minutos ?? null;

  return (
    <DockCell
      href={href}
      selecionado={selecionado}
      atenuado={atenuado}
      marca={marca}
      codigo={ctx.idx.codigoDoca.get(doca.id) ?? "Doca"}
      visual={visual}
      rotuloEstado={rotuloRecurso(doca.estado, "doca", doca.area.interditada)}
      placa={op?.caminhao.placa}
      operacao={op ? (op.tipo === "carga" ? "Carga" : "Descarga") : undefined}
      progresso={operado !== undefined ? { operado: Math.round(operado), estimado } : undefined}
      formatar={formatarDuracao}
      equipamento={mostrarEquipamento ? (op?.equipamento?.nome ?? null) : undefined}
      interrompidaHa={
        interrompida
          ? `há ${formatarDuracao(minutosDesde(interrompida.interrompida_em, ctx.agora))}`
          : undefined
      }
      manutencaoAte={p.manutencao_ate ? formatarHora(p.manutencao_ate) : undefined}
      restricao={p.restricao ? RESTRICAO_CURTA[p.restricao.codigo] : undefined}
      bloqueioMotivo={doca.area.interditada ? (doca.area as { motivo_interdicao?: string | null }).motivo_interdicao ?? undefined : undefined}
    />
  );
}

export function VagaView({
  vaga,
  ctx,
  href,
  selecionado,
  atenuado,
  marca,
}: {
  vaga: Vaga | VagaProposta;
  ctx: ContextoRecursos;
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  marca?: Etiqueta;
}) {
  const op = vaga.operacao_id ? ctx.idx.operacaoPorId.get(vaga.operacao_id) : undefined;
  const item = op ? ctx.filaPorOperacao.get(op.id) : undefined;
  const sev = op ? ctx.sevPorOperacao.get(op.id) : undefined;
  const espera = item
    ? formatarDuracao(item.espera_minutos)
    : op && op.tempos_minutos.operacao > 0
      ? formatarDuracao(op.tempos_minutos.operacao)
      : undefined;
  return (
    <YardSlot
      href={href}
      selecionado={selecionado}
      atenuado={atenuado}
      marca={marca}
      codigo={ctx.idx.codigoVaga.get(vaga.id) ?? "Vaga"}
      visual={visualRecurso(vaga.estado, vaga.area.interditada)}
      rotuloEstado={rotuloRecurso(vaga.estado, "vaga", vaga.area.interditada)}
      placa={op?.caminhao.placa}
      situacao={op ? etapaLonga(op.estado) : undefined}
      detalhe={op ? rotuloEspeciais(op.carga.caracteristicas) || undefined : undefined}
      espera={espera}
      nivel={sev ? nivelVisual(sev) : "none"}
      rotuloSeveridade={sev ? ROTULO_SEVERIDADE[sev] : undefined}
      bloqueioMotivo={
        vaga.area.interditada
          ? (vaga.area as { motivo_interdicao?: string | null }).motivo_interdicao ?? undefined
          : undefined
      }
    />
  );
}

export function EquipView({
  equip,
  ctx,
  href,
  selecionado,
  atenuado,
  marca,
}: {
  equip: Equipamento;
  ctx: ContextoRecursos;
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  marca?: Etiqueta;
}) {
  const op = equip.operacao_id ? ctx.idx.operacaoPorId.get(equip.operacao_id) : undefined;
  const docaCodigo = op?.doca ? ctx.idx.codigoDoca.get(op.doca.id) : undefined;
  const ocorrencia = ctx.abertas.find(
    (o) => o.recurso_tipo === "equipment" && o.recurso_id === equip.id,
  );
  const numero = ocorrencia ? ctx.abertas.indexOf(ocorrencia) + 1 : 0;
  const rotulo =
    equip.estado === "OCUPADO"
      ? `Em uso${docaCodigo ? ` · ${docaCodigo}` : ""}`
      : rotuloEstadoRecurso(equip.estado, "equipment");
  return (
    <EquipmentCard
      href={href}
      selecionado={selecionado}
      atenuado={atenuado}
      marca={marca}
      nome={equip.nome}
      visual={visualEquip(equip, ctx)}
      rotuloEstado={rotulo}
      alerta={
        ocorrencia
          ? {
              nivel: nivelVisual(ocorrencia.severidade),
              rotuloSeveridade: ROTULO_SEVERIDADE[ocorrencia.severidade],
              texto:
                ocorrencia.tipo === "EQUIPAMENTO_QUEBRADO"
                  ? `Quebrado · Ocorrência ${numero}`
                  : `Ocorrência ${numero}`,
            }
          : undefined
      }
    />
  );
}
