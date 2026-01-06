import { z } from 'zod';

/**
 * AI Chat Validation Schemas
 * Database-first, read-only intelligence with strict limits
 */

class aiChatValidation {
  /**
   * Create new chat session
   */
  createSession = {
    body: z.object({
      title: z.string().max(100).optional(),
    }),
  };

  /**
   * Send message to chat session
   */
  sendMessage = {
    params: z.object({
      sessionId: z.string().uuid(),
    }),
    body: z.object({
      message: z.string().min(1).max(2000),
    }),
  };

  /**
   * Get session details
   */
  getSession = {
    params: z.object({
      sessionId: z.string().uuid(),
    }),
  };

  /**
   * List user sessions
   */
  listSessions = {
    query: z.object({
      limit: z.string().regex(/^\d+$/).transform(Number).default(10),
      cursor: z.string().uuid().optional(),
      activeOnly: z
        .string()
        .regex(/^(true|false)$/)
        .transform((val) => val === 'true')
        .default(true),
    }),
  };

  /**
   * End chat session
   */
  endSession = {
    params: z.object({
      sessionId: z.string().uuid(),
    }),
  };
}

export default new aiChatValidation();
