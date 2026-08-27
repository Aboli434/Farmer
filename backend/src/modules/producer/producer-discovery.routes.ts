import { Router } from 'express';
import { ProducerDiscoveryController } from './producer-discovery.controller';

const router = Router();

router.get('/nearby', ProducerDiscoveryController.getNearbyProducers);
router.get('/', ProducerDiscoveryController.getProducers);

// Allow '/me' to fall through to the authenticated producer routes
router.use('/:id', (req, res, next) => {
  if (req.params.id === 'me' || req.params.id === 'apply') return next('router');
  next();
});

router.get('/:id', ProducerDiscoveryController.getProducerById);
router.get('/:id/products', ProducerDiscoveryController.getProducerProducts);

export default router;
