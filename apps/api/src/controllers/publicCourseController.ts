import { Response } from 'express';
import * as courseService from '../services/courseService';

export async function listTopCourses(_req: unknown, res: Response) {
  try {
    const data = await courseService.listTopPublishedCourses();
    return res.status(200).json({ success: true, data });
  } catch {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}
