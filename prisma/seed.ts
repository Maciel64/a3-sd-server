import { prisma } from "../src/infra/db";

async function seed() {
	await prisma.$queryRaw`
    CREATE INDEX IF NOT EXISTS resident_embedding_idx 
    ON "Resident"
    USING hnsw (embedding vector_cosine_ops);
  `;
}

seed();
