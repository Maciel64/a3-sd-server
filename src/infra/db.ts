import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import Elysia from "elysia";

export const prisma = new PrismaClient({
	adapter: new PrismaPg({
		connectionString: process.env.DATABASE_URL as string,
	}),
});

export const prismaPlugin = new Elysia().decorate("prisma", prisma);
