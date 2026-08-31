'use client';

import { useEffect, useState, useCallback } from 'react';
import { sellerApi } from '@/lib/api/seller';
import { Product } from '@/types/product';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, ArrowUpRight, Box, Edit2, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type FlattenedVariant = {
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  status: string; // Product status
  availableQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  unit: string;
};

export default function SellerInventoryPage() {
  const [variants, setVariants] = useState<FlattenedVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Update Stock Modal State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<FlattenedVariant | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number | ''>('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      
      const res = await sellerApi.getProducts({ limit: 100 });
      if (res.success && res.data) {
        const flattened: FlattenedVariant[] = [];
        res.data.forEach((product: Product) => {
          product.variants?.forEach(v => {
            flattened.push({
              productId: product.id,
              productName: product.name,
              variantId: v.id,
              variantLabel: v.label,
              status: product.status,
              availableQuantity: Number(v.inventory?.availableQuantity) || 0,
              reservedQuantity: Number(v.inventory?.reservedQuantity) || 0,
              lowStockThreshold: Number(v.inventory?.lowStockThreshold) || 5,
              unit: v.unit,
            });
          });
        });
        setVariants(flattened);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInventory();
  }, [fetchInventory]);

  const handleUpdateStock = async () => {
    if (!selectedVariant || !adjustmentQuantity) return;
    setIsUpdating(true);
    try {
      const type = adjustmentType === 'add' ? 'RESTOCK' : 'ADJUSTMENT'; // Backend expects specific types
      const quantity = adjustmentType === 'add' ? Number(adjustmentQuantity) : -Number(adjustmentQuantity);
      
      const res = await sellerApi.updateInventory(selectedVariant.variantId, {
        adjustmentQuantity: quantity,
        type,
        notes: adjustmentNotes
      });
      
      if (res.success) {
        setIsUpdateModalOpen(false);
        fetchInventory(); // Refresh data
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update stock');
    } finally {
      setIsUpdating(false);
    }
  };

  const openUpdateModal = (variant: FlattenedVariant) => {
    setSelectedVariant(variant);
    setAdjustmentType('add');
    setAdjustmentQuantity('');
    setAdjustmentNotes('');
    setIsUpdateModalOpen(true);
  };

  const getStockStatus = (qty: number, threshold: number) => {
    if (qty <= 0) return { label: 'Out of Stock', color: 'destructive' as const };
    if (qty <= threshold) return { label: 'Low Stock', color: 'warning' as const };
    return { label: 'In Stock', color: 'default' as const }; // Using default for green/normal
  };

  const filteredVariants = variants.filter(v => 
    v.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.variantLabel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500">Track and update stock levels for all your product variants.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Search by product or variant..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-600 bg-red-50">{error}</div>
          ) : filteredVariants.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <Box className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No inventory found</h3>
              <p className="mt-1 text-sm text-gray-500">You need to add products with variants first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 bg-gray-50 uppercase border-b">
                  <tr>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-6 py-3">Variant</th>
                    <th className="px-6 py-3 text-right">Available Stock</th>
                    <th className="px-6 py-3 text-right">Reserved</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map((variant) => {
                    const status = getStockStatus(variant.availableQuantity, variant.lowStockThreshold);
                    return (
                      <tr key={variant.variantId} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {variant.productName}
                          {variant.status !== 'ACTIVE' && (
                            <span className="ml-2 text-xs text-gray-400 font-normal">({variant.status.toLowerCase()})</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          {variant.variantLabel}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {variant.availableQuantity} {variant.unit}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-500">
                          {variant.reservedQuantity} {variant.unit}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${status.color === 'destructive' ? 'bg-red-100 text-red-800' : 
                              status.color === 'warning' ? 'bg-orange-100 text-orange-800' : 
                              'bg-green-100 text-green-800'}
                          `}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8"
                            onClick={() => openUpdateModal(variant)}
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                            Update
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Stock Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Inventory</DialogTitle>
          </DialogHeader>
          
          {selectedVariant && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <div className="text-sm font-medium text-gray-900">{selectedVariant.productName}</div>
                <div className="text-xs text-gray-500">Variant: {selectedVariant.variantLabel}</div>
                <div className="mt-2 text-sm text-gray-700 flex justify-between">
                  <span>Current Available:</span>
                  <span className="font-semibold">{selectedVariant.availableQuantity} {selectedVariant.unit}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  type="button" 
                  variant={adjustmentType === 'add' ? 'default' : 'outline'}
                  onClick={() => setAdjustmentType('add')}
                  className={adjustmentType === 'add' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" /> Add Stock
                </Button>
                <Button 
                  type="button" 
                  variant={adjustmentType === 'remove' ? 'destructive' : 'outline'}
                  onClick={() => setAdjustmentType('remove')}
                >
                  Remove Stock
                </Button>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Quantity to {adjustmentType}</label>
                <div className="relative">
                  <Input 
                    type="number"
                    min="1"
                    step="0.1"
                    value={adjustmentQuantity}
                    onChange={(e) => setAdjustmentQuantity(Number(e.target.value) || '')}
                    className="pr-12"
                    autoFocus
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500 text-sm">
                    {selectedVariant.unit}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Input 
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  placeholder={adjustmentType === 'add' ? "e.g., New batch harvested" : "e.g., Damaged items"}
                />
              </div>

              {adjustmentQuantity && (
                <div className="text-sm bg-blue-50 text-blue-800 p-3 rounded-md flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div>
                    New total will be: 
                    <span className="font-bold ml-1">
                      {adjustmentType === 'add' 
                        ? selectedVariant.availableQuantity + Number(adjustmentQuantity)
                        : Math.max(0, selectedVariant.availableQuantity - Number(adjustmentQuantity))
                      } {selectedVariant.unit}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleUpdateStock} 
              disabled={!adjustmentQuantity || Number(adjustmentQuantity) <= 0 || isUpdating}
              className={adjustmentType === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
