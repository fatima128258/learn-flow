import { Router } from 'express';
import { listTopCourses } from '../controllers/publicCourseController';

const publicCourseRouter = Router();

publicCourseRouter.get('/top', listTopCourses);

export default publicCourseRouter;
