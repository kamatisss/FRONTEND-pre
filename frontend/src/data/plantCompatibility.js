/**
 * Botanical compatibility check for the customer's preferred plants (AI Garden Designer).
 * Soft warnings only: the customer can still generate. The backend layout engine enforces the matching
 * separation (layout_engine.companion_gap), so every tip here is something the layout really does.
 * Mirrors BACKEND/apps/library/compatibility.py — keep the two (and these numbers) in sync.
 */
export const HYDROZONE_GAP = 1.0;     // m extra between low- and high-water plants
export const ROOT_BARRIER_GAP = 1.0;  // m extra around an aggressive spreader
export const CANOPY_GAP = 0.5;        // m extra between tall canopy and low sun-lovers
const CANOPY_HEIGHT = 3.0;
const GROUNDCOVER_HEIGHT = 0.6;

export function evaluatePlantCompatibility(selectedPlants = []) {
  if (!selectedPlants || selectedPlants.length < 2) {
    return [];
  }

  const warnings = [];

  // Normalize plant items
  const plants = selectedPlants.map(p => ({
    id: String(p.id),
    name: p.name || 'Plant',
    sunlight: p.sunlight || 'full_sun',
    water_need: p.water_need || 'moderate',
    is_invasive: Boolean(p.is_invasive),
    // Fully grown when known (as the backend): shade and root conflicts are about the plant it becomes
    height: Number(p.mature_height) || Number(p.real_world_size) || Number(p.height) || 1.0,
  }));

  // 1. Soil Moisture & Irrigation Mismatch (Low vs High)
  const lowWater = plants.filter(p => p.water_need === 'low');
  const highWater = plants.filter(p => p.water_need === 'high');

  if (lowWater.length > 0 && highWater.length > 0) {
    const lowNames = lowWater.map(p => p.name).slice(0, 3).join(', ');
    const highNames = highWater.map(p => p.name).slice(0, 3).join(', ');
    warnings.push({
      id: 'moisture_conflict',
      type: 'water',
      severity: 'warning',
      icon: '💧',
      title: 'Soil Moisture & Irrigation Mismatch',
      message: `Drought-tolerant flora (${lowNames}) and moisture-loving tropicals (${highNames}) require conflicting watering schedules. In shared beds, low-water species risk root rot.`,
      affectedPlants: [...lowWater, ...highWater].map(p => p.name),
      recommendation: `The layout keeps them in separate watering zones (at least ${HYDROZONE_GAP} m of extra soil apart). Plant the drought-tolerant ones in raised, gravelly or sandy beds that drain fast.`,
    });
  }

  // 2. Sunlight Exposure Conflict (Full Sun vs Full Shade)
  const fullSun = plants.filter(p => p.sunlight === 'full_sun');
  const fullShade = plants.filter(p => p.sunlight === 'full_shade');

  if (fullSun.length > 0 && fullShade.length > 0) {
    const sunNames = fullSun.map(p => p.name).slice(0, 3).join(', ');
    const shadeNames = fullShade.map(p => p.name).slice(0, 3).join(', ');
    warnings.push({
      id: 'sunlight_conflict',
      type: 'sunlight',
      severity: 'warning',
      icon: '☀️',
      title: 'Sunlight Exposure Conflict',
      message: `Full-sun species (${sunNames}) require direct sunlight, while shade species (${shadeNames}) suffer leaf scorch under intense midday sun.`,
      affectedPlants: [...fullSun, ...fullShade].map(p => p.name),
      recommendation: 'The layout tucks the shade plants beside taller plants and keeps the open beds for sun-lovers. On site, a wall or tree that blocks the afternoon (west) sun is the best spot for them.',
    });
  }

  // 3. Invasive Root Competition (e.g. Bamboo)
  const invasive = plants.filter(p => p.is_invasive);
  const beddingCompanions = plants.filter(p => !p.is_invasive);

  if (invasive.length > 0 && beddingCompanions.length > 0) {
    const invNames = invasive.map(p => p.name).slice(0, 2).join(', ');
    const compNames = beddingCompanions.map(p => p.name).slice(0, 3).join(', ');
    warnings.push({
      id: 'invasive_roots',
      type: 'roots',
      severity: 'advisory',
      icon: '🎋',
      title: 'Aggressive Root Competition',
      message: `Aggressive rhizome spreaders (${invNames}) can overtake the roots of companion plants (${compNames}) in shared soil.`,
      affectedPlants: [...invasive, ...beddingCompanions].map(p => p.name),
      recommendation: `The layout leaves at least ${ROOT_BARRIER_GAP} m around the spreader. For installation we recommend a 60 cm deep HDPE root barrier around it.`,
    });
  }

  // 4. Overhead Canopy Shading
  const canopy = plants.filter(p => p.height >= CANOPY_HEIGHT);
  const sunGroundcovers = plants.filter(p => p.height <= GROUNDCOVER_HEIGHT && p.sunlight === 'full_sun');

  if (canopy.length > 0 && sunGroundcovers.length > 0) {
    const canopyNames = canopy.map(p => p.name).slice(0, 2).join(', ');
    const groundNames = sunGroundcovers.map(p => p.name).slice(0, 2).join(', ');
    warnings.push({
      id: 'canopy_shading',
      type: 'canopy',
      severity: 'advisory',
      icon: '🌳',
      title: 'Overhead Canopy Shading',
      message: `Tall broadleaf specimens (${canopyNames}) create dense shadow cones that will suppress flowering on sun-loving groundcovers (${groundNames}) if placed beneath them.`,
      affectedPlants: [...canopy, ...sunGroundcovers].map(p => p.name),
      recommendation: `The layout puts tall plants at the back and keeps low sun-lovers at least ${CANOPY_GAP} m beyond their normal spacing, in the open front border.`,
    });
  }

  return warnings;
}

export function formatSunlightBadge(sunlight) {
  switch (sunlight) {
    case 'full_sun': return { label: 'Full Sun', icon: '☀️', color: '#D97706', bg: '#FEF3C7' };
    case 'partial_shade': return { label: 'Partial Shade', icon: '⛅', color: '#059669', bg: '#D1FAE5' };
    case 'full_shade': return { label: 'Full Shade', icon: '☁️', color: '#4B5563', bg: '#F3F4F6' };
    default: return { label: 'Full Sun', icon: '☀️', color: '#D97706', bg: '#FEF3C7' };
  }
}

export function formatWaterBadge(water) {
  switch (water) {
    case 'low': return { label: 'Low Water', icon: '💧', color: '#B45309', bg: '#FEF3C7' };
    case 'moderate': return { label: 'Moderate Water', icon: '💧💧', color: '#0284C7', bg: '#E0F2FE' };
    case 'high': return { label: 'High Moisture', icon: '💧💧💧', color: '#2563EB', bg: '#DBEAFE' };
    default: return { label: 'Moderate Water', icon: '💧💧', color: '#0284C7', bg: '#E0F2FE' };
  }
}
