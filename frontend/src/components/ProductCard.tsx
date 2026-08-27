'use client';

import { Product } from '@/types/product';
import Link from 'next/link';
import { MapPin, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryVariant = product.variants?.[0];
  const price = primaryVariant?.price || 0;
  const unit = primaryVariant?.unit || 'unit';
  const imageUrl = product.images?.[0]?.url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600'; // Default placeholder

  const producer = product.producer;
  const isVerified = producer?.verifications?.some(v => v.status === 'APPROVED');
  const location = producer ? [producer.city, producer.district].filter(Boolean).join(', ') : 'Unknown location';

  return (
    <Link href={`/customer/products/${product.slug}`} className="group h-full flex flex-col">
      <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-md hover:border-green-200">
        {/* Image Container */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.productType === 'FRESH_PRODUCE' && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-green-600/90 hover:bg-green-600">Fresh Produce</Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-start gap-2 mb-2">
            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-green-700 transition-colors">
              {product.name}
            </h3>
            <div className="text-right flex-shrink-0">
              <span className="font-bold text-lg text-green-700">₹{price}</span>
              <span className="text-xs text-gray-500 ml-1">/{unit}</span>
            </div>
          </div>

          <div className="mt-auto space-y-2 pt-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-700">
              <span className="truncate">{producer?.farmName || 'Independent Farmer'}</span>
              {isVerified && (
                <ShieldCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
              )}
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
