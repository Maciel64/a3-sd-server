import Elysia from "elysia";
import { PrismaClient, Resident } from "../generated/prisma/client";
import { prismaPlugin } from "../infra/db";
import { THRESHOLD_DISTANCE } from "../constants/recognize";
import { createId } from "@paralleldrive/cuid2";

export interface CreateResidentInput {
	name: string;
	embedding: number[];
	photo: string;
}

export class ResidentRepository {
	constructor(private readonly prisma: PrismaClient) {}

	async getAll() {
		const residents = await this.prisma.resident.findMany();

		return residents;
	}

	async create(data: CreateResidentInput) {
		await this.prisma.$executeRaw`
      INSERT INTO "Resident" (id, name, embedding, "createdAt", "updatedAt", photo)
      VALUES (
        ${createId()},
        ${data.name},
        ${JSON.stringify(data.embedding)}::vector,
        ${new Date()},
        ${new Date()},
        ${data.photo}
      )
    `;
	}

	async findByName(name: string) {
		const residents = await this.prisma.resident.findFirst({
			where: {
				name,
			},
		});
		return residents;
	}

	async recognize(embeed: number[]): Promise<Resident | null> {
		const resident = (await this.prisma.$queryRaw`
        SELECT
        id,
        name,
        embedding,
        "createdAt",
        "updatedAt",
        ${JSON.stringify(embeed)}::vector <=> embedding AS distance
      FROM "Resident"
      WHERE ${JSON.stringify(embeed)}::vector <=> embedding < ${THRESHOLD_DISTANCE}
      ORDER BY distance ASC
      LIMIT 1;
    `) as Resident[];

		return resident?.[0] ?? null;
	}
}

export const residentRepositoryPlugin = (app: Elysia) =>
	app.use(prismaPlugin).resolve(({ prisma }) => {
		return {
			residentRepository: new ResidentRepository(prisma),
		};
	});
