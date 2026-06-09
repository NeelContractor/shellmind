import type { ChatMessage } from "../llm/types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanAction =
  | "direct"      // Just respond — no tools needed
  | "read"        // Needs to read files / explore codebase first
  | "write"       // Will create or modify files
  | "shell"       // Needs to run commands (install, test, build, git)
  | "search"      // Needs web search for docs / answers
  | "multi";      // Complex task needing multiple tool types

export interface Plan {
  action: PlanAction;
  reasoning: string;        // short explanation of why
  suggestedTools: string[]; // ordered list of tools likely needed
  isDestructive: boolean;   // flag if write/shell actions may modify things
}

// ── Keyword sets ──────────────────────────────────────────────────────────────

const READ_SIGNALS = [
  "read", "show", "open", "look at", "inspect", "view", "check",
  "what is in", "what does", "explain this", "understand", "find in",
  "list files", "ls", "dir", "tree", "cat", "contents of",
];

const WRITE_SIGNALS = [
  "write", "create", "make", "build", "add", "implement", "generate",
  "scaffold", "update", "edit", "modify", "change", "fix", "refactor",
  "rename", "move", "delete file", "remove file",
];

const SHELL_SIGNALS = [
  "run", "execute", "install", "npm", "bun", "yarn", "pnpm", "pip",
  "test", "build", "compile", "start", "deploy", "git", "push", "pull",
  "commit", "clone", "migrate", "seed", "docker", "kill", "restart",
];

const SEARCH_SIGNALS = [
  "how do i", "how to", "what is", "explain", "documentation", "docs",
  "example of", "tutorial", "difference between", "best way to",
  "latest", "current", "version of", "api for", "library for",
  "error:", "cannot find", "not working", "why is",
];

const DESTRUCTIVE_SIGNALS = [
  "delete", "remove", "drop", "truncate", "overwrite", "replace",
  "reset", "clean", "purge", "wipe", "rm ", "uninstall",
];

// ── Planner ───────────────────────────────────────────────────────────────────

export function plan(userMessage: string, history: ChatMessage[]): Plan {
  const msg = userMessage.toLowerCase();
  const isOngoing = history.length > 0;

  // Score each action type
  const scores: Record<PlanAction, number> = {
    direct: 0,
    read: 0,
    write: 0,
    shell: 0,
    search: 0,
    multi: 0,
  };

  for (const sig of READ_SIGNALS)    if (msg.includes(sig)) scores.read++;
  for (const sig of WRITE_SIGNALS)   if (msg.includes(sig)) scores.write++;
  for (const sig of SHELL_SIGNALS)   if (msg.includes(sig)) scores.shell++;
  for (const sig of SEARCH_SIGNALS)  if (msg.includes(sig)) scores.search++;

  // Boost: if message contains a file path pattern
  if (/[./][\w-]+\.\w+/.test(userMessage)) scores.read += 2;

  // Boost: if it's a question without file refs → probably search or direct
  if (msg.endsWith("?") && scores.read === 0 && scores.write === 0) {
    scores.search++;
  }

  // Boost: short conversational messages → direct
  if (userMessage.split(" ").length < 5) scores.direct += 2;

  // Ongoing task context — if we've been writing, keep writing
  if (isOngoing) {
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    if (lastAssistant?.content.includes("```")) scores.write++;
  }

  // Check destructiveness
  const isDestructive = DESTRUCTIVE_SIGNALS.some((sig) => msg.includes(sig));

  // Determine if multi-step (2+ types scoring > 0)
  const activeTypes = (Object.entries(scores) as [PlanAction, number][])
    .filter(([k, v]) => k !== "direct" && k !== "multi" && v > 0);

  if (activeTypes.length >= 2) {
    return {
      action: "multi",
      reasoning: `Task involves multiple steps: ${activeTypes.map(([k]) => k).join(", ")}`,
      suggestedTools: buildToolOrder(activeTypes.map(([k]) => k)),
      isDestructive,
    };
  }

  // Pick the highest scoring single action
  const best = (Object.entries(scores) as [PlanAction, number][])
    .filter(([k]) => k !== "multi")
    .sort(([, a], [, b]) => b - a)[0];

  const action: PlanAction = best[1] > 0 ? best[0] : "direct";

  return {
    action,
    reasoning: reasoningFor(action, userMessage),
    suggestedTools: toolsFor(action),
    isDestructive,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toolsFor(action: PlanAction): string[] {
  switch (action) {
    case "read":    return ["readFile"];
    case "write":   return ["readFile", "writeFile"];
    case "shell":   return ["shell"];
    case "search":  return ["webSearch"];
    case "multi":   return ["readFile", "writeFile", "shell", "webSearch"];
    case "direct":
    default:        return [];
  }
}

function buildToolOrder(types: PlanAction[]): string[] {
  // Sensible ordering: read first, then write, then shell, then search
  const order: Record<string, number> = {
    read: 0, write: 1, shell: 2, search: 3,
  };
  const tools: string[] = [];
  const sorted = [...types].sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9));
  for (const t of sorted) {
    tools.push(...toolsFor(t).filter((x) => !tools.includes(x)));
  }
  return tools;
}

function reasoningFor(action: PlanAction, msg: string): string {
  switch (action) {
    case "read":
      return "Message references files or code — will read before responding.";
    case "write":
      return "Message asks to create or modify code/files.";
    case "shell":
      return "Message involves running a command or process.";
    case "search":
      return "Message is a question that may need current docs or web info.";
    case "direct":
    default:
      return "Simple conversational message — no tools needed.";
  }
}

// ── Pretty print for debug / render ──────────────────────────────────────────

export function formatPlan(p: Plan): string {
  const tools = p.suggestedTools.length > 0
    ? ` → [${p.suggestedTools.join(", ")}]`
    : "";
  const warn = p.isDestructive ? " ⚠ destructive" : "";
  return `${p.action}${tools}${warn}`;
}
