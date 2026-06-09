import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, ChatMessage, ToolDefinition, LLMResponse, ToolCall } from "./types.ts";

export class AnthropicProvider implements LLMProvider {
    private client: Anthropic;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    private formatMessages(messages: ChatMessage[]) {
        return messages
            .filter((m) => m.role !== "tool")
            .map((m) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
            }));
    }

    private formatTools(tools: ToolDefinition[]) {
        return tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters as Anthropic.Tool["input_schema"],
        }));
    }

    async chat(messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string): Promise<LLMResponse> {
        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: this.formatMessages(messages),
            tools: tools.length > 0 ? this.formatTools(tools) : undefined,
        });

        const content = response.content
            .filter((b) => b.type === "text")
            .map((b) => (b as Anthropic.TextBlock).text)
            .join("");

        const toolCalls: ToolCall[] = response.content
            .filter((b) => b.type === "tool_use")
            .map((b) => {
                const tb = b as Anthropic.ToolUseBlock;
                return {
                    id: tb.id,
                    name: tb.name,
                    args: tb.input as Record<string, unknown>,
                };
            });

        return { content, toolCalls };
    }

    async stream(
        messages: ChatMessage[],
        tools: ToolDefinition[],
        systemPrompt: string,
        onChunk: (text: string) => void
    ): Promise<LLMResponse> {
        let fullContent = "";
        const toolCalls: ToolCall[] = [];

        const stream = await this.client.messages.stream({
            model: this.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: this.formatMessages(messages),
            tools: tools.length > 0 ? this.formatTools(tools) : undefined,
        });

        for await (const event of stream) {
            if (event.type === "content_block_delta") {
                if (event.delta.type === "text_delta") {
                    onChunk(event.delta.text);
                    fullContent += event.delta.text;
                }
            }
        }

        const finalMessage = await stream.finalMessage();
        for (const block of finalMessage.content) {
            if (block.type === "tool_use") {
                toolCalls.push({
                    id: block.id,
                    name: block.name,
                    args: block.input as Record<string, unknown>,
                });
            }
        }

        return { content: fullContent, toolCalls };
    }
}