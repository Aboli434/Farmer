'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CartResponse } from '@/types/cart';
import { cartApi } from '@/lib/api/cart';
import { useAuth } from '@/lib/auth/store';

interface CartState {
  cart: CartResponse | null;
  isLoading: boolean;
}

interface CartContextType extends CartState {
  fetchCart: () => Promise<void>;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<CartState>({
    cart: null,
    isLoading: true,
  });

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ cart: null, isLoading: false });
      return;
    }
    
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await cartApi.getCart();
      setState({ cart: response.data, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch cart', error);
      setState({ cart: null, isLoading: false });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCart();
  }, [fetchCart]);

  const addItem = async (variantId: string, quantity: number) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await cartApi.upsertItem(variantId, quantity);
      setState({ cart: response.data, isLoading: false });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const removeItem = async (variantId: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await cartApi.removeItem(variantId);
      setState({ cart: response.data, isLoading: false });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const response = await cartApi.clearCart();
      setState({ cart: response.data, isLoading: false });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const totalItems = state.cart?.groupedByProducer?.reduce((total, group) => {
    return total + group.items.reduce((sum, item) => sum + item.quantity, 0);
  }, 0) || 0;

  return (
    <CartContext.Provider value={{ ...state, fetchCart, addItem, removeItem, clearCart, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
