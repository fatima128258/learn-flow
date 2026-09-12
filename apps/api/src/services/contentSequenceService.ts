import * as courseRepo from '../repositories/courseRepository';
import * as moduleRepo from '../repositories/moduleRepository';
import * as lessonRepo from '../repositories/lessonRepository';
import * as quizRepo from '../repositories/quizRepository';
import * as sequenceRepo from '../repositories/contentSequenceRepository';
import { assertCanManage, type ContentActor } from './contentAccess';

type Item = { type: 'LESSON' | 'QUIZ'; lessonId?: string; quizId?: string };

async function access(organizationId: string, courseId: string, moduleId: string, actor?: ContentActor | null) {
  const course = await courseRepo.getById(organizationId, courseId);
  if (!course) throw new Error('COURSE_NOT_FOUND');
  const module = await moduleRepo.getById(courseId, moduleId);
  if (!module) throw new Error('MODULE_NOT_FOUND');
  if (actor) assertCanManage(actor, course);
  return module;
}

function dto(row: any) {
  const item = row.type === 'LESSON' ? row.lesson : row.quiz;
  return { type: row.type, id: item.id, position: row.position, title: item.title, description: item.description };
}

export async function list(organizationId: string, courseId: string, moduleId: string) {
  await access(organizationId, courseId, moduleId);
  return (await sequenceRepo.listByModule(moduleId)).filter((row: any) => row.lesson || row.quiz).map(dto);
}

export async function replaceOrder(organizationId: string, courseId: string, moduleId: string, raw: unknown, actor: ContentActor) {
  await access(organizationId, courseId, moduleId, actor);
  if (!Array.isArray(raw)) throw new Error('INVALID_CONTENT_ORDER');
  const items: Item[] = raw.map((value: any) => {
    if (!value || (value.type !== 'LESSON' && value.type !== 'QUIZ') || typeof value.id !== 'string') throw new Error('INVALID_CONTENT_ORDER');
    return value.type === 'LESSON' ? { type: value.type, lessonId: value.id } : { type: value.type, quizId: value.id };
  });
  const keys = new Set(items.map(item => `${item.type}:${item.lessonId ?? item.quizId}`));
  if (keys.size !== items.length) throw new Error('INVALID_CONTENT_ORDER');
  const [lessons, quizzes] = await Promise.all([lessonRepo.listByModule(moduleId), quizRepo.listByModule(moduleId)]);
  const expected = new Set([...lessons.map(item => `LESSON:${item.id}`), ...quizzes.map(item => `QUIZ:${item.id}`)]);
  if (expected.size !== keys.size || [...expected].some(key => !keys.has(key))) throw new Error('INVALID_CONTENT_ORDER');
  return (await sequenceRepo.replace(moduleId, items)).map((row: any) => ({ type: row.type, id: row.lessonId ?? row.quizId, position: row.position }));
}
