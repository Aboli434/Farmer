'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sellerApi } from '@/lib/api/seller';
import { productsApi } from '@/lib/api/products';
import { Product, Category } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Save, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function EditProductPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Available categories
  const [categories, setCategories] = useState<Category[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    productType: 'FRESH_PRODUCE',
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch specific product to edit
        // We can use getProducts with search filter, but it might not return details accurately, 
        // Let's use the public getProductBySlug if possible, or just find it from getProducts
        const res = await sellerApi.getProducts({ limit: 100 });
        if (res.success && res.data) {
          const found = res.data.find(p => p.id === params.id);
          if (found) {
            setProduct(found);
            setFormData({
              name: found.name || '',
              description: found.description || '',
              categoryId: found.categoryId || '',
              productType: found.productType || 'FRESH_PRODUCE',
            });
          } else {
            setError('Product not found or you do not have permission to view it.');
          }

          // Extract categories
          const uniqueCategories = new Map<string, Category>();
          res.data.forEach(p => {
            if (p.category) {
              uniqueCategories.set(p.category.id, p.category);
            }
          });
          
          // Also fetch public products to ensure we have a good list of categories
          try {
             const pubRes = await productsApi.getProducts({ limit: 50 });
             pubRes.data.forEach(p => {
               if (p.category) uniqueCategories.set(p.category.id, p.category);
             });
          } catch(e) {}
          
          setCategories(Array.from(uniqueCategories.values()));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load product');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await sellerApi.updateProduct(params.id, formData);
      if (res.success) {
        router.push('/seller/products');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-red-200">
        <h2 className="text-lg font-semibold text-red-600">Error</h2>
        <p className="text-gray-600">{error || 'Product not found'}</p>
        <Link href="/seller/products">
          <Button variant="outline" className="mt-4">Back to Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/seller/products">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
              <Badge variant={product.status === 'ACTIVE' ? 'default' : 'secondary'}>
                {product.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">Update your product details.</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start">
        <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-blue-800">Review Process</h3>
          <p className="text-sm text-blue-700 mt-1">
            Editing a product will change its status back to <strong>PENDING</strong>. It will temporarily be hidden from the marketplace until an administrator approves the changes.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h2>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">Product Name</label>
              <Input 
                required 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                required 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Category</label>
                <Select 
                  value={formData.categoryId} 
                  onValueChange={(val: string | null) => setFormData({...formData, categoryId: val || ''})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    {categories.length === 0 && (
                      <SelectItem value={formData.categoryId}>{product.category?.name || 'Current Category'}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <Button type="button" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
            <Trash2 className="h-4 w-4 mr-2" /> Delete Product
          </Button>
          <div className="flex gap-4">
            <Link href="/seller/products">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
