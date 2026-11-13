# Divergências front-end × back-end (MVP · Etapa 3)

> **Para alinhamento com o responsável pelo back-end (Jhonata).** O front-end do MVP funciona sozinho,
> com o estado em `src/store/` e as regras em `src/domain/`. Onde o comportamento necessário diferiu do back-end,
> o front implementou o comportamento adequado e o ajuste fica registrado aqui. **O back-end não foi alterado.**
>
> Referência do back-end: branch `origin/backend`, commit `b16a874` (`main.py`, `api.py`). O back-end não tem testes
> automatizados; os comportamentos abaixo foram lidos do código.

Rótulos: **Alinhado** (front e back-end já coincidem), **Divergência** (o back-end precisa mudar ou decidir),
**Proposta** (campo/endpoint novo que o front usa e a API não tem). Tipos e payloads de exemplo dos campos propostos
estão em `contrato-api-proposto.md` e `src/types/terminal-proposto.ts`.

## Resumo

| # | Assunto | Situação | Prioridade para integrar |
|---|---|---|---|
| 1 | Iniciar operação (`NO_PATIO → EM_OPERACAO`) | Divergência (bug) | **Bloqueia** a integração |
| 2 | Cancelar operação em andamento | Divergência | Decidir a regra |
| 3 | Prévia de alocação | Proposta | Necessária para a tela |
| 4 | Aguardar recursos | Alinhado | — |
| 5 | Concluir × liberar | Alinhado | — |
| 6 | Interromper operação | Divergência + proposta | Alta |
| 7 | Retomar operação | Proposta | Alta |
| 8 | Resolver ocorrência | Alinhado (texto do evento difere) | Baixa |
| 9 | Manutenção de recursos | Alinhado | — |
| 10 | Interdição de área | Proposta (`motivo_interdicao`) | Média |
| 11 | Responsável pelas ações | Divergência de contrato | Alta |
| 12 | Carga "comum" é exclusiva | Alinhado (correção de nota anterior) | — |

---

## 1. Iniciar operação (`NO_PATIO → EM_OPERACAO`)

- **Funcionalidade no front:** "Iniciar operação" no painel do caminhão (Fila). Mostra antes a vaga, a doca e o equipamento
  que serão usados; se algo falta, informa o motivo.
- **Comportamento no MVP:** `start` reserva vaga, doca e equipamento **somente se o conjunto completo existe** e vai
  direto de `NO_PATIO` para `EM_OPERACAO` (uma única mudança de estado, eventos `ALOCACAO_RECURSO`, `MUDANCA_ESTADO`,
  `OPERACAO_INICIADA`). Se falta qualquer recurso, nada é reservado e a operação passa a `AGUARDANDO_RECURSO`.
- **Back-end hoje:** `AlocadorDeRecursos.alocar_e_iniciar` valida o conjunto e **grava as reservas** (vaga, doca e equipamento
  `OCUPADO`, evento `ALOCACAO_RECURSO`) antes de chamar `_mudar_estado(EM_OPERACAO)`. Em `TRANSICOES`, `NO_PATIO` só permite
  `AGUARDANDO_RECURSO` e `AGUARDANDO_LIBERACAO`; a transição lança `ErroDeDominio` com as reservas já feitas.
  A partir de `AGUARDANDO_RECURSO` funciona.
- **Divergência:** com recursos disponíveis, iniciar uma operação que está em `NO_PATIO` falha e deixa recursos presos a uma
  operação que continua em `NO_PATIO`.
- **Ajuste necessário:** incluir `EM_OPERACAO` nas transições de `NO_PATIO` em `TRANSICOES` (ou passar sempre por
  `AGUARDANDO_RECURSO`). Se mantiver a mudança de estado depois das reservas, desfazê-las em caso de erro.
- **Contrato:** `POST /api/operations/{id}/start` já devolve `{ "iniciada": bool, "operacao": … }`; o front usa o mesmo formato.
  Nenhum endpoint novo para esta parte.

## 2. Cancelar operação em andamento

