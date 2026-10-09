# PARTE 1 — Tipos e estados

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from uuid import uuid4


def novo_id() -> str:
    return str(uuid4())


class EstadoOperacao(Enum):
    AGUARDANDO_DOCUMENTACAO = "Aguardando Documentação"
    AGUARDANDO_INSPECAO = "Aguardando Inspeção"
    AGUARDANDO_ENTRADA = "Aguardando Entrada"
    NO_PATIO = "No Pátio"
    AGUARDANDO_RECURSO = "Aguardando Recurso"
    EM_OPERACAO = "Em Operação"
    AGUARDANDO_LIBERACAO = "Aguardando Liberação"
    FINALIZADO = "Finalizado"


class TipoOperacao(Enum):
    CARGA = "Carga"
    DESCARGA = "Descarga"


class TipoOcorrencia(Enum):
    EQUIPAMENTO_QUEBRADO = "Equipamento quebrado"
    DOCUMENTACAO_IRREGULAR = "Documentação irregular"
    CARGA_DIVERGENTE = "Carga divergente"
    ACIDENTE = "Acidente"
    AREA_INTERDITADA = "Área interditada"
    ATRASO = "Atraso"
    CANCELAMENTO = "Cancelamento"


# PARTE 2 — Cadastros e carga

@dataclass
class Transportadora:
    nome: str
    documento: str
    id: str = field(default_factory=novo_id)


@dataclass
class Motorista:
    nome: str
    documento: str
    telefone: str = ""
    id: str = field(default_factory=novo_id)


@dataclass
class Caminhao:
    placa: str
    modelo: str
    capacidade_kg: float
    id: str = field(default_factory=novo_id)


@dataclass
class Carga:
    nome: str
    peso_kg: float
    caracteristicas: set[str] = field(default_factory=set)
    equipamentos_necessarios: set[str] = field(default_factory=set)
    id: str = field(default_factory=novo_id)

    def adicionar_caracteristica(self, caracteristica: str) -> None:
        self.caracteristicas.add(caracteristica)


# PARTE 3 — Funcionários, documentação e inspeção

@dataclass
class Funcionario:
    nome: str
    funcao: str
    habilitacoes: set[str] = field(default_factory=set)
    id: str = field(default_factory=novo_id)

    def esta_habilitado(self, operacao: TipoOperacao) -> bool:
        return operacao.value in self.habilitacoes


@dataclass
class Documentacao:
    documentos: list[str] = field(default_factory=list)
    validada: bool = False
    validada_por: str | None = None
    id: str = field(default_factory=novo_id)

    def validar(self, funcionario: Funcionario) -> None:
        self.validada = True
        self.validada_por = funcionario.id


@dataclass
class Inspecao:
    necessaria: bool = False
    aprovada: bool | None = None
    observacao: str = ""
    inspetor: Funcionario | None = None
    id: str = field(default_factory=novo_id)

    def registrar_resultado(
        self,
        aprovada: bool,
        inspetor: Funcionario,
        observacao: str = "",
    ) -> None:
        self.aprovada = aprovada
        self.inspetor = inspetor
        self.observacao = observacao


# PARTE 4 — Áreas e recursos

@dataclass
class Vaga:
    codigo: str
    ocupada: bool = False
    em_manutencao: bool = False
    id: str = field(default_factory=novo_id)


@dataclass
class Doca:
    codigo: str
    tipos_operacao: set[TipoOperacao] = field(default_factory=set)
    ocupada: bool = False
    id: str = field(default_factory=novo_id)


@dataclass
class Area:
    nome: str
    autorizada_para_carga_perigosa: bool = False
    refrigerada: bool = False
    recursos: list[Area | Vaga | Doca] = field(default_factory=list)
    id: str = field(default_factory=novo_id)

    def adicionar_recurso(self, recurso: Area | Vaga | Doca) -> None:
        self.recursos.append(recurso)


@dataclass
class Equipamento:
    nome: str
    tipo: str
    capacidades: set[str] = field(default_factory=set)
    disponivel: bool = True
    em_manutencao: bool = False
    id: str = field(default_factory=novo_id)


# PARTE 5 — Histórico e ocorrências

@dataclass
class Ocorrencia:
    tipo: TipoOcorrencia
    descricao: str
    responsavel: Funcionario
    criada_em: datetime = field(default_factory=datetime.now)
    id: str = field(default_factory=novo_id)


@dataclass
class EventoHistorico:
    descricao: str
    responsavel: Funcionario
    criado_em: datetime = field(default_factory=datetime.now)
    estado_anterior: EstadoOperacao | None = None
    estado_novo: EstadoOperacao | None = None
    id: str = field(default_factory=novo_id)


# PARTE 6 — Operação

@dataclass
class Operacao:
    caminhao: Caminhao
    motorista: Motorista
    transportadora: Transportadora
    carga: Carga
    tipo: TipoOperacao
    documentacao: Documentacao = field(default_factory=Documentacao)
    inspecao: Inspecao = field(default_factory=Inspecao)
    estado: EstadoOperacao = EstadoOperacao.AGUARDANDO_DOCUMENTACAO
    funcionarios: list[Funcionario] = field(default_factory=list)
    equipamentos: list[Equipamento] = field(default_factory=list)
    ocorrencias: list[Ocorrencia] = field(default_factory=list)
    historico: list[EventoHistorico] = field(default_factory=list)
    criada_em: datetime = field(default_factory=datetime.now)
    id: str = field(default_factory=novo_id)

    def adicionar_funcionario(self, funcionario: Funcionario) -> None:
        self.funcionarios.append(funcionario)

    def adicionar_equipamento(self, equipamento: Equipamento) -> None:
        self.equipamentos.append(equipamento)

    def adicionar_ocorrencia(self, ocorrencia: Ocorrencia) -> None:
        self.ocorrencias.append(ocorrencia)

    def registrar_evento(self, evento: EventoHistorico) -> None:
        self.historico.append(evento)

    def alterar_estado(
        self,
        novo_estado: EstadoOperacao,
        responsavel: Funcionario,
    ) -> None:
        estado_anterior = self.estado
        self.estado = novo_estado
        self.registrar_evento(EventoHistorico(
            descricao=(
                f"Estado alterado de {estado_anterior.value} "
                f"para {novo_estado.value}"
            ),
            responsavel=responsavel,
            estado_anterior=estado_anterior,
            estado_novo=novo_estado,
        ))