'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { productsApi } from '@/lib/api/products';
import { Product } from '@/types/product';
import { Loader2, ArrowLeft, MapPin, ShieldCheck, Minus, Plus, Star, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useCart } from '@/lib/cart/store';
import { ApiClientError } from '@/lib/api/client';
import { reviewsApi } from '@/lib/api/reviews';
import { Review } from '@/types/review';

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  
  const { addItem, isLoading: isCartLoading } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [cartError, setCartError] = useState<string | null>(null);
  const [cartSuccess, setCartSuccess] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const response = await productsApi.getProductBySlug(slug);
        if (response.success && response.data) {
          setProduct(response.data);
          
          // Fetch reviews
          setReviewsLoading(true);
          try {
            const reviewRes = await reviewsApi.getProductReviews(response.data.id);
            if (reviewRes.success) {
              setReviews(reviewRes.data);
            }
          } catch (rErr) {
            console.error('Failed to load reviews', rErr);
          } finally {
            setReviewsLoading(false);
          }
          
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

  const handleReportReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to report this review?')) return;
    try {
      await reviewsApi.reportReview(reviewId);
      alert('Review reported successfully. Our team will review it.');
    } catch {
      alert('Failed to report review.');
    }
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
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center text-yellow-500 text-sm font-medium">
                      <Star className="h-3.5 w-3.5 fill-current mr-1" />
                      {producer?.trustScore ? producer.trustScore.toFixed(1) : 'New'}
                    </div>
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
      
      {/* Reviews Section */}
      <div className="mt-10 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Customer Reviews</h2>
        
        {reviewsLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Star className="mx-auto h-8 w-8 text-gray-300 mb-3" />
            <p className="text-gray-500">No reviews yet for this product.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <div key={review.id} className="pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star} 
                          className={`h-4 w-4 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} 
                        />
                      ))}
                    </div>
                    <span className="font-medium text-gray-900">{review.user?.name || 'Customer'}</span>
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">Verified Purchase</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                    <button 
                      onClick={() => handleReportReview(review.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      title="Report Review"
                    >
                      <Flag className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {review.comment && (
                  <p className="text-gray-700 mt-2 text-sm">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
