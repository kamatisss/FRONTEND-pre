import { useEffect } from 'react';
import { useDesign } from '../context/DesignContext';
import { Check, X, Move, MousePointerClick, CornerDownLeft } from 'lucide-react';

/**
 * PlacementControls — floating overlay with Confirm / Cancel buttons.
 * Positioned at bottom-center of the canvas container.
 */
export default function PlacementControls() {
  const { state, dispatch } = useDesign();
  const { placementMode, previewObject, previewValid } = state;

  const isEditing = placementMode === 'editing';
  const assetName = previewObject?.name || 'Object';
  const assetPrice = previewObject?.price || 0;

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Enter' && previewValid) {
        e.preventDefault();
        dispatch({ type: 'CONFIRM_PLACEMENT' });
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'CANCEL_PLACEMENT' });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch, previewValid]);

  if (placementMode === 'idle' || !previewObject) return null;

  return (
    <div className="placement-controls" id="placement-controls">
      {/* Header */}
      <div className="placement-header">
        <Move size={16} className="placement-icon" />
        <span className="placement-mode-label">
          {isEditing ? 'Editing Position' : 'Placement Mode'}
        </span>
      </div>

      {/* Asset info */}
      <div className="placement-info">
        <span className="placement-asset-name">{assetName}</span>
        {assetPrice > 0 && (
          <span className="placement-asset-price">₱{assetPrice.toLocaleString()}</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="placement-actions">
        <button
          className="placement-confirm-btn"
          onClick={() => dispatch({ type: 'CONFIRM_PLACEMENT' })}
          disabled={!previewValid}
          title="Confirm placement (Enter)"
        >
          <Check size={16} />
          <span>Confirm</span>
        </button>

        <button
          className="placement-cancel-btn"
          onClick={() => dispatch({ type: 'CANCEL_PLACEMENT' })}
          title="Cancel placement (Esc)"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>
      </div>

      {/* Hint */}
      <div className="placement-hint">
        <MousePointerClick size={12} />
        <span>Move mouse to position</span>
        <span className="placement-hint-separator">·</span>
        <CornerDownLeft size={12} />
        <span>Enter to confirm</span>
      </div>
    </div>
  );
}
