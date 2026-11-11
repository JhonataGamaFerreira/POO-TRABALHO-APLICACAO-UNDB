# Contrato de dados proposto — front-end × back-end

> **Status: PROPOSTA para discussão com o responsável pelo back-end (Jhonata).**
> Nada aqui é regra de negócio confirmada nem contrato firmado. O front-end hoje
> usa um cenário de demonstração em `src/mocks/cenario.ts`, processado pelo motor de `src/domain/`; a API real **não** foi integrada
> e o back-end **não** foi alterado.

Referência do contrato atual: back-end, commit `b16a874` (`api.py` / `main.py`).
Tipos da API atual: `src/types/terminal.ts` (não alterado).
Tipos da proposta: `src/types/terminal-proposto.ts` (cada interface estende a atual e acrescenta só campos novos).

## Legenda dos rótulos

| Rótulo | Significado |
|---|---|
| **EXTRAÍDO** | Já existe na API atual (`b16a874`). |
| **PROPOSTA** | Campo/endpoint que o design precisa e a API não envia. Existe só nos mocks. |
| **HIPÓTESE** | Escolha de apresentação do front-end, ainda sem validação. |
| **DEPENDE DO BACK-END** | Só vira regra quando o responsável definir. |
| **A CONFIRMAR** | Divergência ou dúvida a resolver com o back-end/equipe. |

## Princípios

1. Três conceitos ficam **separados** e nunca são fundidos:
   - **estado da operação/caminhão** (`EstadoCaminhao`, 8 etapas);
   - **estado do recurso** (`EstadoRecurso`: `LIVRE`, `DISPONIVEL`, `OCUPADO`, `EM_MANUTENCAO`);
   - **ocorrência** (tipo, severidade, impacto, estado), que *explica* um recurso ou operação, mas não é um estado de recurso.
2. O front-end **exibe**; não decide prioridade, alocação nem compatibilidade. Textos como "Por que não recebe?" vêm do sistema.
3. Todo campo proposto é lido com **fallback** para a API atual (ver "Compatibilidade").
4. A interface **não** menciona backend, API, simulação, campos propostos nem limitações técnicas. Toda essa informação vive exclusivamente neste documento, nos tipos (`terminal-proposto.ts`) e nos comentários dos mocks.
5. Os mocks são **respostas prontas do sistema**: posição, pontuação e fatores da fila, lista e situação das docas compatíveis, `restricao` e `motivo_espera` estão escritos como dados literais. O front não implementa priorização, pontuação nem compatibilidade; a política (pesos e bônus por minuto) pertence ao back-end e aparece aqui só como exemplo de payload. Os mesmos serviços podem ser trocados por chamadas HTTP sem mudar os componentes.

---

## 1. Campos que já existem na API (EXTRAÍDO)

| Tela | Campos usados |
|---|---|
| Painel | `GET /api/dashboard`: `total_operacoes`, `por_estado`, `recursos.{vagas,docas,equipamentos}`. `GET /api/reports/timings`: `media_por_etapa_minutos`. `GET /api/occurrences`: `tipo`, `descricao`, `severidade`, `impacto`, `estado`, `criada_em`, `recurso_tipo`, `recurso_id`, `operacao_id`. `GET /api/queue`: `posicao`, `espera_minutos`, `pontuacao`, `fatores`, `carga`. |
| Fila | `GET /api/queue` (acima) e `GET /api/operations` (`acoes_permitidas`, `historico`, `tempos_minutos`, `vaga`, `doca`, `equipamento`, `caminhao`, `carga`). |
| Pátio e docas | `GET /api/resources`: vagas/docas (`id`, `estado`, `operacao_id`, `area.{nome, autorizada_carga_perigosa, refrigerada, interditada}`, `tipo` da doca), equipamentos (`nome`, `estado`, `tipos_compativeis`, `aceita_carga_fragil`, `operacao_id`). |
| Painéis contextuais | Os mesmos campos acima, ligados por id. |

## 2. Campos extras nos mocks (PROPOSTA)

Todos DEPENDEM DO BACK-END. Origem: necessidades dos wireframes A1, A2, B1, B2, B3 e da tela Fila.

### Recursos (`GET /api/resources`)

