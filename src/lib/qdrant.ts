import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

export const COLLECTION = "nochbot_chunks"; // ← FIXED: match your Qdrant dashboard

const VECTOR_SIZE = 3072; // ← FIXED: match what's stored (3072 shown in screenshot)

export async function ensureCollection() {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION
    );

    if (!exists) {
      await qdrant.createCollection(COLLECTION, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });

      await qdrant.createPayloadIndex(COLLECTION, {
        field_name: "userId",
        field_schema: "keyword",
      });

      console.log("✅ Qdrant collection created:", COLLECTION);
    }
  } catch (err) {
    console.error("❌ Qdrant connection failed:", err);
    throw err;
  }
}