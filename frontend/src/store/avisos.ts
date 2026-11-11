/**
 * Avisos de resultado de ações. Estado só de interface; não é persistido.
 * `atencao` é a ação que deu certo mas deixou uma pendência (ex.: documentação irregular).
 */
export interface Aviso {
  id: number;
  tipo: "sucesso" | "atencao" | "erro";
  texto: string;
  /** Atalho opcional para o item afetado (ex.: abrir o caminhão registrado). */
  acao?: { rotulo: string; href: string };
}

type Ouvinte = () => void;

let lista: Aviso[] = [];
let proximoId = 1;
const ouvintes = new Set<Ouvinte>();

const emitir = () => ouvintes.forEach((o) => o());

export function assinarAvisos(o: Ouvinte) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}
export const snapshotAvisos = () => lista;
export const snapshotAvisosServidor = (): Aviso[] => [];

export function fecharAviso(id: number) {
  lista = lista.filter((a) => a.id !== id);
  emitir();
}

export function avisar(tipo: Aviso["tipo"], texto: string, acao?: Aviso["acao"]) {
  const id = proximoId++;
  lista = [...lista.slice(-3), { id, tipo, texto, acao }];
  emitir();
  // Sucesso some sozinho; pendência e erro permanecem mais tempo para dar chance de leitura.
  setTimeout(() => fecharAviso(id), tipo === "sucesso" ? 6_000 : 10_000);
}
