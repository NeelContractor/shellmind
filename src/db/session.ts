import { getClient } from "./client.ts";

export async function getOrCreateSession(
    name: string,
    provider: string,
    model: string
) {
    const db = getClient();
    const existing = await db.session.findUnique({ where: { name } });
    if (existing) {
        // Update provider/model if they changed
        if (existing.provider !== provider || existing.model !== model) {
            return db.session.update({
                where: { name },
                data: { provider, model },
            });
        }
        return existing;
    }
    return db.session.create({ data: { name, provider, model } });
}

export async function listSessions() {
    const db = getClient();
    return db.session.findMany({
        orderBy: { updatedAt: "desc" },
        take: 20,
    });
}

export async function deleteSession(name: string) {
    const db = getClient();
    return db.session.delete({ where: { name } });
}