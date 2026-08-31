'use client';

import { useEffect, useState, useCallback } from 'react';
import { sellerApi } from '@/lib/api/seller';
import { Product } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, PackageOpen, MoreVertical, Edit, Search } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await sellerApi.getProducts({ limit: 100 });
      if (res.success && res.data) {
        setProducts(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'default'; // Or some custom green
      case 'PENDING': return 'secondary';
      case 'REJECTED': return 'destructive';
      case 'INACTIVE': return 'outline';
      default: return 'outline';
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Manage your product catalog and listings.</p>
        </div>
        <Link href="/seller/products/new">
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search products..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <PackageOpen className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No products found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery ? "No products match your search." : "You haven&apos;t added any products yet."}
              </p>
              {!searchQuery && (
                <div className="mt-6">
                  <Link href="/seller/products/new">
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" /> Add your first product
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Variants</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                        {product.images && product.images.length > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.images[0].url} alt={product.name} className="h-10 w-10 rounded object-cover bg-gray-100" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                            <PackageOpen className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        {product.name}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {product.category?.name || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusBadgeVariant(product.status) as any}>
                          {product.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {product.variants?.length || 0} variant{(product.variants?.length || 0) !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/seller/products/${product.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-500 hover:text-green-700">
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