- **Funcionalidade no front:** "Cancelar operação" (com motivo) nas etapas de triagem, `NO_PATIO` e `AGUARDANDO_RECURSO`.
- **Comportamento no MVP:** só é possível cancelar nos estados em que `acoes_permitidas` inclui `cancel`
  (`AGUARDANDO_DOCUMENTACAO`, `AGUARDANDO_INSPECAO`, `AGUARDANDO_ENTRADA`, `NO_PATIO`, `AGUARDANDO_RECURSO`).
  Em `EM_OPERACAO` é preciso **interromper antes** (a interrupção registra a ocorrência e libera doca e equipamento) e então
  cancelar a partir de `AGUARDANDO_RECURSO`. Cancelar registra ocorrência `CANCELAMENTO`, libera tudo, marca `cancelada` e
  leva a `AGUARDANDO_LIBERACAO`; o caminhão só sai do terminal com "Liberar caminhão". Não preenche `finalizada_em`.
- **Back-end hoje:** `Operacao.cancelar` aceita `EM_OPERACAO` (só recusa `FINALIZADO` e `AGUARDANDO_LIBERACAO`, e exige
  que `TRANSICOES` permita `AGUARDANDO_LIBERACAO`), mas `acoes_permitidas` de `EM_OPERACAO` é `("finish", "interrupt")`, sem `cancel`.
- **Divergência:** o método e a lista de ações permitidas discordam sobre cancelar em andamento.
- **Ajuste necessário:** decidir a regra. A recomendação do front é a do MVP (não cancelar em `EM_OPERACAO`; interromper
  antes): fazer `cancelar` recusar `EM_OPERACAO` com a mensagem "Operação em andamento: interrompa antes de cancelar.".
  Se o negócio preferir cancelar em andamento, incluir `cancel` em `acoes_permitidas` de `EM_OPERACAO` e ajustar o front.

## 3. Prévia de alocação (vaga, doca e equipamento)

- **Funcionalidade no front:** o "Próximo passo" e o diálogo de iniciar/retomar mostram quais recursos serão usados e,
  quando não dá, o motivo ("Aguarda EQ-01 e EQ-02 (em manutenção)"). O botão fica desabilitado em `AGUARDANDO_RECURSO` sem recursos.
- **Comportamento no MVP:** o domínio local (`avaliarInicio`) usa a **mesma escolha** de `start`, então a prévia coincide com o
  que é alocado (há teste para isso).
- **Back-end hoje:** não existe consulta; só `start`, que já executa a alocação.
- **Divergência:** com a API real o front não deve repetir a escolha; precisa ler do sistema.
- **Ajuste necessário (proposta):** `GET /api/operations/{id}/allocation-preview` →
  `{ "pode": bool, "retomada": bool, "motivo": string | null, "vaga_id": uuid | null, "doca_id": uuid | null, "equipamento_id": uuid | null }`,
  usando o mesmo código de seleção de `alocar_e_iniciar`. O campo `motivo_espera` já proposto no contrato cobre o texto da fila.

## 4. Aguardar recursos

- **No front:** iniciar sem conjunto completo leva a `AGUARDANDO_RECURSO`, mantém a vaga e não reserva nada; repetir a
  tentativa sem recursos não muda nada; com recursos livres a ação fica disponível (retomada ou início).
- **Back-end hoje:** igual (`alocar_e_iniciar` devolve `False`; de `NO_PATIO` passa a `AGUARDANDO_RECURSO`).
- **Observação de MVP:** não há reprocessamento automático da fila quando recursos ficam livres; a pessoa aciona "Iniciar" ou "Retomar".
  O back-end também não tem. Definir se haverá.

## 5. Concluir operação × liberar caminhão

- **No front:** "Concluir operação" (`finish`) libera vaga, doca e equipamento, preenche `finalizada_em` e leva a
  `AGUARDANDO_LIBERACAO` (evento `OPERACAO_FINALIZADA`). "Liberar caminhão" (`release`) leva a `FINALIZADO`. São ações distintas,
  em telas e diálogos distintos.
- **Back-end hoje:** `finalizar_operacao` e `liberar_caminhao` fazem exatamente isso. **Alinhado.**

## 6. Interromper operação

