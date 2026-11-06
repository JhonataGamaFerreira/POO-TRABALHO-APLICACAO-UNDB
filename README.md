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

## 🚀 API REST (armazenamento em memória)

Atualmente a API permite experimentar o fluxo do domínio sem configurar banco de dados. Os registros ficam apenas na memória do processo e são apagados quando o servidor é encerrado. O repositório em memória pode ser substituído por SQLite/PostgreSQL posteriormente sem mudar os modelos de entrada da API.

### Iniciar localmente

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --reload
```

Documentação interativa: http://127.0.0.1:8000/docs

### Endpoints disponíveis

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/health` | Verifica a API |
| POST, GET | `/api/areas` | Cria e lista áreas; ao criar, também pode gerar vagas e docas |
| POST | `/api/docks` | Cadastra uma doca adicional |
| POST | `/api/equipment` | Cadastra equipamento |
| GET | `/api/resources` | Lista vagas, docas e equipamentos |
| POST, GET | `/api/employees` | Cadastra e lista funcionários |
| POST, GET | `/api/operations` | Registra e lista operações |
| GET | `/api/operations/{id}` | Consulta uma operação, incluindo histórico e ocorrências |
| POST, GET | `/api/trucks` | Cadastra e lista caminhões |
| GET | `/api/trucks/{placa}` | Busca caminhão e seu histórico de operações |
| POST | `/api/operations/{id}/documentation` | Valida documentação |
| POST | `/api/operations/{id}/inspections` | Registra inspeção |
| POST | `/api/operations/{id}/yard-entry` | Autoriza entrada no pátio e reserva vaga |
| POST | `/api/operations/{id}/start` | Aloca recursos e inicia operação |
| POST | `/api/operations/{id}/interrupt` | Registra interrupção |
| POST | `/api/operations/{id}/cancel` | Cancela uma operação |
| POST | `/api/operations/{id}/finish` | Finaliza operação |
| POST | `/api/operations/{id}/release` | Libera caminhão |
| GET | `/api/occurrences` | Lista ocorrências; aceita filtro `?estado=ABERTA` ou `RESOLVIDA` |
| POST | `/api/occurrences/{id}/resolve` | Resolve ocorrência (supervisor ou administrador) |
| GET | `/api/queue` | Consulta fila priorizada |
| PUT | `/api/queue/policy` | Configura pesos da fila (supervisor ou administrador) |
| GET | `/api/dashboard` | Resume estados das operações e recursos |
| GET | `/api/reports/timings` | Calcula médias de espera, operação e tempo por etapa |

As respostas das operações incluem `acoes_permitidas`; o front-end pode exibir os controles sem duplicar a máquina de estados. A fila é ordenada pelo algoritmo (sem reordenação manual), inclui caminhões em `NO_PATIO`, placa, carga e fatores estruturados. O bônus de espera precisa ser positivo para evitar que a fila pare de envelhecer. A ocorrência mantém os estados `ABERTA` e `RESOLVIDA`, com severidade, impacto e recurso afetado opcionais. A categoria "caminhão com problema" não foi adicionada como oitavo tipo: sem o PDF para confirmar o significado, ela permanece representada pelos tipos de ocorrência já previstos.

Áreas podem ser interditadas por `PATCH /api/areas/{id}` e vagas, docas e equipamentos podem ser colocados/retirados de manutenção por `PATCH /api/resources/{tipo}/{id}/maintenance`. Essas mudanças exigem um funcionário supervisor ou administrador. A API aceita CORS de `http://localhost:3000` e `http://127.0.0.1:3000` para o front-end local.

Os endpoints de ação recebem `responsavel_id`. Crie primeiro o funcionário, a área com recursos e o equipamento; a resposta da criação fornece os IDs necessários para as próximas chamadas. A função aceita os nomes `RECEPCAO`, `INSPETOR`, `OPERADOR`, `SUPERVISOR` ou `ADMINISTRADOR`; as habilitações do operador são `carga` e/ou `descarga`.
# Requisitos do sistema: terminal portuário de caminhões


## Requisitos funcionais

**RF01 – Recepção e triagem**
- Registrar a chegada do caminhão com motorista, caminhão, transportadora, carga e tipo de operação (carga ou descarga).
- Validar a documentação.
- Encaminhar o caminhão para inspeção quando necessário.

**RF02 – Fila de atendimento**
- Priorizar os caminhões pelo tipo de carga.
- Controlar o tempo de espera, para que nenhum caminhão espere indefinidamente.
- Calcular a posição na fila pela prioridade da carga mais um bônus pelo tempo de espera, de modo que um caminhão antigo possa ultrapassar um prioritário recente.

**RF03 – Alocação de recursos**
- Alocar vagas, docas e equipamentos compatíveis com a carga.
- Iniciar a operação somente quando houver, ao mesmo tempo, vaga ou doca, equipamento compatível e funcionário habilitado.

