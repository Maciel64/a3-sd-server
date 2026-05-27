import { Elysia, t } from "elysia";
import { microApi, shotApi } from "./infra/api";
import cors from "@elysia/cors";
import { residentRepositoryPlugin } from "./repositories/resident.repository";
import { s3StorageProviderPlugin } from "./providers/s3.storage.provider";
import openapi from "@elysia/openapi";

export const app = new Elysia().get("/", () => "Hello Elysia");
app.use(openapi());
app.use(
	cors({
		origin: "*",
	}),
);

interface EmbeddingResponse {
	embedding: number[];
}

app.group("api", (app) =>
	app
		.use(residentRepositoryPlugin)
		.use(s3StorageProviderPlugin)
		.get(
			"residents",
			async ({ residentRepository }) => {
				const users = await residentRepository.getAll();

				const usersMapped = users.map((u) => ({
					...u,
					createdAt: u.createdAt.toISOString(),
					updatedAt: u.updatedAt.toISOString(),
				}));

				return usersMapped;
			},
			{
				response: {
					200: t.Array(
						t.Object({
							id: t.String(),
							name: t.String(),
							photo: t.String(),
							createdAt: t.String({
								format: "date-time",
							}),
							updatedAt: t.String({
								format: "date-time",
							}),
						}),
					),
				},
			},
		)
		.post(
			"embeed",
			async ({ request, set, residentRepository, s3StorageProvider }) => {
				const body = await request.formData();

				const name = body.get("name") as string | null;
				const photo = body.get("photo") as File | null;

				if (!name || !photo) {
					set.status = 400;
					return {
						error: "Nome e foto são obrigatórios",
					};
				}

				const existingByName = await residentRepository.findByName(name);

				if (existingByName) {
					set.status = 409;
					return {
						error: `Residente já ${existingByName.name} cadastrado`,
					};
				}

				const response = await shotApi<EmbeddingResponse>("/embeed", {
					method: "POST",
					body,
				});

				if (!response.embedding) {
					set.status = 400;

					return {
						error: "Erro ao gerar embedding",
					};
				}

				const existingByEmbedding = await residentRepository.recognize(
					response.embedding,
				);

				if (existingByEmbedding) {
					set.status = 409;

					return {
						error: `Residente já ${existingByEmbedding.name} cadastrado`,
					};
				}

				const photoBuffer = Buffer.from(await photo.arrayBuffer());
				const photoUrl = await s3StorageProvider.upload(
					photoBuffer,
					`${new Date().getTime()}.png`,
				);

				await residentRepository.create({
					name,
					embedding: response.embedding,
					photo: photoUrl,
				});

				const resident = await residentRepository.findByName(name);

				return { success: !!resident, resident };
			},
		)

		.post("recognize", async ({ request, residentRepository }) => {
			const body = await request.formData();

			const response = await shotApi<EmbeddingResponse>("/embeed", {
				method: "POST",
				body,
			});

			const resident = await residentRepository.recognize(response.embedding);

			return { success: !!resident, resident };
		}),
);

export default app;
