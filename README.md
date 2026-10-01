# POO-TRABALHO-APLICACAO-UNDB
TRABALHO PJBL DO PROFESSOR RONDINELI

sujeito a alterações

# 🚛  Sistema para controlar a operação de um terminal portuário que recebe caminhões para carga e descarga de mercadorias, com controle de fila, recursos, funcionários, estados, ocorrências, histórico e relatórios.

---

## 📌 Contexto e problema

O terminal recebe vários caminhões por dia, e cada um chega em uma condição diferente: alguns vêm carregar, outros descarregar, alguns trazem carga perigosa, alguns são prioritários e outros precisam de inspeção antes de entrar.

Hoje o controle é feito por **planilhas e mensagens entre funcionários**, o que causa:

- perda de informação e falta de rastreabilidade;
- fila injusta, já que atender por ordem de chegada não funciona quando há cargas prioritárias e perigosas;
- caminhões esperando indefinidamente;
- recursos limitados (vagas, docas, equipamentos) sem controle centralizado;
- status sobrescrito, sem histórico do que aconteceu;
- falta de registro quando algo dá errado (equipamento quebra, documentação irregular etc.).

**Capacidade do terminal (exemplo):** 3 empilhadeiras, 2 guindastes, 4 docas e 20 vagas. Esses valores serão configuráveis.

---

## 🎯 O que o sistema precisa fazer

**Objetivo:** gerenciar a operação do terminal do momento em que o caminhão chega até a sua liberação, tomando decisões com base nas regras do negócio. Não será apenas um CRUD de caminhões.

1. **Recepção e triagem:** registrar a chegada (motorista, caminhão, transportadora, carga, tipo de operação), validar a documentação e encaminhar para inspeção quando necessário.
2. **Fila inteligente:** priorizar por tipo de carga e controlar o tempo de espera, para que ninguém espere indefinidamente.
3. **Alocação de recursos:** vagas, docas e equipamentos compatíveis com a carga.
4. **Gestão de funcionários:** cada função só executa as operações permitidas, e cada operação registra quem a realizou.
5. **Ciclo de vida do caminhão:** controlar os estados e as interrupções no meio do caminho.
6. **Ocorrências:** registrar e vincular à operação (equipamento quebrado, documentação irregular, carga divergente, acidente, área interditada, atraso, cancelamento).
7. **Histórico:** linha do tempo completa, sem perder estados anteriores.
8. **Painel:** visão do terminal em tempo real (pátio, docas, equipamentos).
9. **Relatórios:** indicadores do dia.

---

## 📐 Regras de negócio

**Tipos de carga**

| Tipo | Regra |
|---|---|
| Comum | Sem restrições |
| Frágil | Exige equipamento específico |
| Refrigerada | Não pode esperar indefinidamente em área sem refrigeração |
| Perigosa | Só vai para áreas autorizadas |
| Prioritária | Pode alterar a ordem de atendimento |

Uma carga pode combinar características (ex.: refrigerada e prioritária).

**Fila:** a posição é definida pela prioridade da carga somada a um bônus pelo tempo de espera. Assim, um caminhão antigo acaba ultrapassando um prioritário recente.

**Recursos:** a operação só começa se houver vaga ou doca, equipamento compatível e funcionário habilitado ao mesmo tempo.

**Estados do caminhão**

```
AGUARDANDO_DOCUMENTAÇÃO → AGUARDANDO_INSPEÇÃO → AGUARDANDO_ENTRADA
→ NO_PÁTIO → AGUARDANDO_RECURSO → EM_OPERAÇÃO
→ AGUARDANDO_LIBERAÇÃO → FINALIZADO
```

Imprevistos, como uma quebra de equipamento durante a operação ou uma irregularidade na documentação, geram uma ocorrência e fazem o caminhão voltar ao estado adequado.

---

## 🔍 Análise do domínio

O cliente não define as classes, então elas foram descobertas a partir do problema.

