import { MongoClient, Db } from 'mongodb';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _mongoClientUri: string | undefined;
}

let client: MongoClient;

function getMongoConfig() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;

  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env');
  }

  return { uri, dbName };
}

export async function getClient(): Promise<MongoClient> {
  const { uri } = getMongoConfig();

  // Cache in every environment: a fresh connect per call costs a TLS handshake and leaks sockets.
  if (!global._mongoClient || global._mongoClientUri !== uri) {
    if (global._mongoClient) {
      await global._mongoClient.close();
    }
    global._mongoClient = new MongoClient(uri, { maxPoolSize: 20, serverSelectionTimeoutMS: 8000 });
    await global._mongoClient.connect();
    global._mongoClientUri = uri;
  }
  client = global._mongoClient;
  return client;
}

export async function getDb(): Promise<Db> {
  const { dbName } = getMongoConfig();
  const c = await getClient();
  return c.db(dbName);
}
