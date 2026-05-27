import { S3Client } from "bun"
import Elysia from "elysia";

const s3 = new S3Client({
  accessKeyId: process.env.BACKBLAZE_ACCESS_KEY!,
  secretAccessKey: process.env.BACKBLAZE_SECRET_KEY!,
  bucket: process.env.BACKBLAZE_BUCKET!,
  endpoint: process.env.BACKBLAZE_ENDPOINT!,
  region: process.env.BACKBLAZE_REGION!,
});

export class S3StorageProvider {
  async upload(file: Buffer, fileName: string) {
    await s3.write(`images/${fileName}`, file)

    return `https://${process.env.BACKBLAZE_ENDPOINT}/${process.env.BACKBLAZE_BUCKET}/images/${fileName}`
  }
}

export const s3StorageProviderPlugin = (app: Elysia) => app.decorate('s3StorageProvider', new S3StorageProvider())