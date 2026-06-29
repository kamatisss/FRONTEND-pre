import React, { useState } from 'react';
import { Settings, Shield, Sparkles, RefreshCw, Save, DollarSign, Bell } from 'lucide-react';

export default function AdminSettings() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    aiModel: 'gemini-2.5-flash',
    aiTemperature: 0.2,
    defaultBudget: 5000,
    enableStripe: true,
    notificationEmail: 'admin@gardenstudio.com',
    alertLowStock: 10,
  });

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert('Global Settings updated successfully!');
    }, 800);
  };

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100%', padding: '40px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center',
            marginRight: 16
          }}>
            <Settings size={22} color="#059669" />
          </div>
          <div>
            <h1 style={{ color: '#1e293b', fontSize: '24px', margin: '0 0 4px 0', fontWeight: '800' }}>Global Settings</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Configure system configurations and AI generation preferences</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Settings Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
            
            {/* System Status & AI Config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', margin: 0 }}>
                System & AI Preferences
              </h3>

              {/* Maintenance Toggle */}
              <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>Maintenance Mode</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Temporarily disable design edits and checkouts.</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('maintenanceMode')}
                  style={{
                    width: '50px',
                    height: '26px',
                    borderRadius: '999px',
                    background: settings.maintenanceMode ? '#ef4444' : '#cbd5e1',
                    border: 'none',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    position: 'absolute',
                    top: '3px',
                    left: settings.maintenanceMode ? '27px' : '3px',
                    transition: 'left 0.2s'
                  }} />
                </button>
              </div>

              {/* Model Choice */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  Active AI Model
                </label>
                <select
                  name="aiModel"
                  value={settings.aiModel}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#334155',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Precision)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Legacy)</option>
                </select>
              </div>

              {/* Temperature Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                    AI Temperature (Creativity)
                  </label>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>{settings.aiTemperature}</span>
                </div>
                <input
                  type="range"
                  name="aiTemperature"
                  min="0"
                  max="1.0"
                  step="0.1"
                  value={settings.aiTemperature}
                  onChange={handleChange}
                  style={{ width: '100%', accentColor: '#059669' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  <span>Precise / Symmetrical</span>
                  <span>Creative / Organic</span>
                </div>
              </div>
            </div>

            {/* Business & Inventory settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', margin: 0 }}>
                Operations & Budget Defaults
              </h3>

              {/* Default lot budget */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  Default Design Budget (PHP)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: '600' }}>₱</span>
                  <input
                    type="number"
                    name="defaultBudget"
                    value={settings.defaultBudget}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '10px 14px 10px 28px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      color: '#334155',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Low stock alert value */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  name="alertLowStock"
                  value={settings.alertLowStock}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#334155',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Notification Email */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                  Admin Notification Email
                </label>
                <input
                  type="email"
                  name="notificationEmail"
                  value={settings.notificationEmail}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#334155',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {saving ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
