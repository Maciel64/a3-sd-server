import cors from "@elysia/cors";
import openapi from "@elysia/openapi";
import { Elysia, t } from "elysia";
import { microApi, shotApi } from "./infra/api";
import { withRetry, withTimeout } from "./infra/with";
import { s3StorageProviderPlugin } from "./providers/s3.storage.provider";
import { configRepositoryPlugin } from "./repositories/config.repository";
import { residentRepositoryPlugin } from "./repositories/resident.repository";

export const app = new Elysia().get("/", () => "Hello Elysia", {
	detail: { hide: true },
});
app.use(openapi());
app.use(
	cors({
		origin: "*",
	}),
);

const ResidentDTO = t.Object({
	id: t.String(),
	name: t.String(),
	photo: t.String(),
	createdAt: t.String({
		format: "date-time",
	}),
	updatedAt: t.String({
		format: "date-time",
	}),
});

const ConfigDTO = t.Object({
	id: t.String(),
	name: t.String(),
	value: t.String(),
	type: t.String(),
	createdAt: t.String({
		format: "date-time",
	}),
	updatedAt: t.String({
		format: "date-time",
	}),
});

const ResidentResponseDTO = t.Omit(ResidentDTO, ["photo"]);

interface EmbeddingResponse {
	embedding: number[];
}

app.group("api", (app) =>
	app
		.use(residentRepositoryPlugin)
		.use(configRepositoryPlugin)
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
					200: t.Array(ResidentDTO),
					400: t.Object({
						error: t.String(),
					}),
				},
			},
		)
		.post(
			"embeed",
			async ({ body, set, residentRepository, s3StorageProvider }) => {
				const { name, photo } = body;

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

				const formData = new FormData();
				formData.append("name", name);
				formData.append("photo", photo);

				const response = await withRetry(
					() =>
						withTimeout(
							(signal) =>
								shotApi<EmbeddingResponse>("/embeed", {
									method: "POST",
									body: formData,
									signal,
								}),
							{ timeoutMs: 5000 },
						),
					{ maxRetry: 3 },
				);

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
						error: `Residente ${existingByEmbedding.name} já cadastrado`,
					};
				}

				const photoBuffer = Buffer.from(await photo.arrayBuffer());
				const photoUrl = await s3StorageProvider.upload(
					photoBuffer,
					`${Date.now()}.png`,
				);

				await residentRepository.create({
					name,
					embedding: response.embedding,
					photo: photoUrl,
				});

				const resident = await residentRepository.findByName(name);

				if (!resident) {
					set.status = 409;
					return {
						error: "Erro ao buscar residente",
					};
				}

				const mappedResident = {
					...resident,
					createdAt: resident?.createdAt.toISOString(),
					updatedAt: resident?.updatedAt.toISOString(),
				};

				return { success: !!resident, resident: mappedResident };
			},
			{
				body: t.Object({
					name: t.String(),
					photo: t.File(),
				}),
				response: {
					200: t.Object({
						success: t.Boolean(),
						resident: ResidentResponseDTO,
					}),
					400: t.Object({
						error: t.String(),
					}),
					409: t.Object({
						error: t.String(),
					}),
				},
			},
		)

		.post(
			"recognize",
			async ({ body, set, residentRepository, configRepository }) => {
				const { photo } = body;

				const formData = new FormData();
				formData.append("photo", photo);

				const response = await shotApi<EmbeddingResponse>("/embeed", {
					method: "POST",
					body: formData,
				});

				const resident = await residentRepository.recognize(response.embedding);

				const config = await configRepository.get("microcontroller_url");

				if (!resident) {
					if (config) {
						await microApi(`${config.value}/gate`, {
							method: "POST",
							body: JSON.stringify({
								open: false,
							}),
						});
					}

					set.status = 404;
					return { success: false, error: "Residente não encontrado" };
				}

				const mappedResident = {
					...resident,
					createdAt: resident.createdAt.toISOString(),
					updatedAt: resident.updatedAt.toISOString(),
				};

				if (config) {
					await microApi(`${config.value}/gate`, {
						method: "POST",
						body: JSON.stringify({
							open: true,
						}),
					});
				}

				return { success: true, resident: mappedResident };
			},
			{
				body: t.Object({
					photo: t.File(),
				}),
				response: {
					200: t.Object({
						success: t.Boolean(),
						resident: t.Optional(ResidentResponseDTO),
					}),
					404: t.Object({
						success: t.Boolean(),
						error: t.String(),
					}),
				},
			},
		)
		.get(
			"config/:name",
			async ({ configRepository, set, params }) => {
				const { name } = params;

				const config = await configRepository.get(name);

				if (!config) {
					set.status = 404;
					return { error: "Configuração não encontrada" };
				}

				const mappedConfig = {
					...config,
					createdAt: config.createdAt.toISOString(),
					updatedAt: config.updatedAt.toISOString(),
				};

				set.status = 200;

				return { success: true, config: mappedConfig };
			},
			{
				params: t.Object({
					name: t.String(),
				}),
				response: {
					200: t.Object({
						success: t.Boolean(),
						config: ConfigDTO,
					}),
					404: t.Object({
						error: t.String(),
					}),
				},
			},
		)
		.put(
			"config",
			async ({ body, configRepository, set }) => {
				const newConfig = await configRepository.upsert(body.name, body.value);

				const parsedConfig = {
					...newConfig,
					createdAt: newConfig.createdAt.toISOString(),
					updatedAt: newConfig.updatedAt.toISOString(),
				};

				set.status = 201;

				return { success: !!newConfig, config: parsedConfig };
			},
			{
				body: t.Object({
					name: t.String(),
					value: t.Union([t.String(), t.Number(), t.Boolean()]),
				}),
				response: {
					201: t.Object({
						success: t.Boolean(),
						config: ConfigDTO,
					}),
				},
			},
		),
);

export default app;
