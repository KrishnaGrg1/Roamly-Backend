import { Server } from 'socket.io';
import { registerChatHandlers } from './chat.socket';
import { socketAuthMiddleware } from '../middlewares/socket.middleware';

export const registerSocketHandlers = (io: Server) => {
  io.use(socketAuthMiddleware);
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    registerChatHandlers(io, socket);
  });
};

// Client Usage (Web + Mobile)

// const socket = io(SOCKET_URL, {
//   auth: {
//     token: accessToken,
//   },
// })

// socket.on('MESSAGE', (res) => {
//   console.log(res.data)
// })

// socket.emit('SEND_MESSAGE', {
//   receiverId: 'user-id',
//   message: 'Hello 👋',
// })
