import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

let _client: PrismaClient | null = null;

export function getClient(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({ adapter });
  }
  return _client;
}

export async function disconnect() {
  if (_client) {
    await _client.$disconnect();
    _client = null;
  }
}
