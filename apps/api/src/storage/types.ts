export interface StoredObject {
  key: string;
  publicUrl: string;
}

export interface PutObjectInput {
  key: string;
  data: Buffer;
  contentType: string;
}

export interface PresignedUrlOptions {
  expiresInSeconds?: number;
}

export interface StorageProvider {
  readonly bucket: string;
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getPublicUrl(key: string): string;
  getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string>;
  deleteObjects(keys: string[]): Promise<void>;
}