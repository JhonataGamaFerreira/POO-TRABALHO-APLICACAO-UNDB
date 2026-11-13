"use client";

import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import {
  CARACTERISTICAS,
  ErroDeDominio,
  LIMITES_TEXTO,
  ORDEM_CAMPOS,
  caminhaoPorPlaca,
  estadoInicial,
  normalizarPlaca,
  responsavelDaAcao,
  validarNovaOperacao,
  type CampoNovaOperacao,
  type NovaOperacao,
} from "@/domain";
import { ContextPanel } from "@/components/layout/context-panel";
import { etapaLonga, rotuloCaracteristica } from "@/lib/terminal";
import { montarHref } from "@/lib/terminal-contexto";
import { avisar } from "@/store/avisos";
import { useAcoes, useEstadoTerminal } from "@/store/use-terminal";
import type { CaracteristicaCarga, TipoOperacao } from "@/types/terminal";
import { BotaoAcao } from "./actions";
import { CampoTexto, Erro, Escolha, GrupoEscolha } from "./campos";

interface Rascunho {
  placa: string;
  nome_motorista: string;
  documento_motorista: string;
  transportadora: string;
  tipo: TipoOperacao | "";
  descricao_carga: string;
  caracteristicas: CaracteristicaCarga[];
  documentacao_regular: boolean;
  exige_inspecao: boolean;
}

const VAZIO: Rascunho = {
  placa: "",
  nome_motorista: "",
  documento_motorista: "",
  transportadora: "",
  tipo: "",
  descricao_carga: "",
  caracteristicas: [],
  documentacao_regular: false,
  exige_inspecao: false,
};

const FECHAR = "/dashboard";
const ROTULO_FUNCAO = { RECEPCAO: "Recepção", INSPETOR: "Inspeção", OPERADOR: "Operação", SUPERVISOR: "Supervisão", ADMINISTRADOR: "Administração" } as const;

/**
 * Painel lateral "Registrar chegada" (Painel). As regras (campos obrigatórios,
 * estado inicial, reaproveitamento do caminhão, responsável) vêm do domínio; aqui só se coletam os dados e se mostram os resultados.
 * O layout do formulário é HIPÓTESE de design: o Figma aprovado não tem a tela.
 */
