/**
 * Service Initializer - Pre-warms critical dependencies to prevent cold start issues
 * This module ensures that external services (Cloudinary, Redis queues, etc.) are
 * initialized before the first certificate generation request.
 */

import { getNotificationQueue, isNotificationQueueEnabled } from '../queues/notificationQueue';
import * as storage from '../storage';
import { getRedis } from '../utils/redis';

let initialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Pre-initializes critical services to prevent cold start 502 errors
 */
export async function initializeServices(): Promise<void> {
  if (initialized) return;
  
  if (!initializationPromise) {
    initializationPromise = performInitialization();
  }
  
  return initializationPromise;
}

/**
 * Performs the actual service initialization
 */
async function performInitialization(): Promise<void> {
  console.log('[SERVICE-INIT] Starting service initialization...');
  
  try {
    // 1. Initialize Redis connection for rate limiting
    console.log('[SERVICE-INIT] Warming up Redis connection...');
    try {
      const redis = getRedis();
      await redis.ping();
      console.log('[SERVICE-INIT] ✓ Redis connection ready');
    } catch (redisError) {
      console.warn('[SERVICE-INIT] ⚠ Redis connection warning:', redisError instanceof Error ? redisError.message : String(redisError));
      // Redis failures shouldn't block initialization
    }

    // 2. Pre-initialize notification queue if enabled
    if (isNotificationQueueEnabled()) {
      console.log('[SERVICE-INIT] Pre-initializing notification queue...');
      try {
        const queue = getNotificationQueue();
        // Touch the queue to initialize connection
        await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
        console.log('[SERVICE-INIT] ✓ Notification queue ready');
      } catch (queueError) {
        console.warn('[SERVICE-INIT] ⚠ Notification queue warning:', queueError instanceof Error ? queueError.message : String(queueError));
        // Queue failures shouldn't block initialization
      }
    }

    // 3. Pre-initialize storage (Cloudinary) connection
    console.log('[SERVICE-INIT] Pre-initializing storage provider...');
    try {
      await storage.storagePing();
      console.log('[SERVICE-INIT] ✓ Storage provider ready');
    } catch (storageError) {
      console.warn('[SERVICE-INIT] ⚠ Storage provider warning:', storageError instanceof Error ? storageError.message : String(storageError));
      // Storage failures shouldn't block initialization
    }

    // 4. Pre-initialize PDF generation (load fonts, etc.)
    console.log('[SERVICE-INIT] Pre-initializing PDF generation...');
    try {
      // PDFKit doesn't have explicit initialization, but we can create a small test PDF
      // to ensure fonts and resources are loaded
      await testPdfInitialization();
      console.log('[SERVICE-INIT] ✓ PDF generation ready');
    } catch (pdfError) {
      console.warn('[SERVICE-INIT] ⚠ PDF generation warning:', pdfError instanceof Error ? pdfError.message : String(pdfError));
    }

    initialized = true;
    console.log('[SERVICE-INIT] ✓ Service initialization completed');
  } catch (error) {
    console.error('[SERVICE-INIT] ✗ Service initialization failed:', error);
    // Even if initialization fails partially, mark as initialized to prevent repeated attempts
    initialized = true;
    throw error;
  }
}

/**
 * Tests PDF generation initialization by creating a minimal PDF
 */
async function testPdfInitialization(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Dynamically import PDFKit to avoid loading it if not needed
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4' });
      
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[SERVICE-INIT] PDF test generated ${buffer.length} bytes`);
        resolve();
      });
      doc.on('error', reject);
      
      // Create minimal test content
      doc.fontSize(12).text('PDF Generation Test', 50, 50);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Returns the initialization status
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * Resets initialization state (for testing)
 */
export function resetInitialization(): void {
  initialized = false;
  initializationPromise = null;
}