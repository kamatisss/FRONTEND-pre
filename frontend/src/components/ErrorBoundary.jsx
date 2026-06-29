import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="canvas-error-overlay" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-secondary)', color: 'var(--text-primary)', zIndex: 100,
      padding: '2rem', textAlign: 'center'
    }}>
      <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
      <h3 style={{ marginBottom: '0.5rem' }}>3D Canvas Crashed</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px' }}>
        A rendering error occurred in the 3D scene. This is often caused by invalid data (like NaN) being passed to a 3D object.
      </p>
      <div style={{
        background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', 
        marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '0.8rem',
        color: '#fca5a5', maxWidth: '500px', overflowX: 'auto', textAlign: 'left'
      }}>
        {error.message}
      </div>
      <button 
        onClick={resetErrorBoundary}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', background: 'var(--accent)', color: 'white',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
        }}
      >
        <RefreshCw size={16} /> Reload Canvas
      </button>
    </div>
  );
}

export default function ErrorBoundary({ children, onReset }) {
  return (
    <ReactErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={onReset}
    >
      {children}
    </ReactErrorBoundary>
  );
}
