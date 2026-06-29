import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDesign } from '../context/DesignContext';
import { saveDesign, listDesigns, loadDesign, deleteDesign, submitDesign } from '../services/api';
import {
  Save, FolderOpen, Sparkles, X, Loader, HardDrive, Send, Trash2
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   INLINE STYLES
   ═══════════════════════════════════════════════════════════════ */
const T = {
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 8, border: '1px solid #E5E7EB',
    background: '#fff', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    color: '#6B7280', transition: 'all 0.15s',
  },
  submitBtn: {
    marginLeft: 8, padding: '8px 14px', background: '#111827', color: '#fff',
    borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
    transition: 'background 0.15s',
  },
  dirtyDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#F59E0B',
    marginLeft: 4, flexShrink: 0,
  },
  /* Modal */
  overlay: {
    position: 'fixed', inset: 0, zIndex: 40,
    background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px 16px 16px',
  },
  modal: {
    background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB', overflow: 'hidden',
    marginTop: '8px',
  },
  modalHeader: {
    padding: '20px 32px', borderBottom: '1px solid #E5E7EB',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: '1.15rem', fontWeight: 900, color: '#1f2937',
    display: 'flex', alignItems: 'center', gap: 12, margin: 0,
  },
  modalTitleIcon: {
    width: 40, height: 40, background: '#FFF7ED', borderRadius: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C',
  },
  modalCloseBtn: {
    width: 36, height: 36, background: '#F3F4F6', border: 'none', borderRadius: '50%',
    cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: 24, maxHeight: 400, overflowY: 'auto' },
  loadingText: { textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontWeight: 500 },
  emptyText: { textAlign: 'center', padding: '64px 24px', color: '#9CA3AF', fontStyle: 'italic', lineHeight: 1.5 },
  designRow: {
    padding: 16, borderRadius: 12, background: '#F9FAFB', marginBottom: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transition: 'background 0.15s',
  },
  designName: { fontWeight: 700, color: '#1f2937', fontSize: '0.9rem', marginBottom: 4 },
  designMeta: { fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em' },
  openBtn: {
    padding: '8px 16px', background: '#fff', color: '#059669', fontSize: 12, fontWeight: 700,
    borderRadius: 10, border: '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 0.15s',
  },
  deleteBtn: {
    padding: 8, background: 'none', border: 'none', cursor: 'pointer',
    color: '#D1D5DB', transition: 'color 0.15s',
  },
  /* Card variant */
  card: {
    background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 20px', borderBottom: '1px solid #F3F4F6',
    display: 'flex', alignItems: 'center', gap: 12,
  },
  cardTitle: { color: '#1f2937', fontWeight: 700, fontSize: '0.85rem', margin: 0 },
  cardBody: { padding: 20 },
  nameInput: {
    width: '100%', padding: '10px 14px', background: '#F9FAFB',
    border: '1px solid #E5E7EB', borderRadius: 10, fontSize: '0.85rem',
    fontWeight: 500, outline: 'none', color: '#1f2937', boxSizing: 'border-box',
    marginBottom: 16, transition: 'border-color 0.2s',
  },
  cardBtnRow: { display: 'flex', gap: 8, marginBottom: 12 },
  saveBtn: {
    flex: 1, padding: '10px 0', background: '#059669', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.15s',
  },
  loadBtn: {
    flex: 1, padding: '10px 0', background: '#fff', color: '#374151',
    border: '1px solid #E5E7EB', borderRadius: 10, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.15s',
  },
  cardSubmitBtn: {
    width: '100%', padding: '10px 0', background: '#111827', color: '#fff',
    border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background 0.15s', marginBottom: 8,
  },
  msgSuccess: { fontSize: 11, fontWeight: 700, textAlign: 'center', color: '#059669', marginTop: 8 },
  msgError: { fontSize: 11, fontWeight: 700, textAlign: 'center', color: '#EF4444', marginTop: 8 },
  dirtyLabel: { fontSize: 10, fontWeight: 700, textAlign: 'center', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 8 },
};

