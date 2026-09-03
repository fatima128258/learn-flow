# ADR-005: Object Storage Strategy

**Status**: Accepted  
**Date**: 2026-02-01  
**Deciders**: Engineering Team  
**Affected Components**: File Management, Media Handling, Frontend

## Context

LearnFlow requires persistent storage for user-uploaded media:
- Course thumbnail images
- Lesson media files (images, videos, PDFs)
- Certificate documents
- User profile images
- Course material attachments

Storing files locally on the API server is not viable because:
- API server disk is ephemeral (container restarts lose data)
- Large files consume server memory and disk
- Multiple API instances need access to same files
- Docker containers shouldn't store persistent state
- No built-in replication or backup

We need a robust, scalable, reliable object storage solution.

## Decision

We chose **Cloudinary** as our primary object storage provider for media management.

## Rationale

### 1. **Image Optimization**
Cloudinary automatically optimizes images:
- Responsive sizing based on device
- Format conversion (WebP for modern browsers, JPEG fallback)
- Compression with quality presets
- Lazy loading support
- CDN delivery for fast downloads globally

```javascript
// Automatic responsive images
const thumbnailUrl = 'https://res.cloudinary.com/learnflow/image/upload/w_400,q_80/course_thumbnail.jpg';
const highResUrl = 'https://res.cloudinary.com/learnflow/image/upload/w_1600,q_90/course_thumbnail.jpg';
```

### 2. **Video Streaming**
Cloudinary provides video transformations:
- HLS streaming for adaptive bitrate
- Thumbnail generation from videos
- Duration calculation
- Automatic codec detection
- Streaming to browsers without buffering

### 3. **API-Driven Uploads**
Built-in upload API eliminates server-side file handling:
- Direct browser-to-Cloudinary uploads (bypass API server)
- Server-side signed upload URLs for secure uploads
- Upload presets limit what users can upload
- Automatic virus scanning on uploads
- Metadata extraction (image dimensions, video duration)

```javascript
// Secure signed upload
const { upload_url, signature } = await cloudinary.signUploadUrl({
  folder: 'course_thumbnails',
  resource_type: 'image',
  format: 'auto'
});

// Client uploads directly to Cloudinary
const response = await fetch(upload_url, {
  method: 'POST',
  body: formData  // User's file
});
```

### 4. **Cost Efficiency**
- Pay only for storage and bandwidth used
- Free tier: 25 GB storage, 25 GB monthly bandwidth
- Pro tier: $99/month (1 TB storage, unlimited bandwidth)
- No per-transaction fees
- Automatic compression reduces actual storage used

### 5. **Reliability & Availability**
- 99.95% SLA with multiple geographic data centers
- Automatic replication across regions
- Built-in backup and recovery
- No single point of failure
- Redundant storage infrastructure

### 6. **Access Control**
Cloudinary provides:
- Token-based authentication for uploads
- Signed URLs with expiration for temporary access
- Private/public delivery URLs
- Delivery restrictions by domain
- IP-based access controls

### 7. **Developer Experience**
- Simple npm/Node.js SDK: `cloudinary@2.5.1`
- REST API for all operations
- Web UI for manual file management
- Extensive documentation and examples
- Active maintenance and community support

### 8. **Scalability**
- No limit on file count or total storage (with paid plan)
- Handles traffic spikes without degradation
- Bandwidth scaling automatic
- No configuration needed as usage grows

## Implementation

### Cloudinary SDK Integration

```typescript
// env variables
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

// Initialize
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
```

### Upload Flow

#### 1. **Server Generates Signed Upload URL**
```typescript
async generateUploadUrl(folder: string) {
  const signature = cloudinary.utils.api_sign_request(
    {
      folder,
      timestamp: Math.floor(Date.now() / 1000),
      upload_preset: 'learnflow_uploads'
    },
    process.env.CLOUDINARY_API_SECRET
  );
  
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    signature
  };
}
```

#### 2. **Client Uploads Directly to Cloudinary**
```javascript
// React/TypeScript on frontend
const formData = new FormData();
formData.append('file', userFile);
formData.append('public_id', `course_${courseId}`);
formData.append('signature', signature);

const response = await fetch(uploadUrl, {
  method: 'POST',
  body: formData
});

const result = await response.json();
// result.secure_url = https://res.cloudinary.com/.../course_123.jpg
```

#### 3. **Server Stores URL in Database**
```typescript
const course = await prisma.course.update({
  where: { id: courseId },
  data: {
    thumbnailUrl: result.secure_url  // Store public URL
  }
});
```

### Supported File Types

| File Type | Use Case | Format | Max Size |
|-----------|----------|--------|----------|
| JPEG/PNG | Thumbnails, course images | Auto-optimized | 50 MB |
| WebP | Modern browsers | Auto-converted | 50 MB |
| MP4/WebM | Lesson videos | HLS streaming | 500 MB |
| PDF | Lesson materials | Embedded viewer | 100 MB |
| GIF | Animated content | Auto-optimized | 50 MB |

### Upload Presets

Cloudinary upload presets restrict what users can upload:

