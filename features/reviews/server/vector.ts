import type { CodeChunk } from "@/features/reviews/types/review";
import { getPineconeIndex } from "@/features/pinecone/client";

const CONTEXT_RESULTS = 10;
// Schema-based index: the documents API caps a batch at 96 when the schema
// declares an `embed` field (ours embeds `chunk_text`).
const UPSERT_BATCH_SIZE = 90;

export function buildPrNamespace(repoFullName: string, prNumber: number) {
    return `${repoFullName.replace("/", "--")}--pr-${prNumber}`;
}

// The index has a document schema (`title` + embedded `chunk_text`), so writes
// must go through the documents API instead of the legacy vectors/records API.
function toDocument(chunk: CodeChunk) {
    return {
        _id: chunk.id,
        title: chunk.filePath,
        chunk_text: chunk.text,
    };
}

export async function saveChunksToPinecone(
    namespace: string,
    chunks: CodeChunk[]
) {
    const index = getPineconeIndex();

    // namespace() scopes documents so this PR never mixes with repo-wide sync data
    for (let start = 0; start < chunks.length; start += UPSERT_BATCH_SIZE) {
        const batch = chunks.slice(start, start + UPSERT_BATCH_SIZE);

        await index.namespace(namespace).documents.upsert({
            documents: batch.map(toDocument),
        });
    }
}


export async function searchPrContext(namespace: string, query: string) {
    const index = getPineconeIndex();

    // `embed` scoring asks Pinecone to embed the query with the same model that
    // embedded `chunk_text` (llama-text-embed-v2) before ranking.
    const response = await index.namespace(namespace).documents.search({
        scoreBy: [{ type: "embed", field: "chunk_text", query }],
        topK: CONTEXT_RESULTS,
        includeFields: ["title", "chunk_text"],
    });

    const snippets: string[] = [];

    for (const match of response.matches) {
        const text = match.chunk_text as string | undefined;
        if (!text) {
            continue;
        }

        snippets.push(`File: ${match.title}\n${text}`);
    }

    return snippets;
}