**Entidades principais:** Caminhão, Motorista, Transportadora, Carga, Documentação, Inspeção, Operação, Área, Vaga, Doca, Equipamento, Funcionário, Ocorrência e Evento de Histórico.

**Com comportamento e estado:** Caminhão, Operação, Equipamento, Vaga, Doca, Inspeção.

**Principais relacionamentos:** uma transportadora tem vários caminhões; um caminhão tem várias operações; uma operação tem uma carga, vários equipamentos e funcionários, várias ocorrências e vários eventos de histórico; uma área contém várias vagas e docas.

---

## 🏛️ Arquitetura

```
Front-end (Next.js + React + TypeScript + Tailwind CSS + shadcn/ui)
        ↓
API / Back-end (Python + FastAPI ou Flask)
        ↓
Serviços (casos de uso)
        ↓
Domínio em POO (regras, estados, fila)
        ↓
Repositórios (SQL)
        ↓
Banco de dados (SQLite / PostgreSQL)
```

| Camada | Responsabilidade |
|---|---|
| Front-end | Painel, formulários e históricos |
| API | Receber requisições e devolver JSON |
| Serviços | Orquestrar casos de uso ("registrar chegada", "iniciar operação") |
| Domínio | Conter as regras de negócio, independente de framework e banco |
| Repositórios | Isolar o SQL |
| Banco | Persistir entidades, histórico e ocorrências |

As regras do terminal ficam no **domínio**, e não nas rotas nem no front-end.

---

## 🧠 Padrões de projeto

| Padrão | Onde será aplicado |
|---|---|
| **State** | Ciclo de vida do caminhão e da operação |
| **Strategy** | Política de priorização da fila |
| **Decorator** | Combinar características da carga (refrigerada, prioritária, perigosa) |
| **Facade** | Ponto único para os casos de uso do terminal |
| **Composite** | Hierarquia Terminal → Áreas → Vagas/Docas |
| **Proxy** | Controle de acesso por função do funcionário, com registro do responsável |
| **Observer** | Mudanças de estado e ocorrências geram eventos de histórico |
| **Factory** | Criação de cargas, operações e ocorrências conforme o tipo |
| **Repository** | Isolar o acesso ao banco |

---

## 🗄️ Banco de dados

Tabelas previstas: `transportadora`, `motorista`, `caminhao`, `carga`, `operacao`, `documentacao`, `inspecao`, `area`, `vaga`, `doca`, `equipamento`, `funcionario`, `operacao_equipamento`, `operacao_funcionario`, `ocorrencia` e `historico_evento`.

A tabela `historico_evento` só recebe inserções. O estado atual fica em `operacao.estado`, mas a história completa nunca é apagada.

---

## 🖥️ Telas

1. Painel do terminal (caminhões no terminal, em operação, aguardando, em inspeção, finalizados hoje)
2. Pátio (vagas livres, ocupadas ou em manutenção)
3. Docas (carga, descarga ou livre)
4. Equipamentos (ocupado, disponível ou em manutenção)
5. Fila de atendimento
6. Registro de chegada
7. Histórico do caminhão (linha do tempo)
8. Ocorrências
9. Relatórios

---

## 📈 Relatórios

- Caminhões atendidos
- Tempo médio de espera e de operação
- Cargas por tipo
- Operações canceladas
- Equipamentos mais utilizados
- Períodos de maior movimento
- Caminhões que mais esperaram
- Quantidade de ocorrências
- Produtividade por operação

---

## 🗓️ Plano de desenvolvimento

1. **Análise e modelagem:** entidades, estados, regras, diagrama de classes e DER
2. **Domínio em Python:** classes, máquina de estados e fila priorizada, com testes
3. **Persistência:** schema SQL, repositórios e histórico
4. **API:** endpoints e integração com os serviços
5. **Front-end:** painel, pátio, docas, equipamentos, fila e histórico
6. **Ocorrências e relatórios**
7. **Testes finais e documentação**

## Equipe

- Jhonata: Back
- Cássia:  Front
- Victor:  Q.A
- Heitor:  DevOps
- Elcio:   TechLead