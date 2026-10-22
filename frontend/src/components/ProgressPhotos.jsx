import React, { useEffect, useState } from 'react';
import { Camera, Trash2, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { listProgressPhotos, uploadProgressPhoto, deleteProgressPhoto } from '../services/api';

const PHASES = [
  { key: 'BEFORE', label: 'Before', hint: 'Site as you found it' },
  { key: 'DURING', label: 'During', hint: 'Work in progress' },
  { key: 'AFTER',  label: 'After',  hint: 'Finished garden' },
];

/**
 * Before / during / after site photos for one booking (field crew).
 * These feed the Project Hub portfolio once the job is signed off.
 * Photos are re-encoded on the server, which strips the phone's GPS metadata.
 */
export default function ProgressPhotos({ booking, user, toast, canUpload = true, onUploaded }) {
  const [open,     setOpen]     = useState(false);
  const [photos,   setPhotos]   = useState(null);
  const [phase,    setPhase]    = useState(booking.status === 'Installing' ? 'DURING' : 'BEFORE');
  const [file,     setFile]     = useState(null);
  const [note,     setNote]     = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const [inputKey, setInputKey] = useState(0);

  useEffect(() => {
    if (!open || photos !== null) return;
    listProgressPhotos(booking.id).then(setPhotos).catch(e => { setPhotos([]); setError(e.message); });
  }, [open]);

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const created = await uploadProgressPhoto(booking.id, { file, phase, description: note.trim() });
      setPhotos(prev => [created, ...(prev || [])]);
      setFile(null);
      setNote('');
      setInputKey(k => k + 1);
      toast && toast(`${PHASES.find(p => p.key === phase).label} photo saved.`);
      onUploaded && onUploaded();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const handleDelete = async (photo) => {
    if (!window.confirm('Delete this photo?')) return;
    try {
      await deleteProgressPhoto(booking.id, photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      onUploaded && onUploaded();
    } catch (e) {
      toast ? toast(e.message, 'error') : setError(e.message);
    }
  };

  const counts = Object.fromEntries(PHASES.map(p => [p.key, (photos || []).filter(x => x.construction_phase === p.key).length]));

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[48px] flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 cursor-pointer border-none text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Camera size={15} className="text-emerald-600" /> Site photos
          {photos && photos.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{photos.length}</span>
          )}
        </span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
          {canUpload && (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-1.5">
                {PHASES.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPhase(p.key)}
                    title={p.hint}
                    className={`min-h-[44px] rounded-lg text-sm font-bold border cursor-pointer transition-colors
                      ${phase === p.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}
                  >
                    {p.label}{photos ? ` · ${counts[p.key]}` : ''}
                  </button>
                ))}
              </div>
              <input
                key={inputKey}
                type="file"
                accept="image/*"
                capture="environment"
                disabled={busy}
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-slate-600 px-2 py-2.5 border border-slate-200 rounded-lg bg-white cursor-pointer"
              />
              <input
                type="text"
                value={note}
                maxLength={500}
                onChange={e => setNote(e.target.value)}
                placeholder="Short note (optional), e.g. 'Front lawn after sod laying'"
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-lg bg-white"
              />
              <button
                onClick={handleUpload}
                disabled={busy || !file}
                className="flex items-center justify-center gap-2 w-full min-h-[48px] bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-lg border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload size={13} /> {busy ? 'Uploading…' : `Upload ${PHASES.find(p => p.key === phase).label} Photo`}
              </button>
              <p className="text-xs text-slate-500 m-0 leading-relaxed">
                Shoot the garden, not people or plate numbers. Location data is removed from the photo automatically.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-700 font-semibold m-0" role="alert">{error}</p>}

          {photos === null ? (
            <p className="text-xs text-slate-400 m-0">Loading photos…</p>
          ) : photos.length === 0 ? (
            <p className="text-xs text-slate-400 m-0">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map(p => (
                <div key={p.id} className="relative rounded-lg overflow-hidden border border-slate-200 bg-white">
                  <a href={p.file_url} target="_blank" rel="noopener noreferrer">
                    <img src={p.file_url} alt={p.description || p.phase_display} className="w-full h-20 object-cover block" loading="lazy" />
                  </a>
                  <span className="absolute top-1 left-1 text-[9px] font-black uppercase tracking-wide bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {p.phase_display}
                  </span>
                  {canUpload && String(p.uploader) === String(user?.user_id) && (
                    <button
                      onClick={() => handleDelete(p)}
                      title="Delete photo"
                      className="absolute top-1 right-1 p-1 bg-white/90 hover:bg-red-50 text-red-500 rounded border-none cursor-pointer"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