```
Preset: learnflow_uploads
├── Allowed formats: jpg, jpeg, png, gif, webp, pdf, mp4, webm
├── Max file size: 100 MB
├── Auto-tag: learnflow
├── Folder structure: learnflow/{resource_type}/{organization_id}
├── Eager transformations:
│   └── Generate thumbnail: w_400,h_300,c_fill
└── Quality: auto
```

### Delivery URLs

Signed URLs protect private content:

```typescript
// Generate secure delivery URL (expires in 1 hour)
const secureUrl = cloudinary.url(publicId, {
  sign_url: true,
  type: 'authenticated',
  expiration: Math.floor(Date.now() / 1000) + 3600
});
```

## File Organization

Files are organized by type and organization for easy management:

```
learnflow/
├── course_thumbnails/
│   ├── org-abc/course-123.jpg
│   └── org-def/course-456.jpg
├── lesson_media/
│   ├── org-abc/lesson-789/
│   │   ├── lesson-image.jpg
│   │   └── lesson-video.mp4
│   └── org-def/
├── certificates/
│   ├── org-abc/cert-001.pdf
│   └── org-def/cert-002.pdf
└── user_profiles/
    ├── user-123.jpg
    └── user-456.jpg
```

## API Endpoints Using Storage

### Course Upload Endpoint
```
POST /api/courses/:id/upload-thumbnail
├── Input: multipart file upload
├── Process:
│   ├── Generate signed Cloudinary URL
│   ├── Return to client
│   └── Client uploads directly to Cloudinary
├── Webhook: Cloudinary notifies on upload complete
└── Response: Updated course with thumbnailUrl
```

### Lesson Media Endpoint
```
POST /api/lessons/:id/upload-media
├── Input: File (image, video, PDF)
├── Process: Same as course upload
└── Response: Stored media URL for lesson
```

## Alternatives Considered

### AWS S3
- ✓ Industry standard, widely used
- ✓ Very cost-effective for storage
- ✗ Requires separate CDN (CloudFront) for delivery
- ✗ No built-in image optimization
- ✗ Requires more configuration
- Better for raw storage; Cloudinary better for images/videos

### Google Cloud Storage
- ✓ Good performance and availability
- ✗ More complex authentication
- ✗ No image optimization service
- ✗ Requires separate CDN
- Similar tradeoffs to AWS S3

### Local File System (NFS)
- ✗ Not viable in containerized environment
- ✗ Ephemeral storage lost on restart
- ✗ Not scalable across multiple servers
- ✗ Manual backup required
- Rejected as too risky

### Database (BLOB fields)
- ✗ Wastes database resources
- ✗ Large objects slow down queries
- ✗ Harder to backup and restore
- ✗ No built-in optimization
- ✗ Not recommended for production systems

## Consequences

### Positive
- ✓ No file storage on API server (stateless, scalable)
- ✓ Automatic image optimization and CDN delivery
- ✓ Reliable, redundant storage with SLA
- ✓ Video streaming support built-in
- ✓ Secure signed URLs for access control
- ✓ Built-in backup and disaster recovery
- ✓ Global CDN for fast delivery
- ✓ Developer-friendly API

### Negative
- ✗ Introduces external dependency (Cloudinary)
- ✗ Internet connectivity required for uploads
- ✗ Monthly service costs (once free tier exceeded)
- ✗ Data stored outside application infrastructure
- ✗ Relies on Cloudinary's security and reliability
- ✗ GDPR considerations for EU customers (Cloudinary US-based)

## Data Privacy & Compliance

### GDPR Considerations
- Cloudinary stores files in US data centers
- EU customers may require Data Processing Agreement (DPA)
- Cloudinary is not EU-based (unlike Bunny CDN)
- Consider requiring customer consent for US storage

### Security
- All uploads encrypted in transit (HTTPS)
- Files can be marked private or public
- Signed URLs prevent unauthorized access
- API credentials protected in environment variables
- No private customer data in file metadata (except folder/id)

## Monitoring & Limits

### Quotas
- Storage: Scales with plan (free: 25 GB, pro: 1 TB+)
- Bandwidth: Free 25 GB/month, then billed per GB
- API Requests: Unlimited
- Upload size: 500 MB (configurable)

### Metrics to Track
```typescript
// Logging uploads
logger.info('File uploaded', {
  fileId,
  size: file.size,
  publicId: result.public_id,
  cloudinaryUrl: result.secure_url,
  organizationId
});
```

## Future Improvements

1. **Automatic Cleanup**: Delete unused files older than 30 days
2. **CDN Cache Control**: Optimize cache headers for different asset types
3. **Bandwidth Alerts**: Notify admins if bandwidth usage spikes
4. **Custom Domain**: Serve files from custom domain (e.g., cdn.learnflow.app)
5. **EU-Compliant Storage**: Migrate to Bunny CDN if GDPR mandatory
6. **Adaptive Streaming**: Configure HLS quality tiers based on connection speed

## References

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration)
- [Image Optimization Best Practices](https://cloudinary.com/documentation/responsive_images)
- [GDPR Considerations for Cloud Storage](https://gdpr-info.eu/art-4-gdpr/)
