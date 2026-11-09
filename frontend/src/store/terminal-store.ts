/**
 * Fonte única de verdade do front-end.
 *
 * - O estado do terminal (`EstadoTerminal`) vive em um único objeto, persistido
 *   em UMA chave do `localStorage` (versionada). Toda ação passa por `despachar`,
 *   que chama o motor de domínio, grava e notifica as telas.
 * - Hidratação segura: no servidor e na primeira renderização do cliente o
 *   snapshot é `null` (as telas mostram o esqueleto); o `localStorage` só é lido
 *   no navegador, depois da hidratação.
 * - Dados corrompidos ou de versão incompatível nunca travam a abertura: o
 *   conteúdo antigo vai para uma chave de backup e o cenário inicial é recriado.
 * - Mudanças feitas em outra aba chegam pelo evento `storage`.
 * - O relógio é o do navegador. Os horários do estado são absolutos, então o
 *   tempo continua correndo após F5 ou reabertura do navegador.
 */
import {
  ErroDeDominio,
  VERSAO_ESQUEMA,
  executar,
  type Acao,
  type EstadoTerminal,
  type ResultadoAcao,
} from "@/domain";
import { criarCenarioInicial } from "@/mocks/cenario";

export const CHAVE_ESTADO = "terminal-portuario:estado";
export const CHAVE_BACKUP = "terminal-portuario:backup";

interface Registro {
  versao: number;
  salvo_em: string;
  estado: EstadoTerminal;
}

type Ouvinte = () => void;

let estado: EstadoTerminal | null = null;
let iniciado = false;
const ouvintes = new Set<Ouvinte>();
let relogio = 0;
let temporizador: ReturnType<typeof setTimeout> | null = null;
const ouvintesRelogio = new Set<Ouvinte>();

const noNavegador = () => typeof window !== "undefined";

/* ---------- Armazenamento (tudo em try/catch: pode estar bloqueado ou cheio) ---------- */

function ler(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string): boolean {
  try {
    window.localStorage.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

function guardarBackup(bruto: string, motivo: string) {
  gravar(CHAVE_BACKUP, JSON.stringify({ motivo, guardado_em: new Date().toISOString(), conteudo: bruto }));
}

/** Estrutura mínima para aceitar o que veio do armazenamento. */
function estruturaValida(x: unknown): x is EstadoTerminal {
  if (!x || typeof x !== "object") return false;
  const e = x as Partial<EstadoTerminal>;
  return (
    e.versao === VERSAO_ESQUEMA &&
    typeof e.criado_em === "string" &&
    [e.areas, e.vagas, e.docas, e.equipamentos, e.funcionarios, e.operacoes, e.ocorrencias].every(Array.isArray) &&
    !!e.politica &&
    !!e.tempos
  );
}

/** Lê e valida o registro; `null` quando ausente ou inutilizável (e então guarda backup). */
function lerRegistro(): EstadoTerminal | null {
  const bruto = ler(CHAVE_ESTADO);
  if (!bruto) return null;
  try {
    const registro = JSON.parse(bruto) as Partial<Registro>;
    if (registro.versao === VERSAO_ESQUEMA && estruturaValida(registro.estado)) return registro.estado;
    guardarBackup(bruto, "versão incompatível ou estrutura inválida");
  } catch {
    guardarBackup(bruto, "JSON corrompido");
  }
  return null;
}

function persistir() {
  if (!estado) return;
  const registro: Registro = { versao: VERSAO_ESQUEMA, salvo_em: new Date().toISOString(), estado };
  gravar(CHAVE_ESTADO, JSON.stringify(registro));
}

/* ---------- Ciclo de vida ---------- */

function inicializar() {
  if (iniciado || !noNavegador()) return;
  iniciado = true;
  estado = lerRegistro();
  if (!estado) {
    estado = criarCenarioInicial(new Date());
    persistir();
  }
  relogio = Date.now();
  window.addEventListener("storage", aoMudarOutraAba);
  agendarRelogio();
}

function aoMudarOutraAba(ev: StorageEvent) {
  if (ev.key !== CHAVE_ESTADO) return;
  const novo = ev.newValue ? lerRegistro() : null;
  estado = novo ?? criarCenarioInicial(new Date());
  if (!novo) persistir();
  notificar();
}

function notificar() {
  ouvintes.forEach((o) => o());
}

/* ---------- Estado (useSyncExternalStore) ---------- */

export function assinar(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Cliente: carrega do armazenamento na primeira leitura. Servidor/hidratação: ver `snapshotServidor`. */
export function snapshot(): EstadoTerminal | null {
  inicializar();
  return estado;
}

export const snapshotServidor = () => null;

/* ---------- Relógio ---------- */

/** O relógio avança a cada virada de minuto (os tempos de espera têm resolução de minuto). */
function agendarRelogio() {
  if (temporizador || !noNavegador()) return;
  const agora = Date.now();
  const proximo = 60_000 - (agora % 60_000) + 50;
  temporizador = setTimeout(() => {
    temporizador = null;
    atualizarRelogio();
    agendarRelogio();
  }, proximo);
}

export function atualizarRelogio() {
  relogio = Date.now();
  ouvintesRelogio.forEach((o) => o());
}

export function assinarRelogio(ouvinte: Ouvinte) {
  ouvintesRelogio.add(ouvinte);
  return () => ouvintesRelogio.delete(ouvinte);
}

export function snapshotRelogio(): number {
  inicializar();
  return relogio;
}

export const snapshotRelogioServidor = () => 0;

/* ---------- Ações ---------- */

/**
 * Executa uma ação do domínio. Em caso de violação de regra lança `ErroDeDominio`
 * e o estado permanece como estava. Em caso de sucesso grava e notifica as telas.
 */
export function despachar(acao: Acao): ResultadoAcao {
  inicializar();
  if (!estado) throw new ErroDeDominio("O terminal ainda não foi carregado.");
  const agora = new Date();
  const { estado: novo, resultado } = executar(estado, acao, {
    agora,
    novoId: () => globalThis.crypto.randomUUID(),
  });
  estado = novo;
  persistir();
  atualizarRelogio();
  notificar();
  return resultado;
}

/**
 * Restaura o cenário inicial usando data e hora reais do computador. O estado
 * anterior fica guardado na chave de backup (recuperável pelo console, sem
 * aparecer na interface).
 */
export function restaurarCenario() {
  inicializar();
  const anterior = ler(CHAVE_ESTADO);
  if (anterior) guardarBackup(anterior, "restauração manual do cenário");
  estado = criarCenarioInicial(new Date());
  persistir();
  atualizarRelogio();
  notificar();
}