| Campo | Onde | Tipo | Usado em | Observação |
|---|---|---|---|---|
| `vagas[].codigo`, `docas[].codigo` | vaga/doca | `string` ("V05", "D3") | Todas as telas | Hoje só há UUID; sem o campo o front usa a ordem da lista (V01, D1…). |
| `area.motivo_interdicao` | área | `string \| null` | Pátio, painel de vaga/doca | Ex.: "piso danificado". Só faz sentido com `interditada = true`. |
| `docas[].manutencao_ate` | doca | ISO datetime \| null | Dock Cell "Manutenção até 16:30" | |
| `docas[].interrupcao` | doca | `{operacao_id, interrompida_em, minutos_operados, ocorrencia_id}` \| null | Dock Cell "Interrompida há 38 min" | Condição registrada **à parte**, coerente com o ciclo de vida atual: ao interromper, a operação volta a `AGUARDANDO_RECURSO`, a doca e o equipamento são liberados (`estado` da doca = `LIVRE`) e a vaga é mantida (`liberar_recursos(manter_vaga=True)`). **A CONFIRMAR**: o formato do campo e se a interrupção virá em `resources` ou na operação. |
| `docas[].restricao` | doca livre | `{codigo: "SEM_EQUIPAMENTO_COMPATIVEL", texto, ocorrencia_id}` \| null | Dock Cell "Restrição", painel "Por que não recebe?" | O `texto` é do sistema; o front não o deduz. |

### Operação (`GET /api/operations`)

| Campo | Tipo | Observação |
|---|---|---|
| `historico[].tipo = "CHEGADA"` | `string` | **PROPOSTA (hoje só do front/store).** O back-end não grava evento na chegada e `TipoEvento` não tem este valor. A store local o registra ao criar a operação (`descricao` "Chegada registrada.", `responsavel_id` da recepção, `ocorrido_em` = `chegada_em`, estados nulos) para que o histórico mostre quem registrou e quando. Se o back-end passar a gravar o evento, o front deixa de gerá-lo. |
| `duracao_estimada_minutos` | `number \| null` | **ILUSTRATIVO**. O back-end não tem esse conceito. Alimenta a barra "42 de 70 min". A interface apresenta a barra como parte natural da operação ("42 de 70 min"), sem aviso técnico. Sem o campo, a barra some e aparece só o tempo operado. |

### Fila (`GET /api/queue`)

| Campo | Tipo | Observação |
|---|---|---|
| `motivo_espera` | `string \| null` | Texto do sistema ("Aguarda EQ-02 (em manutenção, quebrado)"). |

### Ocorrências (`GET /api/occurrences`)

| Campo | Tipo | Observação |
|---|---|---|
| `titulo` | `string` | Título curto de lista ("EQ-02 quebrada"). Sem ele o front monta "Tipo · recurso". |
| `operacoes_afetadas` | `[{operacao_id, severidade}]` | A API liga a ocorrência a **uma** operação. O design mostra "Afeta N caminhões". A severidade é do **impacto sobre aquela operação**. Inclui a operação de origem. |
| `metrica_impacto` | `{minutos, rotulo: "espera máxima" \| "parada" \| "na etapa"} \| null` | Métrica da linha "Atenção agora". Sem ela o front mostra "aberta há". |
| Ordem da lista | — | Wireframe: "Ordenado por impacto · critério definido pelo back-end". O front **não ordena**. |

### Painel (`GET /api/dashboard`)

| Campo | Tipo | Observação |
|---|---|---|
| `etapas[]` | `{estado, quantidade, media_minutos, faixa_espera: "normal" \| "atencao" \| "critica"}` | Hoje a média vem de `/api/reports/timings`. A `faixa_espera` (destaque amarelo de "Aguard. recurso") é definição do sistema — os limites **não existem** e os nomes são provisórios. |
| `finalizados_hoje` | `number` | "23 hoje · fora dos 17". "Hoje" depende de definir o turno/dia. |

### Docas compatíveis — endpoint novo

`GET /api/operations/{id}/compatible-docks`

```json
{
  "operacao_id": "…-506",
  "docas": [
    { "doca_id": "…-301", "situacao": "PQR-1A11 em operação", "disponivel": false },
    { "doca_id": "…-306", "situacao": "GHI-5E55 em operação", "disponivel": false },
    { "doca_id": "…-307", "situacao": "Livre · sem equipamento compatível livre", "disponivel": false }
  ]
}
```

