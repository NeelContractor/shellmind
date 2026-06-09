import type { LLMProvider, ProviderName } from "./types.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { OpenAIProvider } from "./openai.ts";
import { GeminiProvider } from "./gemini.ts";

export function createProvider(
  providerName: ProviderName,
  apiKey: string,
  model: string
): LLMProvider {
    switch (providerName) {
        case "anthropic":
            return new AnthropicProvider(apiKey, model);

        case "openai":
            return new OpenAIProvider(apiKey, model);

        case "openrouter":
            return new OpenAIProvider(apiKey, model, "https://openrouter.ai/api/v1");

        case "gemini":
            return new GeminiProvider(apiKey, model);

        default:
            throw new Error(`Unknown provider: ${providerName}`);
    }
}

export type { LLMProvider, ProviderName };