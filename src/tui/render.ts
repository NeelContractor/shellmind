import chalk from "chalk";

const ICONS = {
    user: "❯",
    agent: "◆",
    tool: "⚙",
    result: "↳",
    error: "✖",
    info: "ℹ",
    success: "✔",
    thinking: "…",
    separator: "─",
};

// Track whether we're currently in a streaming response
let _isStreaming = false;
let _thinkingVisible = false;

export const render = {
    clearLine() {
        process.stdout.write("\x1b[1A\x1b[2K");
    },

    gap() {
        console.log();
    },

    banner(sessionName: string, provider: string, model: string) {
        console.log();
        console.log(chalk.bold.cyan("  code-agent") + chalk.dim(" v1"));
        console.log(
            chalk.dim(`  session: `) +
            chalk.white(sessionName) +
            chalk.dim("  ·  ") +
            chalk.yellow(provider) +
            chalk.dim("/") +
            chalk.yellow(model)
        );
        console.log(chalk.dim("  " + "─".repeat(50)));
        console.log(
            chalk.dim("  type ") +
            chalk.white("/help") +
            chalk.dim(" for commands, ") +
            chalk.white("/exit") +
            chalk.dim(" to quit")
        );
        console.log();
    },

    userPrompt() {
        return chalk.cyan(ICONS.user + " ");
    },

    // Called once before streaming begins — prints the ◆ prefix on its own line
    agentStart() {
        _isStreaming = false;
        process.stdout.write("\n" + chalk.green(ICONS.agent + " "));
    },

    // Called with each streamed text chunk
    agentChunk(text: string) {
        if (_thinkingVisible) {
            // Erase the thinking line before first chunk
            process.stdout.write("\r\x1b[2K");
            process.stdout.write(chalk.green(ICONS.agent + " "));
            _thinkingVisible = false;
        }
        _isStreaming = true;
        process.stdout.write(chalk.white(text));
    },

    // Called after streaming is done
    agentEnd() {
        if (_isStreaming) {
            console.log(); // end the streamed line
        }
        console.log();
        _isStreaming = false;
    },

    // Shows thinking indicator on same line as ◆ prefix
    thinking() {
        process.stdout.write(chalk.dim(`${ICONS.thinking} thinking...`));
        _thinkingVisible = true;
    },

    // Erases thinking indicator — chunk will reprint the ◆ prefix
    clearThinking() {
        if (_thinkingVisible) {
            process.stdout.write("\r\x1b[2K");
            _thinkingVisible = false;
        }
    },

    toolCall(toolName: string, args: Record<string, unknown>) {
        const preview = formatToolArgs(toolName, args);
        console.log(chalk.dim(`\n  ${ICONS.tool} `) + chalk.cyan(toolName) + chalk.dim(": ") + chalk.white(preview));
    },

    toolResult(result: string, isError = false) {
        const lines = result.trim().split("\n").slice(0, 10);
        const truncated = result.trim().split("\n").length > 10;
        const color = isError ? chalk.red : chalk.dim;

        lines.forEach((line, i) => {
            const prefix = i === 0 ? `  ${ICONS.result} ` : "    ";
            console.log(color(prefix + line));
        });

        if (truncated) {
            console.log(chalk.dim(`    … (truncated)`));
        }
        console.log();
    },

    approvalPrompt(command: string): string {
        return (
            chalk.yellow(`\n  ⚠  Run shell command: `) +
            chalk.white.bold(command) +
            chalk.yellow(`\n  Allow? `) +
            chalk.dim("[y/N] ")
        );
    },

    info(msg: string) {
        console.log(chalk.dim(`  ${ICONS.info} `) + chalk.white(msg));
    },

    success(msg: string) {
        console.log(chalk.green(`  ${ICONS.success} `) + chalk.white(msg));
    },

    error(msg: string) {
        console.log(chalk.red(`\n  ${ICONS.error} `) + chalk.white(msg));
        console.log();
    },

    help() {
        console.log();
        console.log(chalk.bold.white("  Commands:"));
        const cmds = [
            ["/exit, /quit",         "Exit the agent"],
            ["/clear",               "Clear conversation context (keeps session in DB)"],
            ["/session <name>",      "Switch to or create a named session"],
            ["/sessions",            "List all saved sessions"],
            ["/model <name>",        "Switch model mid-conversation"],
            ["/provider <name>",     "Switch provider (gemini/anthropic/openai/openrouter)"],
            ["/history",             "Show conversation history for current session"],
            ["/help",                "Show this help"],
        ];
        cmds.forEach(([cmd, desc]) => {
            console.log(chalk.cyan(`    ${cmd.padEnd(24)}`) + chalk.dim(desc));
        });
        console.log();
    },

    sessionList(sessions: Array<{ name: string; provider: string; model: string; updatedAt: Date }>) {
        if (sessions.length === 0) {
            render.info("No saved sessions found.");
            return;
        }
        console.log();
        console.log(chalk.bold.white("  Sessions:"));
        sessions.forEach((s) => {
            const ago = timeAgo(s.updatedAt);
            console.log(
                chalk.cyan(`    ${s.name.padEnd(20)}`) +
                chalk.dim(`${s.provider}/${s.model}`) +
                chalk.dim(` · ${ago}`)
            );
        });
        console.log();
    },
};

function formatToolArgs(toolName: string, args: Record<string, unknown>): string {
    switch (toolName) {
        case "readFile":  return String(args.path);
        case "writeFile": return `${args.path} (${String(args.content ?? "").length} chars)`;
        case "shell":     return String(args.command);
        case "webSearch": return String(args.query);
        default:          return JSON.stringify(args).slice(0, 60);
    }
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}