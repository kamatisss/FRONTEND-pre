// TEMPORARY preview page for checking designs (delete after use)
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import ThreeGardenCanvas from './components/ThreeGardenCanvas';
import './index.css';
function App() {
  const q = new URLSearchParams(location.search);
  const [d, setD] = useState(null);
  useEffect(() => { fetch('/zz-designs.json?' + Date.now()).then(r => r.json()).then(all => setD(all[q.get('k') || 'm'][Number(q.get('i') || 0)])); }, []);
  if (!d) return null;
  return <div style={{ width: Number(q.get('w') || 1200) }}>
    <ThreeGardenCanvas plants={d.plants} gardenPlan={d.garden_plan} groundcover={d.groundcover} lotWidth={d.w} lotLength={d.l}
      height={Number(q.get('h') || 700)} growthStage={q.get('stage') || undefined} lawnLook={q.get('look') || undefined} />
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