export function FormChegada() {
  const router = useRouter();
  const estado = useEstadoTerminal();
  const { executar } = useAcoes();
  const formId = useId();
  const [d, setD] = useState<Rascunho>(VAZIO);
  const [tocados, setTocados] = useState<Set<CampoNovaOperacao>>(new Set());
  const [tentou, setTentou] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const sujo = JSON.stringify(d) !== JSON.stringify(VAZIO);
  const erros = useMemo(() => validarNovaOperacao(d), [d]);
  const erroDe = (c: CampoNovaOperacao) => (tentou || tocados.has(c) ? erros[c] : undefined);

  const conhecido = useMemo(
    () => (estado && d.placa.trim() ? caminhaoPorPlaca(estado, d.placa) : null),
    [estado, d.placa],
  );
  const responsavel = useMemo(() => {
    if (!estado) return null;
    try {
      return responsavelDaAcao(estado, "criar-operacao");
    } catch {
      return null;
    }
  }, [estado]);

  const set = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) => setD((a) => ({ ...a, [campo]: valor }));
  const tocar = (c: CampoNovaOperacao) => setTocados((t) => new Set(t).add(c));
  const campoTexto = (c: Exclude<CampoNovaOperacao, "tipo" | "caracteristicas">) => ({
    value: d[c],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(c, e.target.value),
    onBlur: () => tocar(c),
    erro: erroDe(c),
    "data-campo": c,
    maxLength: LIMITES_TEXTO[c],
  });

  /**
   * Ao sair do campo, a placa volta na grafia do terminal (AAA-1A23, quando
   * segue o padrão brasileiro). Com placa já cadastrada, completa o que ainda
   * estiver vazio com o cadastro existente.
   */
  const aoSairDaPlaca = () => {
    tocar("placa");
    if (!d.placa.trim()) return;
    setD((a) => ({
      ...a,
      placa: normalizarPlaca(a.placa),
      ...(conhecido && {
        nome_motorista: a.nome_motorista || conhecido.motorista.nome,
        documento_motorista: a.documento_motorista || conhecido.motorista.documento,
        transportadora: a.transportadora || conhecido.transportadora.nome,
      }),
    }));
  };

  const alternarCaracteristica = (c: CaracteristicaCarga) =>
    setD((a) => {
      const tem = a.caracteristicas.includes(c);
      // "comum" exclui as demais: regra do back-end (`Carga.__post_init__`); o formulário a aplica na escolha.
      const proximas = tem
        ? a.caracteristicas.filter((x) => x !== c)
        : c === "comum"
          ? ["comum" as const]
          : [...a.caracteristicas.filter((x) => x !== "comum"), c];
      return { ...a, caracteristicas: proximas };
    });

  const etapaPendente = etapaLonga(estadoInicial(false, false));
  const etapaRegular = etapaLonga(estadoInicial(true, d.exige_inspecao));
  const etapaInicial = d.documentacao_regular ? etapaRegular : etapaPendente;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setTentou(true);
    setErroGeral(null);
    if (Object.keys(erros).length) {
      const primeiro = ORDEM_CAMPOS.find((c) => erros[c]);
      formRef.current?.querySelector<HTMLElement>(`[data-campo="${primeiro}"]`)?.focus();
      return;
    }
    setEnviando(true);
    try {
      const dados: NovaOperacao = {
        nome_motorista: d.nome_motorista,
        documento_motorista: d.documento_motorista,
        placa: d.placa,
        transportadora: d.transportadora,
        descricao_carga: d.descricao_carga,
        caracteristicas: d.caracteristicas,
        tipo: d.tipo as TipoOperacao,
        documentacao_regular: d.documentacao_regular,
        exige_inspecao: d.documentacao_regular && d.exige_inspecao,
      };
      const r = executar({ tipo: "criar-operacao", dados });
      const placa = normalizarPlaca(d.placa);
      avisar("sucesso", `${r.mensagem} Etapa: ${etapaInicial}.`, {
        rotulo: "Abrir caminhão",
        href: montarHref("/fila", { caminhao: placa }),
      });
      router.push(FECHAR, { scroll: false });
    } catch (x) {
      setEnviando(false);
      setErroGeral(x instanceof ErroDeDominio ? x.message : "Não foi possível registrar a chegada. Tente novamente.");
    }
  }

  return (
    <ContextPanel rotulo="Registrar chegada" fecharHref={FECHAR} fecharComEsc={!sujo}>
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-t1">Registrar chegada</h2>
        <p className="text-sm text-t2">
          Informe os dados do caminhão. A data e a hora da chegada são registradas automaticamente.
        </p>
      </header>

      {erroGeral && (
        <div role="alert">
          <Erro>{erroGeral}</Erro>
        </div>
      )}

      <form ref={formRef} id={formId} noValidate onSubmit={enviar} className="flex flex-1 flex-col gap-4">
        <CampoTexto
          rotulo="Placa"
          placeholder="AAA-1A23"
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase"
          {...campoTexto("placa")}
          onBlur={aoSairDaPlaca}
        />
        {conhecido && (
          <p className="-mt-2 flex items-start gap-1.5 rounded-ds-lg bg-selected px-3 py-2 text-xs text-t1">
            <Info className="mt-px size-3.5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              Caminhão já cadastrado ({conhecido.motorista.nome}, {conhecido.transportadora.nome}). O cadastro
              existente é mantido.
            </span>
          </p>
        )}
        <CampoTexto rotulo="Motorista" autoComplete="off" {...campoTexto("nome_motorista")} />
        <CampoTexto rotulo="Documento do motorista" placeholder="CPF ou CNH" autoComplete="off" {...campoTexto("documento_motorista")} />
        <CampoTexto rotulo="Transportadora" autoComplete="off" {...campoTexto("transportadora")} />

        <GrupoEscolha legenda="Operação" erro={erroDe("tipo")} className="sm:flex-row sm:[&>*]:flex-1">
          {(["descarga", "carga"] as const).map((t, i) => (
            <Escolha
              key={t}
              tipo="radio"
              name={`${formId}-tipo`}
              rotulo={t === "carga" ? "Carga" : "Descarga"}
              checked={d.tipo === t}
              onChange={() => set("tipo", t)}
              onBlur={() => tocar("tipo")}
              data-campo={i === 0 ? "tipo" : undefined}
            />
          ))}
        </GrupoEscolha>

        <CampoTexto
          rotulo="Descrição da carga"
          placeholder="Ex.: Paletes de bebidas"
          autoComplete="off"
          {...campoTexto("descricao_carga")}
        />

        <GrupoEscolha legenda="Características da carga" erro={erroDe("caracteristicas")}>
          {CARACTERISTICAS.map((c, i) => {
            const peso = estado?.politica.pesos[c];
            return (
              <Escolha
                key={c}
                tipo="checkbox"
                rotulo={rotuloCaracteristica(c)}
                lateral={peso ? `+${peso} pts` : undefined}
                checked={d.caracteristicas.includes(c)}
                onChange={() => alternarCaracteristica(c)}
                onBlur={() => tocar("caracteristicas")}
                data-campo={i === 0 ? "caracteristicas" : undefined}
              />
            );
          })}
        </GrupoEscolha>

        <GrupoEscolha legenda="Documentação">
          <Escolha
            tipo="radio"
            name={`${formId}-doc`}
            rotulo="A conferir na recepção"
            descricao={`Segue para ${etapaPendente.toLowerCase()}.`}
            checked={!d.documentacao_regular}
            onChange={() => setD((a) => ({ ...a, documentacao_regular: false, exige_inspecao: false }))}
          />
          <Escolha
            tipo="radio"
            name={`${formId}-doc`}
            rotulo="Já conferida e regular"
            descricao={`Segue para ${etapaRegular.toLowerCase()}.`}
            checked={d.documentacao_regular}
            onChange={() => set("documentacao_regular", true)}
          />
          {d.documentacao_regular && (
            <Escolha
              tipo="checkbox"
              rotulo="Exige inspeção"
              descricao="O caminhão passa pela inspeção antes de entrar."
              checked={d.exige_inspecao}
              onChange={(e) => set("exige_inspecao", e.target.checked)}
            />
          )}
        </GrupoEscolha>

        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-3">
          <dl className="flex flex-col gap-0.5 text-xs text-t2">
            <div className="flex justify-between gap-3">
              <dt>Etapa inicial</dt>
              <dd className="font-medium text-t1">{etapaInicial}</dd>
            </div>
            {responsavel && (
              <div className="flex justify-between gap-3">
                <dt>Registrado por</dt>
                <dd className="font-medium text-t1">
                  {responsavel.nome} · {ROTULO_FUNCAO[responsavel.funcao]}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <BotaoAcao variante="ghost" tamanho="lg" onClick={() => router.push(FECHAR, { scroll: false })}>
              Cancelar
            </BotaoAcao>
            <BotaoAcao type="submit" variante="primary" tamanho="lg" disabled={enviando || !estado}>
              {enviando ? "Registrando…" : "Registrar chegada"}
            </BotaoAcao>
          </div>
        </div>
      </form>
    </ContextPanel>
  );
}
