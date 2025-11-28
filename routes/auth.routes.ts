import { Router } from 'express';
import authController from '../controllers/auth.controller';
import validate from '../middlewares/validation.middleware';
import authValidation from '../validation/auth.validations';
import authMiddleware from '../middlewares/auth.middleware';

const AuthRoutes = Router();

AuthRoutes.post(
  '/register',
  validate(authValidation.register),
  authController.registerUser
);

AuthRoutes.post(
  '/login',
  validate(authValidation.login),
  authController.loginUser
);

AuthRoutes.get('/me', authMiddleware.verifyToken, authController.getMe);

export default AuthRoutes;
