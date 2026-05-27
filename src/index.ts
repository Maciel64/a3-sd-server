import { Elysia } from "elysia";
import { microApi, shotApi } from "./infra/api";
import cors from "@elysia/cors";
import { residentRepositoryPlugin } from "./repositories/resident.repository";

const app = new Elysia().get("/", () => "Hello Elysia").listen(3001);

app.use(cors({
  origin: '*'
}))

interface EmbeddingResponse {
  embedding: number[];
}

app.group('api', app => 
  app
  .use(residentRepositoryPlugin)
  .post('embeed', async ({ request, set, residentRepository }) => {
    const body = await request.formData();
    const name = body.get('name') as string | null
    const photo = body.get('photo')

    if (!name || !photo) {
      set.status = 400
      return {
        error: 'Nome e foto são obrigatórios'
      }
    }

    const existingByName = await residentRepository.findByName(name)
    
    if (existingByName) {
      set.status = 409
      return {
        error: `Residente já ${existingByName.name} cadastrado`
      }
    }

    const response = await shotApi<EmbeddingResponse>('/embeed', {
      method: 'POST',
      body
    })

    if (!response.embedding) {
      set.status = 400

      return {
        error: 'Erro ao gerar embedding'
      }
    }

    const existingByEmbedding = await residentRepository.recognize(response.embedding)

    if (existingByEmbedding) {
      set.status = 409

      return {
        error: `Residente já ${existingByEmbedding.name} cadastrado`
      }
    }

    await residentRepository.create({
      name,
      embedding: response.embedding
    })

    const resident = await residentRepository.findByName(name)

    return { success: !!resident, resident };
  })

  .post('recognize', async ({ request, residentRepository }) => {
    const body = await request.formData();

    const response = await shotApi<EmbeddingResponse>('/embeed', {
      method: 'POST',
      body
    })

    const resident = await residentRepository.recognize(response.embedding)

    return { success: !!resident, resident };
  })
)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
