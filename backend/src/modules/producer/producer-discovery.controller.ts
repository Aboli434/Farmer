import { Request, Response, NextFunction } from 'express';
import { ProducerDiscoveryService } from './producer-discovery.service';
import { ProductService } from '../product/product.service';

export class ProducerDiscoveryController {
  static async getProducers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await ProducerDiscoveryService.getProducers(page, limit, req.query);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async getNearbyProducers(req: Request, res: Response, next: NextFunction) {
    try {
      const producers = await ProducerDiscoveryService.getNearbyProducers(req.query);
      res.status(200).json({ success: true, data: producers });
    } catch (error) {
      next(error);
    }
  }

  static async getProducerById(req: Request, res: Response, next: NextFunction) {
    try {
      const producer = await ProducerDiscoveryService.getProducerById(req.params.id as string);
      res.status(200).json({ success: true, data: producer });
    } catch (error) {
      next(error);
    }
  }

  static async getProducerProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const result = await ProductService.getProducts(page, limit, { ...req.query, producerId: req.params.id as string });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
