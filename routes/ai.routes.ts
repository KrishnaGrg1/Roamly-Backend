import { Router } from 'express';
import aiController from '../controllers/ai.controller';
import validate from '../middlewares/validation.middleware';
import aiValidation from '../validation/ai.validation';

const aiRoutes = Router();

aiRoutes.post(
  '/suggest',
  validate(aiValidation.suggestPlaces),
  aiController.suggestPlacesBasedOnLocation
);

export default aiRoutes;