Consulta **contextual**. O front exibe e rotula como "Não é alocação nem priorização de doca". Quem decide compatibilidade é o back-end: a lista de docas e a `situacao` de cada uma chegam prontas (nos mocks, estão escritas como dados literais; o front não calcula compatibilidade). **DEPENDE DO BACK-END**: existência do endpoint, o que é "compatível" e o formato de `situacao` (texto livre vs. código + dados).

## 3. Formato esperado por tela

| Tela | Dados | Chamadas | Seleção (URL) |
|---|---|---|---|
| **Painel** | ocorrências abertas (ordenadas), `dashboard.etapas`, `finalizados_hoje`, recursos, 3 primeiros da fila | `dashboard`, `occurrences`, `queue`, `resources`, `reports/timings` | `?ocorrencia=` |
| **Fila** | itens da fila com `motivo_espera`, pontuação e fatores; pré-entrada vem de `operations` | `queue`, `operations`, `occurrences` | `?caminhao=PLACA`, `?q=` |
| **Pátio e docas** | recursos com códigos, interrupção, restrição, manutenção; entrada (pré-entrada e fila externa) a partir de `operations`; docas compatíveis | `resources`, `operations`, `occurrences`, `compatible-docks` | `?recurso=tipo:id`, `?ocorrencia=`, `?consulta=PLACA`, `?filtro=`, `?origem=painel` |

Contagens exibidas (ativos, livres, ocupadas, indisponíveis) são **derivadas dos dados no front** (apresentação). No cenário atual dos mocks: 17 ativos e 23 finalizados (como nos wireframes); 8 de 12 vagas ocupadas (os wireframes mostram 7), porque a VWX-3C33, interrompida, mantém a vaga; as etapas ficam com 5 caminhões em "Aguard. recurso" e 5 em "Em operação".

## 4. Exemplos de payload

### `GET /api/resources` (trechos)

```json
{
  "vagas": [
    {
      "id": "…-209", "codigo": "V09", "estado": "LIVRE", "operacao_id": null,
      "area": {
        "id": "…-104", "nome": "Área Norte",
        "autorizada_carga_perigosa": false, "refrigerada": false,
        "interditada": true, "motivo_interdicao": "piso danificado"
      }
    }
  ],
  "docas": [
    {
      "id": "…-303", "codigo": "D3", "tipo": null, "estado": "LIVRE", "operacao_id": null,
      "area": { "id": "…-101", "nome": "Área Geral", "autorizada_carga_perigosa": false,
                "refrigerada": false, "interditada": false, "motivo_interdicao": null },
      "manutencao_ate": null,
      "interrupcao": {
        "operacao_id": "…-510", "interrompida_em": "2026-11-06T13:57:00-03:00",
        "minutos_operados": 58, "ocorrencia_id": "…-702"
      },
      "restricao": null
    },
    {
      "id": "…-307", "codigo": "D7", "tipo": null, "estado": "LIVRE", "operacao_id": null,
      "area": { "id": "…-103", "nome": "Área Perigosos", "autorizada_carga_perigosa": true,
                "refrigerada": false, "interditada": false, "motivo_interdicao": null },
      "manutencao_ate": null, "interrupcao": null,
      "restricao": {
        "codigo": "SEM_EQUIPAMENTO_COMPATIVEL",
        "texto": "EQ-02 está em manutenção (equipamento quebrado). EQ-01, EQ-04, EQ-05 e EQ-06 estão em uso nas docas D1, D2, D6 e D5.",
        "ocorrencia_id": "…-701"
      }
    }
  ],
  "equipamentos": [
    { "id": "…-402", "nome": "EQ-02", "estado": "EM_MANUTENCAO", "operacao_id": null,
      "tipos_compativeis": ["carga", "descarga"], "aceita_carga_fragil": false }
  ]
}
```

**Equipamento quebrado** não é estado novo: é `estado = EM_MANUTENCAO` **mais** uma ocorrência aberta `EQUIPAMENTO_QUEBRADO` com `recurso_tipo = "equipment"` e `recurso_id` do equipamento. O visual hachurado vermelho do design é composto dessas duas informações no front (HIPÓTESE).

### `GET /api/occurrences` (um item)

