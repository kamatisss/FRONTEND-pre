import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDesign } from '../context/DesignContext';
import { loadDesign } from '../services/api';
import { Shield, ChevronDown, ChevronUp, Eye, CheckCircle, XCircle, TrendingUp, ShoppingBag, Clock, Percent, MapPin, ExternalLink, Image, Sparkles, Users } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000';

const AdminDashboard = () => {
    const { authTokens } = useAuth();
    const { dispatch } = useDesign();
    const navigate = useNavigate();
        const [designs, setDesigns] = useState([]);
    const [orders, setOrders] = useState([]);
    const [attendanceLogs, setAttendanceLogs] = useState([]);
    const [selectedAttendance, setSelectedAttendance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('designs');
    const [expandedOrder, setExpandedOrder] = useState(null);
    const [allDesigns, setAllDesigns] = useState([]);
    const [allUsers, setAllUsers] = useState([]);

    useEffect(() => {
        const fetchSubmittedDesigns = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/designs/submitted_designs/`, {
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (!response.ok) throw new Error('Failed to fetch designs');
                const data = await response.json();
                setDesigns(data);
            } catch (err) {
                setError(err.message);
            }
        };

        const fetchOrders = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/orders/`, {
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (!response.ok) throw new Error('Failed to fetch orders');
                const data = await response.json();
                setOrders(data);
            } catch (err) {
                setError(err.message);
            }
        };

        const fetchAttendanceLogs = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/attendance/`, {
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (!response.ok) throw new Error('Failed to fetch attendance logs');
                const data = await response.json();
                setAttendanceLogs(data);
            } catch (err) {
                console.error('Failed to fetch attendance logs:', err);
            }
        };

        const fetchAllDesigns = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/designs/`, {
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setAllDesigns(data);
                }
            } catch (err) {
                console.error('Failed to fetch all designs:', err);
            }
        };

        const fetchAllUsers = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/users/`, {
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setAllUsers(data);
                }
            } catch (err) {
                console.error('Failed to fetch all users:', err);
            }
        };

        if (authTokens) {
            Promise.all([
                fetchSubmittedDesigns(),
                fetchOrders(),
                fetchAttendanceLogs(),
                fetchAllDesigns(),
                fetchAllUsers()
            ]).finally(() => setLoading(false));
        }
    }, [authTokens]);

    const handleUpdateStatus = async (id, status) => {
        try {
            const response = await fetch(`${API_BASE_URL}/designs/${id}/update_status/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authTokens.access}`
                },
                body: JSON.stringify({ status })
            });

            if (response.ok) {
                setDesigns(designs.filter(d => d.id !== id));
            }
        } catch (err) {
            console.error('Failed to update status', err);
        }
    };

    const handleViewDesign = async (id) => {
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
            console.error('Failed to load design for viewing:', err);
            alert('Could not load the design.');
        }
    };

    const toggleOrderDetails = (orderId) => {
        if (expandedOrder === orderId) {
            setExpandedOrder(null);
        } else {
            setExpandedOrder(orderId);
        }
    };
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const totalOrdersCount = orders.length;
    const pendingDesignsCount = designs.length;

    const codCount = orders.filter(order => order.payment_method === 'cod').length;
    const codPercentage = totalOrdersCount > 0 ? Math.round((codCount / totalOrdersCount) * 100) : 0;
    const onlinePercentage = totalOrdersCount > 0 ? 100 - codPercentage : 0;

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100%', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ 
                maxWidth: '1200px', 
                margin: '0 auto',
            }}>
                
                {/* Hero Section */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    marginBottom: '32px'
                }}>
                    <Shield size={36} color="#059669" style={{ marginRight: '20px' }} />
                    <div>
                        <h1 style={{ color: '#0f172a', fontSize: '28px', margin: '0 0 4px 0', fontWeight: '800', letterSpacing: '-0.02em' }}>Admin Dashboard</h1>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>System-wide control tower and monitoring</p>
                    </div>
                </div>

                {/* Analytics Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6" style={{ marginBottom: '32px' }}>
                    {/* Total Earnings */}
                    <div className="border border-slate-100 rounded-xl bg-white p-6 shadow-sm flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div>
                            <p style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Earnings (PHP)</p>
                            <h3 style={{ color: '#059669', fontSize: '24px', fontWeight: '800', margin: 0 }}>₱{totalRevenue.toLocaleString()}</h3>
                        </div>
                        <div style={{ backgroundColor: '#ecfdf5', padding: '12px', borderRadius: '10px' }}>
                            <TrendingUp size={24} color="#059669" />
                        </div>
                    </div>

                    {/* Total AI Generations */}
                    <div className="border border-slate-100 rounded-xl bg-white p-6 shadow-sm flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div>
                            <p style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total AI Generations</p>
                            <h3 style={{ color: '#1e293b', fontSize: '24px', fontWeight: '800', margin: 0 }}>{allDesigns.length || 0}</h3>
                        </div>
                        <div style={{ backgroundColor: '#faf5ff', padding: '12px', borderRadius: '10px' }}>
                            <Sparkles size={24} color="#a855f7" />
                        </div>
                    </div>

                    {/* Active Registered Users */}
                    <div className="border border-slate-100 rounded-xl bg-white p-6 shadow-sm flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div>
                            <p style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Registered Users</p>
                            <h3 style={{ color: '#1e293b', fontSize: '24px', fontWeight: '800', margin: 0 }}>{allUsers.filter(u => u.is_active).length || 0}</h3>
                        </div>
                        <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '10px' }}>
                            <Users size={24} color="#3b82f6" />
                        </div>
                    </div>

                    {/* Pending Designs */}
                    <div className="border border-slate-100 rounded-xl bg-white p-6 shadow-sm flex items-center justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div>
                            <p style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Designs</p>
                            <h3 style={{ color: '#1e293b', fontSize: '24px', fontWeight: '800', margin: 0 }}>{pendingDesignsCount}</h3>
                        </div>
                        <div style={{ backgroundColor: '#fef3c7', padding: '12px', borderRadius: '10px' }}>
                            <Clock size={24} color="#d97706" />
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div style={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '16px', 
                    padding: '32px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
                    border: '1px solid #f1f5f9'
                }}>

                {/* Controls / Tabs */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                    <button 
                        onClick={() => setActiveTab('designs')} 
                        style={{ 
                            padding: '12px 24px', 
                            cursor: 'pointer', 
                            background: activeTab === 'designs' ? '#10b981' : '#f1f5f9', 
                            color: activeTab === 'designs' ? 'white' : '#475569', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontWeight: '700',
                            fontSize: '15px',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'designs' ? '0 4px 14px rgba(16,185,129,0.3)' : 'none'
                        }}
                    >
                        Pending Designs
                    </button>
                    <button 
                        onClick={() => setActiveTab('orders')} 
                        style={{ 
                            padding: '12px 24px', 
                            cursor: 'pointer', 
                            background: activeTab === 'orders' ? '#10b981' : '#f1f5f9', 
                            color: activeTab === 'orders' ? 'white' : '#475569', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontWeight: '700',
                            fontSize: '15px',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'orders' ? '0 4px 14px rgba(16,185,129,0.3)' : 'none'
                        }}
                    >
                        Customer Orders
                    </button>
                    <button 
                        onClick={() => setActiveTab('attendance')} 
                        style={{ 
                            padding: '12px 24px', 
                            cursor: 'pointer', 
                            background: activeTab === 'attendance' ? '#10b981' : '#f1f5f9', 
                            color: activeTab === 'attendance' ? 'white' : '#475569', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontWeight: '700',
                            fontSize: '15px',
                            transition: 'all 0.2s',
                            boxShadow: activeTab === 'attendance' ? '0 4px 14px rgba(16,185,129,0.3)' : 'none'
                        }}
                    >
                        Attendance Tracking
                    </button>
                </div>

                {loading && <p style={{ color: '#64748b' }}>Loading data...</p>}
                {error && <p style={{ color: '#ef4444' }}>{error}</p>}
                
                {/* Pending Designs Table */}
                {!loading && !error && activeTab === 'designs' && (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                        {designs.length === 0 ? (
                            <p style={{ padding: '32px', color: '#64748b', textAlign: 'center', margin: 0 }}>No designs are currently pending review.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>ID</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Name</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700', textAlign: 'right' }}>Total Cost</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Submitted At</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {designs.map((design, index) => (
                                        <tr key={design.id} style={{ background: '#ffffff', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                                            <td style={{ padding: '16px 24px', color: '#334155', borderBottom: '1px solid #f1f5f9', fontWeight: '500' }}>{design.id}</td>
                                            <td style={{ padding: '16px 24px', color: '#334155', borderBottom: '1px solid #f1f5f9', fontWeight: '600' }}>{design.name}</td>
                                            <td style={{ padding: '16px 24px', color: '#10b981', borderBottom: '1px solid #f1f5f9', fontWeight: '700', textAlign: 'right' }}>₱{Number(design.total_cost).toLocaleString()}</td>
                                            <td style={{ padding: '16px 24px', color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{new Date(design.updated_at).toLocaleDateString()}</td>
                                            <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => handleViewDesign(design.id)} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#ffffff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: '6px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                                                        <Eye size={14} /> View
                                                    </button>
                                                    <button onClick={() => handleUpdateStatus(design.id, 'approved')} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#059669'} onMouseLeave={e => e.currentTarget.style.background = '#10b981'}>
                                                        <CheckCircle size={14} /> Approve
                                                    </button>
                                                    <button onClick={() => handleUpdateStatus(design.id, 'rejected')} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#dc2626'} onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}>
                                                        <XCircle size={14} /> Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Customer Orders Table */}
                {!loading && !error && activeTab === 'orders' && (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                        {orders.length === 0 ? (
                            <p style={{ padding: '32px', color: '#64748b', textAlign: 'center', margin: 0 }}>No orders have been placed yet.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Order #</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Customer</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Contact Info</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700', textAlign: 'right' }}>Total Price</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700', textAlign: 'center' }}>Payment</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Date</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order, index) => (
                                        <React.Fragment key={order.id}>
                                            <tr style={{ background: '#ffffff', transition: 'background 0.2s', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                                                <td style={{ padding: '16px 24px', color: '#334155', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9', fontWeight: '500' }}>{order.id}</td>
                                                <td style={{ padding: '16px 24px', color: '#334155', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9', fontWeight: '600' }}>{order.customer_name}</td>
                                                <td style={{ padding: '16px 24px', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9' }}>
                                                    <div style={{ color: '#0f172a', fontWeight: '700', fontSize: '14px' }}>{order.customer_email}</div>
                                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{order.customer_address}</div>
                                                </td>
                                                <td style={{ padding: '16px 24px', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9', fontWeight: '800', color: '#059669', textAlign: 'right', fontSize: '16px' }}>₱{Number(order.total_price).toLocaleString()}</td>
                                                <td style={{ padding: '16px 24px', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9', textAlign: 'center' }}>
                                                    {order.payment_method === 'cod' ? (
                                                        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200/50">
                                                            COD
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800 border border-green-200/50">
                                                            Paid Online
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px', color: '#64748b', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                                                <td style={{ padding: '16px 24px', borderBottom: expandedOrder === order.id ? 'none' : '1px solid #f1f5f9' }}>
                                                    <button 
                                                        onClick={() => toggleOrderDetails(order.id)}
                                                        style={{ 
                                                            padding: '8px 16px', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '8px', 
                                                            cursor: 'pointer', 
                                                            background: '#ffffff', 
                                                            color: '#334155', 
                                                            border: '1px solid #cbd5e1', 
                                                            borderRadius: '8px', 
                                                            fontWeight: '600', 
                                                            fontSize: '13px',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                                    >
                                                        View Details 
                                                        {expandedOrder === order.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {/* Expanded Details Row */}
                                            {expandedOrder === order.id && (
                                                <tr style={{ background: '#f8fafc' }}>
                                                    <td colSpan="7" style={{ padding: '0 24px 24px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div style={{ background: '#ffffff', borderRadius: '8px', padding: '16px', border: '1px solid #f1f5f9', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)' }}>
                                                            <h4 style={{ color: '#475569', margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Ordered Items</h4>
                                                            <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                                                                {order.items.map(item => (
                                                                    <li key={item.id}>
                                                                        <span style={{ fontWeight: '700', color: '#0f172a' }}>{item.quantity}x</span> {item.item_name} <span style={{ color: '#059669', fontWeight: '600' }}>(₱{Number(item.price_at_booking).toLocaleString()})</span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Attendance Tracking Table */}
                {!loading && !error && activeTab === 'attendance' && (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                        {attendanceLogs.length === 0 ? (
                            <p style={{ padding: '32px', color: '#64748b', textAlign: 'center', margin: 0 }}>No attendance logs recorded yet.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Staff Name</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Date</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Booking/Project ID</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Time In</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Time Out</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Total Hours</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attendanceLogs.map((log) => (
                                        <tr key={log.id} style={{ background: '#ffffff', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                                            <td style={{ padding: '16px 24px', color: '#334155', borderBottom: '1px solid #f1f5f9', fontWeight: '600' }}>{log.staff_name}</td>
                                            <td style={{ padding: '16px 24px', color: '#334155', borderBottom: '1px solid #f1f5f9' }}>{log.clock_in_time ? new Date(log.clock_in_time).toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '16px 24px', color: '#64748b', borderBottom: '1px solid #f1f5f9', fontWeight: '500' }}>
                                                {log.booking ? `#${log.booking}` : 'General'}
                                            </td>
                                            <td style={{ padding: '16px 24px', color: '#334155', borderBottom: '1px solid #f1f5f9' }}>
                                                {log.clock_in_time ? new Date(log.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td style={{ padding: '16px 24px', color: '#334155', borderBottom: '1px solid #f1f5f9' }}>
                                                {log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                                                    <span className="inline-flex items-center gap-x-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200/50">
                                                        Active Shift
                                                    </span>
                                                )}
                                            </td>
                                            <td 
                                                style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}
                                                className={Number(log.total_hours || 0) === 0 ? "text-slate-400" : "text-emerald-600"}
                                            >
                                                {log.total_hours !== null ? `${log.total_hours} hrs` : '-'}
                                            </td>
                                            <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                <button 
                                                    onClick={() => setSelectedAttendance(log)}
                                                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                                >
                                                    View Proof
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>

            {/* View Proof Modal Overlay */}
            {selectedAttendance && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '650px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
                                Shift Proof Verification
                            </h3>
                            <button 
                                onClick={() => setSelectedAttendance(null)}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    color: '#94a3b8'
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Shift Details Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', fontSize: '14px', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <strong style={{ color: '#475569' }}>Staff Member:</strong>
                                    <div style={{ color: '#1e293b', fontWeight: '600', marginTop: '4px' }}>{selectedAttendance.staff_name}</div>
                                </div>
                                <div>
                                    <strong style={{ color: '#475569' }}>Booking Ref:</strong>
                                    <div style={{ color: '#1e293b', fontWeight: '600', marginTop: '4px' }}>{selectedAttendance.booking_label}</div>
                                </div>
                                <div>
                                    <strong style={{ color: '#475569' }}>Clock In:</strong>
                                    <div style={{ color: '#1e293b', fontWeight: '600', marginTop: '4px' }}>
                                        {selectedAttendance.clock_in_time ? new Date(selectedAttendance.clock_in_time).toLocaleString() : '-'}
                                    </div>
                                </div>
                                <div>
                                    <strong style={{ color: '#475569' }}>Clock Out:</strong>
                                    <div style={{ color: '#1e293b', fontWeight: '600', marginTop: '4px' }}>
                                        {selectedAttendance.clock_out_time ? new Date(selectedAttendance.clock_out_time).toLocaleString() : 'Active Session'}
                                    </div>
                                </div>
                            </div>

                            {/* Photo Proofs Container */}
                            <div>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Image Proof of Presence</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', background: '#f8fafc' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', textAlign: 'center' }}>CLOCK-IN PHOTO</div>
                                        {selectedAttendance.clock_in_photo_url ? (
                                            <img 
                                                src={selectedAttendance.clock_in_photo_url.startsWith('http') ? selectedAttendance.clock_in_photo_url : `${MEDIA_BASE_URL}${selectedAttendance.clock_in_photo_url}`} 
                                                alt="Clock In Proof" 
                                                style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px' }}
                                            />
                                        ) : (
                                            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                                No Clock-in Photo
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', background: '#f8fafc' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', textAlign: 'center' }}>CLOCK-OUT PHOTO</div>
                                        {selectedAttendance.clock_out_photo_url ? (
                                            <img 
                                                src={selectedAttendance.clock_out_photo_url.startsWith('http') ? selectedAttendance.clock_out_photo_url : `${MEDIA_BASE_URL}${selectedAttendance.clock_out_photo_url}`} 
                                                alt="Clock Out Proof" 
                                                style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px' }}
                                            />
                                        ) : (
                                            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
                                                No Clock-out Photo
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* GIS Location Details */}
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#065f46' }}>
                                        GIS Coordinates Tracking
                                    </h4>
                                    {selectedAttendance.latitude && selectedAttendance.longitude ? (
                                        <>
                                            <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                                                Latitude: {selectedAttendance.latitude.toFixed(6)}, Longitude: {selectedAttendance.longitude.toFixed(6)}
                                            </p>
                                            {selectedAttendance.clock_in_address && (
                                                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#1e293b', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                                    <span style={{ fontWeight: '600', color: '#047857' }}>Clock-in Address:</span> {selectedAttendance.clock_in_address}
                                                </p>
                                            )}
                                            {selectedAttendance.clock_out_address && (
                                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#1e293b', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                                    <span style={{ fontWeight: '600', color: '#047857' }}>Clock-out Address:</span> {selectedAttendance.clock_out_address}
                                                </p>
                                            )}
                                            {!selectedAttendance.clock_in_address && !selectedAttendance.clock_out_address && (
                                                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
                                                    Address not recorded
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                                            No GIS coordinates tracked for this shift log.
                                        </p>
                                    )}
                                </div>
                                {selectedAttendance.latitude && selectedAttendance.longitude && (
                                    <a 
                                        href={`https://www.google.com/maps/search/?api=1&query=${selectedAttendance.latitude},${selectedAttendance.longitude}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{
                                            marginLeft: 'auto',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 16px',
                                            background: '#10b981',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '700',
                                            fontSize: '13px',
                                            textDecoration: 'none',
                                            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                                            flexShrink: 0
                                        }}
                                    >
                                        <MapPin size={14} /> Open Maps
                                    </a>
                                )}
                            </div>
                        </div>

                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => setSelectedAttendance(null)}
                                style={{
                                    padding: '10px 20px',
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 10px rgba(239, 68, 68, 0.15)'
                                }}
                            >
                                Close Proof
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
