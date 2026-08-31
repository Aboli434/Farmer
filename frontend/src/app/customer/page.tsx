'use client';

import { useState, useEffect } from 'react';
import { productsApi, ProductQueryParams } from '@/lib/api/products';
import { Product } from '@/types/product';
import { ProductCard } from '@/components/ProductCard';
import { Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CustomerDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  
  const fetchProducts = async (query?: string) => {
    await Promise.resolve();
      setIsLoading(true);
    try {
      const params: ProductQueryParams = {
        limit: 20,
        page: 1,
      };
      if (query) {
        params.search = query;
      }
      
      const response = await productsApi.getProducts(params);
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts(activeSearch);
  }, [activeSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(search);
  };

  return (
    <div className="space-y-10 pb-10">
      
      {/* Hero Section */}
      <section className="relative rounded-2xl overflow-hidden bg-green-900 text-white shadow-xl">
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="https://images.unsplash.com/photo-1595841696650-6f77215c0e18?auto=format&fit=crop&q=80&w=2000" 
            alt="Farming Background" 
            className="w-full h-full object-cover opacity-30"
          />
        </div>
        <div className="relative z-10 px-6 py-16 md:py-24 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Fresh from local farmers
          </h1>
          <p className="text-lg md:text-xl text-green-50 mb-8 max-w-2xl mx-auto">
            Discover fresh produce directly from trusted producers near you. Support local agriculture and eat healthier.
          </p>
          
          <form onSubmit={handleSearch} className="max-w-xl mx-auto relative flex shadow-lg rounded-full overflow-hidden bg-white p-1">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="What are you looking for?" 
                className="w-full pl-12 pr-4 h-12 border-none bg-transparent text-gray-900 focus-visible:ring-0 text-base"
              />
            </div>
            <Button type="submit" className="rounded-full h-12 px-8 bg-green-600 hover:bg-green-700 text-base font-semibold">
              Search
            </Button>
          </form>
        </div>
      </section>

      {/* Discovery Section */}
      <section>
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {activeSearch ? `Search results for "${activeSearch}"` : 'Fresh Arrivals'}
            </h2>
            <p className="text-gray-500 mt-1">Discover what local farmers are harvesting today.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-green-600" />
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <h3 className="text-lg font-medium text-gray-900">No products found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search criteria or check back later.</p>
            {activeSearch && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => { setSearch(''); setActiveSearch(''); }}
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
