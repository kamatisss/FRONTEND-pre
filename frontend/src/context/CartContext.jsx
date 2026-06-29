import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => {
        const local = localStorage.getItem('garden_studio_cart');
        return local ? JSON.parse(local) : [];
    });

    useEffect(() => {
        localStorage.setItem('garden_studio_cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (product, quantity = 1) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { product, quantity }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    };

    const updateQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }
        setCart(prev => prev.map(item =>
            item.product.id === productId
                ? { ...item, quantity }
                : item
        ));
    };

    const clearCart = () => {
        setCart([]);
    };

    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartSubtotal = cart.reduce((sum, item) => sum + (parseFloat(item.product.unit_price) * item.quantity), 0);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            cartCount,
            cartSubtotal
        }}>
            {children}
        </CartContext.Provider>
    );
};