```json
{
  "id": "…-701", "tipo": "EQUIPAMENTO_QUEBRADO", "estado": "ABERTA",
  "severidade": "critica", "impacto": "recurso",
  "descricao": "EQ-02 quebrada durante a operação de FGH-2J34.",
  "criada_em": "2026-11-06T13:05:00-03:00",
  "recurso_tipo": "equipment", "recurso_id": "…-402", "operacao_id": "…-506",
  "titulo": "EQ-02 quebrada",
  "operacoes_afetadas": [
    { "operacao_id": "…-506", "severidade": "critica" },
    { "operacao_id": "…-509", "severidade": "media" }
  ],
  "metrica_impacto": { "minutos": 112, "rotulo": "espera máxima" }
}
```

### `GET /api/queue` (um item)

```json
{
  "operacao_id": "…-506", "placa": "FGH-2J34", "estado": "AGUARDANDO_RECURSO",
  "posicao": 1, "espera_minutos": 112, "pontuacao": 206,
  "carga": { "descricao": "Solvente industrial (classe 3)", "caracteristicas": ["perigosa", "prioritária"] },
  "fatores": [
    { "tipo": "caracteristica", "caracteristica": "perigosa", "peso": 50 },
    { "tipo": "caracteristica", "caracteristica": "prioritária", "peso": 100 },
    { "tipo": "tempo_espera", "minutos": 112, "bonus_por_minuto": 0.5, "pontos": 56 }
  ],
  "motivo_espera": "Aguarda EQ-02 (em manutenção, quebrado)"
}
```

### `GET /api/dashboard` (campos propostos)

```json
{
  "total_operacoes": 18,
  "por_estado": { "AGUARDANDO_RECURSO": 5, "FINALIZADO": 3 },
  "etapas": [
    { "estado": "AGUARDANDO_RECURSO", "quantidade": 5, "media_minutos": 70, "faixa_espera": "atencao" },
    { "estado": "FINALIZADO", "quantidade": 3, "media_minutos": null, "faixa_espera": "normal" }
  ],
  "finalizados_hoje": 3
}
```

(`por_estado` e `recursos` omitidos por brevidade; seguem a API atual.)

## 5. O que depende de definição do back-end (DEPENDE DO BACK-END / A CONFIRMAR)

1. **Doca interrompida**: o mock segue o comportamento atual (doca liberada, operação em `AGUARDANDO_RECURSO`, vaga mantida) e representa a interrupção como condição separada (`interrupcao`). Falta confirmar o formato desse campo; se o back-end preferir manter a doca presa à operação, o estado da doca e a operação mudariam.
2. **`restricao` da doca**: quem produz o texto; se haverá outros códigos além de `SEM_EQUIPAMENTO_COMPATIVEL`.
3. **`operacoes_afetadas`**: quem calcula e qual a regra de severidade por operação.
4. **Ordem e `metrica_impacto`** das ocorrências ("ordenado por impacto"): critério e rótulos.
5. **`faixa_espera`**: limites por etapa, número de faixas e nomes.
6. **Docas compatíveis**: endpoint, definição de compatibilidade e formato de `situacao`.
7. **Duração estimada**: se existirá. Hoje é só ilustração do design; sem ela a barra deve sair.
8. **Códigos de vaga/doca**, `motivo_interdicao`, `manutencao_ate`, `motivo_espera`, `titulo`.
9. **"Hoje"** em `finalizados_hoje` (dia civil ou turno).
10. **Inspeção na chegada**: `POST /api/operations` aceita `exige_inspecao` (padrão `false`), que só tem efeito com `documentacao_regular = true` e é o único caminho para `AGUARDANDO_INSPECAO`: `validar_documentacao` com documentação regular leva direto a `AGUARDANDO_ENTRADA`. Não há critério que decida a necessidade de inspeção (o flag vem do cliente e a operação não o guarda), nem endpoint que encaminhe para inspeção depois da documentação, embora `TRANSICOES` permita `AGUARDANDO_DOCUMENTACAO → AGUARDANDO_INSPECAO` e o README fale em "encaminhar para inspeção quando necessário". Confirmar com o responsável do back-end quem decide e em que momento.
11. **Placa**: o back-end só aplica `strip().upper()`; compara o texto como chega (`ABC1D23` ≠ `ABC-1D23`). O front normaliza para `AAA-1A23` (exibição e busca). Confirmar se o back-end normaliza ou se deve receber a placa já normalizada.
12. **Severidade**: o design só tem dois níveis visuais (Crítico/Atenção) e a API tem quatro (`baixa`, `media`, `alta`, `critica`). A correspondência (`critica` → Crítico; `alta`/`media` → Atenção; `baixa` → sem glifo) é HIPÓTESE do front, e o texto exibido segue o mesmo agrupamento ("Crítico" / "Atenção"; ver seção 7).

