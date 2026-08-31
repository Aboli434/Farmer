'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sellerApi } from '@/lib/api/seller';
import { productsApi } from '@/lib/api/products';
import { Category } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export default function NewProductPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Available categories extracted from existing products
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    productType: 'FRESH_PRODUCE',
    detail: {
      isVegetarian: true,
      shelfLifeDays: 7,
      storageInstructions: '',
    },
  });

  const [variants, setVariants] = useState([
    { label: '1 kg', quantity: 1, unit: 'kg', price: 100, initialStock: 50 }
  ]);

  useEffect(() => {
    // Fetch categories by extracting from public products (since there is no category endpoint)
    async function fetchCategories() {
      try {
        const res = await productsApi.getProducts({ limit: 50 });
        if (res.success && res.data) {
          const uniqueCategories = new Map<string, Category>();
          res.data.forEach(product => {
            if (product.category) {
              uniqueCategories.set(product.category.id, product.category);
            }
          });
          setCategories(Array.from(uniqueCategories.values()));
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      } finally {
        setIsLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  const handleAddVariant = () => {
    setVariants([...variants, { label: '', quantity: 1, unit: 'kg', price: 0, initialStock: 0 }]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length > 1) {
      const newVariants = [...variants];
      newVariants.splice(index, 1);
      setVariants(newVariants);
    }
  };

  const handleVariantChange = (index: number, field: string, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!formData.categoryId && categories.length > 0) {
        throw new Error('Please select a category');
      }

      // If there are no categories found, we can't create a product since backend requires valid categoryId
      if (!formData.categoryId) {
         throw new Error('No categories available in the system. Cannot create product.');
      }

      const payload = {
        ...formData,
        variants: variants.map(v => ({
          label: v.label,
          quantity: Number(v.quantity),
          unit: v.unit,
          price: Number(v.price),
          initialStock: Number(v.initialStock)
        })),
        images: [] // Provide empty images array or integrate image upload later
      };

      const res = await sellerApi.createProduct(payload);
      if (res.success) {
        router.push('/seller/products');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/seller/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-sm text-gray-500">Create a new listing for your farm.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-md">
          {error}
        </div>
      )}

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
                placeholder="e.g. Organic Tomatoes" 
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea 
                required 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe your product..." 
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Category</label>
                {isLoadingCategories ? (
                  <div className="h-10 border rounded flex items-center px-3 text-gray-500 bg-gray-50">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                  </div>
                ) : (
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
                        <SelectItem value="none" disabled>No categories found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Product Type</label>
                <Select 
                  value={formData.productType} 
                  onValueChange={(val: string | null) => setFormData({...formData, productType: val || 'FRESH_PRODUCE'})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FRESH_PRODUCE">Fresh Produce</SelectItem>
                    <SelectItem value="PROCESSED_FOOD">Processed Food</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-lg font-semibold text-gray-900">Variants & Pricing</h2>
              <Button type="button" variant="outline" size="sm" onClick={handleAddVariant}>
                <Plus className="h-4 w-4 mr-1" /> Add Variant
              </Button>
            </div>

            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div key={index} className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 border rounded-lg relative">
                  <div className="grid gap-2 flex-1 min-w-[120px]">
                    <label className="text-xs font-medium">Label</label>
                    <Input 
                      required 
                      value={variant.label}
                      onChange={(e) => handleVariantChange(index, 'label', e.target.value)}
                      placeholder="e.g. 1 kg" 
                    />
                  </div>
                  <div className="grid gap-2 w-24">
                    <label className="text-xs font-medium">Value</label>
                    <Input 
                      required 
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={variant.quantity}
                      onChange={(e) => handleVariantChange(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 w-24">
                    <label className="text-xs font-medium">Unit</label>
                    <Input 
                      required 
                      value={variant.unit}
                      onChange={(e) => handleVariantChange(index, 'unit', e.target.value)}
                      placeholder="kg, ml..." 
                    />
                  </div>
                  <div className="grid gap-2 w-32">
                    <label className="text-xs font-medium">Price (₹)</label>
                    <Input 
                      required 
                      type="number"
                      min="0"
                      value={variant.price}
                      onChange={(e) => handleVariantChange(index, 'price', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2 w-32">
                    <label className="text-xs font-medium">Initial Stock</label>
                    <Input 
                      required 
                      type="number"
                      min="0"
                      value={variant.initialStock}
                      onChange={(e) => handleVariantChange(index, 'initialStock', e.target.value)}
                    />
                  </div>
                  {variants.length > 1 && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 mb-0.5"
                      onClick={() => handleRemoveVariant(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/seller/products">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || isLoadingCategories} className="bg-green-600 hover:bg-green-700">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Product
          </Button>
        </div>
      </form>
    </div>
  );
}
