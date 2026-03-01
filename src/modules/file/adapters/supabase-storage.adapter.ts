import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Express } from 'express';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  IFileStorageAdapter,
  FileUploadResult,
} from '../../../common/interfaces/file-storage.interface';

type SupabaseAdapterOptions = {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  localStorageRoot?: string;
  forceLocal?: boolean;
};

export class SupabaseStorageAdapter implements IFileStorageAdapter {
  private client: SupabaseClient | null = null;
  private readonly localStorageRoot: string;

  constructor(private readonly options: SupabaseAdapterOptions = {}) {
    this.localStorageRoot =
      options.localStorageRoot ||
      path.resolve(process.cwd(), '.local', 'file-storage');
  }

  private isSupabaseConfigured(): boolean {
    if (this.options.forceLocal) return false;
    return !!(
      (this.options.supabaseUrl || process.env.SUPABASE_URL) &&
      (this.options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY)
    );
  }

  private sanitizeFileName(name: string): string {
    return String(name || 'file')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-');
  }

  private localPathFor(bucket: string, key: string): string {
    const safeKey = key.replace(/\\/g, '/');
    return path.join(this.localStorageRoot, bucket, ...safeKey.split('/'));
  }

  private getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }

    const supabaseUrl = this.options.supabaseUrl || process.env.SUPABASE_URL;
    const serviceRoleKey =
      this.options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.client = createClient(supabaseUrl, serviceRoleKey);
    return this.client;
  }

  async uploadFile(
    file: Express.Multer.File,
    bucket: string,
  ): Promise<FileUploadResult> {
    const id = randomUUID();
    const key = `${id}/${Date.now()}-${this.sanitizeFileName(file.originalname)}`;

    if (!this.isSupabaseConfigured()) {
      const targetPath = this.localPathFor(bucket, key);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, file.buffer);
      return {
        id,
        key,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };
    }

    const client = this.getClient();
    const { error } = await client.storage
      .from(bucket)
      .upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    return {
      id,
      key,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async deleteFile(fileKey: string, bucket: string): Promise<void> {
    if (!this.isSupabaseConfigured()) {
      const targetPath = this.localPathFor(bucket, fileKey);
      await fs.unlink(targetPath).catch(() => undefined);
      return;
    }

    const client = this.getClient();
    const { error } = await client.storage.from(bucket).remove([fileKey]);
    if (error) throw error;
  }

  async getFileStream(
    fileKey: string,
    bucket: string,
  ): Promise<NodeJS.ReadableStream> {
    if (!this.isSupabaseConfigured()) {
      const targetPath = this.localPathFor(bucket, fileKey);
      await fs.access(targetPath);
      return createReadStream(targetPath);
    }

    const client = this.getClient();
    const { data, error } = await client.storage
      .from(bucket)
      .download(fileKey);
    if (error) throw error;
    const anyData: any = data as any;
    if (anyData && typeof anyData.arrayBuffer === 'function') {
      const buf = Buffer.from(await anyData.arrayBuffer());
      return Readable.from(buf);
    }
    if (anyData?.body) {
      return anyData.body as NodeJS.ReadableStream;
    }
    if (Buffer.isBuffer(anyData)) {
      return Readable.from(anyData);
    }
    throw new Error('Unsupported download response');
  }
}
