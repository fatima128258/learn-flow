import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as service from '../services/chatService';
import { chatEvents } from '../chatEvents';

const error = (res: Response, e: unknown) => {
  const m = e instanceof Error ? e.message : '';
  const map: Record<string, number> = { COURSE_NOT_FOUND: 404, CONVERSATION_NOT_FOUND: 404, ENROLLMENT_REQUIRED: 403, FORBIDDEN: 403, CONVERSATION_BLOCKED: 403, INVALID_CONTENT: 400, INVALID_REPLY: 400 };
  return res.status(map[m] || 500).json({ success: false, error: map[m] ? m : 'SERVER_ERROR' });
};
export async function open(req: AuthenticatedRequest, res: Response) { try { return res.status(200).json({ success: true, data: await service.open(req.params.organizationId, req.params.courseId, req.user!.id, req.user!.role, req.body?.studentId) }); } catch (e) { return error(res, e); } }
export async function list(req: AuthenticatedRequest, res: Response) { try { return res.json({ success: true, data: await service.list(req.params.organizationId, req.user!.id, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function messages(req: AuthenticatedRequest, res: Response) { try { return res.json({ success: true, data: await service.messages(req.params.organizationId, req.params.conversationId, req.user!.id, Number(req.query.limit) || 50, typeof req.query.cursor === 'string' ? req.query.cursor : undefined, req.user!.role) }); } catch (e) { return error(res, e); } }
export async function send(req: AuthenticatedRequest, res: Response) {
  try {
    const message = await service.send(req.params.organizationId, req.params.conversationId, req.user!.id, req.body?.content, req.user!.role, req.body?.replyToId);
    chatEvents.emit('messages:change', {
      type: 'created',
      conversationId: req.params.conversationId,
      organizationId: req.params.organizationId,
      message,
    });
    return res.status(201).json({ success: true, data: message });
  } catch (e) { return error(res, e); }
}
export async function read(req: AuthenticatedRequest, res: Response) {
  try {
    const messageIds = await service.read(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role);
    chatEvents.emit('messages:change', {
      type: 'read',
      conversationId: req.params.conversationId,
      organizationId: req.params.organizationId,
      messageIds,
      readerId: req.user!.id,
    });
    return res.json({ success: true, data: { messageIds } });
  } catch (e) { return error(res, e); }
}
export async function block(req: AuthenticatedRequest, res: Response) {
  try {
    const participants = await service.conversationParticipants(req.params.conversationId);
    const data = await service.block(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role);
    if (!data.count) return error(res, new Error('FORBIDDEN'));
    chatEvents.emit('conversation:change', {
      type: 'blocked',
      conversationId: req.params.conversationId,
      organizationId: req.params.organizationId,
      ...participants,
    });
    return res.json({ success: true, data });
  } catch (e) { return error(res, e); }
}
export async function unblock(req: AuthenticatedRequest, res: Response) {
  try {
    const participants = await service.conversationParticipants(req.params.conversationId);
    const data = await service.unblock(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role);
    if (!data.count) return error(res, new Error('FORBIDDEN'));
    chatEvents.emit('conversation:change', {
      type: 'unblocked',
      conversationId: req.params.conversationId,
      organizationId: req.params.organizationId,
      ...participants,
    });
    return res.json({ success: true, data });
  } catch (e) { return error(res, e); }
}
export async function removeConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const participants = await service.conversationParticipants(req.params.conversationId);
    const result = await service.removeConversation(req.params.organizationId, req.params.conversationId, req.user!.id, req.user!.role);
    if (!result.count) return error(res, new Error('FORBIDDEN'));
    chatEvents.emit('conversation:change', {
      type: 'deleted',
      conversationId: req.params.conversationId,
      organizationId: req.params.organizationId,
      ...participants,
    });
    return res.json({ success: true });
  } catch (e) { return error(res, e); }
}
export async function remove(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await service.removeMessage(
      req.params.organizationId,
      req.params.conversationId,
      req.params.messageId,
      req.user!.id,
      req.user!.role,
    );
    if (!result.count) return error(res, new Error('FORBIDDEN'));
    chatEvents.emit('messages:change', {
      type: 'deleted',
      conversationId: req.params.conversationId,
      organizationId: req.params.organizationId,
      messageId: req.params.messageId,
    });
    return res.json({ success: true });
  } catch (e) { return error(res, e); }
}
