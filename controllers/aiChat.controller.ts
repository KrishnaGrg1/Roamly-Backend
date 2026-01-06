import type { Response } from 'express';
import { prisma } from '../config/db';
import { HttpErrors, HttpSuccess } from '../helpers/standardResponse';
import {
  buildChatContext,
  hasEnoughContext,
  extractDestination,
  detectIntent,
} from '../helpers/chatContext.helper';
import {
  callAIChatWithContext,
  validateAIResponse,
} from '../helpers/aiChat.helper';
import type { AuthRequest } from '../middlewares/auth.middleware';
import type { ChatIntent, PrismaClient } from '../generated/prisma/client';
/**
 * AI Chat Controller
 * Database-first, read-only intelligence
 *
 * Cost controls enforced:
 * - 1 active session per user
 * - 15 messages max per session
 * - Token limits per request
 */

class AIChatController {
  /**
   * Create new chat session
   * POST /ai/chat/session
   */
  constructor(private readonly prisma: PrismaClient) {}
  public createSession = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const { title } = req.body;

      // HARD LIMIT: Only 1 active session per user
      const activeSession = await prisma.aIChatSession.findFirst({
        where: {
          userId,
          active: true,
        },
      });

      if (activeSession) {
        HttpErrors.conflict(
          res,
          'You You already have an active chat session. Please end it first or continue using it. '
        );
        return;
      }

      // Create new session
      const session = await prisma.aIChatSession.create({
        data: {
          userId,
          title: title || 'New Chat',
          active: true,
        },
      });

