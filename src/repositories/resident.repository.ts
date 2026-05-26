import Elysia from "elysia";
import { PrismaClient, Resident } from "../generated/prisma/client";
import { prismaPlugin } from "../infra/db";

export interface CreateResidentInput {
  name: string;
  embedding: number[];
}

export class ResidentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateResidentInput) {
    return await this.prisma.$executeRaw`
      INSERT INTO "Resident" (id, name, embedding, "createdAt", "updatedAt")
      VALUES (
        ${crypto.randomUUID()},
        ${data.name},
        ${JSON.stringify(data.embedding)}::vector,
        ${new Date()},
        ${new Date()}
      )
    `
  }

  async recognize(embeed: number[]): Promise<Resident[] | null> {
    const resident = await this.prisma.$queryRaw`
      SELECT
        id,
        name,
        ${JSON.stringify(embeed)}::vector <=> embedding AS distance
      FROM "Resident"
      ORDER BY distance
      LIMIT 1;
    `

    return resident as Promise<Resident[] | null> 
  }
}

export const residentRepositoryPlugin = (app: Elysia) => 
  app
    .use(prismaPlugin)
    .resolve(({ prisma }) => {
      return {
        'residentRepository': new ResidentRepository(prisma)
      }
    })