export default function SaveLoadPanel({ toolbarVariant }) {
  const { state, dispatch, totalCost } = useDesign();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!showModal) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };

    const handleOutsideClick = (e) => {
      const modalEl = document.getElementById('saved-designs-modal');
      if (modalEl && !modalEl.contains(e.target)) {
        setShowModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleOutsideClick);
      clearTimeout(timeoutId);
    };
  }, [showModal]);

  const handleSubmitForReview = async () => {
    if (!state.designId) {
      setMessage('Please save the design first.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setSubmitting(true);
    try {
      await submitDesign(state.designId);
      setMessage('Design submitted for review!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Submission failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (showModal) fetchDesigns();
  }, [showModal]);

  const fetchDesigns = async () => {
    setLoadingList(true);
    try {
      const designs = await listDesigns();
      dispatch({ type: 'SET_SAVED_DESIGNS', payload: designs });
    } catch (err) {
      console.error('Failed to load designs:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        id: state.designId || undefined,
        name: state.designName,
        original_image_url: state.originalImageUrl || '',
        depth_data: state.depthData || {},
        placed_items: state.placedItems.map(item => ({
          product_id: item.productId,
          name: item.name,
          model_type: item.modelType || item.model_type || null,
          price: item.price,
          position: item.position,
          rotation: item.rotation,
          scale: item.scale,
        })),
        dimensions: state.dimensions,
        total_cost: totalCost,
        terrain_height: state.terrainHeight,
        time_of_day: state.timeOfDay,
      };
      const result = await saveDesign(payload);
      dispatch({ type: 'SET_DESIGN_META', payload: { designId: result.id } });
      dispatch({ type: 'MARK_CLEAN' });
      setMessage('Design saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id) => {
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
      setShowModal(false);
      setMessage('Design loaded!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Load failed: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this design?')) return;
    try {
      await deleteDesign(id);
      fetchDesigns();
    } catch (err) {
      setMessage('Delete failed');
    }
  };

  const handleNew = () => {
    if (state.isDirty && !confirm('Unsaved changes will be lost. Continue?')) return;
    dispatch({ type: 'RESET' });
    setMessage('');
  };

  /* ── Load Modal (shared between variants) ── */
  const loadModal = showModal ? createPortal(
    <div style={T.overlay} onClick={() => setShowModal(false)}>
      <div id="saved-designs-modal" style={T.modal} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div className="flex justify-between items-center border-b pb-2 mb-2">
            <span className="text-sm font-semibold text-gray-700">Saved Designs</span>
            <button 
              onClick={() => setShowModal(false)} 
              className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ ...T.modalBody, padding: 0 }}>
            {loadingList && <p style={T.loadingText}>Loading designs...</p>}
            {!loadingList && state.savedDesigns.length === 0 && (
              <p style={T.emptyText}>No saved designs found.</p>
            )}
            {state.savedDesigns.map(d => (
              <div key={d.id} style={T.designRow}
                onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}>
                <div>
                  <p style={T.designName}>{d.name || 'Untitled'}</p>
                  <p style={T.designMeta}>₱{Number(d.total_cost).toLocaleString()} · {new Date(d.updated_at).toLocaleDateString()}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleLoad(d.id)} style={T.openBtn}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = '#F0FDF4'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#fff'; }}>
                    Open
                  </button>
                  <button 
                    onClick={() => handleDelete(d.id)} 
                    style={T.deleteBtn}
                    title="Delete Design"
                    onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#D1D5DB'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  /* ══════════════════════════════════════════════════════════════
     TOOLBAR VARIANT — horizontal icon row in the top toolbar
     ══════════════════════════════════════════════════════════════ */
  if (toolbarVariant) {
    return (
      <div style={T.row}>
        {/* New */}
        <button onClick={handleNew} style={T.iconBtn} title="New Design"
          onMouseEnter={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.color = '#059669'; e.currentTarget.style.borderColor = '#BBF7D0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          <Sparkles size={22} />
        </button>

        {/* Save */}
        <button onClick={handleSave} disabled={saving} style={T.iconBtn} title="Save Design"
          onMouseEnter={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.color = '#059669'; e.currentTarget.style.borderColor = '#BBF7D0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          {saving ? <Loader size={22} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={22} />}
        </button>

        {/* Load */}
        <button onClick={() => setShowModal(true)} style={T.iconBtn} title="Open Design"
          onMouseEnter={e => { e.currentTarget.style.background = '#F0FDF4'; e.currentTarget.style.color = '#059669'; e.currentTarget.style.borderColor = '#BBF7D0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
          <FolderOpen size={22} />
        </button>

        {/* Unsaved indicator */}
        {state.isDirty && <div style={T.dirtyDot} title="Unsaved changes" />}

        {/* Submit for Review */}
        {state.designId && (
          <button onClick={handleSubmitForReview} disabled={submitting || state.isDirty}
            style={{ ...T.submitBtn, opacity: (submitting || state.isDirty) ? 0.5 : 1 }}
            onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#000'; }}
            onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#111827'; }}>
            <Send size={14} />
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        )}

        {loadModal}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     CARD VARIANT — full panel (fallback)
     ══════════════════════════════════════════════════════════════ */
  return (
    <div style={T.card}>
      <div style={T.cardHeader}>
        <HardDrive size={18} style={{ color: '#10b981' }} />
        <h3 style={T.cardTitle}>Design Settings</h3>
      </div>
      <div style={T.cardBody}>
        <input type="text" value={state.designName}
          onChange={e => dispatch({ type: 'SET_DESIGN_META', payload: { designName: e.target.value } })}
          placeholder="Untitled Design" style={T.nameInput}
          onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.15)'; }}
          onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; }}
        />
        <div style={T.cardBtnRow}>
          <button onClick={handleSave} disabled={saving} style={T.saveBtn}>
            {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Save
          </button>
          <button onClick={() => setShowModal(true)} style={T.loadBtn}>
            <FolderOpen size={14} /> Load
          </button>
        </div>
        {state.designId && (
          <button onClick={handleSubmitForReview} disabled={submitting || state.isDirty}
            style={{ ...T.cardSubmitBtn, opacity: (submitting || state.isDirty) ? 0.5 : 1 }}>
            <Send size={14} /> Submit for Review
          </button>
        )}
        {message && <p style={message.includes('fail') ? T.msgError : T.msgSuccess}>{message}</p>}
        {state.isDirty && <p style={T.dirtyLabel}>● Unsaved changes</p>}
      </div>
      {loadModal}
    </div>
  );
}
