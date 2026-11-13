/**
 * Validação do registro de chegada (`OperacaoEntrada` / `CaminhaoEntrada`, api.py).
 *
 * REGRAS DO BACKEND (reproduzidas): motorista, documento, placa e transportadora
 * são obrigatórios (`min_length=1`, após `strip`); a descrição da carga é
 * obrigatória; ao menos uma característica deve ser informada. O backend não
 * valida o formato da placa (`Caminhao.__post_init__` só faz `strip().upper()`),
 * então aqui também não: uma placa estrangeira ou fora do padrão é aceita.
 *
 * DECISÕES DO FRONT (não são regras de negócio):
 *  - tamanho máximo dos textos, só para proteger o layout (validação técnica);
 *  - `normalizarPlaca`: remove espaços, põe em maiúsculas e, quando a placa
 *    segue o padrão brasileiro (AAA-1234 ou Mercosul AAA-1A23), coloca o hífen,
 *    que é a grafia do cenário inicial. É só consistência de exibição e de
 *    busca ("abc1d23" e "ABC-1D23" viram o mesmo caminhão); nenhuma placa é
 *    recusada por isso. Quando houver API, o backend precisa receber a placa já
 *    normalizada ou aplicar a mesma normalização, porque ele compara o texto
 *    exatamente como chega.
 */
import type { NovaOperacao } from "./tipos";

export const LIMITES_TEXTO = {
  placa: 12,
  nome_motorista: 80,
  documento_motorista: 30,
  transportadora: 80,
  descricao_carga: 120,
} as const;

/** Padrões brasileiros: AAA-1234 (antigo) e AAA-1A23 (Mercosul), com ou sem hífen. Só orienta a grafia. */
const PLACA_BRASILEIRA = /^([A-Z]{3})-?([0-9][A-Z0-9][0-9]{2})$/;

const semEspacos = (bruta: string) => bruta.replace(/\s+/g, "").toUpperCase();

/** "abc1d23" → "ABC-1D23". Placa fora do padrão brasileiro volta só em maiúsculas e sem espaços. */
export function normalizarPlaca(bruta: string): string {
  const limpa = semEspacos(bruta);
  const m = PLACA_BRASILEIRA.exec(limpa);
  return m ? `${m[1]}-${m[2]}` : limpa;
}

export type CampoNovaOperacao =
  | "nome_motorista"
  | "documento_motorista"
  | "placa"
  | "transportadora"
  | "descricao_carga"
  | "caracteristicas"
  | "tipo";

export type ErrosNovaOperacao = Partial<Record<CampoNovaOperacao, string>>;

const obrigatorio: Record<"placa" | "nome_motorista" | "documento_motorista" | "transportadora" | "descricao_carga", string> = {
  placa: "Informe a placa do caminhão.",
  nome_motorista: "Informe o nome do motorista.",
  documento_motorista: "Informe o documento do motorista.",
  transportadora: "Informe a transportadora.",
  descricao_carga: "Informe a descrição da carga.",
};

/** Ordem em que os campos aparecem no formulário (o primeiro erro é o que a ação reporta). */
export const ORDEM_CAMPOS: readonly CampoNovaOperacao[] = [
  "placa",
  "nome_motorista",
  "documento_motorista",
  "transportadora",
  "tipo",
  "descricao_carga",
  "caracteristicas",
];

/** Erros por campo; objeto vazio quando os dados são válidos. */
export function validarNovaOperacao(d: Omit<NovaOperacao, "tipo"> & { tipo: NovaOperacao["tipo"] | "" }): ErrosNovaOperacao {
  const erros: ErrosNovaOperacao = {};

  for (const campo of ["placa", "nome_motorista", "documento_motorista", "transportadora", "descricao_carga"] as const) {
    const valor = d[campo].trim();
    if (!valor) erros[campo] = obrigatorio[campo];
    else if (valor.length > LIMITES_TEXTO[campo]) {
      erros[campo] = `Use no máximo ${LIMITES_TEXTO[campo]} caracteres.`;
    }
  }

  if (d.tipo !== "carga" && d.tipo !== "descarga") erros.tipo = "Informe se a operação é de carga ou de descarga.";
  if (!d.caracteristicas.length) erros.caracteristicas = "Selecione ao menos uma característica da carga.";
  return erros;
}

/** Primeira mensagem de erro na ordem do formulário, ou `null`. */
export function primeiroErro(erros: ErrosNovaOperacao): string | null {
  for (const campo of ORDEM_CAMPOS) if (erros[campo]) return erros[campo]!;
  return null;
}
