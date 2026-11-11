import Link from "next/link";
import { ArrowRight, ChevronRight, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  etapaLonga,
  formatarDataHora,
  formatarDuracao,
  rotuloCaracteristica,
  type NivelVisual,
} from "@/lib/terminal";
import type { Operacao } from "@/types/terminal";
import type { ItemFilaProposto } from "@/types/terminal-proposto";
import { Acao } from "./actions";
import {
  ResourceSwatch,
  SeverityIndicator,
  type VisualRecurso,
} from "./indicators";

export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 py-1 text-sm">
      <dt className="text-t3">{rotulo}</dt>
      <dd className="text-t1">{children}</dd>
    </div>
  );
}

export function SecaoPainel({
  titulo,
  children,
  nota,
  contagem,
}: {
  titulo: string;
  children: React.ReactNode;
  nota?: string;
  contagem?: number;
}) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-t1">
        {titulo}
        {contagem !== undefined && ` (${contagem})`}
      </h3>
      {nota && <p className="text-xs text-t3">{nota}</p>}
      {children}
    </section>
  );
}

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
              <Link
                href={o.href}
                scroll={false}
                className={cn(classe, "transition-colors hover:bg-canvas active:bg-selected")}
              >
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

/** Truck Card (DS 09.10): caminhão em cartão, dentro de um painel. */
export function CartaoCaminhao({
  placa,
  nivel = "none",
  rotuloSeveridade,
  espera,
  linha2,
  linha3,
  vaga,
  href,
  selo,
  acaoSecundaria,
  destaque,
}: {
  placa: string;
  nivel?: NivelVisual;
  rotuloSeveridade?: string;
  espera: string;
  linha2: string;
  linha3: string;
  /** Código da vaga ocupada ("V05"). */
  vaga?: string | null;
  href?: string;
  /** Etiqueta no canto ("consultando"). */
  selo?: string;
  /** Link de contexto ("Consultar docas"). */
  acaoSecundaria?: { rotulo: string; href: string };
  destaque?: boolean;
}) {
  const corpo = (
    <>
      <span className="flex items-center gap-2">
        {vaga && <span className="font-mono text-xs text-t3">{vaga}</span>}
        <span className="font-mono text-sm font-medium text-t1">{placa}</span>
        <span className="ml-auto inline-flex items-center gap-2">
          {nivel !== "none" && (
            <SeverityIndicator nivel={nivel} rotulo={rotuloSeveridade ?? ""} mostrarRotulo={false} />
          )}
          <span className="font-mono text-sm font-medium text-t1">{espera}</span>
        </span>
      </span>
      <span className="text-[13px] text-t2">{linha2}</span>
      <span className="flex items-center justify-between gap-2 text-[13px] text-t3">
        {linha3}
        {selo && <Badge variant="brand">{selo}</Badge>}
      </span>
    </>
  );
  const caixa = cn(
    "flex flex-col gap-0.5 rounded-ds-lg border px-3 py-2",
    destaque ? "border-2 border-line-brand bg-selected" : "border-line bg-surface",
  );
  return (
    <div className="flex flex-col">
      {href ? (
        <Link
          href={href}
          scroll={false}
          className={cn(caixa, "transition-colors hover:bg-canvas active:bg-selected", destaque && "hover:bg-selected")}
        >
          {corpo}
        </Link>
      ) : (
        <div className={caixa}>{corpo}</div>
      )}
      {acaoSecundaria && (
        <Link
          href={acaoSecundaria.href}
          scroll={false}
          className="mt-1 inline-flex w-fit items-center gap-0.5 self-end rounded-ds-sm px-1 text-xs font-medium text-brand hover:underline active:opacity-80"
        >
          {acaoSecundaria.rotulo}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export interface DocaCompativelView {
  codigo: string;
  situacao: string;
  disponivel: boolean;
  /** Doca livre que o sistema não considera alocável (campo `restricao`). */
  restrita?: boolean;
  href: string;
}

/**
 * Consulta contextual de docas compatíveis (endpoint PROPOSTO). O front-end só
 * exibe o que o sistema informa: não aloca nem prioriza doca.
 */
export function ConsultaDocas({
  placa,
  contexto,
  docas,
  semDados,
  porQue,
}: {
  placa: string;
  /** "1º da fila", "perigosa", etc. */
  contexto?: string;
  docas: DocaCompativelView[];
  semDados?: boolean;
  /** Link para explicar uma doca livre que o sistema não considera alocável. */
  porQue?: { codigo: string; href: string };
}) {
  return (
    <SecaoPainel
      titulo={`Docas compatíveis para ${placa}`}
      nota="Consulta contextual para o caminhão selecionado. Não é alocação nem priorização de doca."
    >
      {contexto && <p className="text-xs text-t2">{contexto}</p>}
      {semDados || !docas.length ? (
        <p className="text-sm text-t3">Nenhuma doca compatível para este caminhão.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {docas.map((d) => (
            <li key={d.codigo}>
              <Link
                href={d.href}
                scroll={false}
                className={cn(
                  "flex items-center gap-3 rounded-ds-lg border bg-surface px-3 py-2 text-sm transition-colors hover:bg-canvas active:bg-selected",
                  d.restrita ? "border-attention" : "border-line",
                )}
              >
                <span className="w-7 shrink-0 font-semibold text-t1">{d.codigo}</span>
                <span className="min-w-0 flex-1 text-[13px] text-t2">{d.situacao}</span>
                {d.restrita && (
                  <TriangleAlert className="size-4 shrink-0 text-attention" aria-label="Com restrição" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {porQue && (
        <Link
          href={porQue.href}
          scroll={false}
          className="inline-flex w-fit items-center gap-1 rounded-ds-sm text-sm font-medium text-brand hover:underline active:opacity-80"
        >
          Por que a {porQue.codigo} não recebe?
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </SecaoPainel>
  );
}

/** Resumo da consulta de docas dentro do painel de uma doca (wireframe B3). */
export function ResumoConsulta({
  placa,
  contexto,
  docas,
}: {
  placa: string;
  contexto?: string;
  docas: Array<{ codigo: string; situacao: string; disponivel: boolean; restrita?: boolean }>;
}) {
  const codigos = docas.map((d) => d.codigo);
  const lista =
    codigos.length < 2 ? codigos.join("") : `${codigos.slice(0, -1).join(", ")} e ${codigos.at(-1)}`;
  return (
    <SecaoPainel titulo={`Para ${placa}${contexto ? ` (${contexto})` : ""}`}>
      <div className="flex flex-col gap-1.5 rounded-ds-lg border border-line px-3 py-2 text-[13px]">
        {docas.length ? (
          <>
            <p className="text-t2">Docas compatíveis segundo o sistema: {lista}.</p>
            <ul className="flex flex-col gap-0.5">
              {docas.map((d) => (
                <li
                  key={d.codigo}
                  className={cn("text-t2", d.restrita && "font-medium text-attention-strong")}
                >
                  <span className="font-semibold text-t1">{d.codigo}</span> · {d.situacao}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-t3">Nenhuma doca compatível para este caminhão.</p>
        )}
      </div>
    </SecaoPainel>
  );
}

/** Rodapé do painel: ações principais. */
function Rodape({ children }: { children: React.ReactNode }) {
  return <div className="mt-auto flex flex-col gap-3 pt-2">{children}</div>;
}

/** Detalhe de uma ocorrência (painel contextual dos wireframes A2 e B2). */
export function DetalheOcorrencia({
  numero,
  titulo,
  nivel,
  rotuloSeveridade,
  descricao,
  campos,
  afetados,
  recurso,
  consulta,
  linkPatio,
  voltarPainel,
}: {
  numero: number;
  titulo: string;
  nivel: NivelVisual;
  rotuloSeveridade: string;
  descricao: string;
  campos: Array<{ rotulo: string; valor: React.ReactNode }>;
  afetados: React.ReactNode[];
  recurso: { visual: VisualRecurso; codigo: string; rotulo: string; href: string } | null;
  /** Consulta de docas compatíveis (apenas em Pátio e docas). */
  consulta?: React.ReactNode;
  /** Painel: leva ao Pátio com a ocorrência em foco. */
  linkPatio?: string;
  /** Pátio aberto a partir do Painel: volta com a ocorrência. */
  voltarPainel?: string;
}) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <SeverityIndicator nivel={nivel} rotulo={rotuloSeveridade} />
          <span className="text-xs text-t3">Ocorrência {numero}</span>
        </div>
        <h2 className="text-xl font-semibold text-t1">{titulo}</h2>
        <p className="text-sm text-t2">{descricao}</p>
      </header>
      <dl>
        {campos.map((c) => (
          <Campo key={c.rotulo} rotulo={c.rotulo}>
            {c.valor}
          </Campo>
        ))}
      </dl>

      <SecaoPainel titulo="Caminhões afetados" contagem={afetados.length}>
        {afetados.length ? (
          <div className="flex flex-col gap-2">{afetados}</div>
        ) : (
          <p className="text-sm text-t3">Nenhum caminhão afetado.</p>
        )}
      </SecaoPainel>

      {consulta}

      {recurso && (
        <SecaoPainel titulo="Recurso da ocorrência">
          <Link
            href={recurso.href}
            scroll={false}
            className="flex items-center gap-3 rounded-ds-lg border border-line px-3 py-2 transition-colors hover:bg-canvas active:bg-selected"
          >
            <ResourceSwatch visual={recurso.visual} />
            <span className="flex flex-col">
              <span className="font-mono text-sm font-medium text-t1">{recurso.codigo}</span>
              <span className="text-[13px] text-t2">{recurso.rotulo}</span>
            </span>
          </Link>
        </SecaoPainel>
      )}

      <Rodape>
        {linkPatio && (
          <Acao href={linkPatio} variante="primary" tamanho="lg" scroll>
            Ver no Pátio e docas
            <ArrowRight className="size-4" aria-hidden="true" />
          </Acao>
        )}
        {voltarPainel && (
          <Acao href={voltarPainel} variante="link" scroll>
            ← Voltar ao Painel
          </Acao>
        )}
      </Rodape>
    </>
  );
}

/** Detalhe de um caminhão/operação (painel contextual da Fila). */
export function DetalheCaminhao({
  op,
  item,
  recursos,
  etapa,
  ocorrencias,
  linkPatio,
  acoes,
  responsavelDe,
}: {
  op: Operacao;
  item: ItemFilaProposto | null;
  recursos: { vaga: string | null; doca: string | null; equipamento: string | null };
  /** Complemento da etapa atual: há quanto tempo e média da etapa (backend). */
  etapa: { desde: string; media: string | null };
  ocorrencias: LigacaoOcorrencia[];
  linkPatio: string | null;
  /** Ação da etapa atual ("Próximo passo"), quando há. */
  acoes?: React.ReactNode;
  /** Nome do funcionário pelo id (responsável da operação e dos eventos). */
  responsavelDe?: (id: string | null) => string | null;
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

      {acoes}

      <SecaoPainel titulo="Etapa atual">
        <dl>
          <Campo rotulo="Etapa">{etapaLonga(op.estado)}</Campo>
          <Campo rotulo="Na etapa há">{etapa.desde}</Campo>
          {etapa.media && <Campo rotulo="Média da etapa">{etapa.media}</Campo>}
          {item?.motivo_espera && <Campo rotulo="Motivo da espera">{item.motivo_espera}</Campo>}
        </dl>
      </SecaoPainel>

      <dl>
        <Campo rotulo="Motorista">{op.caminhao.motorista.nome}</Campo>
        <Campo rotulo="Transportadora">{op.caminhao.transportadora.nome}</Campo>
        <Campo rotulo="Operação">{op.tipo === "carga" ? "Carga" : "Descarga"}</Campo>
        <Campo rotulo="Chegada">{formatarDataHora(op.chegada_em)}</Campo>
        {responsavelDe?.(op.funcionario_responsavel_id) && (
          <Campo rotulo="Responsável">{responsavelDe(op.funcionario_responsavel_id)}</Campo>
        )}
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
        <SecaoPainel titulo={`Fila · posição ${item.posicao}`}>
          <p className="font-mono text-sm text-t1">{Math.round(item.pontuacao)} pontos</p>
          <ul className="flex flex-col gap-0.5 text-[13px] text-t2">
            {item.fatores.map((f, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {f.tipo === "caracteristica"
                    ? rotuloCaracteristica(f.caracteristica)
                    : `Tempo de espera (${formatarDuracao(f.minutos)})`}
                </span>
                <span className="font-mono">
                  {Math.round(f.tipo === "caracteristica" ? f.peso : f.pontos)}
                </span>
              </li>
            ))}
          </ul>
        </SecaoPainel>
      )}

      <SecaoPainel titulo="Ocorrências" contagem={ocorrencias.length}>
        <ListaOcorrencias itens={ocorrencias} />
      </SecaoPainel>

      <SecaoPainel titulo="Histórico da operação">
        {op.historico.length ? (
          <ol className="flex flex-col gap-1.5 border-l border-line pl-3">
            {op.historico.map((e) => (
              <li key={e.id} className="text-[13px]">
                <span className="font-mono text-xs text-t3">
                  {formatarDataHora(e.ocorrido_em)}
                  {responsavelDe?.(e.responsavel_id) && ` · ${responsavelDe(e.responsavel_id)}`}
                </span>
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

      {linkPatio && (
        <Rodape>
          <Acao href={linkPatio} variante="primary" tamanho="lg" scroll>
            Ver no Pátio e docas
            <ArrowRight className="size-4" aria-hidden="true" />
          </Acao>
        </Rodape>
      )}
    </>
  );
}

/** Detalhe de um recurso (vaga, doca ou equipamento) — wireframe B3. */
export function DetalheRecurso({
  tipoRotulo,
  codigo,
  visual,
  rotuloVisual,
  tomRotulo = "neutral",
  descricao,
  campos,
  destaque,
  caminhao,
  consulta,
  causa,
  ocorrencias,
  acaoPrimaria,
  voltar,
}: {
  tipoRotulo: "Vaga" | "Doca" | "Equipamento";
  codigo: string;
  visual: VisualRecurso;
  /** Estado em texto (ex.: "Livre · com restrição", "Interrompida"). */
  rotuloVisual: string;
  tomRotulo?: "neutral" | "attention";
  descricao?: string;
  campos?: Array<{ rotulo: string; valor: React.ReactNode }>;
  /** Bloco de atenção (ex.: "Por que não recebe?"). */
  destaque?: { titulo: string; titulo2?: string; texto: string };
  caminhao: {
    placa: string;
    carga: string;
    etapa: string;
    operacao: string;
    href: string;
  } | null;
  /** Consulta de docas compatíveis do caminhão em foco. */
  consulta?: React.ReactNode;
  /** Causa relacionada (ocorrência). */
  causa?: { href: string; titulo: string; detalhe: string; visual: VisualRecurso } | null;
  ocorrencias: LigacaoOcorrencia[];
  acaoPrimaria?: { rotulo: string; href: string } | null;
  voltar?: { rotulo: string; href: string } | null;
}) {
  return (
    <>
      <header className="flex items-center gap-3">
        <ResourceSwatch visual={visual} />
        <div>
          <p className="text-xs text-t3">{tipoRotulo}</p>
          <h2 className="text-xl font-semibold text-t1">{codigo}</h2>
        </div>
        <Badge variant={tomRotulo} className="ml-auto">
          {rotuloVisual}
        </Badge>
      </header>

      {descricao && <p className="text-sm text-t2">{descricao}</p>}

      {campos && campos.length > 0 && (
        <dl>
          {campos.map((c) => (
            <Campo key={c.rotulo} rotulo={c.rotulo}>
              {c.valor}
            </Campo>
          ))}
        </dl>
      )}

      {destaque && (
        <SecaoPainel titulo={destaque.titulo}>
          <div className="flex gap-2 rounded-ds-lg border-[1.5px] border-attention bg-surface p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden="true" />
            <div>
              {destaque.titulo2 && <p className="font-medium text-t1">{destaque.titulo2}</p>}
              <p className="text-[13px] text-t2">{destaque.texto}</p>
            </div>
          </div>
        </SecaoPainel>
      )}

      {consulta}

      {caminhao && (
      <SecaoPainel titulo="Caminhão associado">
        {caminhao ? (
          <Link
            href={caminhao.href}
            scroll={false}
            className="rounded-ds-lg border border-line px-3 py-2 transition-colors hover:bg-canvas active:bg-selected"
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
      )}

      {causa && (
        <SecaoPainel titulo="Causa relacionada">
          <Link
            href={causa.href}
            scroll={false}
            className="flex items-center gap-3 rounded-ds-lg border border-line px-3 py-2 transition-colors hover:bg-canvas active:bg-selected"
          >
            <ResourceSwatch visual={causa.visual} />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-t1">{causa.titulo}</span>
              <span className="text-[13px] text-t2">{causa.detalhe}</span>
            </span>
            <ChevronRight className="ml-auto size-4 text-brand" aria-hidden="true" />
          </Link>
        </SecaoPainel>
      )}

      {(ocorrencias.length > 0 || !causa) && (
        <SecaoPainel titulo="Ocorrências ligadas" contagem={ocorrencias.length}>
          <ListaOcorrencias itens={ocorrencias} />
        </SecaoPainel>
      )}

      {(acaoPrimaria || voltar) && (
        <Rodape>
          {acaoPrimaria && (
            <Acao href={acaoPrimaria.href} variante="primary" tamanho="lg">
              {acaoPrimaria.rotulo}
            </Acao>
          )}
          {voltar && (
            <Acao href={voltar.href} variante="link" scroll>
              {voltar.rotulo}
            </Acao>
          )}
        </Rodape>
      )}
    </>
  );
}
