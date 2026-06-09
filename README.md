# ShellMind

A minimal terminal coding agent with a real agentic loop, multi-provider LLM support, and persistent sessions.

Supports **Gemini**, **Claude (Anthropic)**, **OpenAI**, and **OpenRouter**.

---

## Features

- **Agentic loop** — plan → call tool → observe result → continue (up to 10 iterations)
- **Tools** — read/write files, run shell commands (with approval gate for dangerous ones), web search
- **Multi-provider** — swap LLMs with one env var, or switch mid-conversation with `/provider`
- **Persistent sessions** — conversation history stored in PostgreSQL, resumable by name
- **Minimal TUI** — clean terminal output, no bloat

---

## Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Bun |
| Language | TypeScript |
| TUI | readline + chalk |
| Database | PostgreSQL via Prisma 7 |
| LLM | Gemini, Claude, OpenAI, OpenRouter |

---

## Setup

### 1. Start the database

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://shellmind:shellmind@localhost:5432/shellmind"

# Provider: gemini | anthropic | openai | openrouter
PROVIDER="anthropic"
MODEL="claude-haiku-4-5-20251001"
API_KEY="your-api-key"

# Optional: Brave Search API for full web search
BRAVE_API_KEY=""
```

### 4. Generate Prisma client and push schema

```bash
bun db:generate
bun db:push
```

### 5. Run

```bash
bun dev
```

---

## Commands

| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/exit` | Exit the agent |
| `/clear` | Clear conversation context (keeps session in DB) |
| `/session <name>` | Switch to or create a named session |
| `/sessions` | List all saved sessions |
| `/model <name>` | Switch model mid-conversation |
| `/provider <name> [apikey]` | Switch provider |
| `/history` | Show current session's message history |

---

## Provider Models

| Provider | Recommended Models |
|---|---|
| `anthropic` | `claude-haiku-4-5-20251001`, `claude-sonnet-4-20250514` |
| `openai` | `gpt-4o-mini`, `gpt-4o` |
| `gemini` | `gemini-2.0-flash`, `gemini-1.5-pro` |
| `openrouter` | `anthropic/claude-haiku-4-5`, `google/gemini-flash-1.5` |

> **Note:** Free models on OpenRouter often lack tool-calling support. Use a paid model or add credits for reliable tool use.

---

## Web Search

Set `BRAVE_API_KEY` in `.env` for full web search via the [Brave Search API](https://api.search.brave.com). Without it, the agent falls back to DuckDuckGo instant answers (limited results).

---

## Project Structure

```
src/
  index.ts              ← entry point, session management, command loop
  agent/
    loop.ts             ← agentic reasoning loop (plan → tool → observe → respond)
    planner.ts          ← classifies intent and selects tools before calling LLM
  llm/
    types.ts            ← shared interfaces
    provider.ts         ← factory: creates provider by name
    anthropic.ts
    openai.ts           ← also used for OpenRouter
    gemini.ts
  tools/
    index.ts            ← tool definitions (JSON Schema)
    executor.ts         ← dispatches tool calls by name
    readFile.ts
    writeFile.ts
    shell.ts            ← runs commands, approval gate for dangerous ones
    webSearch.ts        ← Brave Search + DuckDuckGo fallback
  db/
    client.ts           ← Prisma singleton
    session.ts          ← session CRUD
    message.ts          ← message persistence
  tui/
    render.ts           ← chalk-based terminal output
    input.ts            ← readline prompt loop
prisma/
  schema.prisma         ← Session, Message, ToolCall models
docker-compose.yml      ← PostgreSQL container
```

---

## Tests

### 1. Basic chat
```
hello, what can you do?
```

### 2. Web search tool
```
search for the latest bun.js release notes
```

### 3. Read a file
```
read my package.json and tell me what dependencies I have
```

### 4. Write a file
```
create a file called hello.ts that prints "Hello from ShellMind"
```

### 5. Shell command
```
run ls -la in the current directory
```

### 6. Dangerous command approval gate
```
run rm -rf ./hello.ts
```
