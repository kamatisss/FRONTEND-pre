import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listUsers, createUser, updateUser, getUserActivityLogs } from '../services/api';
import { Users, Plus, Shield, CheckCircle, XCircle, Search, Loader2, Clock, Calendar, ShoppingBag, X, Info } from 'lucide-react';

const ManageUsers = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal states
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        email: '',
        password: '',
        role: 'CUSTOMER'
    });

    // Edit user role & activity states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUserRole, setSelectedUserRole] = useState('CUSTOMER');
    const [activityLogs, setActivityLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsError, setLogsError] = useState(null);
    const [savingRole, setSavingRole] = useState(false);
    const [toasts, setToasts] = useState([]);
    
    const showToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listUsers();
            setUsers(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleToggleStatus = async (userId, currentActive) => {
        if (userId === currentUser.id) {
            alert("You cannot deactivate your own account.");
            return;
        }
        try {
            await updateUser(userId, { is_active: !currentActive });
            setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u));
            if (selectedUser && selectedUser.id === userId) {
                setSelectedUser({ ...selectedUser, is_active: !currentActive });
            }
        } catch (err) {
            alert(err.message || 'Failed to update user status');
        }
    };

    const handleOpenEditModal = async (userObj) => {
        setSelectedUser(userObj);
        let currentRole = userObj.role || (userObj.is_superuser ? 'SUPER_ADMIN' : userObj.is_staff ? 'OFFICE_ADMIN' : 'CUSTOMER');
        if (currentRole === 'Admin') currentRole = 'SUPER_ADMIN';
        if (currentRole === 'Staff') currentRole = 'OFFICE_ADMIN';
        if (currentRole === 'Customer') currentRole = 'CUSTOMER';
        setSelectedUserRole(currentRole);
        setEditModalOpen(true);
        setLoadingLogs(true);
        setLogsError(null);
        setActivityLogs([]);

        try {
            const res = await getUserActivityLogs(userObj.id);
            setActivityLogs(res.activity_logs || []);
        } catch (err) {
            setLogsError(err.message || 'Failed to load activity logs.');
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleSaveRole = async () => {
        if (!selectedUser) return;
        setSavingRole(true);
        try {
            const res = await updateUser(selectedUser.id, { role: selectedUserRole });
            
            setUsers(users.map(u => u.id === selectedUser.id ? { 
                ...u, 
                is_staff: res.is_staff, 
                is_superuser: res.is_superuser, 
                role: res.role 
            } : u));
            
            setSelectedUser({
                ...selectedUser,
                is_staff: res.is_staff,
                is_superuser: res.is_superuser,
                role: res.role
            });
            const prettyRoleName = {
                'SUPER_ADMIN': 'System Administrator',
                'OFFICE_ADMIN': 'Office Staff',
                'FIELD_CREW': 'Field Crew',
                'CUSTOMER': 'Customer'
            }[res.role] || res.role;
            showToast(`Role successfully updated to ${prettyRoleName}`);
        } catch (err) {
            showToast(err.message || "Failed to update user role.", "error");
        } finally {
            setSavingRole(false);
        }
    };

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleOpenModal = () => {
        setFormData({
            fullName: '',
            username: '',
            email: '',
            password: '',
            role: 'CUSTOMER'
        });
        setFormError(null);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const handleCreateAccount = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError(null);

        if (!formData.username.trim()) {
            setFormError("Username is required.");
            setSubmitting(false);
            return;
        }

        // Split fullName into first_name and last_name
        const nameParts = formData.fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        try {
            await createUser({
                username: formData.username.trim(),
                first_name: firstName,
                last_name: lastName,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                input_role: formData.role.toLowerCase() === 'super_admin' ? 'admin' : (formData.role.toLowerCase() === 'customer' ? 'customer' : 'staff'),
                input_staff_role: formData.role
            });
            
            // Reload user list and close modal
            await fetchUsers();
            setModalOpen(false);
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const query = searchTerm.toLowerCase();
        return fullName.includes(query) || email.includes(query) || username.includes(query);
    });

    return (
        <div style={{ backgroundColor: '#f1f5f9', minHeight: '100%', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
            {/* Modal */}
            {modalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '450px',
                        padding: '32px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        border: '1px solid #e2e8f0',
                        animation: 'modal-in 0.2s ease-out'
                    }}>
                        <style>{`
                            @keyframes modal-in {
                                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                                to { opacity: 1; transform: scale(1) translateY(0); }
                            }
                        `}</style>
                        <h3 style={{ color: '#1e293b', fontSize: '20px', fontWeight: '800', margin: '0 0 8px 0' }}>Add New Account</h3>
                        <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>Create a new staff or customer account.</p>

                        {formError && (
                            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '20px' }}>
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Full Name</label>
                                <input
                                    type="text"
                                    name="fullName"
                                    required
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', color: '#1e293b' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', color: '#1e293b' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', color: '#1e293b' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Password</label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', color: '#1e293b' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Account Role</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', color: '#1e293b', backgroundColor: '#ffffff', cursor: 'pointer' }}
                                >
                                    <option value="CUSTOMER">Customer (Read-Only Portal)</option>
                                    <option value="FIELD_CREW">Field Crew (Mobile Execution)</option>
                                    <option value="OFFICE_ADMIN">Office Staff (Operations & Dispatch)</option>
                                    <option value="SUPER_ADMIN">System Administrator (Full Access)</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    disabled={submitting}
                                    style={{ padding: '10px 20px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', color: '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', background: '#10b981', color: '#ffffff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 14px rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                                >
                                    {submitting ? 'Creating...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div style={{ 
                maxWidth: '1200px', 
                margin: '0 auto', 
                backgroundColor: '#ffffff', 
                borderRadius: '16px', 
                padding: '32px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'
            }}>
                {/* Header / Hero */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '32px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Users size={36} color="#10b981" style={{ marginRight: '20px' }} />
                        <div>
                            <h1 style={{ color: '#1e293b', fontSize: '28px', margin: '0 0 4px 0', fontWeight: '800' }}>User Management</h1>
                            <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>Manage administrative, staff, and customer accounts</p>
                        </div>
                    </div>
                    <button
                        onClick={handleOpenModal}
                        style={{
                            padding: '12px 24px',
                            cursor: 'pointer',
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '15px',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,0.45)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,185,129,0.3)'; }}
                    >
                        <Plus size={18} /> Add New Account
                    </button>
                </div>

                {/* Search Bar / Filter Panel */}
                <div style={{ position: 'relative', marginBottom: '24px', maxWidth: '400px' }}>
                    <Search size={18} color="#94a3b8" style={{ position: 'absolute', top: '50%', left: '14px', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        placeholder="Search users by name, email, or username..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px 12px 42px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            outline: 'none',
                            color: '#334155',
                            transition: 'all 0.2s',
                            fontFamily: 'inherit'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = '#10b981'}
                        onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                    />
                </div>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: '12px' }}>
                        <Loader2 size={36} color="#10b981" style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: '#64748b', fontSize: '15px', fontWeight: '500' }}>Loading accounts...</span>
                        <style>{`
                            @keyframes spin {
                                from { transform: rotate(0deg); }
                                to { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                ) : error ? (
                    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 12px 0', fontWeight: '700' }}>Failed to load users</p>
                        <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
                    </div>
                ) : (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        {filteredUsers.length === 0 ? (
                            <p style={{ padding: '32px', color: '#64748b', textAlign: 'center', margin: 0 }}>No matching accounts found.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc' }}>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>User ID</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Name</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Email</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Role</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Status</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Date Created</th>
                                        <th style={{ padding: '16px 24px', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((item) => {
                                        const rawRole = item.role || (item.is_superuser ? 'SUPER_ADMIN' : item.is_staff ? 'OFFICE_ADMIN' : 'CUSTOMER');
                                        let role = rawRole;
                                        if (role === 'Admin') role = 'SUPER_ADMIN';
                                        if (role === 'Staff') role = 'OFFICE_ADMIN';
                                        if (role === 'Customer') role = 'CUSTOMER';
                                        
                                        // Role badge styling
                                        let roleBg = '#F3F4F6';
                                        let roleColor = '#374151';
                                        if (role === 'SUPER_ADMIN') {
                                            roleBg = '#F3E8FF';
                                            roleColor = '#6B21A8';
                                        } else if (role === 'OFFICE_ADMIN') {
                                            roleBg = '#DBEAFE';
                                            roleColor = '#1E40AF';
                                        } else if (role === 'FIELD_CREW') {
                                            roleBg = '#FFEDD5';
                                            roleColor = '#9A3412';
                                        } else if (role === 'CUSTOMER') {
                                            roleBg = '#FEF3C7';
                                            roleColor = '#92400E';
                                        }

                                        return (
                                            <tr 
                                                key={item.id} 
                                                onClick={() => handleOpenEditModal(item)}
                                                style={{ background: '#ffffff', transition: 'background 0.2s', cursor: 'pointer' }} 
                                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} 
                                                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                                            >
                                                <td style={{ padding: '16px 24px', color: '#475569', borderBottom: '1px solid #f1f5f9', fontWeight: '600' }}>{item.id}</td>
                                                <td style={{ padding: '16px 24px', color: '#1e293b', borderBottom: '1px solid #f1f5f9', fontWeight: '700' }}>
                                                    {item.first_name || item.last_name ? `${item.first_name || ''} ${item.last_name || ''}`.trim() : item.username}
                                                </td>
                                                <td style={{ padding: '16px 24px', color: '#334155', borderBottom: '1px solid #f1f5f9', fontWeight: '500' }}>{item.email || '-'}</td>
                                                <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <span style={{
                                                        display: 'inline-block', padding: '4px 12px', borderRadius: 999,
                                                        background: roleBg, color: roleColor,
                                                        fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em',
                                                    }}>{role.replace('_', ' ')}</span>
                                                </td>
                                                <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                    {item.is_active ? (
                                                        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200/50">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200/50">
                                                            Deactivated
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px', color: '#64748b', borderBottom: '1px solid #f1f5f9', fontSize: '13.5px' }}>
                                                    {new Date(item.date_joined).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(item.id, item.is_active); }}
                                                        disabled={item.id === currentUser?.id}
                                                        style={{ 
                                                            padding: '8px 16px', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '8px', 
                                                            cursor: (currentUser && item.id === currentUser.id) ? 'not-allowed' : 'pointer', 
                                                            background: '#ffffff', 
                                                            color: (currentUser && item.id === currentUser.id) ? '#94a3b8' : (item.is_active ? '#ef4444' : '#10b981'), 
                                                            border: `1px solid ${(currentUser && item.id === currentUser.id) ? '#e2e8f0' : (item.is_active ? '#fca5a5' : '#86efac')}`, 
                                                            borderRadius: '8px', 
                                                            fontWeight: '700', 
                                                            fontSize: '13px',
                                                            transition: 'all 0.2s',
                                                            opacity: (currentUser && item.id === currentUser.id) ? 0.6 : 1
                                                        }}
                                                        onMouseEnter={(e) => { 
                                                            if (!currentUser || item.id !== currentUser.id) {
                                                                e.currentTarget.style.background = item.is_active ? '#fef2f2' : '#f0fdf4'; 
                                                                e.currentTarget.style.borderColor = item.is_active ? '#ef4444' : '#10b981';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => { 
                                                            if (!currentUser || item.id !== currentUser.id) {
                                                                e.currentTarget.style.background = '#ffffff'; 
                                                                e.currentTarget.style.borderColor = item.is_active ? '#fca5a5' : '#86efac';
                                                            }
                                                        }}
                                                    >
                                                        {item.is_active ? 'Deactivate' : 'Activate'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* Edit User & Activity Modal */}
            {editModalOpen && selectedUser && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '90%',
                        maxWidth: '850px',
                        padding: '0',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid #e2e8f0',
                        animation: 'modal-in 0.2s ease-out',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '85vh'
                    }}>
                        <style>{`
                            @keyframes modal-in {
                                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                                to { opacity: 1; transform: scale(1) translateY(0); }
                            }
                        `}</style>
                        {/* Header */}
                        <div style={{
                            padding: '24px 32px',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc'
                        }}>
                            <div>
                                <h3 style={{ color: '#1e293b', fontSize: '20px', fontWeight: '800', margin: '0 0 4px 0' }}>Manage User Account</h3>
                                <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>Configure role permissions and review logs for <strong>@{selectedUser.username}</strong></p>
                            </div>
                            <button 
                                onClick={() => setEditModalOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body Columns */}
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                            {/* Left Column: Account Settings */}
                            <div style={{ width: '40%', padding: '32px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                                <div>
                                    <h4 style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', margin: '0 0 16px 0' }}>Account Settings</h4>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                                        <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: '700' }}>
                                            {selectedUser.first_name || selectedUser.last_name ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() : selectedUser.username}
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#64748b' }}>{selectedUser.email || 'No email associated'}</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Joined on {new Date(selectedUser.date_joined).toLocaleDateString()}</div>
                                    </div>
                                    
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Assign Permission Level</label>
                                    <select
                                        value={selectedUserRole}
                                        onChange={e => setSelectedUserRole(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', color: '#1e293b', backgroundColor: '#ffffff', cursor: 'pointer', marginBottom: '16px' }}
                                    >
                                        <option value="SUPER_ADMIN">System Administrator (Full Access)</option>
                                        <option value="OFFICE_ADMIN">Office Staff (Operations & Dispatch)</option>
                                        <option value="FIELD_CREW">Field Crew (Mobile Execution)</option>
                                        <option value="CUSTOMER">Customer (Read-Only Portal)</option>
                                    </select>
                                    
                                    <button
                                        onClick={handleSaveRole}
                                        disabled={savingRole}
                                        style={{ width: '100%', padding: '10px 16px', border: 'none', borderRadius: '8px', background: '#10b981', color: '#ffffff', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 14px rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#059669'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#10b981'}
                                    >
                                        {savingRole ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                                        {savingRole ? 'Saving Role...' : 'Save Role'}
                                    </button>
                                </div>
                                
                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Status Operations</label>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(selectedUser.id, selectedUser.is_active); }}
                                        disabled={selectedUser.id === currentUser?.id}
                                        style={{ 
                                            width: '100%',
                                            padding: '10px 16px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            gap: '8px', 
                                            cursor: (currentUser && selectedUser.id === currentUser.id) ? 'not-allowed' : 'pointer', 
                                            background: '#ffffff', 
                                            color: (currentUser && selectedUser.id === currentUser.id) ? '#94a3b8' : (selectedUser.is_active ? '#ef4444' : '#10b981'), 
                                            border: `1px solid ${(currentUser && selectedUser.id === currentUser.id) ? '#e2e8f0' : (selectedUser.is_active ? '#fca5a5' : '#86efac')}`, 
                                            borderRadius: '8px', 
                                            fontWeight: '700', 
                                            fontSize: '13px',
                                            transition: 'all 0.2s',
                                            opacity: (currentUser && selectedUser.id === currentUser.id) ? 0.6 : 1
                                        }}
                                        onMouseEnter={(e) => { 
                                            if (!currentUser || selectedUser.id !== currentUser.id) {
                                                e.currentTarget.style.background = selectedUser.is_active ? '#fef2f2' : '#f0fdf4'; 
                                                e.currentTarget.style.borderColor = selectedUser.is_active ? '#ef4444' : '#10b981';
                                            }
                                        }}
                                        onMouseLeave={(e) => { 
                                            if (!currentUser || selectedUser.id !== currentUser.id) {
                                                e.currentTarget.style.background = '#ffffff'; 
                                                e.currentTarget.style.borderColor = selectedUser.is_active ? '#fca5a5' : '#86efac';
                                            }
                                        }}
                                    >
                                        {selectedUser.is_active ? 'Deactivate Account' : 'Activate Account'}
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Activity Overview */}
                            <div style={{ width: '60%', padding: '32px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <h4 style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', margin: '0 0 16px 0' }}>Activity Overview</h4>
                                
                                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', minHeight: 0 }}>
                                    {loadingLogs ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                                            <Loader2 size={24} color="#10b981" className="animate-spin" />
                                            <span style={{ color: '#64748b', fontSize: '13.5px' }}>Retrieving activity audit logs...</span>
                                        </div>
                                    ) : logsError ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: '12px', fontSize: '13.5px' }}>
                                            <XCircle size={18} />
                                            <span>{logsError}</span>
                                        </div>
                                    ) : activityLogs.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', padding: '40px 0' }}>
                                            <Info size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                            <span style={{ fontSize: '14px' }}>No recorded user activities found.</span>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', borderLeft: '2px solid #e2e8f0', margin: '8px 0 8px 12px' }}>
                                            {activityLogs.map((log, idx) => {
                                                // Choose visual elements based on log type
                                                let icon = <Clock size={14} color="#3b82f6" />;
                                                let iconBg = '#eff6ff';
                                                let typeLabel = 'Activity';
                                                
                                                if (log.type === 'clock_in') {
                                                    icon = <Clock size={14} color="#3b82f6" />;
                                                    iconBg = '#eff6ff';
                                                    typeLabel = 'Clock In';
                                                } else if (log.type === 'clock_out') {
                                                    icon = <CheckCircle size={14} color="#10b981" />;
                                                    iconBg = '#f0fdf4';
                                                    typeLabel = 'Clock Out';
                                                } else if (log.type === 'booking') {
                                                    icon = <Calendar size={14} color="#6366f1" />;
                                                    iconBg = '#e0e7ff';
                                                    typeLabel = 'Service Booking';
                                                } else if (log.type === 'order') {
                                                    icon = <ShoppingBag size={14} color="#10b981" />;
                                                    iconBg = '#ecfdf5';
                                                    typeLabel = 'Product Order';
                                                }

                                                return (
                                                    <div key={idx} style={{ position: 'relative', paddingLeft: '24px' }}>
                                                        {/* Dot marker */}
                                                        <div style={{
                                                            position: 'absolute',
                                                            left: '-29px',
                                                            top: '4px',
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '50%',
                                                            backgroundColor: iconBg,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            border: '2px solid #ffffff'
                                                        }}>
                                                            {icon}
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.02em' }}>{typeLabel}</span>
                                                                {log.timestamp && (
                                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                        {new Date(log.timestamp).toLocaleString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '13px', color: '#1e293b', lineHeight: 1.4 }}>
                                                                {log.details}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Toast Notifications */}
            <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 16px', borderRadius: '8px',
                        background: t.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                        color: t.type === 'success' ? '#065F46' : '#991B1B',
                        border: `1px solid ${t.type === 'success' ? '#A7F3D0' : '#FCA5A5'}`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '14px', fontWeight: '600', minWidth: '250px',
                        transition: 'all 0.2s ease-in-out'
                    }}>
                        <CheckCircle size={16} />
                        <span>{t.msg}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManageUsers;