**RF04 – Gestão de funcionários**
- Restringir as operações que cada função pode executar.
- Registrar quem realizou cada operação.

**RF05 – Ciclo de vida do caminhão**
- Controlar os estados: Aguardando Documentação → Aguardando Inspeção → Aguardando Entrada → No Pátio → Aguardando Recurso → Em Operação → Aguardando Liberação → Finalizado.
- Tratar interrupções no meio do caminho, como quebra de equipamento ou irregularidade na documentação. Elas geram uma ocorrência e fazem o caminhão voltar ao estado adequado.

**RF06 – Ocorrências**
- Registrar ocorrências e vinculá-las à operação.
- Tipos previstos: equipamento quebrado, documentação irregular, carga divergente, acidente, área interditada, atraso e cancelamento.

**RF07 – Histórico**
- Manter uma linha do tempo completa de cada caminhão ou operação.
- Nunca sobrescrever ou apagar estados anteriores.

**RF08 – Painel do terminal**
- Mostrar em tempo real o pátio, as docas e os equipamentos.
- Exibir os caminhões no terminal, em operação, aguardando, em inspeção e finalizados no dia.

**RF09 – Relatórios**
- Caminhões atendidos.
- Tempo médio de espera e de operação.
- Cargas por tipo.
- Operações canceladas.
- Equipamentos mais utilizados.
- Períodos de maior movimento.
- Caminhões que mais esperaram.
- Quantidade de ocorrências.
- Produtividade por operação.

**RF10 – Configuração da capacidade**
- Permitir configurar as quantidades de recursos. O exemplo do README é 3 empilhadeiras, 2 guindastes, 4 docas e 20 vagas.

## Regras de negócio

| Tipo de carga | Regra |
|---|---|
| Comum | Sem restrições |
| Frágil | Exige equipamento específico |
| Refrigerada | Não pode esperar indefinidamente em área sem refrigeração |
| Perigosa | Só vai para áreas autorizadas |
| Prioritária | Pode alterar a ordem de atendimento |

- Uma carga pode combinar características, por exemplo refrigerada e prioritária.
- As regras de negócio ficam no domínio, não nas rotas nem no front-end.
- O sistema deve tomar decisões com base nas regras e não ser apenas um CRUD de caminhões.

## Telas

1. Painel do terminal
2. Pátio (vagas livres, ocupadas ou em manutenção)
3. Docas (carga, descarga ou livre)
4. Equipamentos (ocupado, disponível ou em manutenção)
5. Fila de atendimento
6. Registro de chegada
7. Histórico do caminhão (linha do tempo)
8. Ocorrências
9. Relatórios

## Requisitos não funcionais e técnicos

**Arquitetura em camadas:** Front-end → API → Serviços → Domínio → Repositórios → Banco.

**Tecnologias:**
- Front-end: Next.js, React, TypeScript, Tailwind CSS e shadcn/ui.
- Back-end: Python com FastAPI ou Flask.
- Banco de dados: SQLite ou PostgreSQL.

**Padrões de projeto exigidos:**

| Padrão | Aplicação |
|---|---|
| State | Ciclo de vida do caminhão e da operação |
| Strategy | Política de priorização da fila |
| Decorator | Combinação de características da carga |
| Facade | Ponto único para os casos de uso |
| Composite | Terminal → Áreas → Vagas/Docas |
| Proxy | Controle de acesso por função, com registro do responsável |
| Observer | Mudanças de estado e ocorrências geram eventos de histórico |
| Factory | Criação de cargas, operações e ocorrências conforme o tipo |
| Repository | Isolamento do acesso ao banco |

**Persistência:**
- Tabelas previstas: `transportadora`, `motorista`, `caminhao`, `carga`, `operacao`, `documentacao`, `inspecao`, `area`, `vaga`, `doca`, `equipamento`, `funcionario`, `operacao_equipamento`, `operacao_funcionario`, `ocorrencia` e `historico_evento`.
- A tabela `historico_evento` aceita apenas inserções (append-only).
- O estado atual fica em `operacao.estado`.

**Qualidade:** o domínio em Python deve ter testes, e a documentação e os testes finais fazem parte do plano.

**Rastreabilidade:** toda ação deve ser auditável (quem fez, quando e o que mudou), para resolver a perda de informação das planilhas atuais.

## Entidades do domínio

Caminhão, Motorista, Transportadora, Carga, Documentação, Inspeção, Operação, Área, Vaga, Doca, Equipamento, Funcionário, Ocorrência e Evento de Histórico. Caminhão, Operação, Equipamento, Vaga, Doca e Inspeção têm comportamento e estado próprios.



- Jhonata: Back
- Cássia:  Front
- Victor:  Q.A
- Heitor:  DevOps
- Elcio:   TechLead



