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
  .post('embeed', async ({ request, residentRepository }) => {
    const body = await request.formData();

    const response = await shotApi<EmbeddingResponse>('/embeed', {
      method: 'POST',
      body
    })

    const name = body.get('name') as string

    const resident = await residentRepository.create({
      name: 'Maciel',
      embedding: response.embedding
    })

    return resident;
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
