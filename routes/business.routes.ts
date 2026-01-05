import { Router } from 'express';
import businessController from '../controllers/business.controller';
import roleMiddleware from '../middlewares/role.middleware';

const BusinessRoutes = Router();

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

BusinessRoutes.post('/submit', roleMiddleware.verifyBusiness);
export default BusinessRoutes;
