import type { LLMProvider, ChatMessage } from "../llm/types.ts";
import { TOOL_DEFINITIONS } from "../tools/index.ts";
import { executeTool } from "../tools/executor.ts";
import { render } from "../tui/render.ts";
import { plan, formatPlan } from "./planner.ts";

const SYSTEM_PROMPT = `You are a highly capable coding agent running in a terminal. You help users write code, debug issues, explore codebases, and solve technical problems.

You have access to these tools:
- readFile: Read file contents or list directories
- writeFile: Create or update files
- shell: Run shell commands (tests, installs, git, etc.)
- webSearch: Search the web for documentation and answers

Guidelines:
- Be concise and direct. This is a terminal, not a chat interface.
- Use tools proactively — don't ask if you should read a file, just read it.
- For multi-step tasks, plan first then execute step by step.
- When writing code, always write the complete file content.
- Run commands immediately when asked. Only ask for confirmation if the command is clearly destructive (rm -rf, drop table, etc.).
- Format code with proper language fences in your responses.
- When done with a task, summarize what was accomplished.`;

const MAX_TOOL_ITERATIONS = 10;

export async function runAgentLoop(
    userMessage: string,
    history: ChatMessage[],
    provider: LLMProvider,
    onSave: (role: "user" | "assistant" | "tool", content: string, toolName?: string) => Promise<void>
): Promise<ChatMessage[]> {
    // Save user message first
    await onSave("user", userMessage);

    // Build message history
    const messages: ChatMessage[] = [...history, { role: "user", content: userMessage }];

    // Run planner to narrow tool set
    const agentPlan = plan(userMessage, history);
    if (process.env.DEBUG) render.info(`plan: ${formatPlan(agentPlan)}`);

    // Only pass tools the planner thinks are needed
    const activeTools =
        agentPlan.action === "direct"
            ? []
            : agentPlan.suggestedTools.length > 0
            ? TOOL_DEFINITIONS.filter((t) => agentPlan.suggestedTools.includes(t.name))
            : TOOL_DEFINITIONS;

    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;

        render.agentStart();
        render.thinking();

        // use activeTools, not TOOL_DEFINITIONS
        const response = await provider.stream(
            messages,
            activeTools,
            SYSTEM_PROMPT,
            (chunk) => {
                render.clearThinking();
                render.agentChunk(chunk);
            }
        );

        render.clearThinking();

        // No tool calls — done
        if (response.toolCalls.length === 0) {
            if (response.content) {
                render.agentEnd();
                await onSave("assistant", response.content);
                messages.push({ role: "assistant", content: response.content });
            }
            break;
        }

        // Tool calls present — print any text first
        if (response.content) {
            render.agentEnd();
            await onSave("assistant", response.content);
            messages.push({ role: "assistant", content: response.content });
        } else {
            console.log();
        }

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
            render.toolCall(toolCall.name, toolCall.args);

            const result = await executeTool(toolCall.name, toolCall.args);
            const isError = result.startsWith("Error:");

            render.toolResult(result, isError);

            const toolMessage: ChatMessage = {
                role: "tool",
                content: result,
                toolName: toolCall.name,
            };
            await onSave("tool", result, toolCall.name);
            messages.push(toolMessage);
        }
    }

    if (iterations >= MAX_TOOL_ITERATIONS) {
        render.error(`Reached maximum tool iterations (${MAX_TOOL_ITERATIONS}). Stopping.`);
    }

    return messages;
}