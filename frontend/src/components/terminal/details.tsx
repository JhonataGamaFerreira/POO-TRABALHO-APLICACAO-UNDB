import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ROTULO_IMPACTO,
  etapaLonga,
  formatarDataHora,
  formatarDuracao,
  resumoCarga,
  rotuloCaracteristica,
  type NivelVisual,
} from "@/lib/terminal";
import type {
  AcaoOperacao,
  Area,
  ItemFila,
  OcorrenciaListada,
  Operacao,
} from "@/types/terminal";
import { ResourceSwatch, SeverityIndicator, type VisualRecurso } from "./indicators";

export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-3 py-1 text-sm">
      <dt className="text-t3">{rotulo}</dt>
      <dd className="text-t1">{children}</dd>
    </div>
  );
}

export function SecaoPainel({
  titulo,
  children,
  nota,
}: {
  titulo: string;
  children: React.ReactNode;
  nota?: string;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-t1">{titulo}</h3>
      {nota && <p className="text-xs text-t3">{nota}</p>}
      {children}
    </section>
  );
}

const ROTULO_ACAO: Record<AcaoOperacao, string> = {
  documentation: "Validar documentação",
  inspection: "Registrar inspeção",
  "yard-entry": "Autorizar entrada",
  start: "Iniciar operação",
  interrupt: "Interromper",
  cancel: "Cancelar",
  finish: "Finalizar",
  release: "Liberar caminhão",
};

export interface LigacaoOcorrencia {
  id: string;
  titulo: string;
  nivel: NivelVisual;
  rotuloSeveridade: string;
  estado: "ABERTA" | "RESOLVIDA";
  href?: string;
}

