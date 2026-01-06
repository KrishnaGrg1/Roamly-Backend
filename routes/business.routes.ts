import { Router } from 'express';
import businessController from '../controllers/business.controller';
import roleMiddleware from '../middlewares/role.middleware';
import fileUpload from 'express-fileupload';

const BusinessRoutes = Router();

BusinessRoutes.use(
  fileUpload({
    useTempFiles: false,
    limits: { fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded (max 5MB)',
    parseNested: true,
  })
);

BusinessRoutes.post('/', businessController.registerBusiness);

BusinessRoutes.get(
  '/',
  roleMiddleware.verifyBusiness,
  businessController.getBusinessOfUser
);

BusinessRoutes.put(
  '/',
  roleMiddleware.verifyBusiness,
  businessController.updateBusiness
);

BusinessRoutes.post(
  '/submit',
  roleMiddleware.verifyBusiness,
  businessController.submitBusinessVerification
);
export default BusinessRoutes;
