import { Client } from 'minio';
import { PutObjectInput, StorageProvider, PresignedUrlOptions, StoredObject } from './types';

const DEFAULT_REGION = 'us-east-1';

function publicReadPolicy(bucket: string) {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

export class MinioStorageProvider implements StorageProvider {
  readonly bucket: string;
  private readonly client: Client;
  private readonly publicBaseUrl: string | null;
  private ready: Promise<void> | null = null;

  constructor() {
    const endpoint = process.env.STORAGE_ENDPOINT || 'localhost';
    const port = Number(process.env.STORAGE_PORT || 9000);
    const useSSL = process.env.STORAGE_USE_SSL === 'true';
    const accessKey = process.env.STORAGE_ACCESS_KEY || 'minioadmin';
    const secretKey = process.env.STORAGE_SECRET_KEY || 'minioadmin';

    this.bucket = process.env.STORAGE_BUCKET || 'learnflow';
    this.publicBaseUrl = (process.env.STORAGE_PUBLIC_URL || '').replace(/\/+$/, '') || null;

    this.client = new Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    await this.ensureReady();
    await this.client.putObject(this.bucket, input.key, input.data, input.data.length, {
      'Content-Type': input.contentType,
    });
    return { key: input.key, publicUrl: this.getPublicUrl(input.key) };
  }

  getPublicUrl(key: string): string {
    if (!this.publicBaseUrl) {
      throw new Error('STORAGE_PUBLIC_URL_NOT_CONFIGURED');
    }
    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }

  async getPresignedUrl(key: string, options?: PresignedUrlOptions): Promise<string> {
    await this.ensureReady();
    return this.client.presignedGetObject(this.bucket, key, options?.expiresInSeconds ?? 3600);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.ensureReady();
    await this.client.removeObjects(this.bucket, keys);
  }

  async ping(): Promise<void> {
    await this.client.bucketExists(this.bucket);
  }

  private ensureReady(): Promise<void> {
    if (!this.ready) {
      this.ready = this.initializeBucket();
    }
    return this.ready;
  }

  private async initializeBucket() {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, process.env.STORAGE_REGION || DEFAULT_REGION);
    }
    if (this.publicBaseUrl) {
      try {
        await this.client.setBucketPolicy(this.bucket, publicReadPolicy(this.bucket));
      } catch {
        // Non-fatal: public URL reads fall back to presigned URLs.
      }
    }
  }
}