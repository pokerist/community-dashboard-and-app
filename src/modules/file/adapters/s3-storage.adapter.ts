import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import {
  FileUploadResult,
  IFileStorageAdapter,
} from '../../../common/interfaces/file-storage.interface';

type S3StorageAdapterConfig = {
  bucket: string;
  region: string;
  endpoint?: string | null;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

export class S3StorageAdapter implements IFileStorageAdapter {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageAdapterConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle ?? true,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 8_000,
        socketTimeout: 20_000,
      }),
      maxAttempts: 2,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private sanitizeFileName(name: string): string {
    return String(name || 'file')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
  }

  async uploadFile(
    file: Express.Multer.File,
    bucket?: string,
  ): Promise<FileUploadResult> {
    const id = randomUUID();
    const key = `${id}/${Date.now()}-${this.sanitizeFileName(file.originalname)}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket || this.config.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
      }),
    );

    return {
      id,
      key,
      name: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
    };
  }

  async deleteFile(fileKey: string, bucket?: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket || this.config.bucket,
        Key: fileKey,
      }),
    );
  }

  async getFileStream(
    fileKey: string,
    bucket?: string,
  ): Promise<NodeJS.ReadableStream> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket || this.config.bucket,
        Key: fileKey,
      }),
    );

    const body = response.Body as unknown;
    if (!body) throw new Error('S3 object body is empty');

    if (body instanceof Readable) return body;

    const maybeAny = body as any;
    if (typeof maybeAny.transformToWebStream === 'function') {
      return Readable.fromWeb(await maybeAny.transformToWebStream());
    }
    if (typeof maybeAny.arrayBuffer === 'function') {
      const buffer = Buffer.from(await maybeAny.arrayBuffer());
      return Readable.from(buffer);
    }

    throw new Error('Unsupported S3 response body type');
  }
}
