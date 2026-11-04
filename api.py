"""API REST do terminal. Os repositórios em memória são reiniciados ao parar o processo."""
from __future__ import annotations

from dataclasses import fields, is_dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from main import (
    AlocadorDeRecursos, Area, Carga, Caminhao, CaracteristicaCarga, Doca,
    Equipamento, ErroDeDominio, EstadoCaminhao, EstadoRecurso,
    FabricaOperacao, FilaAtendimento, FuncaoFuncionario, Funcionario,
    Motorista, Operacao, PoliticaFila, ServicoDominioTerminal,
    TipoOperacao, Transportadora, Vaga,
)

app = FastAPI(
    title="API do Terminal Portuário",
    description="API REST em memória; os dados são apagados ao reiniciar o processo.",
    version="1.0.0",
)


class RepositorioEmMemoria:
    """Armazenamento temporário para desenvolvimento sem banco de dados."""

    def __init__(self) -> None:
        self.operacoes: dict[UUID, Operacao] = {}
        self.areas: dict[UUID, Area] = {}
        self.vagas: dict[UUID, Vaga] = {}
        self.docas: dict[UUID, Doca] = {}
        self.equipamentos: dict[UUID, Equipamento] = {}
        self.funcionarios: dict[UUID, Funcionario] = {}


repositorio = RepositorioEmMemoria()
servico = ServicoDominioTerminal(AlocadorDeRecursos())


class OperacaoEntrada(BaseModel):
    nome_motorista: str = Field(min_length=1)
    documento_motorista: str = Field(min_length=1)
    placa: str = Field(min_length=1)
    transportadora: str = Field(min_length=1)
    descricao_carga: str = Field(min_length=1)
    caracteristicas: list[CaracteristicaCarga] = Field(min_length=1)
    tipo: TipoOperacao
    documentacao_regular: bool = False
    exige_inspecao: bool = False
    chegada_em: datetime | None = None


class AreaEntrada(BaseModel):
    nome: str = Field(min_length=1)
    autorizada_carga_perigosa: bool = False
    refrigerada: bool = False
    interditada: bool = False
    quantidade_vagas: int = Field(default=0, ge=0)
    quantidade_docas: int = Field(default=0, ge=0)


class DocaEntrada(BaseModel):
    area_id: UUID
    tipo: TipoOperacao | None = None


class EquipamentoEntrada(BaseModel):
    nome: str = Field(min_length=1)
    tipos_compativeis: list[TipoOperacao] = Field(min_length=1)
    aceita_carga_fragil: bool = False


class FuncionarioEntrada(BaseModel):
    nome: str = Field(min_length=1)
    funcao: str
    habilitacoes: set[str] = Field(default_factory=set)


class DocumentacaoEntrada(BaseModel):
    regular: bool
    responsavel_id: UUID


class InspecaoEntrada(BaseModel):
    resultado: str = Field(min_length=1)
    aprovado: bool
    responsavel_id: UUID


class EntradaPatio(BaseModel):
    vaga_id: UUID
    responsavel_id: UUID


class AcaoFuncionario(BaseModel):
    responsavel_id: UUID


class InterrupcaoEntrada(BaseModel):
    descricao: str = Field(min_length=1)
    responsavel_id: UUID
    equipamento_quebrado: bool = False


class CancelamentoEntrada(BaseModel):
    motivo: str = Field(min_length=1)
    responsavel_id: UUID


class PoliticaFilaEntrada(BaseModel):
    pesos: dict[CaracteristicaCarga, float] = Field(default_factory=lambda: {
        CaracteristicaCarga.PRIORITARIA: 100,
        CaracteristicaCarga.PERIGOSA: 50,
        CaracteristicaCarga.REFRIGERADA: 30,
        CaracteristicaCarga.FRAGIL: 20,
    })
    bonus_por_minuto: float = 0.5


def serializar(valor: Any) -> Any:
    if isinstance(valor, Operacao):
        return {
            "id": serializar(valor.id),
            "caminhao": serializar(valor.caminhao),
            "carga": serializar(valor.carga),
            "tipo": serializar(valor.tipo),
            "chegada_em": serializar(valor.chegada_em),
            "estado": serializar(valor.estado),
            "documentacao_regular": valor.documentacao_regular,
            "vaga": serializar(valor.vaga),
            "doca": serializar(valor.doca),
            "equipamento": serializar(valor.equipamento),
            "funcionario_responsavel_id": serializar(valor.funcionario_responsavel_id),
            "iniciada_em": serializar(valor.iniciada_em),
            "finalizada_em": serializar(valor.finalizada_em),
            "cancelada": valor.cancelada,
            "motivo_cancelamento": valor.motivo_cancelamento,
            "historico": serializar(valor.historico),
            "ocorrencias": serializar(valor.ocorrencias),
            "inspecoes": serializar(valor.inspecoes),
        }
    if isinstance(valor, UUID):
        return str(valor)
    if isinstance(valor, datetime):
        return valor.isoformat()
    if isinstance(valor, Enum):
        return valor.value if isinstance(valor.value, str) else valor.name
    if is_dataclass(valor):
        return {item.name: serializar(getattr(valor, item.name))
                for item in fields(valor) if not item.name.startswith("_")}
    if isinstance(valor, dict):
        return {str(serializar(chave)): serializar(item) for chave, item in valor.items()}
    if isinstance(valor, (list, tuple, set, frozenset)):
        return [serializar(item) for item in valor]
    return valor


