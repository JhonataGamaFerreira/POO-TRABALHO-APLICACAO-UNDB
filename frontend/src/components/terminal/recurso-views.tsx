import {
  ROTULO_SEVERIDADE,
  ROTULO_TIPO_OCORRENCIA,
  etapaLonga,
  formatarDuracao,
  maiorSeveridade,
  nivelVisual,
  rotuloEstadoRecurso,
  type Indice,
} from "@/lib/terminal";
import type {
  Doca,
  Equipamento,
  EstadoRecurso,
  ItemFila,
  OcorrenciaListada,
  Vaga,
} from "@/types/terminal";
import { DockCell, EquipmentCard, YardSlot } from "./resource-cells";
import type { VisualRecurso } from "./indicators";

export interface ContextoRecursos {
  idx: Indice;
  filaPorOperacao: Map<string, ItemFila>;
  abertas: OcorrenciaListada[];
}

/**
 * Área interditada é o que o backend informa (`Area.interditada`). O visual
 * "blocked" do DS é usado só para ela (PROPOSTA); Bloqueado/Quebrado como
 * estados de recurso continuam pendentes.
 */
export function visualRecurso(estado: EstadoRecurso, interditada: boolean): VisualRecurso {
  if (interditada) return "blocked";
  if (estado === "EM_MANUTENCAO") return "maintenance";
  if (estado === "OCUPADO") return "occupied";
  return "free";
}

export function rotuloRecurso(
  estado: EstadoRecurso,
  tipo: "vaga" | "doca" | "equipment",
  interditada = false,
): string {
  const base = rotuloEstadoRecurso(estado, tipo);
  return interditada ? `${base} · área interditada` : base;
}

export function DocaView({
  doca,
  ctx,
  href,
  selecionado,
  atenuado,
  afetado,
}: {
  doca: Doca;
  ctx: ContextoRecursos;
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  afetado?: boolean;
}) {
  const op = doca.operacao_id ? ctx.idx.operacaoPorId.get(doca.operacao_id) : undefined;
  return (
    <DockCell
      href={href}
      selecionado={selecionado}
      atenuado={atenuado}
      afetado={afetado}
      codigo={ctx.idx.codigoDoca.get(doca.id) ?? "Doca"}
      visual={visualRecurso(doca.estado, doca.area.interditada)}
      rotuloEstado={rotuloRecurso(doca.estado, "doca", doca.area.interditada)}
      placa={op?.caminhao.placa}
      operacao={op ? (op.tipo === "carga" ? "Carga" : "Descarga") : undefined}
      duracao={op ? `${formatarDuracao(op.tempos_minutos.operacao)} em operação` : undefined}
      equipamento={op?.equipamento?.nome}
    />
  );
}

export function VagaView({
  vaga,
  ctx,
  href,
  selecionado,
  atenuado,
  afetado,
}: {
  vaga: Vaga;
  ctx: ContextoRecursos;
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  afetado?: boolean;
}) {
  const op = vaga.operacao_id ? ctx.idx.operacaoPorId.get(vaga.operacao_id) : undefined;
  const item = op ? ctx.filaPorOperacao.get(op.id) : undefined;
  const sev = op ? maiorSeveridade(op.ocorrencias) : null;
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
      afetado={afetado}
      codigo={ctx.idx.codigoVaga.get(vaga.id) ?? "Vaga"}
      visual={visualRecurso(vaga.estado, vaga.area.interditada)}
      rotuloEstado={rotuloRecurso(vaga.estado, "vaga", vaga.area.interditada)}
      placa={op?.caminhao.placa}
      situacao={op ? etapaLonga(op.estado) : undefined}
      detalhe={op ? op.carga.caracteristicas.join(", ") : undefined}
      espera={espera}
      nivel={sev ? nivelVisual(sev) : "none"}
      rotuloSeveridade={sev ? ROTULO_SEVERIDADE[sev] : undefined}
    />
  );
}

export function EquipView({
  equip,
  ctx,
  href,
  selecionado,
  atenuado,
  afetado,
}: {
  equip: Equipamento;
  ctx: ContextoRecursos;
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  afetado?: boolean;
}) {
  const op = equip.operacao_id ? ctx.idx.operacaoPorId.get(equip.operacao_id) : undefined;
  const docaCodigo = op?.doca ? ctx.idx.codigoDoca.get(op.doca.id) : undefined;
  const ocorrencia = ctx.abertas.find(
    (o) => o.recurso_tipo === "equipment" && o.recurso_id === equip.id,
  );
  const rotulo =
    equip.estado === "OCUPADO"
      ? `Em uso${docaCodigo ? ` · ${docaCodigo}` : ""}`
      : rotuloEstadoRecurso(equip.estado, "equipment");
  return (
    <EquipmentCard
      href={href}
      selecionado={selecionado}
      atenuado={atenuado}
      afetado={afetado}
      nome={equip.nome}
      visual={visualRecurso(equip.estado, false)}
      rotuloEstado={rotulo}
      alerta={
        ocorrencia
          ? {
              nivel: nivelVisual(ocorrencia.severidade),
              rotuloSeveridade: ROTULO_SEVERIDADE[ocorrencia.severidade],
              texto: `Ocorrência aberta: ${ROTULO_TIPO_OCORRENCIA[ocorrencia.tipo].toLowerCase()}`,
            }
          : undefined
      }
    />
  );
}
