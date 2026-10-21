import { beforeEach, describe, expect, it, vi } from "vitest";

// $vectorSearch needs Atlas, so these tests check the pipelines and filters
// the store sends rather than running real searches.
const aggregate = vi.fn();
const deleteMany = vi.fn();
const insertMany = vi.fn();
const readKnowledge = vi.fn();

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    collection: () => ({
      aggregate: (pipeline: unknown) => {
        aggregate(pipeline);
        return { toArray: async () => [] };
      },
      deleteMany,
      insertMany,
      createIndex: async () => undefined,
      listSearchIndexes: () => ({
        toArray: async () => [
          { latestDefinition: { fields: [{ type: "filter", path: "userId" }, { type: "filter", path: "generationId" }] } },
        ],
      }),
      updateSearchIndex: vi.fn(),
    }),
  }),
}));
vi.mock("@/lib/storage", () => ({ readKnowledge }));

const store = await import("./vectorStore");

beforeEach(() => {
  aggregate.mockClear();
  deleteMany.mockClear();
  insertMany.mockClear();
  readKnowledge.mockReset();
});

function vectorStage() {
  return (aggregate.mock.calls[0][0] as Record<string, any>[])[0].$vectorSearch;
}

describe("searchKnowledgeChunks", () => {
  it("searches only the active generation of the owning user", async () => {
    readKnowledge.mockResolvedValue({ activeGenerationId: "gen-2" });
    await store.searchKnowledgeChunks("user-1", [0.1], 5);
    expect(vectorStage().filter).toEqual({ userId: "user-1", generationId: "gen-2" });
    expect(vectorStage().limit).toBe(5);
  });

  it("searches only untagged legacy chunks for users without an active generation", async () => {
    readKnowledge.mockResolvedValue({});
    await store.searchKnowledgeChunks("user-1", [0.1], 5);
    const pipeline = aggregate.mock.calls[0][0] as Record<string, any>[];
    expect(vectorStage().filter).toEqual({ userId: "user-1" });
    expect(pipeline).toContainEqual({ $match: { generationId: { $exists: false } } });
    expect(pipeline).toContainEqual({ $limit: 5 });
  });
});

describe("generation writes", () => {
  it("stamps staged chunks with the owner and generation, whatever the payload says", async () => {
    await store.insertKnowledgeGeneration("user-1", "gen-3", [
      { id: "gen-3:0", vector: [0.1], payload: { userId: "someone-else", text: "t", chunkIndex: 0 } },
    ]);
    expect(insertMany.mock.calls[0][0][0]).toMatchObject({ userId: "user-1", generationId: "gen-3", pointId: "gen-3:0" });
  });

  it("cleanup keeps only the active generation for that user", async () => {
    await store.deleteInactiveKnowledgeGenerations("user-1", "gen-3");
    expect(deleteMany).toHaveBeenCalledWith({ userId: "user-1", generationId: { $ne: "gen-3" } });
  });
});
