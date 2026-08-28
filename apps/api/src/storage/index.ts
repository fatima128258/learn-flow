import { MinioStorageProvider } from './minioProvider';
import { StorageProvider, PutObjectInput, PresignedUrlOptions, StoredObject } from './types';

export * from './types';
export * from './mediaKeys';
export * from './mediaPolicy';

let provider: StorageProvider | null = null;

function getProvider(): StorageProvider {
  if (!provider) {
    const driver = (process.env.STORAGE_DRIVER || 's3').toUpperCase();
    switch (driver) {
      case 'S3':
      case 'MINIO':
      case 'R2':
        provider = new MinioStorageProvider();
        break;
      default:
        throw new Error('UNSUPPORTED_STORAGE_DRIVER');
    }
  }
  return provider;
}

export async function putObject(input: PutObjectInput): Promise<StoredObject> {
  return getProvider().putObject(input);
}

export async function getPublicUrl(key: string): Promise<string> {
  return getProvider().getPublicUrl(key);
}

export async function getPresignedUrl(
  key: string,
  options?: PresignedUrlOptions,
): Promise<string> {
  return getProvider().getPresignedUrl(key, options);
}

export async function deleteObjects(keys: string[]): Promise<void> {
  return getProvider().deleteObjects(keys);
}

export function storageBucket(): string {
  return getProvider().bucket;
}