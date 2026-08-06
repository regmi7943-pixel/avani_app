import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: string; // product id + optional variant
  product: {
    id: string;
    title: string;
    category: string;
    price: string; // e.g. "NPR 1,450 / Pack" or "NPR 1,100 / Bag"
    subsidized_price?: string;
    original_price?: string;
    image_url?: string;
    dosage?: string;
    unit?: string;
    emoji?: string;
  };
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  totalAmount: number;
}

const CartContext = createContext<CartContextType>({
  cartItems: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  cartCount: 0,
  totalAmount: 0,
});

// Helper to extract clean numeric price before slash (prevents unit specs like 50kg from inflating price)
export const parseNumericPrice = (rawPrice: any): number => {
  if (typeof rawPrice === 'number') return rawPrice;
  if (!rawPrice) return 0;
  const str = String(rawPrice);
  const priceOnlyPart = str.split('/')[0];
  const cleanDigits = priceOnlyPart.replace(/[^0-9]/g, '');
  return parseInt(cleanDigits, 10) || 0;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load persisted cart on mount
  useEffect(() => {
    AsyncStorage.getItem('@anavi_cart').then(stored => {
      if (stored) {
        try {
          setCartItems(JSON.parse(stored));
        } catch (e) {}
      }
    });
  }, []);

  // Save cart changes
  const saveCart = (items: CartItem[]) => {
    setCartItems(items);
    AsyncStorage.setItem('@anavi_cart', JSON.stringify(items));
  };

  const addToCart = (product: any, quantity = 1) => {
    const existingIndex = cartItems.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const updated = [...cartItems];
      updated[existingIndex].quantity += quantity;
      saveCart(updated);
    } else {
      saveCart([...cartItems, { id: product.id, product, quantity }]);
    }
  };

  const removeFromCart = (productId: string) => {
    saveCart(cartItems.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    saveCart(
      cartItems.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    saveCart([]);
  };

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Accurate total amount calculation without unit spec digit interference
  const totalAmount = cartItems.reduce((acc, item) => {
    const rawPrice = item.product.subsidized_price || item.product.price || 0;
    const num = parseNumericPrice(rawPrice);
    return acc + num * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