- **No front:** diálogo com descrição (obrigatória), gravidade, impacto, "equipamento quebrou" e recurso envolvido.
  Registra a ocorrência (`ATRASO` ou `EQUIPAMENTO_QUEBRADO`), libera doca e equipamento, **mantém a vaga**, leva `EM_OPERACAO`
  a `AGUARDANDO_RECURSO` e, se o equipamento quebrou, o coloca em `EM_MANUTENCAO`. A interface oferece "Interromper" só em `EM_OPERACAO`.
- **Back-end hoje:** `POST /api/operations/{id}/interrupt` com `descricao`, `responsavel_id`, `equipamento_quebrado`, `severidade`,
  `impacto`, `recurso_tipo`, `recurso_id`: mesmo efeito. Aceita também `NO_PATIO` e `AGUARDANDO_RECURSO` (registra a ocorrência e
  libera recursos sem mudar o estado).
- **Divergências:**
  1. Com `equipamento_quebrado = true` o back-end **não** liga a ocorrência ao equipamento (`recurso_tipo`/`recurso_id` vêm só do cliente).
     O front usa o equipamento quebrado como recurso da ocorrência (é o que as telas mostram como "causa").
  2. O back-end não guarda o registro da interrupção. O front mantém `interrupcao` por operação
     (`doca_id`, `interrompida_em`, `minutos_operados`, `ocorrencia_id`), exposto em `docas[].interrupcao` (campo já proposto, contrato §2),
     para mostrar a doca "interrompida" e distinguir retomada de início.
  3. `titulo` e `metrica_rotulo` da ocorrência (campos propostos) são gerados pelo front.
- **Ajuste necessário:** (1) quando `equipamento_quebrado` e há equipamento, gravar `recurso_tipo = "equipment"` e `recurso_id` dele
  (se o cliente não enviar outro); (2) guardar a interrupção e expô-la em `docas[].interrupcao` (ver §7 e `contrato-api-proposto.md`); (3) decidir se interromper em
  `NO_PATIO`/`AGUARDANDO_RECURSO` continua permitido.

## 7. Retomar operação interrompida

- **No front:** em `AGUARDANDO_RECURSO` com interrupção registrada, o painel oferece "Retomar operação". A retomada **volta pela
  alocação** (mesma escolha de `start`: reaproveita a vaga se ainda é válida, escolhe doca e equipamento livres compatíveis) e só
  acontece se houver conjunto completo. Mantém `iniciada_em`, zera `interrupcao`, evento `OPERACAO_INICIADA` com o texto "Operação retomada.".
- **Back-end hoje:** não há ação própria; `POST /api/operations/{id}/start` a partir de `AGUARDANDO_RECURSO` faz a alocação e emite
  `OPERACAO_INICIADA` com "Operação iniciada." (não distingue de um início normal).
- **Divergência:** o back-end não identifica uma operação como "interrompida a retomar".
- **Ajuste necessário (proposta):** guardar a interrupção (§6) e indicar na operação que ela está interrompida (por exemplo `interrompida: bool`)
  ou emitir um evento/tipo `OPERACAO_RETOMADA` ao retomar. Nenhum endpoint novo: `start` continua sendo a ação.

## 8. Resolver ocorrência

- **No front:** "Resolver ocorrência" (supervisão/administração) marca `RESOLVIDA`, registra quem e quando e acrescenta evento no histórico.
  **Não** altera a etapa do caminhão nem libera recursos; equipamento quebrado só volta com "Concluir manutenção".
- **Back-end hoje:** `POST /api/occurrences/{id}/resolve` faz o mesmo, com texto de evento "Ocorrência {id} resolvida.".
  **Alinhado**; o front escreve o título da ocorrência no lugar do id (só apresentação).
- **Ajuste sugerido:** incluir o título da ocorrência no texto do evento.

## 9. Manutenção de recursos

- **No front:** "Colocar em manutenção" / "Concluir manutenção" em vaga, doca e equipamento (supervisão). Recurso `OCUPADO` não muda
  (botão desabilitado com explicação). Equipamento volta a `DISPONIVEL`; vaga e doca a `LIVRE`.
