import "dotenv/config";
import chalk from "chalk";
import { createProvider } from "./llm/provider.ts";
import { runAgentLoop } from "./agent/loop.ts";
import { getOrCreateSession, listSessions } from "./db/session.ts";
import { saveMessage, loadMessages, clearMessages } from "./db/message.ts";
import { disconnect } from "./db/client.ts";
import { render } from "./tui/render.ts";
import { createInputLoop } from "./tui/input.ts";
import type { ChatMessage, ProviderName } from "./llm/types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

function getConfig() {
  const provider = (process.env.PROVIDER ?? "anthropic") as ProviderName;
  const model = process.env.MODEL ?? "claude-sonnet-4-20250514";
  const apiKey = process.env.API_KEY ?? "";
  const defaultSession = process.env.DEFAULT_SESSION ?? "default";

  if (!apiKey) {
    render.error("API_KEY is not set. Please configure your .env file.");
    process.exit(1);
  }

  return { provider, model, apiKey, defaultSession };
}

// ── State ─────────────────────────────────────────────────────────────────────

interface AgentState {
  sessionId: string;
  sessionName: string;
  provider: ProviderName;
  model: string;
  apiKey: string;
  history: ChatMessage[];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const config = getConfig();

  // Init session
  let state = await initSession(
    config.defaultSession,
    config.provider,
    config.model,
    config.apiKey
  );

  render.banner(state.sessionName, state.provider, state.model);

  // Restore history
  if (state.history.length > 0) {
    render.info(`Resumed session with ${state.history.length} messages.`);
    render.gap();
  }

  // ── Command handler ─────────────────────────────────────────────────────────
  async function handleCommand(cmd: string, args: string[]): Promise<boolean> {
    switch (cmd) {
      case "exit":
      case "quit": {
        render.info("Goodbye.");
        await disconnect();
        process.exit(0);
      }

      case "help": {
        render.help();
        return true;
      }

      case "clear": {
        await clearMessages(state.sessionId);
        state.history = [];
        render.success("Conversation cleared (session kept).");
        return true;
      }

      case "session": {
        const name = args[0];
        if (!name) {
          render.error("Usage: /session <name>");
          return true;
        }
        state = await initSession(name, state.provider, state.model, state.apiKey);
        render.success(`Switched to session: ${chalk.white(name)} (${state.history.length} messages)`);
        return true;
      }

      case "sessions": {
        const sessions = await listSessions();
        render.sessionList(
          sessions.map((s) => ({
            name: s.name,
            provider: s.provider,
            model: s.model,
            updatedAt: s.updatedAt,
          }))
        );
        return true;
      }

      case "model": {
        const newModel = args[0];
        if (!newModel) {
          render.error(`Usage: /model <model-name>  (current: ${state.model})`);
          return true;
        }
        state.model = newModel;
        render.success(`Model switched to: ${chalk.yellow(newModel)}`);
        return true;
      }

      case "provider": {
        const newProvider = args[0] as ProviderName;
        if (!newProvider || !["gemini", "anthropic", "openai", "openrouter"].includes(newProvider)) {
          render.error("Usage: /provider <gemini|anthropic|openai|openrouter>");
          return true;
        }
        const newKey = args[1] ?? state.apiKey;
        state.provider = newProvider;
        state.apiKey = newKey;
        render.success(`Provider switched to: ${chalk.yellow(newProvider)}`);
        if (!args[1]) {
          render.info("Using existing API key. Pass a new key as: /provider <name> <apikey>");
        }
        return true;
      }

      case "history": {
        if (state.history.length === 0) {
          render.info("No messages in this session.");
          return true;
        }
        console.log();
        for (const msg of state.history) {
          if (msg.role === "user") {
            console.log(chalk.cyan("  ❯ ") + chalk.white(msg.content));
          } else if (msg.role === "assistant") {
            const preview = msg.content.slice(0, 120).replace(/\n/g, " ");
            console.log(chalk.green("  ◆ ") + chalk.dim(preview + (msg.content.length > 120 ? "…" : "")));
          } else if (msg.role === "tool") {
            console.log(chalk.dim(`  ⚙ [${msg.toolName}] `) + chalk.dim(msg.content.slice(0, 80)));
          }
        }
        console.log();
        return true;
      }

      default: {
        render.error(`Unknown command: /${cmd}  (try /help)`);
        return true;
      }
    }
  }

  // ── Message handler ─────────────────────────────────────────────────────────
  async function handleMessage(input: string) {
    try {
      const provider = createProvider(state.provider, state.apiKey, state.model);

      state.history = await runAgentLoop(
        input,
        state.history,
        provider,
        async (role, content, toolName) => {
          await saveMessage(state.sessionId, role, content, toolName);
        }
      );
    } catch (err: unknown) {
      const error = err as Error;
      render.error(`Agent error: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error);
      }
    }
  }

  // ── Start loop ──────────────────────────────────────────────────────────────
  const { prompt } = createInputLoop(handleMessage, handleCommand);
  prompt();
}

// ── Session init helper ───────────────────────────────────────────────────────

async function initSession(
    name: string,
    provider: ProviderName,
    model: string,
    apiKey: string
): Promise<AgentState> {
    const session = await getOrCreateSession(name, provider, model);
    const history = await loadMessages(session.id);
    return {
        sessionId: session.id,
        sessionName: session.name,
        provider: session.provider as ProviderName,
        model: session.model,
        apiKey,
        history,
    };
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

process.on("SIGTERM", async () => {
    await disconnect();
    process.exit(0);
});

process.on("uncaughtException", (err) => {
    render.error(`Uncaught error: ${err.message}`);
    if (process.env.DEBUG) console.error(err);
});

main().catch(async (err) => {
    render.error(`Fatal: ${err.message}`);
    if (process.env.DEBUG) console.error(err);
    await disconnect();
    process.exit(1);
});