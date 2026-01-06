import { Router } from 'express';
import tripController from '../controllers/trip.controller';
import tripValidation from '../validation/trip.validation';
import validate from '../middlewares/validation.middleware';

const tripRoutes = Router();

/**
 * POST /trip/generate
 * Generate a new trip itinerary using AI
 */
tripRoutes.post(
  '/generate',
  validate(tripValidation.generate),
  tripController.generateTrip
);

/**
 * GET /trip/my
 * Get user's trips with optional status filter
 */
tripRoutes.get(
  '/my',
  validate(tripValidation.myTrips),
  tripController.getMyTrips
);

/**
 * GET /trip/:id
 * Get a single trip by ID with full details
 */
tripRoutes.get(
  '/:id',
  validate(tripValidation.getById),
  tripController.getTripById
);

/**
 * PUT /trip/:id
 * Update trip details
 */
tripRoutes.put(
  '/:id',
  validate(tripValidation.update),
  tripController.updateTrip
);

/**
 * POST /trip/:id/complete
 * Mark trip as completed
 */
tripRoutes.post(
  '/:id/complete',
  validate(tripValidation.complete),
  tripController.completeTrip
);

/**
 * POST /trip/:id/save
 * Save trip (change status to SAVED)
 */
tripRoutes.post(
  '/:id/save',
  validate(tripValidation.save),
  tripController.saveTrip
);

/**
 * POST /trip/:id/cancel
 * Cancel trip
 */
tripRoutes.post(
  '/:id/cancel',
  validate(tripValidation.cancel),
  tripController.cancelTrip
);

/**
 * DELETE /trip/:id
 * Delete a trip (only if not posted)
 */
tripRoutes.delete(
  '/:id',
  validate(tripValidation.getById),
  tripController.deleteTrip
);

export default tripRoutes;
