import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDesign } from '../context/DesignContext';
import api, { listDesigns, loadDesign } from '../services/api';
import { 
    LayoutDashboard, 
    Calendar, 
    ShoppingBag, 
    Plus, 
    ArrowRight, 
    Home, 
    Edit, 
    Sparkles, 
    ChevronRight, 
    Loader2, 
    ClipboardList, 
    Check, 
    Clock, 
    User,
    Package,
    Compass
} from 'lucide-react';

// Booking Step helper for milestone stepper
const getActiveStep = (status, hasDesign) => {
    switch (status) {
        case 'Pending':
            return hasDesign ? 3 : 1;
        case 'Preparing':
            return 4;
        case 'Installing':
            return 5;
        case 'Finished':
        case 'Completed':
            return 6;
        default:
            return -1;
    }
};

const BookingMilestoneTracker = ({ status, hasDesign }) => {
    const activeStep = getActiveStep(status, hasDesign);
    
    const steps = [
        { label: 'Request Submitted', desc: 'Booking request sent' },
        { label: 'AI Layout Created', desc: 'AI design generated' },
        { label: 'Staff Review', desc: 'Reviewing layout details' },
        { label: 'Finalized Studio Plan', desc: 'Ready in 3D Studio' },
        { label: 'Dispatched', desc: 'Crew prepared & routed' },
        { label: 'Work in Progress', desc: 'Installation active on site' },
        { label: 'Completed', desc: 'Project signed off' }
    ];

    if (status === 'Cancelled') {
        return (
            <div style={{
                background: '#FEF2F2',
                border: '1px solid #FEE2E2',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '12px'
            }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <div>
                    <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#991B1B' }}>Booking Cancelled</h5>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#B91C1C' }}>This booking has been cancelled.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '16px', padding: '0 4px' }}>
            <style>{`
                @keyframes stepperPulse {
                    0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .stepper-active-node {
                    animation: stepperPulse 2s infinite;
                }
                @media (max-width: 768px) {
                    .stepper-desc {
                        display: none !important;
                    }
                    .stepper-label {
                        font-size: 0.65rem !important;
                        margin-top: 4px !important;
                    }
                    .stepper-node {
                        width: 24px !important;
                        height: 24px !important;
                    }
                    .stepper-line, .stepper-line-fill {
                        top: 12px !important;
                    }
                }
                @media (max-width: 480px) {
                    .stepper-label {
                        font-size: 0.55rem !important;
                        font-weight: 800 !important;
                    }
                    .stepper-node {
                        width: 20px !important;
                        height: 20px !important;
                    }
                    .stepper-node span {
                        font-size: 0.65rem !important;
                    }
                    .stepper-line, .stepper-line-fill {
                        top: 10px !important;
                        height: 2px !important;
                    }
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', width: '100%' }}>
                
                {/* Background line */}
                <div 
                    className="stepper-line"
                    style={{
                        position: 'absolute',
                        top: '16px',
                        left: '7%',
                        right: '7%',
                        height: '3px',
                        background: '#E5E7EB',
                        zIndex: 0,
                    }} 
                />

                {/* Active progress line fill */}
                {activeStep > 0 && (
                    <div 
                        className="stepper-line-fill"
                        style={{
                            position: 'absolute',
                            top: '16px',
                            left: '7%',
                            width: `${(activeStep / (steps.length - 1)) * 86}%`,
                            height: '3px',
                            background: '#10B981',
                            zIndex: 1,
                            transition: 'width 0.4s ease-in-out',
                        }} 
                    />
                )}

                {/* Steps */}
                {steps.map((step, idx) => {
                    const isCompleted = idx < activeStep;
                    const isActive = idx === activeStep;

                    let nodeStyle = {
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        transition: 'all 0.3s ease',
                        boxSizing: 'border-box',
                    };

                    if (isCompleted) {
                        nodeStyle = {
                            ...nodeStyle,
                            background: '#10B981',
                            color: '#ffffff',
                            border: '2px solid #10B981',
                        };
                    } else if (isActive) {
                        nodeStyle = {
                            ...nodeStyle,
                            background: '#ffffff',
                            color: '#10B981',
                            border: '3px solid #10B981',
                        };
                    } else {
                        nodeStyle = {
                            ...nodeStyle,
                            background: '#F3F4F6',
                            color: '#9CA3AF',
                            border: '2px solid #D1D5DB',
                        };
                    }

                    return (
                        <div key={idx} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            width: `${100 / steps.length}%`,
                            position: 'relative',
                            zIndex: 2,
                        }}>
                            {/* Circle Node */}
                            <div 
                                style={nodeStyle}
                                className={isActive ? "stepper-node stepper-active-node" : "stepper-node"}
                            >
                                {isCompleted ? (
                                    <Check size={14} strokeWidth={3} />
                                ) : isActive ? (
                                    <Clock size={14} strokeWidth={2.5} />
                                ) : (
                                    <span style={{ fontSize: '11px', fontWeight: 700 }}>{idx + 1}</span>
                                )}
                            </div>

                            {/* Labels */}
                            <div className="stepper-labels-container" style={{ textAlign: 'center', marginTop: '8px' }}>
                                <div className="stepper-label" style={{
                                    fontSize: '11px',
                                    fontWeight: isActive || isCompleted ? 700 : 500,
                                    color: isActive ? '#059669' : isCompleted ? '#1F2937' : '#6B7280',
                                    lineHeight: 1.2,
                                    marginBottom: '2px',
                                }}>
                                    {step.label}
                                </div>
                                <div className="stepper-desc" style={{
                                    fontSize: '9px',
                                    color: '#9CA3AF',
                                    fontWeight: 500,
                                }}>
                                    {step.desc}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const UserDashboard = () => {
    const { user, authTokens } = useAuth();
    const { dispatch } = useDesign();
    const navigate = useNavigate();

    const [designs, setDesigns] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                // Fetch designs
                const dData = await listDesigns();
                setDesigns(dData || []);

                // Fetch bookings
                const bRes = await api.get('/bookings/');
                setBookings(bRes.data || []);

                // Fetch orders
                const oRes = await api.get('/orders/');
                setOrders(oRes.data || []);
            } catch (err) {
                console.error("Dashboard loading error:", err);
                setError("Failed to load dashboard summaries.");
            } finally {
                setLoading(false);
            }
        };

        if (authTokens) {
            fetchDashboardData();
        }
    }, [authTokens]);

    const handleEditDesign = async (id) => {
        try {
            const design = await loadDesign(id);
            dispatch({
                type: 'LOAD_DESIGN',
                payload: {
                    designId: design.id,
                    designName: design.name,
                    depthData: design.depth_data,
                    placedItems: (design.placed_items || []).map((item, idx) => ({
                        id: Date.now() + idx,
                        productId: item.product_id,
                        name: item.name,
                        modelType: item.model_type,
                        price: item.price,
                        position: item.position,
                        rotation: item.rotation,
                        scale: item.scale,
                    })),
                    dimensions: design.dimensions || { width: 10, length: 15, terrainType: 'flat' },
                    terrainHeight: design.terrain_height || 1.5,
                    timeOfDay: design.time_of_day || 14,
                },
            });
            navigate('/studio');
        } catch (err) {
            console.error('Failed to load design:', err);
            alert('Could not load the design.');
        }
    };

    // Calculate active/ongoing elements
    const activeBooking = bookings.find(b => b.status !== 'Completed' && b.status !== 'Cancelled');
    const activeOrder = orders.find(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
    const hasActiveActivity = activeBooking || activeOrder;

    // Badges style tokens
    const getStatusStyle = (status) => {
        const base = {
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.02em',
        };
        switch (status) {
            case 'Pending':
                return { ...base, background: '#FEF3C7', color: '#92400E' };
            case 'Confirmed':
            case 'Preparing':
            case 'Paid':
                return { ...base, background: '#D1FAE5', color: '#065F46' };
            case 'In Progress':
            case 'Installing':
            case 'Shipped':
                return { ...base, background: '#DBEAFE', color: '#1E40AF' };
            case 'Out for Delivery':
                return { ...base, background: '#E0F2FE', color: '#0369A1' };
            case 'Delivered':
            case 'Finished':
                return { ...base, background: '#D1FAE5', color: '#065F46' };
            case 'Cancelled':
                return { ...base, background: '#FEE2E2', color: '#B91C1C' };
            default:
                return { ...base, background: '#F1F5F9', color: '#475569' };
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '12px' }}>
                <Loader2 size={36} color="#10b981" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#64748b', fontSize: '15px', fontWeight: '500' }}>Loading your dashboard...</span>
                <style>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" style={{ fontFamily: "'Inter', sans-serif" }}>
                
                {/* Header Welcome and Quick Actions */}
                <div style={{ 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                    borderRadius: '20px', 
                    padding: '36px', 
                    color: '#ffffff',
                    boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.15)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            fontWeight: '800'
                        }}>
                            {user?.username ? user.username[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>Welcome back, {user?.first_name || user?.username || 'Client'}!</h1>
                            <p style={{ margin: '4px 0 0 0', opacity: 0.85, fontSize: '14px' }}>Design, track, and manage your outdoor living solutions in one place.</p>
                        </div>
                    </div>

                    {/* Quick Actions Row */}
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
                        gap: '16px' 
                    }}>
                        <div 
                            onClick={() => navigate('/studio')}
                            style={{
                                background: 'rgba(255, 255, 255, 0.12)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
                        >
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800' }}>Create 3D Design</h4>
                                <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Launch virtual garden designer</p>
                            </div>
                            <Sparkles size={24} />
                        </div>

                        <div 
                            onClick={() => navigate('/book-service')}
                            style={{
                                background: 'rgba(255, 255, 255, 0.12)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
                        >
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800' }}>Book Service</h4>
                                <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Schedule professional care</p>
                            </div>
                            <Calendar size={24} />
                        </div>

                        <div 
                            onClick={() => navigate('/studio')}
                            style={{
                                background: 'rgba(255, 255, 255, 0.12)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.18)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)'; }}
                        >
                            <div>
                                <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800' }}>Browse Shop & Inventory</h4>
                                <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>Order plants, stones, and furniture</p>
                            </div>
                            <ShoppingBag size={24} />
                        </div>
                    </div>
                </div>

                {/* Priority Status Tracker Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h2 style={{ color: '#1e293b', fontSize: '18px', fontWeight: '800', margin: 0 }}>Active Activity</h2>
                    
                    {!hasActiveActivity ? (
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            padding: '32px',
                            textAlign: 'center',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                        }}>
                            <Compass size={40} color="#94a3b8" style={{ marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#475569', margin: '0 0 6px 0' }}>No active bookings or orders</h3>
                            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 20px 0' }}>Everything is up to date. Ready to start your next landscape project?</p>
                            <button 
                                onClick={() => navigate('/studio')}
                                style={{
                                    padding: '10px 20px',
                                    background: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                    boxShadow: '0 4px 14px rgba(16,185,129,0.2)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                                onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                            >
                                Start 3D Design
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                            {/* Active Booking */}
                            {activeBooking && (
                                <div style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    padding: '24px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar size={18} color="#10b981" />
                                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>Booking: {activeBooking.service_type}</span>
                                        </div>
                                        <span style={getStatusStyle(activeBooking.status)}>{activeBooking.status}</span>
                                    </div>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>Scheduled on: <strong>{new Date(activeBooking.scheduled_date).toLocaleDateString()}</strong></p>
                                    <BookingMilestoneTracker status={activeBooking.status} hasDesign={!!(activeBooking.design || activeBooking.design_details)} />
                                </div>
                            )}

                            {/* Active Order */}
                            {activeOrder && (
                                <div style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    padding: '24px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Package size={18} color="#10b981" />
                                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#334155' }}>Order #{activeOrder.id}</span>
                                            </div>
                                            <span style={getStatusStyle(activeOrder.status)}>{activeOrder.status}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                                            <div style={{ fontSize: '13px', color: '#64748b' }}>Items quantity: <strong>{activeOrder.items?.length || 0} items</strong></div>
                                            <div style={{ fontSize: '13px', color: '#64748b' }}>Total price: <strong style={{ color: '#10b981' }}>₱{Number(activeOrder.total_price).toLocaleString()}</strong></div>
                                            <div style={{ fontSize: '13px', color: '#64748b' }}>Payment type: <strong>{activeOrder.payment_method === 'cod' ? 'Cash on Delivery (COD)' : 'Paid Online'}</strong></div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/my-orders')}
                                        style={{
                                            padding: '10px 16px',
                                            background: '#f1f5f9',
                                            color: '#475569',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
                                    >
                                        Track Delivery Details <ArrowRight size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Saved 3D Designs Gallery */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ color: '#1e293b', fontSize: '18px', fontWeight: '800', margin: 0 }}>Recent 3D Designs</h2>
                        <button 
                            onClick={() => navigate('/studio')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#10b981' }}
                        >
                            Open Studio <ChevronRight size={14} />
                        </button>
                    </div>

                    {designs.length === 0 ? (
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            padding: '32px',
                            textAlign: 'center',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                        }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#475569', margin: '0 0 6px 0' }}>No designs found</h3>
                            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>Create your first 3D virtual landscape to preview plants and hardscapes.</p>
                            <button 
                                onClick={() => navigate('/studio')}
                                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                            >
                                Launch Virtual Studio
                            </button>
                        </div>
                    ) : (
                        <div style={{ 
                            display: 'flex', 
                            gap: '16px', 
                            overflowX: 'auto', 
                            paddingBottom: '12px',
                            scrollbarWidth: 'thin'
                        }}>
                            {designs.map(design => (
                                <div 
                                    key={design.id}
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '14px',
                                        border: '1px solid #e2e8f0',
                                        padding: '16px',
                                        minWidth: '240px',
                                        width: '240px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}
                                >
                                    <div>
                                        {/* Image placeholder */}
                                        <div style={{ 
                                            width: '100%', 
                                            height: '110px', 
                                            borderRadius: '10px', 
                                            background: design.original_image_url ? `url(${design.original_image_url}) center/cover no-repeat` : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                                            border: '1px solid #e2e8f0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#10b981',
                                            fontSize: '12px',
                                            fontWeight: '700'
                                        }}>
                                            {!design.original_image_url && <Sparkles size={24} />}
                                        </div>
                                        <h4 style={{ margin: '8px 0 2px 0', fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>{design.name}</h4>
                                        <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Edited {new Date(design.updated_at).toLocaleDateString()}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleEditDesign(design.id)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            background: '#ffffff',
                                            color: '#10b981',
                                            border: '1px solid #a7f3d0',
                                            borderRadius: '8px',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
                                    >
                                        <Edit size={14} /> Open in Studio
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* side-by-side recent bookings and orders */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                    {/* Recent Bookings Panel */}
                    <div style={{ 
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        padding: '24px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Recent Bookings</h3>
                                <button 
                                    onClick={() => navigate('/my-bookings')}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#10b981' }}
                                >
                                    View All
                                </button>
                            </div>

                            {bookings.length === 0 ? (
                                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '32px 0' }}>No service bookings requested yet.</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: '600' }}>Date</th>
                                                <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: '600' }}>Service Type</th>
                                                <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: '600', textAlign: 'center' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {bookings.slice(0, 5).map(b => (
                                                <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '10px 12px', fontWeight: '500', color: '#475569' }}>{new Date(b.scheduled_date).toLocaleDateString()}</td>
                                                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#334155', textTransform: 'capitalize' }}>{b.service_type}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                        <span style={getStatusStyle(b.status)}>{b.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Orders Panel */}
                    <div style={{ 
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        padding: '24px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Recent Orders</h3>
                                <button 
                                    onClick={() => navigate('/my-orders')}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: '#10b981' }}
                                >
                                    View All
                                </button>
                            </div>

                            {orders.length === 0 ? (
                                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: '32px 0' }}>No product orders placed yet.</p>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: '600' }}>Date</th>
                                                <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: '600', textAlign: 'right' }}>Total Price</th>
                                                <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: '600', textAlign: 'center' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orders.slice(0, 5).map(o => (
                                                <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '10px 12px', fontWeight: '500', color: '#475569' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                                                    <td style={{ padding: '10px 12px', fontWeight: '700', color: '#10b981', textAlign: 'right' }}>₱{Number(o.total_price).toLocaleString()}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                        <span style={getStatusStyle(o.status)}>{o.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

        </div>
    );
};

export default UserDashboard;
