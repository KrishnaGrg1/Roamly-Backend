import { Router } from 'express';
import aiChatController from '../controllers/aiChat.controller';
import aiChatValidation from '../validation/aiChat.validation';
import validate from '../middlewares/validation.middleware';

const aiChatRoutes = Router();

/**
 * POST /ai/chat/session
 * Create a new chat session
 */
aiChatRoutes.post(
  '/session',
  validate(aiChatValidation.createSession),
  aiChatController.createSession
);

/**
 * GET /ai/chat/sessions
 * List user's chat sessions
 */
aiChatRoutes.get(
  '/sessions',
  validate(aiChatValidation.listSessions),
  aiChatController.listSessions
);

/**
 * GET /ai/chat/:sessionId
 * Get session details with messages
 */
aiChatRoutes.get(
  '/:sessionId',
  validate(aiChatValidation.getSession),
  aiChatController.getSession
);

/**
 * POST /ai/chat/:sessionId/message
 * Send message to chat session
 */
aiChatRoutes.post(
  '/:sessionId/message',
  validate(aiChatValidation.sendMessage),
  aiChatController.sendMessage
);

/**
 * POST /ai/chat/:sessionId/end
 * End chat session (mark inactive)
 */
aiChatRoutes.post(
  '/:sessionId/end',
  validate(aiChatValidation.endSession),
  aiChatController.endSession
);

export default aiChatRoutes;
