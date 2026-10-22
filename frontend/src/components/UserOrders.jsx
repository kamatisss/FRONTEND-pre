import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Package, Calendar, CreditCard, Truck, Box, X, Star } from 'lucide-react';
import ServiceRatingModal from './ServiceRatingModal';
import { createCheckoutSession } from '../services/api';
import SwipeCarousel from './ui/SwipeCarousel';
import { useIsPhone } from './ui/useMediaQuery';
import { API_BASE_URL as API_ROOT } from '../config';

// Each tab covers every status in that stage ("Out for Delivery" used to show only under All)
const TAB_STATUSES = {
    Pending: ['Pending', 'Paid'],
    Shipped: ['Shipped', 'Out for Delivery'],
    Delivered: ['Delivered'],
};
const ACTIVE_ORDER_STATUSES = ['Pending', 'Paid', 'Shipped', 'Out for Delivery'];
let toastSeq = 0;

const UserOrders = () => {
    const { authTokens, user } = useAuth();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [toasts, setToasts] = useState([]);
    const [activeTab, setActiveTab] = useState('All');
    const [ratingTarget, setRatingTarget] = useState(null); // { orderItemId, name } or null
    const [payingId, setPayingId] = useState(null);

    const handlePayNow = async (orderId) => {
        setPayingId(orderId);
        try {
            const { checkout_url } = await createCheckoutSession(orderId);
            window.location.href = checkout_url;
        } catch (err) {
            showToast(err.message, 'error');
            setPayingId(null);
        }
    };

    const handleReviewSuccess = (review) => {
        // Mark the reviewed line in place so the Rate button turns into a rating badge
        setOrders(prev => prev.map(order => ({
            ...order,
            items: order.items.map(item =>
                item.id === ratingTarget.orderItemId
                    ? { ...item, review: { id: review.id, rating: review.rating, comment: review.comment } }
                    : item
            ),
        })));
        showToast(`Thanks for reviewing ${ratingTarget.name}!`, 'success');
        setRatingTarget(null);
    };

    const isPhone = useIsPhone();

    const filteredOrders = orders.filter(order => {
        if (activeTab === 'All') return true;
        return (TAB_STATUSES[activeTab] || [activeTab]).includes(order.status);
    });

    const showToast = (message, type = 'info') => {
        const id = ++toastSeq;
        setToasts(prev => prev.some(t => t.message === message) ? prev : [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 8000);
    };

    const handleCancelOrder = async (orderId) => {
        if (window.confirm("Are you sure you want to cancel this order?")) {
            try {
                const res = await fetch(`${API_ROOT}/orders/${orderId}/`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (res.ok) {
                    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
                    showToast("Order cancelled successfully.", "info");
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert(data.error || "Failed to cancel order.");
                }
            } catch (err) {
                console.error("Error cancelling order:", err);
            }
        }
    };

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch(`${API_ROOT}/orders/`, {
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

                // Invite feedback only for delivered orders that still have unreviewed products
                const ordersAwaitingReview = userOrders.filter(o =>
                    o.status === 'Delivered' && (o.items || []).some(i => i.item && !i.review)
                );
                // One notice, however many orders are waiting (a stack of them covers the screen on phones)
                if (ordersAwaitingReview.length === 1) {
                    showToast(`🌿 Order #${String(ordersAwaitingReview[0].id).padStart(5, '0')} has been delivered! Rate your products below to share your feedback.`, 'success');
                } else if (ordersAwaitingReview.length > 1) {
                    showToast(`🌿 ${ordersAwaitingReview.length} of your orders have been delivered! Rate your products below to share your feedback.`, 'success');
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
        color: '#64748B',
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
            background: 'linear-gradient(160deg, #F8FAFC 0%, #ECFDF5 60%, #F1F5F9 100%)',
            padding: 'clamp(1rem, 4vw, 2.5rem) clamp(0.25rem, 2vw, 1.5rem)',
            fontFamily: "'Inter', system-ui, sans-serif",
        },
        card: {
            width: '100%',
            maxWidth: '1024px',
            margin: '0 auto',
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1.5px solid #E2E8F0',
            boxShadow: '0 8px 30px rgba(15,23,42, 0.05)',
            overflow: 'hidden',
            padding: 'clamp(1.25rem, 4vw, 2.5rem)',
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '2rem',
            paddingBottom: '1.25rem',
            borderBottom: '1.5px solid #E2E8F0',
        },
        title: {
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 'clamp(1.5rem, 5vw, 2rem)',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.01em',
            margin: 0,
        },
        empty: {
            padding: '4rem 1rem',
            textAlign: 'center',
            color: '#94A3B8',
            fontSize: '1rem',
            fontWeight: 500,
        },
        loading: {
            padding: '4rem 1rem',
            textAlign: 'center',
            color: '#94A3B8',
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
                            border: '4px solid #E2E8F0', borderTopColor: '#059669',
                            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
                        }} />
                        <p style={{ color: '#64748B', fontWeight: 500, margin: 0 }}>Loading your orders...</p>
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
                        <Package size={28} style={{ color: '#059669' }} />
                        <h2 style={s.title}>Order History</h2>
                    </div>
                    <div style={{ textAlign: 'center', padding: '24px 0' }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifycontent: 'center', margin: '0 auto 20px' }}>
                            <Package size={32} color="#94A3B8" />
                        </div>
                        <h3 style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>No orders yet</h3>
                        <p style={{ color: '#64748B', fontSize: '0.95rem', marginBottom: 28, lineHeight: 1.6, maxWidth: 420, margin: '0 auto 28px' }}>
                            You haven't placed any orders yet. Head over to the Shop to browse plants, furniture, and hardscape items.
                        </p>
                        <button
                            onClick={() => navigate('/shop')}
                            style={{
                                padding: '12px 24px', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#fff',
                                border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700,
                                cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.25)',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#0F172A'}
                            onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'}
                        >
                            Go to Shop
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // One order card, shared by the phone carousel/list and the desktop list
    const renderOrder = (order) => (
            <div key={order.id} style={{
                background: '#ffffff', borderRadius: 16,
                boxShadow: '0 4px 12px rgba(15,23,42, 0.03)',
                border: '1.5px solid #E2E8F0',
                padding: isPhone ? '16px' : '24px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = '#6EE7B7';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42, 0.08)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42, 0.03)';
            }}
            >
                {/* Card Header Info */}
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: isPhone ? '14px 20px' : '24px', alignItems: 'flex-start',
                    borderBottom: '1.5px solid #E2E8F0', marginBottom: isPhone ? '14px' : '20px', paddingBottom: isPhone ? '12px' : '16px'
                }}>
                    <div>
                        <p style={label}>Order Number</p>
                        <p style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                            #{String(order.id).padStart(5, '0')}
                        </p>
                    </div>
                    <div>
                        <p style={label}>Date Placed</p>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Calendar size={14} color="#94A3B8" />
                            {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                    <div>
                        <p style={label}>Total Amount</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669', margin: 0 }}>
                            ₱{Number(order.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Card Body Info */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: isPhone ? '12px' : '24px', marginBottom: isPhone ? '14px' : '20px' }}>
                    <div style={{ flex: 1, minWidth: 'min(200px, 100%)' }}>
                        <p style={label}>Delivery Address</p>
                        <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.6, margin: 0 }}>
                            {order.customer_address}
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isPhone ? 'flex-start' : 'flex-end', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {order.payment_method === 'online' && order.payment_status === 'Pending' && order.status === 'Pending' && (
                                <button
                                    onClick={() => handlePayNow(order.id)}
                                    disabled={payingId === order.id}
                                    style={{
                                        fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                                        background: '#059669', border: 'none', borderRadius: 999,
                                        padding: '5px 14px', cursor: 'pointer', opacity: payingId === order.id ? 0.6 : 1,
                                    }}
                                >
                                    {payingId === order.id ? 'Opening…' : 'Pay Now'}
                                </button>
                            )}
                            {order.status === 'Pending' && order.payment_status !== 'Paid' && (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                            {order.payment_method === 'cod' ? (
                                <><Truck size={14} color="#D97706" /> Cash on Delivery</>
                            ) : (
                                <><CreditCard size={14} color="#059669" /> QR Ph / GCash / Maya / Card</>
                            )}
                            <span style={{
                                marginLeft: 4, padding: '1px 8px', borderRadius: 999, fontSize: '11px', fontWeight: 700,
                                ...(order.payment_status === 'Paid'
                                    ? { background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }
                                    : order.payment_status === 'Pending'
                                        ? { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }
                                        : { background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }),
                            }}>
                                {order.payment_status === 'Pending' ? 'Unpaid' : order.payment_status}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Items List */}
                <div style={{ borderTop: '1.5px solid #E2E8F0', paddingTop: '16px' }}>
                    <p style={{ ...label, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Box size={13} color="#94A3B8" /> Order Items
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {order.items && order.items.length > 0 ? (
                            order.items.map((item, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    background: '#F1F5F9', padding: '6px 14px', borderRadius: 8,
                                    border: '1.5px solid #E2E8F0',
                                }}>
                                    <span style={{
                                        fontSize: '11px', fontWeight: 800, color: '#059669',
                                        background: '#fff', padding: '2px 7px', borderRadius: 5,
                                        border: '1.5px solid #E2E8F0',
                                    }}>
                                        {item.quantity}x
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                                        {item.item_name}
                                    </span>
                                    {order.status === 'Delivered' && (item.review ? (
                                        <span
                                            title={item.review.comment || 'Your rating'}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                                fontSize: '11px', fontWeight: 800, color: '#059669',
                                                background: '#ECFDF5', padding: '2px 8px', borderRadius: 999,
                                                border: '1px solid #A7F3D0',
                                            }}
                                        >
                                            <Star size={10} fill="#059669" color="#059669" /> {item.review.rating}
                                        </span>
                                    ) : item.item && (
                                        <button
                                            onClick={() => setRatingTarget({ orderItemId: item.id, name: item.item_name })}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                fontSize: '11px', fontWeight: 700, color: '#fff',
                                                background: '#059669', border: 'none', padding: '3px 10px',
                                                borderRadius: 999, cursor: 'pointer', transition: 'background .15s',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#1E293B'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#059669'}
                                        >
                                            <Star size={10} fill="white" color="white" /> Rate
                                        </button>
                                    ))}
                                </div>
                            ))
                        ) : (
                            <span style={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic' }}>No items listed.</span>
                        )}
                    </div>
                </div>
            </div>
    );

    // Phones, "All Orders": orders still on their way swipe in a carousel; delivered and
    // cancelled ones are a list. A specific status tab is always a list.
    const activeOrders = filteredOrders.filter(o => ACTIVE_ORDER_STATUSES.includes(o.status));
    const pastOrders = filteredOrders.filter(o => !ACTIVE_ORDER_STATUSES.includes(o.status));
    const sectionTitle = (text, n) => (
        <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {text} <span style={{ color: '#94A3B8' }}>({n})</span>
        </h3>
    );

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
                    <Package size={28} style={{ color: '#059669' }} />
                    <h2 style={s.title}>Order History</h2>
                </div>

                {/* Status Navigation Tabs */}
                <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    borderBottom: '1.5px solid #E2E8F0', 
                    marginBottom: '24px', 
                    paddingBottom: '8px',
                    flexWrap: isPhone ? 'nowrap' : 'wrap',
                    overflowX: isPhone ? 'auto' : 'visible',
                    scrollbarWidth: 'none',
                }}>
                    {['All', 'Pending', 'Shipped', 'Delivered'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '8px 16px',
                                background: activeTab === tab ? '#059669' : 'transparent',
                                color: activeTab === tab ? '#FFFFFF' : '#64748B',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                                whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => {
                                if (activeTab !== tab) e.currentTarget.style.background = '#E2E8F0';
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
                        textAlign: 'center', padding: '3.5rem 1rem', color: '#94A3B8',
                        background: '#ffffff', border: '1.5px solid #E2E8F0', borderRadius: '16px'
                    }}>
                        <Package size={36} color="#94A3B8" style={{ marginBottom: '12px', display: 'inline-block' }} />
                        <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 650 }}>No orders currently in this status.</p>
                    </div>
                ) : isPhone && activeTab === 'All' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        {activeOrders.length > 0 && (
                            <section>
                                {sectionTitle('In progress', activeOrders.length)}
                                <SwipeCarousel label="Orders in progress" caption={i => `#${String(activeOrders[i].id).padStart(5, '0')} · ${activeOrders[i].status}`}>
                                    {activeOrders.map(renderOrder)}
                                </SwipeCarousel>
                            </section>
                        )}
                        {pastOrders.length > 0 && (
                            <section>
                                {sectionTitle('Past orders', pastOrders.length)}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {pastOrders.map(renderOrder)}
                                </div>
                            </section>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isPhone ? '16px' : '24px' }}>
                        {filteredOrders.map(renderOrder)}
                    </div>
                )}

            </div>

            {/* In-app Toast stack */}
            <div style={{
                position: 'fixed',
                bottom: isPhone ? '12px' : '24px',
                right: isPhone ? '12px' : '24px',
                left: isPhone ? '12px' : 'auto',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxWidth: '380px',
                width: isPhone ? 'auto' : '100%',
            }}>
                {toasts.map(t => (
                    <div 
                        key={t.id} 
                        style={{
                            background: '#0F172A',
                            color: '#FFFFFF',
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
                            border: '1.5px solid #059669',
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

            {ratingTarget && (
                <ServiceRatingModal
                    endpoint="/product-reviews/"
                    payload={{ order_item: ratingTarget.orderItemId }}
                    title={`How is your ${ratingTarget.name}?`}
                    subtitle="Your review helps other customers choose the right plants and garden items."
                    commentLabel="Product Comments"
                    placeholder="How was the quality, condition on arrival, and how is it doing so far…"
                    onClose={() => setRatingTarget(null)}
                    onSuccess={handleReviewSuccess}
                />
            )}

        </div>
    );
};

export default UserOrders;
