import { v2 as cloudinary } from 'cloudinary';
import { PutObjectInput, StorageProvider, StoredObject } from './types';

type ResourceType = 'image' | 'video' | 'raw';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'm3u8', 'mov', 'mkv']);

// Cloudinary has no bucket concept; public URLs are namespaced under the cloud.
const DEFAULT_BUCKET = 'learnflow';

function extensionOf(key: string): string {
  const idx = key.lastIndexOf('.');
  return idx === -1 ? '' : key.slice(idx + 1).toLowerCase();
}

// The storage key is a path such as "orgs/<org>/media/<id>/notes.pdf". Cloudinary
// derives the format from the trailing extension and treats everything before it
// as the public_id (folders separated by "/"). Strip the extension so upload and
// lookup round-trip through the same key.
function publicIdForKey(key: string): string {
  const idx = key.lastIndexOf('.');
  return idx === -1 ? key : key.slice(0, idx);
}

function resourceTypeForExtension(ext: string): ResourceType {
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return 'raw';
}

function resourceTypeForKey(key: string): ResourceType {
  return resourceTypeForExtension(extensionOf(key));
}

function uploadOptions(input: PutObjectInput): Record<string, unknown> {
  const resourceType = resourceTypeForKey(input.key);
  return {
    public_id: publicIdForKey(input.key),
    resource_type: resourceType,
    type: 'upload',
    folder: undefined,
  };
}

export class CloudinaryStorageProvider implements StorageProvider {
  readonly bucket: string;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    const apiKey = process.env.CLOUDINARY_API_KEY || '';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || '';

    this.bucket = cloudName || DEFAULT_BUCKET;

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    await this.uploadBuffer(input);
    return { key: input.key, publicUrl: this.getPublicUrl(input.key) };
  }

  getPublicUrl(key: string): string {
    return this.buildUrl(key, false);
  }

  async getPresignedUrl(key: string): Promise<string> {
    return this.buildUrl(key, true);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await Promise.all(
      keys.map((key) =>
        cloudinary.uploader.destroy(publicIdForKey(key), {
          resource_type: resourceTypeForKey(key),
        }),
      ),
    );
  }

  async ping(): Promise<void> {
    await cloudinary.api.ping();
  }

  private buildUrl(key: string, sign: boolean): string {
    const resourceType = resourceTypeForKey(key);
    const ext = extensionOf(key);
    const options: Record<string, unknown> = {
      resource_type: resourceType,
      sign_url: sign,
    };
    if (ext) {
      options.format = ext;
    }
    return cloudinary.url(publicIdForKey(key), options);
  }

  private uploadBuffer(input: PutObjectInput): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions(input) as never,
        ((error: Error | null, result?: unknown) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(result);
        }) as never,
      );
      stream.end(input.data);
    });
  }
}
