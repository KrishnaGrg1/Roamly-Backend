import { Router } from 'express';
import AuthRoutes from './auth.routes';
import authMiddleware from '../middlewares/auth.middleware';
import postRoutes from './post.routes';
import userRoutes from './user.routes';
const mainRoutes = Router();

mainRoutes.use('/auth', AuthRoutes);
mainRoutes.use('/user', authMiddleware.verifyToken, userRoutes);
mainRoutes.use('/post', authMiddleware.verifyToken, postRoutes);
export default mainRoutes;
