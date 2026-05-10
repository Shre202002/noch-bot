// import { QdrantClient } from "@qdrant/js-client-rest";

// const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
// const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

// export const qdrant = new QdrantClient({
//   url: QDRANT_URL,
//   apiKey: QDRANT_API_KEY,
// });

// export const COLLECTION = "nochbot_chunks";
// export const QDRANT_COLLECTION_NAME = COLLECTION;

// /**
//  * Ensures that the required Qdrant collection exists.
//  */
// export async function ensureCollection() {
//   try {
//     const collections = await qdrant.getCollections();
//     const exists = collections.collections.some((c) => c.name === COLLECTION);
//     if (!exists) {
//       await qdrant.createCollection(COLLECTION, {
//         vectors: {
//           size: 3072, // Dimensionality of Gemini gemini-embedding-001
//           distance: "Cosine",
//         },
//       });
//       console.log(`Created Qdrant collection: ${COLLECTION}`);
//     }
//   } catch (error) {
//     console.error("Error ensuring Qdrant collection:", error);
//     throw error;
//   }
// }

// /**
//  * Alias to maintain compatibility with other parts of the app.
//  */
// export const qdrantClient = qdrant;

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