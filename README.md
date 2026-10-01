# 🚛 Terminal Portuário — Front-end

Interface web para gerenciar a operação de um terminal portuário: controle da entrada de caminhões, fila com prioridade, ocupação de vagas, docas e equipamentos, histórico das operações e ocorrências.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix_UI-161618?style=for-the-badge&logo=radixui&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-22B5BF?style=for-the-badge)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

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

O front consome a API do back-end. Enquanto ela não está pronta, os dados são simulados na pasta `src/mocks`.

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|---|---|
| [Node.js](https://nodejs.org/) | Ambiente para executar o Next.js e gerenciar pacotes (npm) |
| [Next.js](https://nextjs.org/) (App Router) | Framework e roteamento |
| [React](https://react.dev/) | Interface |
| [TypeScript](https://www.typescriptlang.org/) | Tipagem estática |
| [Tailwind CSS](https://tailwindcss.com/) | Estilização |
| [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) | Componentes de interface acessíveis |
| [Lucide](https://lucide.dev/) | Ícones |
| [Recharts](https://recharts.org/) | Gráficos do painel e dos relatórios |
| [date-fns](https://date-fns.org/) | Datas, horários e tempo de espera |
| [ESLint](https://eslint.org/) | Padronização do código |

---

## 🖥️ Telas

| # | Tela | Rota | Pasta |
|---|---|---|---|
| 1 | Painel do terminal (caminhões no terminal, em operação, aguardando, em inspeção, finalizados hoje) | `/dashboard` | `app/dashboard` |
| 2 | Pátio (vagas livres, ocupadas ou em manutenção) | `/patio` | `app/patio` |
| 3 | Docas (carga, descarga ou livre) | `/docas` | `app/docas` |
| 4 | Equipamentos (ocupado, disponível ou em manutenção) | `/equipamentos` | `app/equipamentos` |
| 5 | Fila de atendimento | `/fila` | `app/fila` |
| 6 | Registro de chegada | `/caminhoes/nova-entrada` | `app/caminhoes/nova-entrada` |
| 7 | Histórico do caminhão (linha do tempo) | `/caminhoes/[id]` | `app/caminhoes/[id]` |
| 8 | Ocorrências | `/ocorrencias` | `app/ocorrencias` |
| 9 | Relatórios | `/relatorios` | `app/relatorios` |

---

## 📁 Estrutura de pastas

```
frontend/
├── public/                  ← arquivos estáticos
└── src/
    ├── app/                 ← telas (cada pasta vira uma rota)
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── dashboard/
    │   ├── patio/
    │   ├── docas/
    │   ├── equipamentos/
    │   ├── fila/
    │   ├── ocorrencias/
    │   ├── relatorios/
    │   └── caminhoes/
    │       ├── [id]/        ← histórico do caminhão
    │       └── nova-entrada/
    ├── components/
    │   ├── ui/              ← componentes base (shadcn/ui)
    │   └── layout/          ← sidebar, header
    ├── services/            ← chamadas à API
    ├── types/               ← tipos e enums do domínio
    ├── lib/                 ← utilitários e formatadores
    └── mocks/               ← dados simulados
```

---

## 🚀 Como rodar

**Pré-requisitos:** Node.js (versão LTS) e npm.

```bash
# 1. Clonar o repositório
git clone https://github.com/JhonataGamaFerreira/POO-TRABALHO-APLICACAO-UNDB.git
cd POO-TRABALHO-APLICACAO-UNDB

# 2. Entrar na branch do front
git checkout Front-End

# 3. Instalar as dependências
cd frontend
npm install

# 4. Rodar em desenvolvimento
npm run dev
```

Acesse **http://localhost:3000**.

### Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Executa o build de produção |
| `npm run lint` | Verifica o código com ESLint |

---

📚 Projeto acadêmico — Programação Orientada a Objetos · UNDB