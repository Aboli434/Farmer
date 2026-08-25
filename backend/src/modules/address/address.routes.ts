import { Router } from 'express';
import { AddressController } from './address.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validateRequest';
import { createAddressSchema, updateAddressSchema } from './address.validation';

const router = Router();

router.use(authenticate);

router.post('/', validateRequest(createAddressSchema), AddressController.createAddress);
router.get('/', AddressController.getUserAddresses);
router.patch('/:id', validateRequest(updateAddressSchema), AddressController.updateAddress);
router.delete('/:id', AddressController.deleteAddress);

export default router;
