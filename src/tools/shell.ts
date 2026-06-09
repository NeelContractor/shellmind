import { exec } from "child_process";
import { promisify } from "util";
import { render } from "../tui/render.ts";
import { ask } from "../tui/input.ts";

const execAsync = promisify(exec);

// Commands that always require explicit user approval
const DANGEROUS_PATTERNS = [
    /\brm\s+-rf?\b/,
    /\brmdir\b/,
    /\bdrop\s+table/i,
    /\btruncate\b/i,
    /\bformat\b/,
    /\bdd\s+if=/,
    /\bsudo\b/,
    /\bchmod\s+777\b/,
    /\bkill\s+-9\b/,
    /\b>\s*\/dev\//,
    /curl.*\|\s*(bash|sh)/,
    /wget.*\|\s*(bash|sh)/,
];

function isDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

export async function shell(
    args: { command: string },
    requireApproval = false
): Promise<string> {
    const { command } = args;

    const needsApproval = requireApproval || isDangerous(command);

    if (needsApproval) {
        const answer = await ask(render.approvalPrompt(command));
        if (!answer.toLowerCase().startsWith("y")) {
            return "Command cancelled by user.";
        }
    }

    try {
        const { stdout, stderr } = await execAsync(command, {
            timeout: 30_000, // 30s timeout
            maxBuffer: 1024 * 1024, // 1MB output cap
            cwd: process.cwd(),
        });

        const output = [stdout, stderr].filter(Boolean).join("\n").trim();
        return output || "(no output)";
    } catch (err: unknown) {
        const error = err as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
        if (error.killed) {
            return "Error: Command timed out after 30 seconds";
        }
        const output = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n").trim();
        return `Error: ${output}`;
    }
}