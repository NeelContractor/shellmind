export type ProviderName = "gemini" | "anthropic" | "openai" | "openrouter";

export interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls: ToolCall[];
}

export interface LLMProvider {
  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt: string
  ): Promise<LLMResponse>;
  stream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    systemPrompt: string,
    onChunk: (text: string) => void
  ): Promise<LLMResponse>;
}
