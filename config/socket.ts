import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

export const initializeSocket = (server: HttpServer): Server => {
  const io = new Server(server, {
    cors: {
      origin: '*', // Configure based on your env
      methods: ['GET', 'POST'],
    },
  });

  return io;
};
