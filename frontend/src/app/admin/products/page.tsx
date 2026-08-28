'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api/admin';
import { Product } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Package, CheckCircle, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Moderation state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isActioning, setIsActioning] = useState(false);

  const fetchProducts = useCallback(async (currentPage: number, status: string) => {
    try {
      setIsLoading(true);
      const params: any = { page: currentPage, limit: 10 };
      if (status !== 'ALL') {
        params.status = status;
      }
      
      const res = await adminApi.getProducts(params);
      if (res.success && res.data) {
        setProducts(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.pages);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts(page, statusFilter);
  }, [fetchProducts, page, statusFilter]);

  const handleApprove = async (productId: string) => {
    try {
      setIsActioning(true);
      const res = await adminApi.approveProduct(productId);
      if (res.success) {
        fetchProducts(page, statusFilter);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to approve product');
    } finally {
      setIsActioning(false);
    }
  };

  const handleReject = async () => {
    if (!selectedProduct || !rejectReason.trim()) return;
    try {
      setIsActioning(true);
      const res = await adminApi.rejectProduct(selectedProduct.id, rejectReason);
      if (res.success) {
        setIsRejectModalOpen(false);
        setRejectReason('');
        setSelectedProduct(null);
        fetchProducts(page, statusFilter);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reject product');
    } finally {
      setIsActioning(false);
    }
  };

  const openRejectModal = (product: Product) => {
    setSelectedProduct(product);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p as any).producer?.farmName?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Product Moderation</h1>
          <p className="text-sm text-slate-500">Approve or reject newly listed products before they go live on the marketplace.</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-slate-50/50">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Search by product name or producer..."
                className="pl-9 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={(val: string | null) => { setStatusFilter(val || 'ALL'); setPage(1); }}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Products</SelectItem>
                  <SelectItem value="PENDING">Pending Approval</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && products.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50">
              {error}
              <Button onClick={() => fetchProducts(page, statusFilter)} variant="outline" className="mt-4 bg-white">Retry</Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
                <Package className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No products found</h3>
              <p className="mt-1 text-sm">No products match your current filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3">Product Info</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Variants</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="bg-white hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-slate-100 rounded flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {product.images && product.images.length > 0 ? (
                              <img src={product.images[0].url} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{product.name}</div>
                            <div className="text-xs text-slate-500">{(product as any).producer?.farmName || 'Unknown Farm'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {product.category?.name || 'Uncategorized'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">{product.variants?.length || 0} variant(s)</div>
                        {product.variants && product.variants.length > 0 && (
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-[120px]">
                            {product.variants.map(v => `₹${v.price}/${v.unit}`).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${product.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                            product.status === 'PENDING' ? 'bg-orange-100 text-orange-800' : 
                            'bg-red-100 text-red-800'}
                        `}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {product.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => openRejectModal(product)}
                              disabled={isActioning}
                            >
                              Reject
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-8 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => handleApprove(product.id)}
                              disabled={isActioning}
                            >
                              {isActioning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                              Approve
                            </Button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Moderated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50">
              <div className="text-sm text-slate-500">
                Page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Reject Product
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting <span className="font-medium text-slate-900">{selectedProduct?.name}</span>. The producer will see this reason in their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Rejection Reason (Required)</label>
              <Textarea 
                placeholder="e.g. Inappropriate images, confusing pricing, misleading description..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={isActioning || !rejectReason.trim()}
            >
              {isActioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
