import React, { useState, useEffect } from 'react';
import { getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../services/api';
import { Package, Plus, Edit, Trash2, AlertTriangle, X } from 'lucide-react';

/* ── Shared Inline Style Tokens ── */
const thStyle = {
  padding: '16px 24px',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '1px solid #f1f5f9',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '16px 24px',
  fontSize: 14,
  whiteSpace: 'nowrap',
  borderBottom: '1px solid #f1f5f9',
};

const actionBtnStyle = {
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  padding: 7,
  cursor: 'pointer',
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
  transition: 'all 0.15s ease',
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '9px 14px',
  background: '#0f172a',
  color: '#f1f5f9',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s ease',
  boxSizing: 'border-box',
};

const fileInputStyle = {
  width: '100%',
  fontSize: 13,
  color: '#94a3b8',
  cursor: 'pointer',
  padding: '8px 0',
};

const cancelBtnStyle = {
  padding: '9px 20px',
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  color: '#cbd5e1',
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const submitBtnStyle = {
  padding: '9px 20px',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  color: '#ffffff',
  background: '#059669',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
  transition: 'all 0.2s ease',
};

export default function InventoryDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'plant',
    description: '',
    stock_quantity: 0,
    unit_price: '',
    model_file: null,
    thumbnail: null
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getInventoryItems();
      setItems(data);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name || '',
        category: item.category || 'plant',
        description: item.description || '',
        stock_quantity: item.stock_quantity || 0,
        unit_price: item.unit_price || '',
        model_file: null,
        thumbnail: null
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: 'plant',
        description: '',
        stock_quantity: 0,
        unit_price: '',
        model_file: null,
        thumbnail: null
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    if (files && files[0]) {
      setFormData(prev => ({ ...prev, [name]: files[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('category', formData.category);
      data.append('description', formData.description);
      data.append('stock_quantity', formData.stock_quantity);
      data.append('unit_price', formData.unit_price);
      if (formData.model_file) data.append('model_file', formData.model_file);
      if (formData.thumbnail) data.append('thumbnail', formData.thumbnail);

      if (editingItem) {
        await updateInventoryItem(editingItem.id, data);
      } else {
        await createInventoryItem(data);
      }
      closeModal();
      fetchItems();
    } catch (err) {
      console.error('Failed to save item:', err);
      alert('Failed to save item. Check console for details.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteInventoryItem(id);
        fetchItems();
      } catch (err) {
        console.error('Failed to delete item:', err);
      }
    }
  };

  return (
    <div style={{ minHeight: '100%', padding: '40px 48px', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      {/* ── Centered White Card ── */}
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {/* ── Card Header ── */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '28px 32px 24px',
          borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={20} color="#059669" />
            </div>
            <h2 style={{
              margin: 0, fontSize: 22, fontWeight: 700,
              color: '#0f172a', letterSpacing: '-0.02em',
            }}>
              Inventory Management
            </h2>
          </div>
          <button
            onClick={() => openModal()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,185,129,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.25)'; }}
          >
            <Plus size={16} />
            Add New Item
          </button>
        </div>

        {/* ── Table Body ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
            <p style={{ color: '#94a3b8', fontSize: 15, fontWeight: 500 }}>Loading inventory...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Category</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Stock</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Price (₱)</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: '#ffffff',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{item.name}</td>
                    <td style={{ ...tdStyle }}>
                      <span className={`inline-flex items-center gap-x-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                        item.category === 'plant' 
                          ? 'bg-green-50 text-green-700 border-green-200/50' 
                          : item.category === 'furniture' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200/50' 
                            : 'bg-amber-50 text-amber-700 border-amber-200/50'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {item.stock_quantity === 0 ? (
                        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200/50">
                          Out of Stock
                        </span>
                      ) : item.stock_quantity < 10 ? (
                        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200/50">
                          Low Stock ({item.stock_quantity})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-x-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200/50">
                          Active ({item.stock_quantity})
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                      ₱{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        <button
                          onClick={() => openModal(item)}
                          title="Edit"
                          style={actionBtnStyle}
                          onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#2563eb'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                          style={actionBtnStyle}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ padding: '56px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 15 }}>
                      No inventory items found. Add some to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Card Footer ── */}
        {!loading && items.length > 0 && (
          <div style={{
            padding: '14px 32px',
            borderTop: '1px solid #f1f5f9',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
              {items.length} item{items.length !== 1 ? 's' : ''} total
            </span>
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
              {items.filter(i => i.stock_quantity < 10).length > 0 && (
                <span style={{ color: '#ef4444', fontWeight: 600 }}>
                  ⚠ {items.filter(i => i.stock_quantity < 10).length} low stock
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Modal for Add/Edit ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16,
            width: '100%', maxWidth: 520,
            boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#151d2b',
            }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f1f5f9' }}>
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>
              <button
                onClick={closeModal}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none',
                  borderRadius: 8, padding: 6, cursor: 'pointer',
                  color: '#94a3b8', display: 'flex', alignItems: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#94a3b8'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select name="category" value={formData.category} onChange={handleInputChange} style={inputStyle}>
                    <option value="plant">Plant</option>
                    <option value="hardscape">Hardscape</option>
                    <option value="furniture">Furniture</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Price (₱)</label>
                  <input type="number" step="0.01" name="unit_price" value={formData.unit_price} onChange={handleInputChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Stock</label>
                  <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleInputChange} required style={inputStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3"
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>3D Model (.glb/.gltf)</label>
                  <input type="file" name="model_file" accept=".glb,.gltf" onChange={handleFileChange} style={fileInputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Thumbnail Image</label>
                  <input type="file" name="thumbnail" accept="image/*" onChange={handleFileChange} style={fileInputStyle} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button type="button" onClick={closeModal} style={cancelBtnStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#cbd5e1'; }}
                >
                  Cancel
                </button>
                <button type="submit" style={submitBtnStyle}
                  onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
