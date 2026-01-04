import type { Express } from 'express';

export interface FileUploadResult {
  id: string; // The UUID of the File record
  key: string; // The unique storage path (Supabase key)
  name: string;
  mimeType: string;
  size: number;
}

export interface IFileStorageAdapter {
  uploadFile(
    file: Express.Multer.File,
    bucket: string,
  ): Promise<FileUploadResult>;
  deleteFile(fileKey: string, bucket: string): Promise<void>;
  getFileStream(
    fileKey: string,
    bucket: string,
  ): Promise<NodeJS.ReadableStream>;
}
