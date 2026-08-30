import { NextFunction, Request, Response } from 'express';
import multer from 'multer';

export const MEDIA_MAX_SIZE_BYTES = 25 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_MAX_SIZE_BYTES },
});

export function uploadSingle(fieldName: string) {
  const single = upload.single(fieldName);
  return (req: Request, res: Response, next: NextFunction) => {
    single(req, res, (err: unknown) => {
      if (err) {
        const e = err as { code?: string };
        if (e.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ success: false, error: 'MEDIA_TOO_LARGE' });
        }
        return res.status(400).json({ success: false, error: 'MULTIPART_INVALID' });
      }
      return next();
    });
  };
}