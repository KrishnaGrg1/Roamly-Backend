import { Router } from 'express';
import AuthRoutes from './authRoutes';

const mainRoutes = Router();

mainRoutes.use('/auth', AuthRoutes);

export default mainRoutes;
