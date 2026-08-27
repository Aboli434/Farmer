import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { productsApi } from '@/lib/api/products';
import { Product } from '@/types/product';
import { Loader2, ArrowLeft, MapPin, ShieldCheck, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useCart } from '@/lib/cart/store';
import { ApiClientError } from '@/lib/api/client';

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { addItem, isLoading: isCartLoading } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartSuccess, setCartSuccess] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await productsApi.getProductBySlug(slug);
        if (response.success && response.data) {
          setProduct(response.data);
        } else {
          setError('Product not found');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load product details');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
        <h3 className="text-lg font-medium text-gray-900">{error || 'Product not found'}</h3>
        <p className="text-gray-500 mt-1">The product you are looking for does not exist or has been removed.</p>
        <Link href="/customer">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  const primaryVariant = product.variants?.[0];
  const price = primaryVariant?.price || 0;
  const unit = primaryVariant?.unit || 'unit';
  const imageUrl = product.images?.[0]?.url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200';
  const availableStock = primaryVariant?.inventory?.availableQuantity || 0;
  const variantId = primaryVariant?.id;
  
  const producer = product.producer;
  const isVerified = producer?.verifications?.some(v => v.status === 'APPROVED');
  const location = producer ? [producer.city, producer.state].filter(Boolean).join(', ') : 'Unknown location';

  const handleAddToCart = async () => {
    if (!variantId) return;
    setCartError(null);
    setCartSuccess(false);
    
    try {
      await addItem(variantId, quantity);
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setCartError(err.message);
      } else {
        setCartError('Failed to add item to cart');
      }
    }
  };

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(q => q - 1);
  };

  const handleIncrement = () => {
    if (quantity < availableStock) setQuantity(q => q + 1);
  };

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <Link href="/customer" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-green-700 mb-6 transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Link>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          
          {/* Product Image */}
          <div className="relative aspect-square md:aspect-auto md:h-full bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={imageUrl} 
              alt={product.name} 
              className="w-full h-full object-cover"
            />
            {product.productType === 'FRESH_PRODUCE' && (
              <div className="absolute top-4 left-4">
                <Badge className="bg-green-600/90 text-sm py-1 px-3">Fresh Produce</Badge>
              </div>
            )}
          </div>
          
          {/* Product Details */}
          <div className="p-8 md:p-10 flex flex-col">
            <div className="mb-2">
              <span className="text-sm font-medium text-green-600 tracking-wider uppercase">
                {product.category?.name || 'Category'}
              </span>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
            
            <div className="flex items-end gap-2 mb-6 pb-6 border-b border-gray-100">
              <span className="text-4xl font-extrabold text-green-700">₹{price}</span>
              <span className="text-lg text-gray-500 mb-1">/{unit}</span>
            </div>
            
            <div className="prose prose-sm text-gray-600 mb-8 max-w-none">
              <p>{product.description}</p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-5 mb-8">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                Sold by
              </h3>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xl flex-shrink-0">
                  {producer?.farmName?.charAt(0) || 'F'}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-gray-900">
                    {producer?.farmName || 'Independent Farmer'}
                    {isVerified && (
                      <ShieldCheck className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-auto pt-4 space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button 
                    onClick={handleDecrement}
                    disabled={quantity <= 1 || isCartLoading}
                    className="p-2 text-gray-600 hover:text-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <button 
                    onClick={handleIncrement}
                    disabled={quantity >= availableStock || isCartLoading}
                    className="p-2 text-gray-600 hover:text-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <span className="text-sm text-gray-500">{availableStock} available</span>
              </div>

              {cartError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {cartError}
                </div>
              )}
              {cartSuccess && (
                <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md">
                  Added to cart successfully!
                </div>
              )}

              <Button 
                onClick={handleAddToCart}
                disabled={isCartLoading || availableStock < 1 || !variantId}
                className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 rounded-xl"
              >
                {isCartLoading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : null}
                {availableStock < 1 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
