/** Avisos de resultado de ações (sucesso e erro). Estado só de interface; não é persistido. */
export interface Aviso {
  id: number;
  tipo: "sucesso" | "erro";
  texto: string;
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

export function avisar(tipo: Aviso["tipo"], texto: string) {
  const id = proximoId++;
  lista = [...lista.slice(-3), { id, tipo, texto }];
  emitir();
  // Sucesso some sozinho; erro permanece mais tempo para dar chance de leitura.
  setTimeout(() => fecharAviso(id), tipo === "sucesso" ? 5_000 : 10_000);
}
