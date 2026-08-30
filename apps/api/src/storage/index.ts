import { CloudinaryStorageProvider } from './cloudinaryProvider';
import { StorageProvider, PutObjectInput, PresignedUrlOptions, StoredObject } from './types';

export * from './types';
export * from './mediaKeys';
export * from './mediaPolicy';

let provider: StorageProvider | null = null;

function getProvider(): StorageProvider {
  if (!provider) {
    provider = new CloudinaryStorageProvider();
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

export async function storagePing(): Promise<void> {
  return getProvider().ping();
}

export function storageBucket(): string {
  return getProvider().bucket;
}