      HttpSuccess.created(
        res,
        {
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
        },
        'Chat session created'
      );
    } catch (error) {
      console.error('[AI Chat] Create session error:', error);
      HttpErrors.serverError(res, error, 'AIChat session failed');
    }
  };
  /**
   * Send message to chat session
   * POST /ai/chat/:sessionId/message
   */
  public sendMessage = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;
      const { message } = req.body;

      if (!sessionId) {
        HttpErrors.badRequest(res, 'Session ID is required');
        return;
      }

      // Verify session ownership and active status
      const session = await prisma.aIChatSession.findFirst({
        where: {
          id: sessionId,
          userId,
          active: true,
        },
      });

      if (!session) {
        HttpErrors.conflict(res, 'Chat session not found or inactive');
        return;
      }

      // HARD LIMIT: Max 15 messages per session
      if (session.messageCount >= 15) {
        HttpErrors.conflict(
          res,
          'Message limit reached for this session. Please start a new chat.'
        );
        return;
      }

      // Save user message
      const userMessage = await prisma.aIChatMessage.create({
        data: {
          sessionId,
          role: 'USER',
          content: message,
        },
      });

      // Detect intent and extract destination
      const intent = detectIntent(message);
      const destination = extractDestination(message);

      // Update session intent if not set
      if (!session.intent) {
        await prisma.aIChatSession.update({
          where: { id: sessionId },
          data: { intent: intent as ChatIntent },
        });
      }

      console.log(
        `[AI Chat] User message: "${message}" | Intent: ${intent} | Destination: ${destination}`
      );

      // Build context (the most critical part)
      const context = await buildChatContext({
        userId,
        message,
        intent,
        destination,
      });

      // Check if we have enough data
      if (!hasEnoughContext(context)) {
        const insufficientResponse =
          "I don't have enough real travel data yet to answer this question. Try asking about trips you've completed or saved, or explore popular destinations in our feed!";

        // Save AI response
        await prisma.aIChatMessage.create({
          data: {
            sessionId,
            role: 'ASSISTANT',
            content: insufficientResponse,
          },
        });

        // Update session counts
        await prisma.aIChatSession.update({
          where: { id: sessionId },
          data: {
            messageCount: { increment: 2 }, // User + AI
          },
        });

        HttpSuccess.ok(
          res,
          {
            response: insufficientResponse,
            hasEnoughContext: false,
          },
          'Message sent'
        );
      }

      // Get conversation history
      const previousMessages = await prisma.aIChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        take: 6, // Last 3 exchanges
        select: {
          role: true,
          content: true,
        },
      });

      const conversationHistory = previousMessages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      }));

      // Call LLM with context
      const { response, tokens, references } = await callAIChatWithContext(
        message,
        context,
        conversationHistory
      );

      // Validate response (prevent hallucinations)
      const validation = validateAIResponse(response, context);
      if (!validation.valid) {
        console.error(
          `[AI Chat] Response validation failed: ${validation.reason}`
        );

        // Return fallback response
        const fallbackResponse =
          'I apologize, but I need to be more careful with my answer. Could you rephrase your question or ask something more specific about the trips in your history?';

        await prisma.aIChatMessage.create({
          data: {
            sessionId,
            role: 'ASSISTANT',
            content: fallbackResponse,
            tokens,
          },
        });

        await prisma.aIChatSession.update({
          where: { id: sessionId },
          data: {
            messageCount: { increment: 2 },
            tokenCount: { increment: tokens },
          },
        });

        HttpSuccess.ok(
          res,
          {
            response: fallbackResponse,
            validationFailed: true,
          },
          'Message sent'
        );
      }

      // Save AI response
      const aiMessage = await prisma.aIChatMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: response,
          tokens,
        },
      });

      // Save context references (for explainability)
      await prisma.aIContextReference.createMany({
        data: references.map((ref) => ({
          messageId: aiMessage.id,
          refType: ref.type,
          refId: ref.id,
        })),
      });

      // Update session counts
      await prisma.aIChatSession.update({
        where: { id: sessionId },
        data: {
          messageCount: { increment: 2 }, // User + AI
          tokenCount: { increment: tokens },
        },
      });

      HttpSuccess.ok(
        res,
        {
          response,
          tokens,
        },
        'Message sent'
      );
    } catch (error) {
      console.error('[AI Chat] Send message error:', error);
      HttpErrors.serverError(res, error, 'Failed to process message');
    }
  };

  /**
   * Get session details with messages
   * GET /ai/chat/:sessionId
   */
  public getSession = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;

      const session = await prisma.aIChatSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              tokens: true,
              createdAt: true,
              references: {
                select: {
                  refType: true,
                  refId: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        HttpErrors.notFound(res, 'Chat session');
        return;
      }

      HttpSuccess.ok(
        res,
        {
          session: {
            id: session.id,
            title: session.title,
            intent: session.intent,
            active: session.active,
            messageCount: session.messageCount,
            tokenCount: session.tokenCount,
            createdAt: session.createdAt,
            messages: session.messages,
          },
        },
        'Chat session retrieved'
      );
    } catch (error) {
      console.error('[AI Chat] Get session error:', error);

      HttpErrors.serverError(res, error, 'Failed to fetch session');
    }
  };
  /**
   * List user's chat sessions
   * GET /ai/chat/sessions
   */
  public listSessions = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }
      const { limit, cursor, activeOnly } = req.query as any;

      const sessions = await prisma.aIChatSession.findMany({
        where: {
          userId,
          ...(activeOnly === 'true' && { active: true }),
          ...(cursor && { id: { lt: cursor } }),
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit) + 1,
        select: {
          id: true,
          title: true,
          intent: true,
          active: true,
          messageCount: true,
          tokenCount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const hasNextPage = sessions.length > parseInt(limit);
      const sessionsToReturn = hasNextPage ? sessions.slice(0, -1) : sessions;

      HttpSuccess.ok(
        res,
        {
          sessions: sessionsToReturn,
          pagination: {
            hasNextPage,
            nextCursor: hasNextPage
              ? (sessionsToReturn[sessionsToReturn.length - 1]?.id ?? null)
              : null,
          },
        },
        'Chat sessions retrieved'
      );
    } catch (error) {
      console.error('[AI Chat] List sessions error:', error);
      HttpErrors.serverError(res, error, 'Failed to fetch sessions');
    }
  };

  /**
   * End chat session (mark inactive)
   * POST /ai/chat/:sessionId/end
   */
  public endSession = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        HttpErrors.unauthorized(res);
        return;
      }

      const { sessionId } = req.params;

      const session = await prisma.aIChatSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });

      if (!session) {
        HttpErrors.notFound(res, 'Chat session');
        return;
      }
      await prisma.aIChatSession.update({
        where: { id: sessionId },
        data: { active: false },
      });

      //   return res.status(200).json(
      //     standardResponse(200, true, {
      //       message: 'Chat session ended',
      //     })
      //   );
      HttpSuccess.ok(res, {}, 'Chat session ended');
    } catch (error) {
      console.error('[AI Chat] End session error:', error);
      HttpErrors.serverError(res, error, 'Failed to end session');
    }
  };
}

export default new AIChatController(prisma);
