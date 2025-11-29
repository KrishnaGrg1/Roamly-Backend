import { Router } from 'express';
import locationController from '../controllers/location.controller';
import validate from '../middlewares/validation.middleware';
import locationValidation from '../validation/location.validation';
const locationRoutes = Router();

locationRoutes.post(
  '/',
  validate(locationValidation.addLocation),
  locationController.addLocation
);

locationRoutes.get('/', locationController.getAllLocations);

// Static routes MUST come BEFORE dynamic /:id route
locationRoutes.get(
  '/nearby',
  validate(locationValidation.nearbyQuery),
  locationController.getNearbyLocations
);

locationRoutes.get(
  '/search',
  validate(locationValidation.searchQuery),
  locationController.searchLocations
);

// Dynamic route LAST - otherwise it catches /nearby and /search as :id
locationRoutes.get(
  '/:id',
  validate(locationValidation.locationIdParam),
  locationController.getLocationById
);
export default locationRoutes;
