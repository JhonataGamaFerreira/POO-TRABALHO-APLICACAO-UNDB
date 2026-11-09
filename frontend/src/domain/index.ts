/**
 * Motor de domínio do front-end (espelho do back-end; ver `tipos.ts`).
 * Ponto único de importação para store e telas.
 */
export * from "./tipos";
export * from "./regras";
export * from "./derivados";
export { executar, responsavelPara, novoIdPadrao } from "./acoes";
export { verificarInvariantes, type Violacao } from "./invariantes";
