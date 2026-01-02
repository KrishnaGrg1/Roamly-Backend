import { Server } from 'socket.io';
import { registerChatHandlers } from './chat.socket';
import { socketAuthMiddleware } from '../middlewares/socket.middleware';

export const registerSocketHandlers = (io: Server) => {
  io.use(socketAuthMiddleware);
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    registerChatHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};
