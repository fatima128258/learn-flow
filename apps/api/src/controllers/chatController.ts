import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/chatService';

const error = (res: Response, e: unknown) => {
  const m = e instanceof Error ? e.message : '';
  const map: Record<string, number> = { COURSE_NOT_FOUND: 404, CONVERSATION_NOT_FOUND: 404, ENROLLMENT_REQUIRED: 403, FORBIDDEN: 403, CONVERSATION_BLOCKED: 403, INVALID_CONTENT: 400 };
  return res.status(map[m] || 500).json({ success: false, error: map[m] ? m : 'SERVER_ERROR' });
};
export async function open(req: AuthenticatedRequest, res: Response) { try { return res.status(200).json({ success: true, data: await service.open(req.params.organizationId, req.params.courseId, req.user!.id, req.user!.role, req.body?.studentId) }); } catch (e) { return error(res, e); } }
export async function list(req: AuthenticatedRequest, res: Response) { try { return res.json({ success: true, data: await service.list(req.params.organizationId, req.user!.id, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function messages(req: AuthenticatedRequest, res: Response) { try { return res.json({ success: true, data: await service.messages(req.params.organizationId, req.params.conversationId, req.user!.id, Number(req.query.limit) || 50, typeof req.query.cursor === 'string' ? req.query.cursor : undefined, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function send(req: AuthenticatedRequest, res: Response) { try { return res.status(201).json({ success: true, data: await service.send(req.params.organizationId, req.params.conversationId, req.user!.id, req.body?.content, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function read(req: AuthenticatedRequest, res: Response) { try { return res.json({ success: true, data: await service.read(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function block(req: AuthenticatedRequest, res: Response) { try { return res.json({ success: true, data: await service.block(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function unblock(req: AuthenticatedRequest, res: Response) { try { return res.json({ success: true, data: await service.unblock(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function removeConversation(req: AuthenticatedRequest, res: Response) { try { const result = await service.removeConversation(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role); if (!result.count) return error(res, new Error('FORBIDDEN')); return res.json({ success: true }); } catch (e) { return error(res, e); } }
export async function remove(req: AuthenticatedRequest, res: Response) { try { const result = await service.removeMessage(req.params.organizationId, req.params.messageId, req.user!.id); if (!result.count) return error(res, new Error('FORBIDDEN')); return res.json({ success: true }); } catch (e) { return error(res, e); } }
