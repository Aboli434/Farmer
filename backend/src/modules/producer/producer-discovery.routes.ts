import { Router } from 'express';
import { ProducerDiscoveryController } from './producer-discovery.controller';

const router = Router();

router.get('/nearby', ProducerDiscoveryController.getNearbyProducers);
router.get('/', ProducerDiscoveryController.getProducers);
router.get('/:id', ProducerDiscoveryController.getProducerById);
router.get('/:id/products', ProducerDiscoveryController.getProducerProducts);

export default router;
