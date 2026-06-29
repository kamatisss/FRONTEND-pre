import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package, Calendar, CreditCard, Truck, Box, X } from 'lucide-react';

const UserOrders = () => {
    const { authTokens, user } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [activeTab, setActiveTab] = useState('All');

    const filteredOrders = orders.filter(order => {
        if (activeTab === 'All') return true;
        return order.status === activeTab;
    });

    const showToast = (message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 8000);
    };

    const handleCancelOrder = async (orderId) => {
        if (window.confirm("Are you sure you want to cancel this order?")) {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/orders/${orderId}/`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (res.ok) {
                    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
                    showToast("Order cancelled successfully.", "info");
                } else {
                    alert("Failed to cancel order.");
                }
            } catch (err) {
                console.error("Error cancelling order:", err);
            }
        }
    };

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/orders/`, {
                    headers: {
                        'Authorization': `Bearer ${authTokens.access}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error("Failed to fetch orders.");
                }
                
                const data = await response.json();
                const userOrders = Array.isArray(data) ? data : (data.results || []);
                setOrders(userOrders);

                // Trigger automatic notification inviting rating/feedback once order is Delivered
                const deliveredOrders = userOrders.filter(o => o.status === 'Delivered');
                if (deliveredOrders.length > 0) {
                    deliveredOrders.forEach(o => {
                        showToast(`🌿 Order #${String(o.id).padStart(5, '0')} has been delivered! We'd love to hear your feedback on your purchase.`, 'success');
                    });
                }
            } catch (err) {
                console.error("Error fetching orders:", err);
                setError(err.message || 'Failed to load your orders.');
            } finally {
                setLoading(false);
            }
        };

        if (authTokens) {
            fetchOrders();
        }
    }, [authTokens, user]);

    /* ── Shared Style Tokens ── */
    const label = {
        fontSize: '11px',
        fontWeight: 700,
        color: '#8A7E6E',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '4px',
    };

    const getStatusBadge = (status) => {
        const base = {
            display: 'inline-block',
            padding: '5px 14px',
            borderRadius: 999,
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            border: '1.5px solid transparent'
        };
        switch (status) {
            case 'Pending':
                return { ...base, background: '#FFFBEB', color: '#D97706', borderColor: '#FDE68A' };
            case 'Paid':
                return { ...base, background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' };
            case 'Shipped':
                return { ...base, background: '#EFF6FF', color: '#2563EB', borderColor: '#BFDBFE' };
            case 'Out for Delivery':
                return { ...base, background: '#FFFBEB', color: '#D97706', borderColor: '#FDE68A' };
            case 'Delivered':
                return { ...base, background: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0' };
            case 'Cancelled':
                return { ...base, background: '#FEF2F2', color: '#DC2626', borderColor: '#FCA5A5' };
            default:
                return { ...base, background: '#F9FAFB', color: '#6B7280', borderColor: '#E5E7EB' };
        }
    };

    const s = {
        page: {
            minHeight: 'calc(100vh - 64px)',
            background: 'linear-gradient(160deg, #F7F3EC 0%, #EAF0E4 60%, #F0EBE0 100%)',
            padding: '2.5rem 1.5rem',
            fontFamily: "'Inter', system-ui, sans-serif",
        },
        card: {
            width: '100%',
            maxWidth: '1024px',
            margin: '0 auto',
            background: '#FDFAF6',
            borderRadius: '20px',
            border: '1.5px solid #E8E1D4',
            boxShadow: '0 8px 30px rgba(45, 74, 45, 0.05)',
            overflow: 'hidden',
            padding: '2.5rem',
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '2rem',
            paddingBottom: '1.25rem',
            borderBottom: '1.5px solid #EDE8DF',
        },
        title: {
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: '2rem',
            fontWeight: 800,
            color: '#1A2E1A',
            letterSpacing: '-0.01em',
            margin: 0,
        },
        empty: {
            padding: '4rem 1rem',
            textAlign: 'center',
            color: '#9A9080',
            fontSize: '1rem',
            fontWeight: 500,
        },
        loading: {
            padding: '4rem 1rem',
            textAlign: 'center',
            color: '#9A9080',
            fontSize: '1rem',
            fontWeight: 500,
        },
    };

    if (loading) {
        return (
            <div style={s.page}>
                <div style={s.card}>
                    <div style={s.loading}>
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            border: '4px solid #EDE8DF', borderTopColor: '#4A7A3A',
                            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
                        }} />
                        <p style={{ color: '#8A7E6E', fontWeight: 500, margin: 0 }}>Loading your orders...</p>
                    </div>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={s.page}>
                <div style={s.card}>
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', padding: '20px 28px', borderRadius: 12, textAlign: 'center' }}>
                        <p style={{ fontWeight: 700, marginBottom: 6, fontSize: '1rem' }}>Oops!</p>
                        <p style={{ fontSize: '0.88rem', margin: 0 }}>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div style={s.page}>
                <div style={s.card}>
                    <div style={s.header}>
                        <Package size={28} style={{ color: '#4A7A3A' }} />
                        <h2 style={s.title}>Order History</h2>
                    </div>
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F5F0E8', display: 'flex', alignItems: 'center', justifycontent: 'center', margin: '0 auto 20px' }}>
                            <Package size={32} color="#9A9080" />
                        </div>
                        <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.5rem', fontWeight: 800, color: '#1A2E1A', marginBottom: 8 }}>No orders yet</h3>
                        <p style={{ color: '#8A7E6E', fontSize: '0.95rem', marginBottom: 28, lineHeight: 1.6, maxWidth: 420, margin: '0 auto 28px' }}>
                            You haven't placed any orders yet. Head over to the Shop to browse plants, furniture, and hardscape items.
                        </p>
                        <button
                            onClick={() => navigate('/shop')}
                            style={{
                                padding: '12px 24px', background: 'linear-gradient(135deg, #1A2E1A 0%, #2D4A2D 100%)', color: '#fff',
                                border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700,
                                cursor: 'pointer', boxShadow: '0 4px 12px rgba(45,74,45,0.25)',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1A2E1A'}
                            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #1A2E1A 0%, #2D4A2D 100%)'}
                        >
                            Go to Shop
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={s.page}>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
            
            <div style={s.card}>
                
                {/* Page Header */}
                <div style={{ ...s.header, marginBottom: '1.5rem' }}>
                    <Package size={28} style={{ color: '#4A7A3A' }} />
                    <h2 style={s.title}>Order History</h2>
                </div>

                {/* Status Navigation Tabs */}
                <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    borderBottom: '1.5px solid #EDE8DF', 
                    marginBottom: '24px', 
                    paddingBottom: '8px', 
                    flexWrap: 'wrap' 
                }}>
                    {['All', 'Pending', 'Shipped', 'Delivered'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '8px 16px',
                                background: activeTab === tab ? '#4A7A3A' : 'transparent',
                                color: activeTab === tab ? '#FDFAF6' : '#8A7E6E',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => {
                                if (activeTab !== tab) e.currentTarget.style.background = '#EDE8DF';
                            }}
                            onMouseLeave={e => {
                                if (activeTab !== tab) e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            {tab === 'All' ? 'All Orders' : tab}
                        </button>
                    ))}
                </div>

                {/* Orders List */}
                {filteredOrders.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '3.5rem 1rem', color: '#9A9080',
                        background: '#ffffff', border: '1.5px solid #E8E1D4', borderRadius: '16px'
                    }}>
                        <Package size={36} color="#9A9080" style={{ marginBottom: '12px', display: 'inline-block' }} />
                        <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 650 }}>No orders currently in this status.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {filteredOrders.map((order) => (
                        <div key={order.id} style={{
                            background: '#ffffff', borderRadius: 16,
                            boxShadow: '0 4px 12px rgba(45, 74, 45, 0.03)',
                            border: '1.5px solid #E8E1D4',
                            padding: '24px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = '#8FAF7E';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(45, 74, 45, 0.08)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = '#E8E1D4';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 74, 45, 0.03)';
                        }}
                        >
                            {/* Card Header Info */}
                            <div style={{
                                display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start', justifycontent: 'space-between',
                                borderBottom: '1.5px solid #EDE8DF', pb: '16px', marginBottom: '20px', paddingBottom: '16px'
                            }}>
                                <div>
                                    <p style={label}>Order Number</p>
                                    <p style={{ fontSize: '14px', fontWeight: 800, color: '#1A2E1A', margin: 0 }}>
                                        #{String(order.id).padStart(5, '0')}
                                    </p>
                                </div>
                                <div>
                                    <p style={label}>Date Placed</p>
                                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#2D2D2D', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Calendar size={14} color="#9A9080" />
                                        {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                                <div>
                                    <p style={label}>Total Amount</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4A7A3A', margin: 0 }}>
                                        ₱{Number(order.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>

                            {/* Card Body Info */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '24px', marginBottom: '20px' }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <p style={label}>Delivery Address</p>
                                    <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
                                        {order.customer_address}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        {order.status.toLowerCase() === 'pending' && (
                                            <button 
                                                onClick={() => handleCancelOrder(order.id)}
                                                style={{
                                                    fontSize: '0.75rem', fontWeight: 700, color: '#EF4444',
                                                    cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                                                    transition: 'all 0.2s', textDecoration: 'none'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                            >
                                                Cancel Order
                                            </button>
                                        )}
                                        <span style={getStatusBadge(order.status)}>{order.status}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', fontWeight: 600, color: '#4A7A3A' }}>
                                        {order.payment_method === 'cod' ? (
                                            <><Truck size={14} color="#C9883A" /> Cash on Delivery</>
                                        ) : (
                                            <><CreditCard size={14} color="#4A7A3A" /> Online Payment (Stripe)</>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items List */}
                            <div style={{ borderTop: '1.5px solid #EDE8DF', paddingTop: '16px' }}>
                                <p style={{ ...label, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Box size={13} color="#9A9080" /> Order Items
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {order.items && order.items.length > 0 ? (
                                        order.items.map((item, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex', alignItems: 'center', gap: 8,
                                                background: '#F5F0E8', padding: '6px 14px', borderRadius: 8,
                                                border: '1.5px solid #E8E1D4',
                                            }}>
                                                <span style={{
                                                    fontSize: '11px', fontWeight: 800, color: '#4A7A3A',
                                                    background: '#fff', padding: '2px 7px', borderRadius: 5,
                                                    border: '1.5px solid #E8E1D4',
                                                }}>
                                                    {item.quantity}x
                                                </span>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1A2E1A' }}>
                                                    {item.item_name}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <span style={{ fontSize: '13px', color: '#9A9080', fontStyle: 'italic' }}>No items listed.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                )}

            </div>

            {/* In-app Toast stack */}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxWidth: '380px',
                width: '100%',
            }}>
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        style={{
                            background: '#1A2E1A',
                            color: '#FDFAF6',
                            padding: '16px 20px',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                            gap: '12px',
                            fontSize: '0.82rem',
                            fontWeight: 500,
                            lineHeight: 1.4,
                            border: '1.5px solid #4A7A3A',
                            animation: 'slideIn 0.3s ease-out',
                        }}
                    >
                        <span>{t.message}</span>
                        <button 
                            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#9CA3AF',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                outline: 'none'
                            }}
                        >
                            <X size={14} className="hover:text-white" />
                        </button>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default UserOrders;
