import { Server } from 'socket.io';
import type { AuthenticatedSocket } from '../middlewares/socket.middleware';

interface SendMessagePayload {
  receiverId: string;
  content: string;
}

interface ChatMessage {
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
}

export const registerChatHandlers = (
  io: Server,
  socket: AuthenticatedSocket
) => {
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
    console.log(`User ${socket.userId} joined their personal room`);
  }

  socket.on('sendMessage', (payload: SendMessagePayload) => {
    const message: ChatMessage = {
      senderId: socket.userId!,
      receiverId: payload.receiverId,
      content: payload.content,
      timestamp: new Date(),
    };

    console.log('Message received:', message);

    io.to(`user:${payload.receiverId}`).emit('message', message);

    socket.emit('messageSent', message);
  });

  socket.on('joinRoom', (roomId: string) => {
    socket.join(roomId);
    console.log(`User ${socket.userId} joined room: ${roomId}`);
  });

  socket.on('leaveRoom', (roomId: string) => {
    socket.leave(roomId);
    console.log(`User ${socket.userId} left room: ${roomId}`);
  });
};
