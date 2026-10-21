import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer | null = null;

/**
 * Starts an in-memory MongoDB and wires the app's db.ts singleton to it.
 * Must be called before importing anything that pulls in @/lib/db.
 */
export async function startTestMongo(): Promise<void> {
  if (mongod) return;

  // Fixed port: dynamic port binding has proven flaky on this machine.
  mongod = await MongoMemoryServer.create({
    instance: { port: 55001, launchTimeout: 60_000 },
  });

  process.env.MONGODB_URI = mongod.getUri("test_db");
  process.env.MONGODB_DB = "test_db";
}

export async function stopTestMongo(): Promise<void> {
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export function mongoUri(): string {
  if (!mongod) throw new Error("Test Mongo not started");
  return mongod.getUri("test_db");
}
