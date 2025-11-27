import { Router } from 'express';
import authController from '../controllers/authController';
import validate from '../middlewares/validation';
import authValidation from '../validation/authValidation';

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

export default AuthRoutes;
