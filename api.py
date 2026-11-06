"""API REST do terminal. Os repositórios em memória são reiniciados ao parar o processo."""
from __future__ import annotations

from dataclasses import fields, is_dataclass
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from main import (
    AlocadorDeRecursos, Area, Carga, Caminhao, CaracteristicaCarga, Doca,
    Equipamento, ErroDeDominio, EstadoCaminhao, EstadoOcorrencia, EstadoRecurso,
    FabricaOperacao, FilaAtendimento, FuncaoFuncionario, Funcionario,
    ImpactoOcorrencia, Motorista, Operacao, Ocorrencia, PoliticaFila,
    SeveridadeOcorrencia, ServicoDominioTerminal, TipoOperacao,
    TipoEvento, Transportadora, Vaga,
)

app = FastAPI(
    title="API do Terminal Portuário",
    description="API REST em memória; os dados são apagados ao reiniciar o processo.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RepositorioEmMemoria:
    """Armazenamento temporário para desenvolvimento sem banco de dados."""

    def __init__(self) -> None:
        self.operacoes: dict[UUID, Operacao] = {}
        self.caminhoes: dict[UUID, Caminhao] = {}
        self.areas: dict[UUID, Area] = {}
        self.vagas: dict[UUID, Vaga] = {}
        self.docas: dict[UUID, Doca] = {}
        self.equipamentos: dict[UUID, Equipamento] = {}
        self.funcionarios: dict[UUID, Funcionario] = {}


repositorio = RepositorioEmMemoria()
servico = ServicoDominioTerminal(AlocadorDeRecursos())
politica_fila = PoliticaFila({
    CaracteristicaCarga.PRIORITARIA: 100,
    CaracteristicaCarga.PERIGOSA: 50,
    CaracteristicaCarga.REFRIGERADA: 30,
    CaracteristicaCarga.FRAGIL: 20,
}, 0.5)


class OperacaoEntrada(BaseModel):
    caminhao_id: UUID | None = None
    nome_motorista: str | None = None
    documento_motorista: str | None = None
    placa: str | None = None
    transportadora: str | None = None
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


class CaminhaoEntrada(BaseModel):
    nome_motorista: str = Field(min_length=1)
    documento_motorista: str = Field(min_length=1)
    placa: str = Field(min_length=1)
    transportadora: str = Field(min_length=1)


class AreaAtualizacao(BaseModel):
    interditada: bool
    responsavel_id: UUID


class ManutencaoAtualizacao(BaseModel):
    em_manutencao: bool
    responsavel_id: UUID


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
    severidade: SeveridadeOcorrencia = SeveridadeOcorrencia.MEDIA
    impacto: ImpactoOcorrencia = ImpactoOcorrencia.OPERACAO
    recurso_tipo: str | None = None
    recurso_id: UUID | None = None


class CancelamentoEntrada(BaseModel):
    motivo: str = Field(min_length=1)
    responsavel_id: UUID


class PoliticaFilaEntrada(BaseModel):
    responsavel_id: UUID
    pesos: dict[CaracteristicaCarga, float] = Field(default_factory=lambda: {
        CaracteristicaCarga.PRIORITARIA: 100,
        CaracteristicaCarga.PERIGOSA: 50,
        CaracteristicaCarga.REFRIGERADA: 30,
        CaracteristicaCarga.FRAGIL: 20,
    })
    bonus_por_minuto: float = 0.5


class ResolucaoOcorrenciaEntrada(BaseModel):
    responsavel_id: UUID


def serializar(valor: Any) -> Any:
    if isinstance(valor, Operacao):
        agora = datetime.now().astimezone()
        fim_espera = valor.iniciada_em or agora
        fim_operacao = valor.finalizada_em or agora
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
            "acoes_permitidas": list(valor.acoes_permitidas),
            "tempos_minutos": {
                "espera": round(max(0.0, (fim_espera - valor.chegada_em).total_seconds() / 60), 2),
                "operacao": round(max(0.0, (fim_operacao - valor.iniciada_em).total_seconds() / 60), 2)
                if valor.iniciada_em else 0.0,
            },
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


def exigir_supervisor(funcionario_id: UUID) -> Funcionario:
    funcionario = obter_funcionario(funcionario_id)
    if funcionario.funcao not in {FuncaoFuncionario.SUPERVISOR, FuncaoFuncionario.ADMINISTRADOR}:
        raise HTTPException(status_code=403, detail="Ação reservada à supervisão ou administração.")
    return funcionario


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


@app.patch("/api/areas/{area_id}")
def atualizar_area(area_id: UUID, dados: AreaAtualizacao):
    area = obter_area(area_id)
    exigir_supervisor(dados.responsavel_id)
    if dados.interditada and any(
        recurso.area.id == area_id and recurso.estado is EstadoRecurso.OCUPADO
        for recurso in [*repositorio.vagas.values(), *repositorio.docas.values()]
    ):
        raise HTTPException(status_code=409, detail="Libere os recursos ocupados antes de interditar a área.")
    area.interditada = dados.interditada
    return serializar(area)


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


@app.patch("/api/resources/{tipo}/{recurso_id}/maintenance")
def atualizar_manutencao(tipo: str, recurso_id: UUID, dados: ManutencaoAtualizacao):
    exigir_supervisor(dados.responsavel_id)
    colecoes = {"vaga": repositorio.vagas, "doca": repositorio.docas,
                "equipment": repositorio.equipamentos}
    if tipo not in colecoes:
        raise HTTPException(status_code=404, detail="Tipo de recurso inválido; use vaga, doca ou equipment.")
    recurso = validar_recurso_id(recurso_id, colecoes[tipo], "Recurso")
    if recurso.estado is EstadoRecurso.OCUPADO:
        raise HTTPException(status_code=409, detail="Não é possível alterar manutenção de recurso ocupado.")
    if tipo == "equipment":
        recurso.estado = EstadoRecurso.EM_MANUTENCAO if dados.em_manutencao else EstadoRecurso.DISPONIVEL
    else:
        recurso.estado = EstadoRecurso.EM_MANUTENCAO if dados.em_manutencao else EstadoRecurso.LIVRE
    return serializar(recurso)


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


@app.post("/api/trucks", status_code=201)
def cadastrar_caminhao(dados: CaminhaoEntrada):
    placa = dados.placa.strip().upper()
    if any(c.placa == placa for c in repositorio.caminhoes.values()):
        raise HTTPException(status_code=409, detail="Já existe caminhão cadastrado com essa placa.")
    motorista = Motorista(uuid4(), dados.nome_motorista.strip(), dados.documento_motorista.strip())
    transportadora = Transportadora(uuid4(), dados.transportadora.strip())
    caminhao = Caminhao(uuid4(), placa, motorista, transportadora)
    repositorio.caminhoes[caminhao.id] = caminhao
    return serializar(caminhao)


@app.get("/api/trucks")
def listar_caminhoes():
    return [serializar(c) for c in repositorio.caminhoes.values()]


@app.get("/api/trucks/{placa}")
def buscar_caminhao(placa: str):
    caminhao = next((c for c in repositorio.caminhoes.values()
                     if c.placa == placa.strip().upper()), None)
    if caminhao is None:
        raise HTTPException(status_code=404, detail="Caminhão não encontrado.")
    return {"caminhao": serializar(caminhao),
            "operacoes": [serializar(op) for op in repositorio.operacoes.values()
                          if op.caminhao.id == caminhao.id]}


@app.post("/api/operations", status_code=201)
def criar_operacao(dados: OperacaoEntrada):
    if dados.caminhao_id:
        caminhao = repositorio.caminhoes.get(dados.caminhao_id)
        if caminhao is None:
            raise HTTPException(status_code=404, detail="Caminhão não encontrado.")
    else:
        campos = (dados.nome_motorista, dados.documento_motorista, dados.placa, dados.transportadora)
        if not all(campo and campo.strip() for campo in campos):
            raise HTTPException(status_code=422, detail=(
                "Informe caminhao_id ou os dados de motorista, placa e transportadora."
            ))
        motorista = Motorista(uuid4(), dados.nome_motorista.strip(), dados.documento_motorista.strip())
        transportadora = Transportadora(uuid4(), dados.transportadora.strip())
        caminhao = Caminhao(uuid4(), dados.placa, motorista, transportadora)
        existente = next((c for c in repositorio.caminhoes.values() if c.placa == caminhao.placa), None)
        if existente:
            caminhao = existente
        else:
            repositorio.caminhoes[caminhao.id] = caminhao
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


@app.get("/api/occurrences")
def listar_ocorrencias(estado: str | None = None):
    estado_filtro = None
    if estado:
        try:
            estado_filtro = EstadoOcorrencia[estado.strip().upper()]
        except KeyError:
            raise HTTPException(status_code=422, detail="estado deve ser ABERTA ou RESOLVIDA.")
    resultado = []
    for operacao in repositorio.operacoes.values():
        for ocorrencia in operacao.ocorrencias:
            if estado_filtro is None or ocorrencia.estado is estado_filtro:
                resultado.append({"operacao_id": str(operacao.id), **serializar(ocorrencia)})
    return resultado


@app.get("/api/operations/{operacao_id}/occurrences")
def listar_ocorrencias_operacao(operacao_id: UUID):
    return [serializar(o) for o in obter_operacao(operacao_id).ocorrencias]


@app.post("/api/occurrences/{ocorrencia_id}/resolve")
def resolver_ocorrencia(ocorrencia_id: UUID, dados: ResolucaoOcorrenciaEntrada):
    responsavel = exigir_supervisor(dados.responsavel_id)
    for operacao in repositorio.operacoes.values():
        ocorrencia = next((o for o in operacao.ocorrencias if o.id == ocorrencia_id), None)
        if ocorrencia:
            ocorrencia.resolver(responsavel)
            operacao._registrar_evento(
                TipoEvento.OCORRENCIA, responsavel,
                f"Ocorrência {ocorrencia.id} resolvida.", ocorrencia.resolvida_em,
            )
            return {"operacao_id": str(operacao.id), **serializar(ocorrencia)}
    raise HTTPException(status_code=404, detail="Ocorrência não encontrada.")


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
    if dados.recurso_tipo or dados.recurso_id:
        if not dados.recurso_tipo or not dados.recurso_id:
            raise HTTPException(status_code=422, detail="Informe recurso_tipo e recurso_id juntos.")
        colecoes = {"area": repositorio.areas, "vaga": repositorio.vagas, "doca": repositorio.docas,
                    "equipment": repositorio.equipamentos}
        if dados.recurso_tipo not in colecoes:
            raise HTTPException(status_code=422, detail="recurso_tipo deve ser area, vaga, doca ou equipment.")
        validar_recurso_id(dados.recurso_id, colecoes[dados.recurso_tipo], "Recurso")
    operacao.interromper(dados.descricao, obter_funcionario(dados.responsavel_id),
                         dados.equipamento_quebrado,
                         severidade=dados.severidade, impacto=dados.impacto,
                         recurso_tipo=dados.recurso_tipo, recurso_id=dados.recurso_id)
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
def listar_fila():
    agora = datetime.now().astimezone()
    politica = politica_fila
    fila = FilaAtendimento(politica).ordenar(repositorio.operacoes.values())
    resultado = []
    for item in fila:
        operacao = repositorio.operacoes[item.operacao_id]
        caracteristicas = [
            {"tipo": "caracteristica", "caracteristica": c.value,
             "peso": politica.pesos.get(c, 0.0)}
            for c in sorted(operacao.carga.caracteristicas, key=lambda c: c.value)
        ]
        caracteristicas.append({
            "tipo": "tempo_espera", "minutos": item.espera_minutos,
            "bonus_por_minuto": politica.bonus_por_minuto,
            "pontos": item.espera_minutos * politica.bonus_por_minuto,
        })
        resultado.append({
            "operacao_id": str(item.operacao_id),
            "placa": operacao.caminhao.placa,
            "carga": serializar(operacao.carga),
            "estado": serializar(operacao.estado),
            "posicao": item.posicao,
            "espera_minutos": item.espera_minutos,
            "pontuacao": item.pontuacao,
            "fatores": caracteristicas,
        })
    return resultado


@app.put("/api/queue/policy")
def atualizar_politica_fila(dados: PoliticaFilaEntrada):
    exigir_supervisor(dados.responsavel_id)
    if dados.bonus_por_minuto <= 0 or any(peso < 0 for peso in dados.pesos.values()):
        raise HTTPException(status_code=422, detail="Pesos não podem ser negativos e o bônus por minuto deve ser positivo.")
    global politica_fila
    politica_fila = PoliticaFila(dict(dados.pesos), dados.bonus_por_minuto)
    return {"pesos": serializar(politica_fila.pesos),
            "bonus_por_minuto": politica_fila.bonus_por_minuto}


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


@app.get("/api/reports/timings")
def relatorio_tempos():
    agora = datetime.now().astimezone()
    esperas = []
    duracoes = []
    por_estado: dict[str, list[float]] = {}
    for operacao in repositorio.operacoes.values():
        instante_inicio = operacao.iniciada_em
        fim_espera = instante_inicio or agora
        esperas.append(max(0.0, (fim_espera - operacao.chegada_em).total_seconds() / 60))
        if instante_inicio:
            fim = operacao.finalizada_em or agora
            duracoes.append(max(0.0, (fim - instante_inicio).total_seconds() / 60))
        eventos_estado = [e for e in operacao.historico if e.estado_novo is not None]
        inicio_estado = operacao.chegada_em
        estado_atual = eventos_estado[0].estado_anterior if eventos_estado else operacao.estado
        for evento in eventos_estado:
            if estado_atual is not None:
                por_estado.setdefault(estado_atual.name, []).append(
                    max(0.0, (evento.ocorrido_em - inicio_estado).total_seconds() / 60)
                )
            inicio_estado = evento.ocorrido_em
            estado_atual = evento.estado_novo
        if estado_atual is not None:
            por_estado.setdefault(estado_atual.name, []).append(
                max(0.0, (agora - inicio_estado).total_seconds() / 60)
            )
    media = lambda valores: round(sum(valores) / len(valores), 2) if valores else 0.0
    return {
        "media_espera_minutos": media(esperas),
        "media_operacao_minutos": media(duracoes),
        "media_por_etapa_minutos": {estado: media(valores) for estado, valores in por_estado.items()},
        "amostras": {"espera": len(esperas), "operacao": len(duracoes)},
    }
