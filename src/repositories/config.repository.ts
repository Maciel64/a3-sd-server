import type Elysia from "elysia";
import { prisma } from "../infra/db";

export class ConfigRepository {
	async upsert(name: string, value: string | number | boolean) {
		return await prisma.config.upsert({
			where: { name },
			create: {
				name,
				value: String(value),
				type:
					typeof value === "string"
						? "STRING"
						: typeof value === "number"
							? "NUMBER"
							: "BOOLEAN",
			},
			update: { value: String(value) },
		});
	}

	async get(name: string) {
		return await prisma.config.findUnique({ where: { name } });
	}
}

export const configRepositoryPlugin = (app: Elysia) =>
	app.decorate("configRepository", new ConfigRepository());
