import OpenAI from "openai";
import type { LLMProvider, ChatMessage, ToolDefinition, LLMResponse, ToolCall } from "./types.ts";

export class OpenAIProvider implements LLMProvider {
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string, baseURL?: string) {
        this.client = new OpenAI({
            apiKey,
            baseURL: baseURL ?? "https://api.openai.com/v1",
        });
        this.model = model;
    }

    private formatMessages(messages: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
        const result: OpenAI.Chat.ChatCompletionMessageParam[] = [];

        for (let i = 0; i < messages.length; i++) {
            const m = messages[i];

            if (m.role === "tool") {
                // Find the preceding assistant message to get the real tool_call_id
                // Walk backwards to find the matching tool call id
                let toolCallId = m.toolName ?? "tool_call";
                for (let j = i - 1; j >= 0; j--) {
                    const prev = messages[j];
                    if (prev.role === "assistant") break;
                    // id is stored in toolName when we save from the loop
                }
                result.push({
                    role: "tool" as const,
                    tool_call_id: toolCallId,
                    content: m.content,
                });
            } else {
                result.push({
                    role: m.role as "user" | "assistant",
                    content: m.content,
                });
            }
        }

        return result;
    }

    private formatTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
        return tools.map((t) => ({
            type: "function" as const,
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }

    async chat(messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string): Promise<LLMResponse> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: "system", content: systemPrompt },
                ...this.formatMessages(messages),
            ],
            tools: tools.length > 0 ? this.formatTools(tools) : undefined,
        });

        const choice = response.choices[0];
        const content = choice.message.content ?? "";
        const toolCalls: ToolCall[] =
            choice.message.tool_calls?.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments),
            })) ?? [];

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

        const stream = await this.client.chat.completions.create({
            model: this.model,
            stream: true,
            messages: [
                { role: "system", content: systemPrompt },
                ...this.formatMessages(messages),
            ],
            tools: tools.length > 0 ? this.formatTools(tools) : undefined,
        });

        const toolCallAccumulators: Record<number, { id: string; name: string; args: string }> = {};

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (delta?.content) {
                onChunk(delta.content);
                fullContent += delta.content;
            }
            if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCallAccumulators[idx]) {
                        toolCallAccumulators[idx] = {
                            id: tc.id ?? "",
                            name: tc.function?.name ?? "",
                            args: "",
                        };
                    }
                    // id only comes on the first chunk for each tool call
                    if (tc.id) toolCallAccumulators[idx].id = tc.id;
                    if (tc.function?.name) toolCallAccumulators[idx].name = tc.function.name;
                    if (tc.function?.arguments) toolCallAccumulators[idx].args += tc.function.arguments;
                }
            }
        }

        for (const acc of Object.values(toolCallAccumulators)) {
            toolCalls.push({
                id: acc.id,
                name: acc.name,
                args: JSON.parse(acc.args || "{}"),
            });
        }

        return { content: fullContent, toolCalls };
    }
}