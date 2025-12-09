import { createClient } from '@supabase/supabase-js';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { IFileStorageAdapter, FileUploadResult } from '../../../common/interfaces/file-storage.interface';

export class SupabaseStorageAdapter implements IFileStorageAdapter {
  private client = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

  async uploadFile(file: Express.Multer.File, bucket: string): Promise<FileUploadResult> {
    const id = randomUUID();
    const key = `${id}/${Date.now()}-${file.originalname}`;
    const { error } = await this.client.storage.from(bucket).upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    return { id, key, name: file.originalname, mimeType: file.mimetype, size: file.size };
  }

  async deleteFile(fileKey: string, bucket: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([fileKey]);
    if (error) throw error;
  }

  async getFileStream(fileKey: string, bucket: string): Promise<NodeJS.ReadableStream> {
    const { data, error } = await this.client.storage.from(bucket).download(fileKey);
    if (error) throw error;
    const anyData: any = data as any;
    if (anyData && typeof anyData.arrayBuffer === 'function') {
      const buf = Buffer.from(await anyData.arrayBuffer());
      return Readable.from(buf);
    }
    if ((anyData as any)?.body) {
      return (anyData as any).body as NodeJS.ReadableStream;
    }
    if (Buffer.isBuffer(anyData)) {
      return Readable.from(anyData);
    }
    throw new Error('Unsupported download response');
  }
}
