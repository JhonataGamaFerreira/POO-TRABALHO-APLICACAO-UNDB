/**
 * Cenários de demonstração disponíveis. Cada um é uma configuração independente,
 * criada do zero a cada vez (nunca guardada nem alterada): restaurar um não
 * toca na definição do outro.
 *
 *  - `mvp`      cenário reduzido (`cenario-mvp.ts`): padrão de um ambiente sem dados salvos;
 *  - `completo` cenário completo (`cenario.ts`): o cenário inicial anterior, sem alterações.
 */
import type { EstadoTerminal } from "@/domain/tipos";
import { criarCenarioInicial } from "./cenario";
import { criarCenarioMvp } from "./cenario-mvp";

export type IdCenario = "mvp" | "completo";

export interface DefinicaoCenario {
  id: IdCenario;
  /** Nome exibido no menu e na confirmação. */
  nome: string;
  /** Tamanho do cenário, para quem escolhe (confere com os dados em `cenarios.test.ts`). */
  resumo: string;
  criar: (agora: Date) => EstadoTerminal;
}

export const CENARIOS: Record<IdCenario, DefinicaoCenario> = {
  mvp: {
    id: "mvp",
    nome: "Cenário de demonstração MVP",
    resumo: "6 caminhões ativos · 8 vagas · 3 docas · 3 equipamentos",
    criar: criarCenarioMvp,
  },
  completo: {
    id: "completo",
    nome: "Cenário completo",
    resumo: "17 caminhões ativos · 18 vagas · 8 docas · 6 equipamentos",
    criar: criarCenarioInicial,
  },
};

/** Cenário carregado quando não há dados salvos. */
export const CENARIO_PADRAO: IdCenario = "mvp";

/** Ordem de apresentação no menu. */
export const ORDEM_CENARIOS: readonly IdCenario[] = ["mvp", "completo"];

export const criarCenario = (id: IdCenario, agora: Date): EstadoTerminal => CENARIOS[id].criar(agora);
