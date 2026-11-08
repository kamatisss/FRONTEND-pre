import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/*
 * A map to pin an exact spot (the customer's house): tap the map or drag the pin.
 *   center: { lat, lng, zoom } — where to look (the chosen barangay / town); the view moves when it changes
 *   value:  { lat, lng } | null — the pin (none until the customer places it)
 *   onChange({ lat, lng }) — the customer moved the pin
 *   markers: [{ lat, lng, color?, label?, number?, onClick? }] — extra read-only pins (staff maps)
 *   path: [{ lat, lng }] — a dashed line through the pins (the suggested stop order)
 *   circles: [{ lat, lng, radius (px), color?, label? }] — proportional symbols (Reports: per town)
 *   me: { lat, lng, accuracy } — the phone's live position (blue dot + accuracy circle)
 *   fit: 'always' (frame the markers whenever they change) | 'once' (live maps that refresh)
 * Map data © OpenStreetMap contributors (attribution shown on the map, as their licence requires).
 */
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// A pin; with a number (stop order) the number sits in the head instead of the white dot
const pinIcon = (color = '#059669', number = null) => L.divIcon({
  className: '',
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M15 41s13-14.1 13-25A13 13 0 0 0 2 16c0 10.9 13 25 13 25z" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
    ${number == null ? '<circle cx="15" cy="16" r="5" fill="#ffffff"/>'
    : `<circle cx="15" cy="16" r="8.5" fill="#ffffff"/><text x="15" y="20.5" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="12" font-weight="800" fill="${color}">${Number(number)}</text>`}</svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 41],
  popupAnchor: [0, -36],
});

export default function PinMap({ center, value, onChange, height = 260, readOnly = false, markers = null, path = null,
  circles = null, me = null, fit = 'always', ariaLabel = 'Map' }) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const pinRef = useRef(null);
  const layerRef = useRef(null);
  const meRef = useRef(null);       // { dot, ring } — the phone's live position
  const fittedRef = useRef(false);  // fit='once': frame the markers the first time only
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Create the map once
  useEffect(() => {
    const map = L.map(boxRef.current, {
      center: [center?.lat ?? 13.95, center?.lng ?? 121.95],
      zoom: center?.zoom ?? 9,
      scrollWheelZoom: false,          // the page keeps scrolling past the map; zoom with the buttons or pinch
      attributionControl: true,
    });
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    if (!readOnly) {
      map.on('click', (e) => onChangeRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }
    mapRef.current = map;
    // Inside modals and tabs the box can be sized after the map: keep the tiles filling it
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(boxRef.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; pinRef.current = null; meRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- created once; props are applied below

  // Look at the chosen barangay / town
  useEffect(() => {
    const map = mapRef.current;
    if (map && center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      map.setView([center.lat, center.lng], center.zoom ?? map.getZoom(), { animate: true });
    }
  }, [center?.lat, center?.lng, center?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // The customer's pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const has = value && Number.isFinite(value.lat) && Number.isFinite(value.lng);
    if (!has) {
      if (pinRef.current) { pinRef.current.remove(); pinRef.current = null; }
      return;
    }
    if (!pinRef.current) {
      pinRef.current = L.marker([value.lat, value.lng], { icon: pinIcon(), draggable: !readOnly, keyboard: !readOnly,
        title: readOnly ? 'Location' : 'Drag to your exact spot' }).addTo(map);
      pinRef.current.on('dragend', (e) => {
        const p = e.target.getLatLng();
        onChangeRef.current?.({ lat: p.lat, lng: p.lng });
      });
    } else {
      pinRef.current.setLatLng([value.lat, value.lng]);
    }
  }, [value?.lat, value?.lng, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Extra read-only markers (e.g. a crew member's stops), fitted into view
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer || !markers) return;
    layer.clearLayers();
    const pts = markers.filter(m => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    // The suggested order as a dashed line under the pins
    const line = (path || []).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (line.length > 1) {
      L.polyline(line.map(p => [p.lat, p.lng]), { color: '#0f172a', weight: 3, opacity: 0.55, dashArray: '6 8' }).addTo(layer);
    }
    pts.forEach(m => {
      const mk = L.marker([m.lat, m.lng], { icon: pinIcon(m.color, m.number), title: m.label || '' });
      if (m.label) mk.bindTooltip(m.label, { direction: 'top', offset: [0, -34] });
      if (m.onClick) mk.on('click', m.onClick);
      mk.addTo(layer);
    });
    if (fit === 'once' && fittedRef.current) return;   // live maps refresh: don't yank the view each time
    if (pts.length) fittedRef.current = true;
    if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 15);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 15 });
  }, [markers, path]); // eslint-disable-line react-hooks/exhaustive-deps -- fit is a setting, not data

  // The phone's live position: a blue dot and its accuracy circle (kept apart from the pins)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ok = me && Number.isFinite(me.lat) && Number.isFinite(me.lng);
    if (!ok) {
      if (meRef.current) { meRef.current.dot.remove(); meRef.current.ring.remove(); meRef.current = null; }
      return;
    }
    const ll = [me.lat, me.lng], radius = Math.max(5, Math.min(me.accuracy || 0, 500));
    if (!meRef.current) {
      meRef.current = {
        ring: L.circle(ll, { radius, color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12, interactive: false }).addTo(map),
        dot: L.circleMarker(ll, { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
          .bindTooltip('You', { direction: 'top' }).addTo(map),
      };
    } else {
      meRef.current.dot.setLatLng(ll);
      meRef.current.ring.setLatLng(ll).setRadius(radius);
    }
  }, [me?.lat, me?.lng, me?.accuracy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Proportional circles (a value per place, e.g. orders per town), fitted into view
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer || !circles) return;
    layer.clearLayers();
    const pts = circles.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));
    pts.forEach(c => {
      const mk = L.circleMarker([c.lat, c.lng], { radius: c.radius, color: '#ffffff', weight: 2, fillColor: c.color || '#059669', fillOpacity: 0.7 });
      if (c.label) mk.bindTooltip(c.label, { direction: 'top' });
      mk.addTo(layer);
    });
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 12 });
    else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 12);
  }, [circles]);

  return (
    <div ref={boxRef} role="application" aria-label={ariaLabel}
      style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', zIndex: 0, position: 'relative' }} />
  );
}
