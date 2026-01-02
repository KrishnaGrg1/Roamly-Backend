import { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../middlewares/socket.middleware';
import type {
  ChatMessage,
  SendMessagePayload,
  SocketResponse,
} from './types/chat.types';
import { ERROR_MESSAGES, SOCKET_EVENTS } from './constants/event';

const generateMessageId = (): string => {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const parsePayload = <T>(payload: T | string): T | null => {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }
  return payload;
};

const createSuccessResponse = <T>(data: T): SocketResponse<T> => ({
  success: true,
  data,
});

const createErrorResponse = (error: string): SocketResponse => ({
  success: false,
  error,
});

const isAuthenticated = (
  socket: AuthenticatedSocket
): socket is AuthenticatedSocket & { userId: string } => {
  return typeof socket.userId === 'string' && socket.userId.length > 0;
};

const logSocketEvent = (
  event: string,
  userId: string | undefined,
  data?: unknown
): void => {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] [Socket] [${event}] User: ${userId ?? 'unknown'}`,
    data ?? ''
  );
};

const handleSendMessage = (
  io: Server,
  socket: AuthenticatedSocket,
  payload: SendMessagePayload
): void => {
  const parsedPayload = parsePayload(payload);

  if (!parsedPayload) {
    socket.emit(
      SOCKET_EVENTS.ERROR,
      createErrorResponse(ERROR_MESSAGES.PARSE_ERROR)
    );
    return;
  }

  const { receiverId, message } = parsedPayload;

  if (!receiverId?.trim()) {
    socket.emit(
      SOCKET_EVENTS.ERROR,
      createErrorResponse(ERROR_MESSAGES.MISSING_RECEIVER_ID)
    );
    return;
  }

  if (!message?.trim()) {
    socket.emit(
      SOCKET_EVENTS.ERROR,
      createErrorResponse(ERROR_MESSAGES.MISSING_MESSAGE)
    );
    return;
  }

  if (!isAuthenticated(socket)) {
    socket.emit(
      SOCKET_EVENTS.ERROR,
      createErrorResponse(ERROR_MESSAGES.NOT_AUTHENTICATED)
    );
    return;
  }

  const chatMessage: ChatMessage = {
    id: generateMessageId(),
    receiverId: receiverId.trim(),
    senderId: socket.userId,
    message: message.trim(),
    timestamp: new Date(),
  };

  // 1. Broadcast to everyone (public chat)
// io.emit('newMessage', message);

// 2. Broadcast to everyone except sender
// socket.broadcast.emit('newMessage', message);

 // 3. Send to specific room (group chat)
// io.to('room-id').emit('newMessage', message);

// 4. Send to specific user (private message)
// io.to(`user:${receiverId}`).emit('newMessage', message);

  logSocketEvent(SOCKET_EVENTS.SEND_MESSAGE, socket.userId, chatMessage);

  io.to(`user:${receiverId}`).emit(
    SOCKET_EVENTS.MESSAGE,
    createSuccessResponse(chatMessage)
  );

  socket.emit(SOCKET_EVENTS.MESSAGE_SENT, createSuccessResponse(chatMessage));
};

const handleDisconnect = (socket: AuthenticatedSocket): void => {
  logSocketEvent('DISCONNECT', socket.userId, { socketId: socket.id });
};

export const registerChatHandlers = (
  io: Server,
  socket: AuthenticatedSocket
): void => {
  logSocketEvent('CONNECT', socket.userId, { socketId: socket.id });

  if (isAuthenticated(socket)) {
    const personalRoom = `user:${socket.userId}`;
    socket.join(personalRoom);
    logSocketEvent('JOIN_PERSONAL_ROOM', socket.userId, { room: personalRoom });
  }

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, (payload: SendMessagePayload) => {
    handleSendMessage(io, socket, payload);
  });

  socket.on('disconnect', () => {
    handleDisconnect(socket);
  });
};
