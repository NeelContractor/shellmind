import { GoogleGenAI } from "@google/genai";
import type { LLMProvider, ChatMessage, ToolDefinition, LLMResponse, ToolCall } from "./types.ts";

export class GeminiProvider implements LLMProvider {
    private client: GoogleGenAI;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.client = new GoogleGenAI({ apiKey });
        this.model = model;
    }

    private formatMessages(messages: ChatMessage[]) {
        return messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));
    }

    private formatTools(tools: ToolDefinition[]) {
        return [
            {
                functionDeclarations: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters,
                })),
            },
        ];
    }

    async chat(messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string): Promise<LLMResponse> {
        const response = await this.client.models.generateContent({
            model: this.model,
            contents: this.formatMessages(messages),
            config: {
                systemInstruction: systemPrompt,
                tools: tools.length > 0 ? this.formatTools(tools) : undefined,
            },
        });

        const content = response.text ?? "";
        const toolCalls: ToolCall[] = [];

        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.functionCall) {
                toolCalls.push({
                    id: crypto.randomUUID(),
                    name: part.functionCall.name ?? "",
                    args: (part.functionCall.args as Record<string, unknown>) ?? {},
                });
            }
        }

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

        const stream = await this.client.models.generateContentStream({
            model: this.model,
            contents: this.formatMessages(messages),
            config: {
                systemInstruction: systemPrompt,
                tools: tools.length > 0 ? this.formatTools(tools) : undefined,
            },
        });

        for await (const chunk of stream) {
            const text = chunk.text ?? "";
            if (text) {
                onChunk(text);
                fullContent += text;
            }
            for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
                if (part.functionCall) {
                    toolCalls.push({
                        id: crypto.randomUUID(),
                        name: part.functionCall.name ?? "",
                        args: (part.functionCall.args as Record<string, unknown>) ?? {},
                    });
                }
            }
        }

        return { content: fullContent, toolCalls };
    }
}