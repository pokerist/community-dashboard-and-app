import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private readonly BUCKET_NAME = 'uploads'; // Define your bucket name

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }
  /** Uploads a file buffer to Supabase Storage and returns the file path/key. */
  async uploadFile(file: Express.Multer.File, folder: string = 'nid'): Promise<string> {
    const filePath = `${folder}/${uuidv4()}-${file.originalname}`;
    
    // Upload the file buffer
    const { error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .upload(filePath, file.buffer, {
        upsert: false,
        contentType: file.mimetype,
      });

    if (error) {
      throw new InternalServerErrorException(`Supabase upload failed: ${error.message}`);
    }

    return filePath;
  }
  
  /** Deletes a file from Supabase Storage. */
  async deleteFile(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.warn(`Supabase file cleanup failed for ${filePath}: ${error.message}`);
      // Note: We don't throw here, as cleanup failure shouldn't crash a primary transaction.
    }
  }
}