## 6. Compatibilidade com a API atual

O front tolera a ausência de cada campo proposto:

| Campo ausente | Comportamento |
|---|---|
| `codigo` | V01/D1… pela ordem da lista. |
| `motivo_interdicao` | Mostra "Área interditada para operação." |
| `interrupcao` | A doca aparece como `Livre`. |
| `restricao` | Doca livre sem alerta. |
| `manutencao_ate` | "Manutenção" sem horário. |
| `duracao_estimada_minutos` | Sem barra; mostra "N min em operação". |
| `motivo_espera` | Mostra a etapa atual. |
| `titulo` | Monta "Tipo · recurso/placa". |
| `operacoes_afetadas` | Só a operação de origem. |
| `metrica_impacto` | Mostra "aberta há". |
| `etapas` / `finalizados_hoje` | Monta de `por_estado` + `reports/timings`; faixa sempre "normal". |
| endpoint de docas compatíveis | A seção de consulta mostra "Nenhuma doca compatível para este caminhão." |

## 7. Divergências de design registradas (sem alterar Figma)

- A página 10 do Figma é uma versão reduzida dos wireframes (página 08); a implementação segue o wireframe e o DS.
- A legenda "Bloqueada ou quebrado" mistura estado de recurso (área interditada) e ocorrência (equipamento quebrado).
- O cenário dos wireframes não é consistente com as regras atuais do back-end (5 docas em operação com 4 equipamentos utilizáveis; caminhões em operação sem vaga; doca interrompida ainda presa; JKL-7G45 ocupando V10 após finalizar). **Decisão (revisão final):** o mock reproduz a composição dos wireframes quando isso é coerente com o domínio: 17 caminhões ativos e 23 finalizados, D8 em operação com EQ-06, D5 em operação sem equipamento e JKL-7G45 de volta à V10 aguardando liberação (caminhão em doca não ocupa vaga do pátio). A VWX-3C33 **não** é "Em operação": está em `AGUARDANDO_RECURSO`, com a vaga V03 mantida e a doca D3 livre com uma condição de interrupção registrada. Por isso há 8 de 12 vagas ocupadas (e não 7), 5 caminhões em "Aguard. recurso" e 5 em "Em operação"; o back-end não foi alterado para acomodar os números dos wireframes. Em "Pátio e docas", uma doca interrompida conta como livre (estado do recurso) e a interrupção aparece como condição.
- Legenda: três grupos separados — estado do recurso (livre, ocupado, em manutenção), condições (interrupção, área interditada, equipamento quebrado) e severidade (crítico, atenção). Área interditada e equipamento quebrado compartilham o padrão visual hachurado vermelho do wireframe.
- Os wireframes mostram "Referência 14:35 · dados simulados", "+ Registrar chegada", itens de menu futuros (Equipamentos, Caminhões, Ocorrências, Relatórios), "Planta/Agenda" (B4), atalho ⌘K, avatar, "Esquema simplificado · não é a planta real", "Média por etapa · simulada", "Ordenado por impacto · critério definido pelo back-end" e notas sobre campos propostos. **Decisão (revisão final):** a interface não reproduz esses elementos/textos; mostra apenas "Atualizado às HH:MM", três itens de menu (Painel, Fila, Pátio e docas) e nenhum botão sem ação. Os wireframes aprovados e as páginas 08/09 do Figma não foram alterados.
- Rótulos de severidade: o DS tem dois níveis visuais. A interface exibe "Crítico" (`critica`) e "Atenção" (`alta`/`media`); `baixa` permanece "Baixa". O dado original continua na API.
- A busca funciona só por placa. Na Etapa 2 do MVP a interface passou a ter **registrar chegada, validar documentação, registrar inspeção e autorizar entrada** (sobre o estado local, sem API); as demais ações de escrita (resolver ocorrência, iniciar/interromper/finalizar operação etc.) ainda **não** existem. O painel do caminhão lista só a ação da etapa atual, derivada de `acoes_permitidas`.
- A barra de progresso das docas e a faixa de espera continuam dependendo de campos propostos (seção 2); a explicação fica só aqui.
