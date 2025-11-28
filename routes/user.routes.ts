import { Router } from 'express';
import userController from '../controllers/user.controller';
import userValidation from '../validation/user.validation';
import validate from '../middlewares/validation.middleware';
import fileUpload from 'express-fileupload';

const userRoutes = Router();

userRoutes.use(
  fileUpload({
    useTempFiles: false,
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded (max 5MB)',
    parseNested: true,
  })
);

userRoutes.get(
  '/:id',
  validate(userValidation.userIdParam),
  userController.getUserById
);
userRoutes.put(
  '/update',
  // validate(userValidation.editUser),
  userController.editUser
);

export default userRoutes;
