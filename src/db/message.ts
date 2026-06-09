import { getClient } from "./client.ts";
import type { ChatMessage } from "../llm/types.ts";

export async function saveMessage(
    sessionId: string,
    role: "user" | "assistant" | "tool",
    content: string,
    toolName?: string
) {
    const db = getClient();
    return db.message.create({
        data: { sessionId, role, content, toolName },
    });
}

export async function loadMessages(sessionId: string): Promise<ChatMessage[]> {
    const db = getClient();
    const rows = await db.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
        role: r.role as ChatMessage["role"],
        content: r.content,
        toolName: r.toolName ?? undefined,
    }));
}

export async function clearMessages(sessionId: string) {
    const db = getClient();
    return db.message.deleteMany({ where: { sessionId } });
}