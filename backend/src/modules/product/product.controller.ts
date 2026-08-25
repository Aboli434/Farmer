import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class ProductController {
  static async createProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const product = await ProductService.createProduct(userId, req.body);
      
      res.status(201).json({
        success: true,
        message: 'Product created successfully and is pending review.',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      
      const result = await ProductService.getProducts(page, limit, req.query);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  static async getProductBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const slug = req.params.slug as string;
      const product = await ProductService.getProductBySlug(slug);
      
      res.status(200).json({
        success: true,
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSellerProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const result = await ProductService.getSellerProducts(userId, page, limit);
      
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.id;

      const product = await ProductService.updateProduct(id, userId, req.body);
      
      res.status(200).json({
        success: true,
        message: 'Product updated successfully. It has been moved to PENDING status.',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const userId = req.user!.id;

      await ProductService.deleteProduct(id, userId);
      
      res.status(200).json({
        success: true,
        message: 'Product deleted successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
}
