import * as readline from "readline";
import { render } from "./render.ts";

let _rl: readline.Interface | null = null;

export function createInputLoop(
    onMessage: (input: string) => Promise<void>,
    onCommand: (cmd: string, args: string[]) => Promise<boolean>
) {
    _rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
    });

    _rl.on("SIGINT", () => {
        console.log();
        render.info("Use /exit to quit.");
        prompt();
    });

    // Prevent readline from closing on unexpected stream events
    _rl.on("close", () => {
        // Reopen if we didn't intentionally close
        if (_rl) {
            _rl = null;
        }
    });

    function prompt() {
        if (!_rl) return;
        _rl.question(render.userPrompt(), async (input) => {
            input = input.trim();

            if (!input) {
                prompt();
                return;
            }

            if (input.startsWith("/")) {
                const parts = input.slice(1).split(/\s+/);
                const cmd = parts[0].toLowerCase();
                const args = parts.slice(1);
                const shouldContinue = await onCommand(cmd, args);
                if (shouldContinue) prompt();
                return;
            }

            await onMessage(input);
            prompt();
        });
    }

    return { prompt, close: () => { _rl?.close(); _rl = null; } };
}

// One-shot question — reuses the existing readline to avoid stdin conflicts
export function ask(question: string): Promise<string> {
    return new Promise((resolve) => {
        if (_rl) {
            // Pause the main loop's readline and ask inline
            _rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        } else {
            // Fallback: create a temporary one
            const tmp = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: true,
            });
            tmp.question(question, (answer) => {
                tmp.close();
                resolve(answer.trim());
            });
        }
    });
}