- **Back-end hoje:** `PATCH /api/resources/{tipo}/{id}/maintenance` com `em_manutencao` e `responsavel_id`: mesmo comportamento (409 se ocupado). **Alinhado.**
- **Observação:** "quebrado" é derivado no front (`EM_MANUTENCAO` com ocorrência `EQUIPAMENTO_QUEBRADO` aberta). `manutencao_ate` (proposto) não é gravado.

## 10. Interdição de área

- **No front:** "Interditar área" (com motivo obrigatório) e "Liberar área" no painel de vaga/doca. Recusada se há recurso ocupado na área.
- **Back-end hoje:** `PATCH /api/areas/{id}` com `interditada` e `responsavel_id`; 409 se há recurso ocupado. **Não** recebe nem guarda motivo.
- **Divergência:** falta `motivo_interdicao` (já listado em `contrato-api-proposto.md` §5.8).
- **Ajuste necessário:** aceitar `motivo_interdicao` no corpo do `PATCH`, devolvê-lo na área e limpá-lo ao liberar.

## 11. Responsável pelas ações

- **No front:** não há login. Cada ação usa o primeiro funcionário da função exigida (recepção, inspeção, operação habilitada para o tipo da
  operação, supervisão) e mostra "Registrado por …" no diálogo.
- **Back-end hoje:** todo `POST`/`PATCH` exige `responsavel_id`; `start` exige operador habilitado para carga/descarga; resolver, manutenção e
  interdição exigem supervisão.
- **Ajuste necessário:** na integração o front precisa de um usuário atual (ou seletor de funcionário) para enviar `responsavel_id`.
  Definir com a equipe como esse usuário é obtido.

## 12. Carga "comum" é exclusiva (correção)

Em revisão anterior, o formulário de chegada comentava que "comum exclui as demais" era hipótese de apresentação. **Não é:** `Carga.__post_init__`
(commit `03fa766`) rejeita "comum" combinada com outra característica. O formulário aplica a regra ao marcar as opções; o motor local ainda
aceita a combinação se uma ação for enviada fora do formulário. Alinhado; na integração o back-end responde com o erro.

---

## Premissas adotadas no MVP (decisões de negócio não definidas)

1. Interromper é oferecido na interface apenas em `EM_OPERACAO` (o motor aceita também `NO_PATIO`/`AGUARDANDO_RECURSO`, como o back-end).
2. Retomar usa a ação `start`, sempre pela alocação; não há reprocessamento automático da fila.
3. Cancelar só nos estados com `cancel` em `acoes_permitidas`; cancelar leva a `AGUARDANDO_LIBERACAO`, e liberar encerra o fluxo.
4. Resolver ocorrência não libera recurso nem muda a etapa; equipamento quebrado volta por "Concluir manutenção".
5. O responsável de cada ação é o primeiro funcionário da função (sem login).
6. O relógio é o do navegador; os dados vêm do seed local e persistem em `localStorage` (`terminal-portuario:estado`).

## Eventos e transições a criar ou modificar (lista objetiva)

- **Transição:** `NO_PATIO → EM_OPERACAO` em `TRANSICOES` (§1).
- **Regra:** `cancelar` recusa `EM_OPERACAO` (§2) ou `acoes_permitidas` de `EM_OPERACAO` passa a incluir `cancel`.
- **Endpoint novo:** `GET /api/operations/{id}/allocation-preview` (§3).
- **Campo novo:** `docas[].interrupcao { operacao_id, interrompida_em, minutos_operados, ocorrencia_id } | null` (§6; já proposto) e indicador de operação interrompida (§7).
- **Evento/texto:** retomada ("Operação retomada." ou `OPERACAO_RETOMADA`) (§7); título da ocorrência no evento de resolução (§8).
- **Campo novo em `Ocorrencia`:** `titulo`, `metrica_rotulo` (§6; já proposto no contrato).
- **Comportamento:** `equipamento_quebrado` define o recurso da ocorrência (§6).
- **Campo novo em área:** `motivo_interdicao` no `PATCH /api/areas/{id}` (§10).
- **Contrato:** como o front obtém o `responsavel_id` (§11).
