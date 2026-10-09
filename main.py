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