function ListaOcorrencias({ itens }: { itens: LigacaoOcorrencia[] }) {
  if (!itens.length)
    return <p className="text-sm text-t3">Nenhuma ocorrência ligada.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((o) => {
        const corpo = (
          <>
            <SeverityIndicator nivel={o.nivel} rotulo={o.rotuloSeveridade} />
            <span className="text-sm text-t1">{o.titulo}</span>
            {o.estado === "RESOLVIDA" && <Badge variant="neutral">resolvida</Badge>}
          </>
        );
        const classe =
          "flex flex-wrap items-center gap-2 rounded-ds-lg border border-line px-3 py-2";
        return (
          <li key={o.id}>
            {o.href ? (
              <Link href={o.href} scroll={false} className={cn(classe, "hover:bg-canvas")}>
                {corpo}
              </Link>
            ) : (
              <div className={classe}>{corpo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Detalhe de uma ocorrência (painel contextual). */
export function DetalheOcorrencia({
  numero,
  titulo,
  nivel,
  rotuloSeveridade,
  ocorrencia,
  rotuloTipo,
  recursoRotulo,
  idade,
  caminhao,
  linkPatio,
  linkFila,
}: {
  numero: number;
  titulo: string;
  nivel: NivelVisual;
  rotuloSeveridade: string;
  ocorrencia: OcorrenciaListada;
  rotuloTipo: string;
  recursoRotulo: string | null;
  idade: string;
  caminhao: { placa: string; etapa: string; carga: string } | null;
  linkPatio: string;
  linkFila: string | null;
}) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <SeverityIndicator nivel={nivel} rotulo={rotuloSeveridade} />
          <span className="text-xs text-t3">Ocorrência {numero}</span>
        </div>
        <h2 className="text-xl font-semibold text-t1">{titulo}</h2>
        <p className="text-sm text-t2">{ocorrencia.descricao}</p>
      </header>
      <dl>
        <Campo rotulo="Tipo">{rotuloTipo}</Campo>
        <Campo rotulo="Impacto">{ROTULO_IMPACTO[ocorrencia.impacto]}</Campo>
        <Campo rotulo="Severidade">{rotuloSeveridade}</Campo>
        <Campo rotulo="Recurso">{recursoRotulo ?? "Não informado"}</Campo>
        <Campo rotulo="Estado">
          {ocorrencia.estado === "ABERTA" ? "Aberta" : "Resolvida"}
        </Campo>
        <Campo rotulo="Aberta há">{idade}</Campo>
        <Campo rotulo="Criada em">{formatarDataHora(ocorrencia.criada_em)}</Campo>
      </dl>
      <SecaoPainel
        titulo="Caminhão da operação"
        nota="A API liga a ocorrência a uma única operação."
      >
        {caminhao ? (
          linkFila ? (
            <Link
              href={linkFila}
              scroll={false}
              className="rounded-ds-lg border border-line px-3 py-2 hover:bg-canvas"
            >
              <p className="font-mono text-sm font-medium text-t1">{caminhao.placa}</p>
              <p className="text-[13px] text-t2">{caminhao.carga}</p>
              <p className="text-[13px] text-t3">{caminhao.etapa}</p>
            </Link>
          ) : (
            <p className="text-sm text-t1">{caminhao.placa}</p>
          )
        ) : (
          <p className="text-sm text-t3">Operação não encontrada.</p>
        )}
      </SecaoPainel>
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <Link
          href={linkPatio}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-ds-lg bg-line-brand px-4 text-sm font-medium text-on-brand hover:opacity-90"
        >
          Ver no Pátio e docas
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <p className="text-xs text-t3">
          Resolver ocorrência e outras ações não estão disponíveis nesta versão: exigem
          integração com o backend e o responsável pela ação.
        </p>
      </div>
    </>
  );
}

/** Detalhe de um caminhão/operação (painel contextual). */
export function DetalheCaminhao({
  op,
  item,
  recursos,
  ocorrencias,
  linkPatio,
}: {
  op: Operacao;
  item: ItemFila | null;
  recursos: { vaga: string | null; doca: string | null; equipamento: string | null };
  ocorrencias: LigacaoOcorrencia[];
  linkPatio: string | null;
}) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <h2 className="font-mono text-xl font-medium text-t1">{op.caminhao.placa}</h2>
        <p className="text-sm text-t2">{op.carga.descricao}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="neutral">{etapaLonga(op.estado)}</Badge>
          {op.carga.caracteristicas.map((c) => (
            <Badge key={c} variant="neutral">
              {rotuloCaracteristica(c)}
            </Badge>
          ))}
        </div>
      </header>
      <dl>
        <Campo rotulo="Motorista">{op.caminhao.motorista.nome}</Campo>
        <Campo rotulo="Transportadora">{op.caminhao.transportadora.nome}</Campo>
        <Campo rotulo="Operação">{op.tipo === "carga" ? "Carga" : "Descarga"}</Campo>
        <Campo rotulo="Chegada">{formatarDataHora(op.chegada_em)}</Campo>
        <Campo rotulo="Espera">
          {formatarDuracao(item?.espera_minutos ?? op.tempos_minutos.espera)}
        </Campo>
        {op.tempos_minutos.operacao > 0 && (
          <Campo rotulo="Já operado">{formatarDuracao(op.tempos_minutos.operacao)}</Campo>
        )}
        <Campo rotulo="Vaga">{recursos.vaga ?? "—"}</Campo>
        <Campo rotulo="Doca">{recursos.doca ?? "—"}</Campo>
        <Campo rotulo="Equipamento">{recursos.equipamento ?? "—"}</Campo>
      </dl>

      {item && (
        <SecaoPainel
          titulo={`Fila · posição ${item.posicao}`}
          nota="Ordem e pontuação calculadas pelo backend (simuladas aqui); o front-end não reordena."
        >
          <p className="font-mono text-sm text-t1">{item.pontuacao} pontos</p>
          <ul className="flex flex-col gap-0.5 text-[13px] text-t2">
            {item.fatores.map((f, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {f.tipo === "caracteristica"
                    ? rotuloCaracteristica(f.caracteristica)
                    : `Espera (${formatarDuracao(f.minutos)} × ${f.bonus_por_minuto})`}
                </span>
                <span className="font-mono">
                  {f.tipo === "caracteristica" ? f.peso : f.pontos}
                </span>
              </li>
            ))}
          </ul>
        </SecaoPainel>
      )}

      <SecaoPainel titulo={`Ocorrências (${ocorrencias.length})`}>
        <ListaOcorrencias itens={ocorrencias} />
      </SecaoPainel>

      <SecaoPainel titulo="Histórico da operação">
        {op.historico.length ? (
          <ol className="flex flex-col gap-1.5 border-l border-line pl-3">
            {op.historico.map((e) => (
              <li key={e.id} className="text-[13px]">
                <span className="font-mono text-xs text-t3">{formatarDataHora(e.ocorrido_em)}</span>
                <p className="text-t1">
                  {e.estado_novo ? `→ ${etapaLonga(e.estado_novo)}` : e.descricao}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-t3">Sem eventos registrados.</p>
        )}
      </SecaoPainel>

      <SecaoPainel
        titulo="Ações previstas pelo backend"
        nota="Informativo (acoes_permitidas). Nenhuma ação é executada nesta versão."
      >
        {op.acoes_permitidas.length ? (
          <div className="flex flex-wrap gap-1.5">
            {op.acoes_permitidas.map((a) => (
              <Badge key={a} variant="neutral">
                {ROTULO_ACAO[a]}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-t3">Nenhuma ação permitida neste estado.</p>
        )}
      </SecaoPainel>

      {linkPatio && (
        <Link
          href={linkPatio}
          className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-ds-lg bg-line-brand px-4 text-sm font-medium text-on-brand hover:opacity-90"
        >
          Ver no Pátio e docas
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </>
  );
}

/** Detalhe de um recurso (vaga, doca ou equipamento). */
export function DetalheRecurso({
  tipoRotulo,
  codigo,
  visual,
  rotuloEstado,
  area,
  extras,
  caminhao,
  ocorrencias,
}: {
  tipoRotulo: "Vaga" | "Doca" | "Equipamento";
  codigo: string;
  visual: VisualRecurso;
  rotuloEstado: string;
  area?: Area;
  extras?: Array<{ rotulo: string; valor: string }>;
  caminhao: {
    placa: string;
    carga: string;
    etapa: string;
    operacao: string;
    href: string;
  } | null;
  ocorrencias: LigacaoOcorrencia[];
}) {
  return (
    <>
      <header className="flex items-center gap-3">
        <ResourceSwatch visual={visual} />
        <div>
          <p className="text-xs text-t3">{tipoRotulo}</p>
          <h2 className="text-xl font-semibold text-t1">{codigo}</h2>
        </div>
        <Badge variant="neutral" className="ml-auto">
          {rotuloEstado}
        </Badge>
      </header>

      {area && (
        <dl>
          <Campo rotulo="Área">{area.nome}</Campo>
          <Campo rotulo="Refrigerada">{area.refrigerada ? "Sim" : "Não"}</Campo>
          <Campo rotulo="Carga perigosa">
            {area.autorizada_carga_perigosa ? "Autorizada" : "Não autorizada"}
          </Campo>
          <Campo rotulo="Interditada">{area.interditada ? "Sim" : "Não"}</Campo>
        </dl>
      )}
      {extras && extras.length > 0 && (
        <dl>
          {extras.map((e) => (
            <Campo key={e.rotulo} rotulo={e.rotulo}>
              {e.valor}
            </Campo>
          ))}
        </dl>
      )}

      <SecaoPainel titulo="Caminhão associado">
        {caminhao ? (
          <Link
            href={caminhao.href}
            scroll={false}
            className="rounded-ds-lg border border-line px-3 py-2 hover:bg-canvas"
          >
            <p className="font-mono text-sm font-medium text-t1">{caminhao.placa}</p>
            <p className="text-[13px] text-t2">
              {caminhao.operacao} · {caminhao.carga}
            </p>
            <p className="text-[13px] text-t3">{caminhao.etapa}</p>
          </Link>
        ) : (
          <p className="text-sm text-t3">Nenhum caminhão associado.</p>
        )}
      </SecaoPainel>

      <SecaoPainel titulo={`Ocorrências ligadas (${ocorrencias.length})`}>
        <ListaOcorrencias itens={ocorrencias} />
      </SecaoPainel>
    </>
  );
}

export { resumoCarga };
