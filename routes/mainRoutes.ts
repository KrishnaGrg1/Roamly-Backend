import { Router } from 'express';
import AuthRoutes from './authRoutes';
import authMiddleware from '../middlewares/authMiddleware';
import UploadRoutes from './uploadRoute';

const mainRoutes = Router();

mainRoutes.use('/auth', AuthRoutes);
mainRoutes.use('/upload', authMiddleware.verifyToken, UploadRoutes);
export default mainRoutes;
