import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    Calendar, 
    ChevronDown, 
    ChevronUp, 
    Search, 
    RefreshCw, 
    ClipboardList, 
    FileText, 
    User, 
    Mail, 
    Phone, 
    MapPin, 
    Check, 
    X,
    Eye
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || 'http://localhost:8000';

const BookingManagement = () => {
    const { authTokens } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedBooking, setExpandedBooking] = useState(null);
    const [proofPhotoUrl, setProofPhotoUrl] = useState(null);
    
    // UI states
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/bookings/`, {
                headers: { 'Authorization': `Bearer ${authTokens.access}` }
            });
            const data = await res.json();
            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBookings();
        
        // Auto-poll bookings every 10 seconds to reflect status changes made by admins/staff instantly
        const intervalId = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/bookings/`, {
                    headers: { 'Authorization': `Bearer ${authTokens.access}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setBookings(data);
                }
            } catch (error) {
                console.error('Silent sync error:', error);
            }
        }, 10000);

        return () => clearInterval(intervalId);
    }, [authTokens]);

    const handleUpdateStatus = async (id, status) => {
        try {
            const response = await fetch(`${API_BASE_URL}/bookings/${id}/update_status/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authTokens.access}`
                },
                body: JSON.stringify({ status })
            });

            if (response.ok) {
                // Update local status immediately
                const updatedBookings = bookings.map(b => b.id === id ? { ...b, status } : b);
                setBookings(updatedBookings);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const formatTime = (timeKey) => {
        const map = {
            'anytime': 'Anytime',
            'morning': 'Morning (8AM–12PM)',
            'afternoon': 'Afternoon (1PM–5PM)',
        };
        return map[timeKey] || timeKey || '—';
    };

    const getStatusBadge = (status) => {
        const base = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            textTransform: 'capitalize'
        };
        const statusLower = (status || '').toLowerCase();
        switch (statusLower) {
            case 'pending':
                return (
                    <span style={{ ...base, background: '#FEF3C7', color: '#92400E' }}>
                        <span className="animate-pulse" style={{ width: '6px', height: '6px', backgroundColor: '#d97706', borderRadius: '50%', display: 'inline-block' }}></span>
                        {status}
                    </span>
                );
            case 'confirmed':
                return (
                    <span style={{ ...base, background: '#D1FAE5', color: '#065F46' }}>
                        <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
                        {status}
                    </span>
                );
            case 'completed':
                return (
                    <span style={{ ...base, background: '#D1FAE5', color: '#065F46' }}>
                        <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
                        {status}
                    </span>
                );
            case 'cancelled':
                return (
                    <span style={{ ...base, background: '#FEE2E2', color: '#B91C1C' }}>
                        <span style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%', display: 'inline-block' }}></span>
                        {status}
                    </span>
                );
            default:
                return (
                    <span style={{ ...base, background: '#F3F4F6', color: '#374151' }}>
                        {status}
                    </span>
                );
        }
    };

    const thStyle = {
        padding: '16px 20px',
        color: '#475569',
        fontSize: '12px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid #e2e8f0',
        fontWeight: '700',
    };

    const tdStyle = {
        padding: '16px 20px',
        borderBottom: '1px solid #f1f5f9',
        verticalAlign: 'top',
    };

    const toggleBookingDetails = (id) => {
        setExpandedBooking(expandedBooking === id ? null : id);
    };

    // Filter bookings based on status select and search input
    const filteredBookings = bookings.filter(b => {
        // Status filter
        if (statusFilter !== 'all' && b.status.toLowerCase() !== statusFilter.toLowerCase()) {
            return false;
        }
        
        // Search filter
        const term = searchTerm.toLowerCase();
        const customerName = (b.customer_name || `User ${b.user}`).toLowerCase();
        const serviceType = (b.service_type || '').toLowerCase();
        const address = (b.service_address || '').toLowerCase();
        const phone = (b.contact_number || '').toLowerCase();
        const email = (b.customer_email || '').toLowerCase();

        return (
            customerName.includes(term) ||
            serviceType.includes(term) ||
            address.includes(term) ||
            phone.includes(term) ||
            email.includes(term)
        );
    });

    return (
        <div style={{ backgroundColor: '#f1f5f9', minHeight: '100%', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                
                {/* Hero Section */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    marginBottom: '32px'
                }}>
                    <Calendar size={36} color="#10b981" style={{ marginRight: '20px' }} />
                    <div>
                        <h1 style={{ color: '#1e293b', fontSize: '28px', margin: '0 0 4px 0', fontWeight: '800' }}>Booking Management</h1>
                        <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>View and manage all customer appointment schedules</p>
                    </div>

                    {/* Live Sync Badge */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        backgroundColor: '#ecfdf5', 
                        color: '#047857', 
                        padding: '6px 14px', 
                        borderRadius: '999px', 
                        fontSize: '12px', 
                        fontWeight: '700', 
                        marginLeft: 'auto',
                        border: '1px solid #a7f3d0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}>
                        <span className="animate-pulse" style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%', display: 'inline-block' }}></span>
                        Live Connection Active
                    </div>
                </div>

                {/* Table Container */}
                <div style={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '16px', 
                    padding: '32px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
                    border: '1px solid #e2e8f0'
                }}>
                    
                    {/* Controls Row (Search, Filters, Sync Button) */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        gap: '16px', 
                        marginBottom: '24px',
                        flexWrap: 'wrap'
                    }}>
                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                            <input 
                                type="text" 
                                placeholder="Search by customer, service, email, address..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 40px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '14px',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    fontFamily: "'Inter', sans-serif"
                                }}
                                onFocus={e => e.currentTarget.style.borderColor = '#10b981'}
                                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                            />
                        </div>

                        {/* Status Pills */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '999px',
                                        border: '1px solid',
                                        borderColor: statusFilter === status ? '#10b981' : '#cbd5e1',
                                        background: statusFilter === status ? '#10b981' : '#ffffff',
                                        color: statusFilter === status ? '#ffffff' : '#64748b',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>

                        {/* Force Refresh Button */}
                        <button
                            onClick={fetchBookings}
                            disabled={loading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#64748b',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#1e293b'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#64748b'; }}
                        >
                            <RefreshCw 
                                size={14} 
                                style={{
                                    animation: loading ? 'spin 1s linear infinite' : 'none'
                                }}
                            />
                            Sync Data
                        </button>
                    </div>

                    {loading && bookings.length === 0 ? (
                        <p style={{ color: '#64748b', textAlign: 'center', margin: 0, padding: '32px' }}>Loading bookings data...</p>
                    ) : (
                        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={thStyle}>Booking #</th>
                                        <th style={thStyle}>Customer</th>
                                        <th style={thStyle}>Contact Info</th>
                                        <th style={thStyle}>Date & Time Slot</th>
                                        <th style={thStyle}>Status</th>
                                        <th style={thStyle}>Attached Design</th>
                                        <th style={thStyle}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBookings.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" style={{ padding: '32px', color: '#64748b', textAlign: 'center', fontWeight: '500' }}>
                                                {searchTerm || statusFilter !== 'all' ? "No bookings match your filters." : "No bookings found."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredBookings.map(b => {
                                            const isExpanded = expandedBooking === b.id;
                                            return (
                                                <React.Fragment key={b.id}>
                                                    <tr style={{ background: '#ffffff', transition: 'background 0.2s' }}>
                                                        <td style={{ ...tdStyle, fontWeight: '600', color: '#334155' }}>{b.id}</td>
                                                        <td style={{ ...tdStyle, fontWeight: '600', color: '#334155' }}>{b.customer_name || `User ${b.user}`}</td>
                                                        <td style={tdStyle}>
                                                            {b.contact_number && <div style={{ fontSize: '13px', color: '#64748b' }}>📞 {b.contact_number}</div>}
                                                            {b.customer_email && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>✉️ {b.customer_email}</div>}
                                                            {b.service_address && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>📍 {b.service_address}</div>}
                                                        </td>
                                                        <td style={tdStyle}>
                                                            <div style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>
                                                                {new Date(b.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                                🕐 {formatTime(b.preferred_time)}
                                                            </div>
                                                        </td>
                                                        <td style={tdStyle}>
                                                            {getStatusBadge(b.status)}
                                                        </td>
                                                        {/* Attached Design Column */}
                                                        <td style={tdStyle}>
                                                            {b.design_details ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    {b.design_details.image_url && (
                                                                        <img 
                                                                            src={b.design_details.image_url.startsWith('http') ? b.design_details.image_url : `${MEDIA_BASE_URL}${b.design_details.image_url}`} 
                                                                            alt={b.design_details.name} 
                                                                            style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1', flexShrink: 0 }}
                                                                        />
                                                                    )}
                                                                    <a 
                                                                        href={`/studio?design_id=${b.design_details.id}`} 
                                                                        style={{ 
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            color: '#10b981', 
                                                                            fontWeight: '600', 
                                                                            textDecoration: 'none',
                                                                            fontSize: '12px',
                                                                        }}
                                                                    >
                                                                        <span>{b.design_details.name || `Design #${b.design_details.id}`}</span>
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                                                    </a>
                                                                </div>
                                                            ) : (
                                                                <span style={{ color: '#94a3b8' }}>None</span>
                                                            )}
                                                        </td>
                                                        <td style={tdStyle}>
                                                            <button 
                                                                onClick={() => toggleBookingDetails(b.id)}
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
                                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {/* Collapsible Details */}
                                                    {isExpanded && (
                                                        <tr style={{ background: '#f8fafc' }}>
                                                            <td colSpan="7" style={{ padding: '0 24px 24px 24px', borderBottom: '1px solid #e2e8f0' }}>
                                                                <div style={{ 
                                                                    background: '#ffffff', 
                                                                    borderRadius: '12px', 
                                                                    padding: '24px', 
                                                                    border: '1px solid #e2e8f0', 
                                                                    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
                                                                    display: 'grid',
                                                                    gridTemplateColumns: '1fr 1fr',
                                                                    gap: '24px'
                                                                }}>
                                                                    {/* Left Column: Service Details */}
                                                                    <div>
                                                                        <h4 style={{ color: '#475569', margin: '0 0 16px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>Service Information</h4>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                                            <ClipboardList size={16} color="#64748b" />
                                                                            <div>
                                                                                <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Service Type</div>
                                                                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>{b.service_type}</div>
                                                                            </div>
                                                                        </div>
                                                                        {b.notes && (
                                                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '16px' }}>
                                                                                <FileText size={16} color="#64748b" style={{ marginTop: '2px' }} />
                                                                                <div>
                                                                                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Customer Notes</div>
                                                                                    <div style={{ fontSize: '13px', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{b.notes}</div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {b.design_details && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', padding: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                                                                                {b.design_details.image_url && (
                                                                                    <img 
                                                                                        src={b.design_details.image_url.startsWith('http') ? b.design_details.image_url : `${MEDIA_BASE_URL}${b.design_details.image_url}`} 
                                                                                        alt={b.design_details.name} 
                                                                                        style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', flexShrink: 0 }}
                                                                                    />
                                                                                )}
                                                                                <div>
                                                                                    <div style={{ fontSize: '11px', color: '#047857', textTransform: 'uppercase', fontWeight: '600' }}>Attached 3D Design</div>
                                                                                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{b.design_details.name || `Design #${b.design_details.id}`}</div>
                                                                                    <a 
                                                                                        href={`/studio?design_id=${b.design_details.id}`}
                                                                                        style={{ 
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                            marginTop: '6px',
                                                                                            padding: '6px 12px',
                                                                                            background: '#10b981',
                                                                                            color: '#ffffff',
                                                                                            fontSize: '11px',
                                                                                            fontWeight: '700',
                                                                                            borderRadius: '6px',
                                                                                            textDecoration: 'none',
                                                                                            boxShadow: '0 2px 4px rgba(16,185,129,0.1)'
                                                                                        }}
                                                                                    >
                                                                                        View Design Layout
                                                                                    </a>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {b.status === 'Completed' && b.clock_out_photo_url && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', padding: '12px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px' }}>
                                                                                <img 
                                                                                    src={b.clock_out_photo_url.startsWith('http') ? b.clock_out_photo_url : `${MEDIA_BASE_URL}${b.clock_out_photo_url}`} 
                                                                                    alt="Completion Proof" 
                                                                                    style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1', flexShrink: 0 }}
                                                                                />
                                                                                <div>
                                                                                    <div style={{ fontSize: '11px', color: '#065f46', textTransform: 'uppercase', fontWeight: '600' }}>Job Finished Proof</div>
                                                                                    <div style={{ fontSize: '12px', color: '#334155', fontWeight: '500', marginBottom: '4px' }}>Work completed proof photo available.</div>
                                                                                    <button 
                                                                                        type="button"
                                                                                        onClick={() => setProofPhotoUrl(b.clock_out_photo_url)}
                                                                                        style={{ 
                                                                                            display: 'inline-flex',
                                                                                            alignItems: 'center',
                                                                                            gap: '4px',
                                                                                            padding: '4px 8px',
                                                                                            background: '#10b981',
                                                                                            color: '#ffffff',
                                                                                            border: 'none',
                                                                                            fontSize: '11px',
                                                                                            fontWeight: '700',
                                                                                            borderRadius: '4px',
                                                                                            cursor: 'pointer'
                                                                                        }}
                                                                                    >
                                                                                        <Eye size={12} /> View Final Proof
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Right Column: Customer & Scheduling Details */}
                                                                    <div>
                                                                        <h4 style={{ color: '#475569', margin: '0 0 16px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>Contact & Address</h4>
                                                                        
                                                                        <div style={{ display: 'grid', gap: '12px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <User size={16} color="#64748b" />
                                                                                <span style={{ fontSize: '13px', color: '#334155' }}>{b.customer_name || `User ${b.user}`}</span>
                                                                            </div>
                                                                            {b.customer_email && (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <Mail size={16} color="#64748b" />
                                                                                    <span style={{ fontSize: '13px', color: '#334155' }}>{b.customer_email}</span>
                                                                                </div>
                                                                            )}
                                                                            {b.contact_number && (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <Phone size={16} color="#64748b" />
                                                                                    <span style={{ fontSize: '13px', color: '#334155' }}>{b.contact_number}</span>
                                                                                </div>
                                                                            )}
                                                                            {b.service_address && (
                                                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                                                    <MapPin size={16} color="#64748b" style={{ marginTop: '2px' }} />
                                                                                    <span style={{ fontSize: '13px', color: '#334155', lineHeight: '1.4' }}>{b.service_address}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Booking Action Buttons */}
                                                                        {b.status === 'Pending' && (
                                                                            <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                                                                <button 
                                                                                    onClick={() => handleUpdateStatus(b.id, 'Confirmed')} 
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', cursor: 'pointer', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }}
                                                                                    onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                                                                                    onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                                                                                >
                                                                                    <Check size={14} /> Confirm Appointment
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => handleUpdateStatus(b.id, 'Cancelled')} 
                                                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }}
                                                                                    onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                                                                                    onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                                                                                >
                                                                                    <X size={14} /> Cancel Appointment
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Simple CSS Injection for rotation keyframe */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
            `}} />

            {/* Proof Modal Overlay */}
            {proofPhotoUrl && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '16px'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '500px',
                        overflow: 'hidden',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px 20px',
                            borderBottom: '1px solid #f1f5f9'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                                Work Completion Proof
                            </h3>
                            <button
                                onClick={() => setProofPhotoUrl(null)}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    fontSize: '20px',
                                    color: '#64748b',
                                    cursor: 'pointer'
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <img
                                src={proofPhotoUrl.startsWith('http') ? proofPhotoUrl : `${MEDIA_BASE_URL}${proofPhotoUrl}`}
                                alt="Completion Proof"
                                style={{
                                    width: '100%',
                                    aspectRatio: '4/3',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1'
                                }}
                            />
                            <p style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#475569', textAlign: 'center', fontWeight: '500' }}>
                                Final work proof photo submitted by staff at clock-out.
                            </p>
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            padding: '12px 20px',
                            borderTop: '1px solid #f1f5f9',
                            background: '#f8fafc'
                        }}>
                            <button
                                onClick={() => setProofPhotoUrl(null)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingManagement;