def obter_operacao(operacao_id: UUID) -> Operacao:
    operacao = repositorio.operacoes.get(operacao_id)
    if operacao is None:
        raise HTTPException(status_code=404, detail="Operação não encontrada.")
    return operacao


def obter_funcionario(funcionario_id: UUID) -> Funcionario:
    funcionario = repositorio.funcionarios.get(funcionario_id)
    if funcionario is None:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado.")
    return funcionario


def obter_area(area_id: UUID) -> Area:
    area = repositorio.areas.get(area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Área não encontrada.")
    return area


def validar_recurso_id(recurso_id: UUID, recursos: dict, nome: str):
    recurso = recursos.get(recurso_id)
    if recurso is None:
        raise HTTPException(status_code=404, detail=f"{nome} não encontrado.")
    return recurso


@app.exception_handler(ErroDeDominio)
async def erro_de_dominio_handler(_request, exc: ErroDeDominio):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(ValueError)
async def erro_de_validacao_de_dominio_handler(_request, exc: ValueError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok", "armazenamento": "memoria"}


@app.post("/api/areas", status_code=201)
def criar_area(dados: AreaEntrada):
    area = Area(uuid4(), dados.nome.strip(), dados.autorizada_carga_perigosa,
                dados.refrigerada, dados.interditada)
    repositorio.areas[area.id] = area
    for _ in range(dados.quantidade_vagas):
        vaga = Vaga(uuid4(), area)
        repositorio.vagas[vaga.id] = vaga
    for _ in range(dados.quantidade_docas):
        doca = Doca(uuid4(), area)
        repositorio.docas[doca.id] = doca
    return {"area": serializar(area),
            "vagas": [serializar(v) for v in repositorio.vagas.values() if v.area.id == area.id],
            "docas": [serializar(d) for d in repositorio.docas.values() if d.area.id == area.id]}


@app.get("/api/areas")
def listar_areas():
    return [serializar(area) for area in repositorio.areas.values()]


@app.post("/api/docks", status_code=201)
def criar_doca(dados: DocaEntrada):
    doca = Doca(uuid4(), obter_area(dados.area_id), dados.tipo)
    repositorio.docas[doca.id] = doca
    return serializar(doca)


@app.post("/api/equipment", status_code=201)
def criar_equipamento(dados: EquipamentoEntrada):
    equipamento = Equipamento(uuid4(), dados.nome.strip(), frozenset(dados.tipos_compativeis),
                              dados.aceita_carga_fragil)
    repositorio.equipamentos[equipamento.id] = equipamento
    return serializar(equipamento)


@app.get("/api/resources")
def listar_recursos():
    return {"vagas": [serializar(v) for v in repositorio.vagas.values()],
            "docas": [serializar(d) for d in repositorio.docas.values()],
            "equipamentos": [serializar(e) for e in repositorio.equipamentos.values()]}


@app.post("/api/employees", status_code=201)
def criar_funcionario(dados: FuncionarioEntrada):
    try:
        funcao = FuncaoFuncionario[dados.funcao.strip().upper()]
    except KeyError:
        opcoes = ", ".join(funcao.name for funcao in FuncaoFuncionario)
        raise HTTPException(status_code=422, detail=f"Função inválida. Use: {opcoes}.")
    funcionario = Funcionario(uuid4(), dados.nome.strip(), funcao,
                              frozenset(h.strip().lower() for h in dados.habilitacoes))
    if not funcionario.nome:
        raise HTTPException(status_code=422, detail="Nome do funcionário é obrigatório.")
    repositorio.funcionarios[funcionario.id] = funcionario
    return serializar(funcionario)


@app.get("/api/employees")
def listar_funcionarios():
    return [serializar(f) for f in repositorio.funcionarios.values()]


@app.post("/api/operations", status_code=201)
def criar_operacao(dados: OperacaoEntrada):
    motorista = Motorista(uuid4(), dados.nome_motorista.strip(), dados.documento_motorista.strip())
    transportadora = Transportadora(uuid4(), dados.transportadora.strip())
    caminhao = Caminhao(uuid4(), dados.placa, motorista, transportadora)
    carga = Carga(dados.descricao_carga.strip(), frozenset(dados.caracteristicas))
    operacao = FabricaOperacao.criar(caminhao, carga, dados.tipo,
                                     dados.documentacao_regular, dados.exige_inspecao,
                                     dados.chegada_em)
    repositorio.operacoes[operacao.id] = operacao
    return serializar(operacao)


@app.get("/api/operations")
def listar_operacoes():
    return [serializar(op) for op in repositorio.operacoes.values()]


@app.get("/api/operations/{operacao_id}")
def detalhar_operacao(operacao_id: UUID):
    return serializar(obter_operacao(operacao_id))


@app.post("/api/operations/{operacao_id}/documentation")
def validar_documentacao(operacao_id: UUID, dados: DocumentacaoEntrada):
    obter_operacao(operacao_id).validar_documentacao(dados.regular,
                                                     obter_funcionario(dados.responsavel_id))
    return serializar(obter_operacao(operacao_id))


@app.post("/api/operations/{operacao_id}/inspections")
def registrar_inspecao(operacao_id: UUID, dados: InspecaoEntrada):
    operacao = obter_operacao(operacao_id)
    operacao.registrar_inspecao(dados.resultado, obter_funcionario(dados.responsavel_id),
                                dados.aprovado)
    return serializar(operacao)


@app.post("/api/operations/{operacao_id}/yard-entry")
def autorizar_entrada(operacao_id: UUID, dados: EntradaPatio):
    operacao = obter_operacao(operacao_id)
    vaga = validar_recurso_id(dados.vaga_id, repositorio.vagas, "Vaga")
    servico.autorizar_entrada(operacao, vaga, obter_funcionario(dados.responsavel_id))
    return serializar(operacao)


@app.post("/api/operations/{operacao_id}/start")
def iniciar_operacao(operacao_id: UUID, dados: AcaoFuncionario):
    operacao = obter_operacao(operacao_id)
    iniciou = servico.iniciar_operacao(
        operacao, list(repositorio.vagas.values()), list(repositorio.docas.values()),
        list(repositorio.equipamentos.values()), obter_funcionario(dados.responsavel_id),
    )
    return {"iniciada": iniciou, "operacao": serializar(operacao)}


@app.post("/api/operations/{operacao_id}/interrupt")
def interromper_operacao(operacao_id: UUID, dados: InterrupcaoEntrada):
    operacao = obter_operacao(operacao_id)
    operacao.interromper(dados.descricao, obter_funcionario(dados.responsavel_id),
                         dados.equipamento_quebrado)
    return serializar(operacao)


@app.post("/api/operations/{operacao_id}/cancel")
def cancelar_operacao(operacao_id: UUID, dados: CancelamentoEntrada):
    operacao = obter_operacao(operacao_id)
    operacao.cancelar(dados.motivo, obter_funcionario(dados.responsavel_id))
    return serializar(operacao)


@app.post("/api/operations/{operacao_id}/finish")
def finalizar_operacao(operacao_id: UUID, dados: AcaoFuncionario):
    operacao = obter_operacao(operacao_id)
    servico.finalizar_operacao(operacao, obter_funcionario(dados.responsavel_id))
    return serializar(operacao)


@app.post("/api/operations/{operacao_id}/release")
def liberar_caminhao(operacao_id: UUID, dados: AcaoFuncionario):
    operacao = obter_operacao(operacao_id)
    servico.liberar_caminhao(operacao, obter_funcionario(dados.responsavel_id))
    return serializar(operacao)


@app.get("/api/queue")
def listar_fila(bonus_por_minuto: float = 0.5):
    politica = PoliticaFila({
        CaracteristicaCarga.PRIORITARIA: 100,
        CaracteristicaCarga.PERIGOSA: 50,
        CaracteristicaCarga.REFRIGERADA: 30,
        CaracteristicaCarga.FRAGIL: 20,
    }, bonus_por_minuto)
    fila = FilaAtendimento(politica).ordenar(repositorio.operacoes.values())
    return [serializar(item) for item in fila]


@app.get("/api/dashboard")
def painel():
    operacoes = list(repositorio.operacoes.values())
    return {
        "total_operacoes": len(operacoes),
        "por_estado": {estado.name: sum(op.estado is estado for op in operacoes)
                       for estado in EstadoCaminhao},
        "recursos": {
            "vagas": {estado.name: sum(v.estado is estado for v in repositorio.vagas.values())
                      for estado in EstadoRecurso},
            "docas": {estado.name: sum(d.estado is estado for d in repositorio.docas.values())
                      for estado in EstadoRecurso},
            "equipamentos": {estado.name: sum(e.estado is estado for e in repositorio.equipamentos.values())
                             for estado in EstadoRecurso},
        },
    }
