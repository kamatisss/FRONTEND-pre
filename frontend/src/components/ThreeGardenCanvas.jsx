import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Catalog models are Meshopt-compressed (see scripts/optimize-models.md); drei's useGLTF enables this by default
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { realScale, stageSize, stageSpread, widthFit, DEFAULT_GROWTH_STAGE } from '../data/modelSizing';
import PlantHeightCard from './PlantHeightCard';
import { getInventoryItems } from '../services/api';
import { resolveModelUrl } from '../data/modelCatalog';
import { defaultPins, normalizePins, pinLabels, solvePhotoPose, suggestLength } from '../data/photoPose';
import { exactBounds } from '../services/modelBounds';
import { plantOut } from '../data/plantedModel';
import { rigGrowth, rigBounds, growsByParts, growthNote } from '../data/plantGrowth';
import { RotateCw, Trash2, Replace } from 'lucide-react';

const TOOL_BTN = (fg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 40, padding: '0 12px', borderRadius: 999, border: 'none',
  background: 'transparent', color: fg, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
});
const FIT_WARN = 0.025;   // pins further than this (share of the photo) from a W × L rectangle: say so
const EYE_LEVEL = [0.8, 2.6];   // m: a photo taken standing in the yard; outside this the pins or width are likely off

// height: canvas height in px. enableZoom / enablePan / autoRotate tune the orbit controls
// (the landing hero turns zoom off so the mouse wheel keeps scrolling the page).
// active=false pauses rendering, e.g. while the canvas is scrolled out of view.
// lite: lighter rendering for phones (lower pixel ratio, smaller shadow map).
// timeOfDay: hour 5–21 drives the sun (position, colour, sky) and, after dusk, warm garden
// lights along the lot edge. null (the default) keeps the fixed daylight every other screen uses.
//
// Photo overlay (arMode with backgroundImageUrl): the photo is shown at its own shape and colours
// (the browser draws it; the 3D scene is transparent on top), and the camera is the one that took
// the photo, solved from photoCorners (data/photoPose.js): { pins, mode, focal35 } — the back corners
// plus a point on each side edge (mode 'edges', the usual photo), or all four corners ('corners').
// A bare array of four corners (older saved designs) also works. Without pins a typical "standing at
// the front" guess is used. The camera is fixed: moving it would break the match with the photo.
// editCorners shows draggable pins (onCornersChange gets the new pin array); onPoseStatus({ ok,
// reason, fitError, cameraHeight, heightWarn, ... }) reports whether the pins make sense.
//
// gardenPlan: the design's beds and open lawn from the layout engine ({ lawn, entry, beds }, see
// layout_engine.GardenPlan.to_dict). The 3D view draws the beds as mulch and the lawn as grass; the
// photo overlay doesn't (the real ground is in the photo).
export default function ThreeGardenCanvas({
  plants, lotWidth, lotLength, backgroundImageUrl, arMode = false, arGrid = false, gardenPlan = null,
  photoCorners = null, editCorners = false, onCornersChange, onPoseStatus,
  photoTone = null, readOnly = false, preserveDrawingBuffer = false,
  height = 450, enableZoom = true, enablePan = true, autoRotate = false, active = true,
  lite = false, timeOfDay = null,
  editable = false, onPlantsChange, showHeights = editable, growthStage = DEFAULT_GROWTH_STAGE,
  notesByUid = null, onSwapRequest = null, focus = null, previewMoves = null,
}) {
  const canvasRef = useRef(null);
  const aiPlantsGroupRef = useRef(null);
  const ambientLightRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const arPhoto = arMode && !!backgroundImageUrl;
  const [measured, setMeasured] = useState(null);        // { url, w, h }: the photo's own pixel size (its shape)
  const [wrapWidth, setWrapWidth] = useState(0);
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const poseRef = useRef({ corners: null, photoSize: null, lot: [lotWidth, lotLength], onStatus: null });
  const applyPoseRef = useRef(() => {});
  // The ground grid and lot outline are shown/hidden, not rebuilt: rebuilding the scene would drop the plants
  const arGridRef = useRef(arGrid);
  const gridObjectsRef = useRef([]);
  const placePlantsRef = useRef(() => {});
  const placedRef = useRef({});
  const sceneRef = useRef(null);
  const planGroupRef = useRef(null);
  // Editing (AI Designer): plants by key, what is hovered / selected / dragged, the on-canvas markers
  const entriesRef = useRef(new Map());
  const interactRef = useRef({ on: false, edit: false, hoverKey: null, selectedKey: null, dragging: false });
  const [hoverKey, setHoverKey] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const plantsRef = useRef(plants);
  const onChangeRef = useRef(onPlantsChange);
  const stageRef = useRef(growthStage);
  const notesRef = useRef(notesByUid);   // amber rings on items with designer's notes
  const previewRef = useRef(previewMoves);   // Tidy preview: [{ uid, x, z }] where items would go
  const cardRef = useRef(null);
  const toolbarRef = useRef(null);
  const drawPlanRef = useRef(() => {});
  useEffect(() => {
    arGridRef.current = arGrid;
    gridObjectsRef.current.forEach((o) => { o.visible = arGrid; });
  }, [arGrid]);
  const viewRef = useRef({ enableZoom, enablePan, autoRotate, active });
  const lightingRef = useRef(null);       // { scene, sun, ambient, lamps, ... } for time-of-day updates
  const timeOfDayRef = useRef(timeOfDay);
  const liteRef = useRef(lite);

  // Orbit options + pause state change without rebuilding the scene
  useEffect(() => {
    viewRef.current = { enableZoom, enablePan, autoRotate, active };
    const controls = controlsRef.current;
    if (!controls) return;
    controls.enableZoom = enableZoom;
    if (!arMode) controls.enablePan = enablePan;
    controls.autoRotate = autoRotate;
  }, [enableZoom, enablePan, autoRotate, active, arMode]);

  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    let isMounted = true;
    // All categories: AI designs can include garden features (seating, rocks) as well as plants
    getInventoryItems()
      .then(data => {
        if (isMounted) setInventory(data);
      })
      .catch(err => {
        console.error('Error fetching inventory in 3D Canvas:', err);
      });
    return () => { isMounted = false; };
  }, []);

  // The photo's own size, so the frame keeps its shape (no stretching) and the camera maths uses real pixels
  useEffect(() => {
    if (!arPhoto) return undefined;
    let alive = true;
    const img = new Image();
    img.onload = () => { if (alive) setMeasured({ url: backgroundImageUrl, w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = backgroundImageUrl;
    return () => { alive = false; };
  }, [arPhoto, backgroundImageUrl]);
  const photoSize = arPhoto && measured?.url === backgroundImageUrl ? measured : null;

  // Width available for the photo frame
  useEffect(() => {
    const el = wrapRef.current;
    if (!arPhoto || !el) return undefined;
    const ro = new ResizeObserver(() => setWrapWidth(el.clientWidth));
    ro.observe(el);
    setWrapWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [arPhoto]);

  // Effect 3: point the camera where the photo was taken, whenever the pins, photo or lot change
  const setup = normalizePins(photoCorners);
  // The pins as a stable key: callers may pass a new but equal object on every render
  const setupKey = setup ? JSON.stringify(setup) : '';
  // Kept in refs (refreshed after every render, before the other effects) so the scene setup can apply them too
  useLayoutEffect(() => {
    poseRef.current = { corners: setup, photoSize, lot: [lotWidth, lotLength], onStatus: onPoseStatus };
    applyPoseRef.current = () => {
      const camera = cameraRef.current;
      const { corners: given, photoSize: size, lot, onStatus } = poseRef.current;
      if (!camera || !arPhoto || !size) return;
      const pose = solvePhotoPose(given, lot[0], lot[1], size.w, size.h);
      // Four corners must outline a W × L rectangle; side-edge pins can always be met, so instead
      // the camera height is checked (a handheld photo is taken at about eye level)
      const mismatch = pose.ok && given && pose.mode === 'corners' && pose.fitError > FIT_WARN;
      const heightWarn = pose.ok && !!given && pose.mode === 'edges'
        && (pose.cameraHeight < EYE_LEVEL[0] || pose.cameraHeight > EYE_LEVEL[1]);
      onStatus?.({ ok: pose.ok, reason: pose.reason, mode: pose.mode, fitError: pose.fitError, guessed: !given,
        cameraHeight: pose.ok ? pose.cameraHeight : null, heightWarn,
        fitWarn: mismatch, suggestedLength: mismatch ? suggestLength(given.pins, lot[0], size.w, size.h) : null });
      if (!pose.ok) return;   // keep the last good view while a pin is somewhere impossible
      const basis = new THREE.Matrix4().makeBasis(
        new THREE.Vector3(...pose.axes.right), new THREE.Vector3(...pose.axes.up), new THREE.Vector3(...pose.axes.back));
      camera.position.set(...pose.position);
      camera.quaternion.setFromRotationMatrix(basis);
      camera.fov = pose.fovY;
      camera.aspect = size.w / size.h;
      camera.updateProjectionMatrix();
    };
  });
  useEffect(() => { applyPoseRef.current(); }, [setupKey, photoSize, lotWidth, lotLength, arPhoto]);

  // Effect 4: Tint ambient light to approximate the photo's color temperature
  useEffect(() => {
    const light = ambientLightRef.current;
    if (!light) return;
    if (arMode && photoTone) {
      const { r, g, b } = photoTone;
      const blend = 0.28; // gentle tint — mostly neutral, slight photo warmth
      light.color.setRGB(
        1.0 - blend + r * blend,
        1.0 - blend + g * blend,
        1.0 - blend + b * blend,
      );
    } else {
      light.color.set(0xffffff);
    }
  }, [arMode, photoTone]);

  // Effect 5: move the sun / switch the garden lights without rebuilding the scene
  useEffect(() => {
    timeOfDayRef.current = timeOfDay;
    if (lightingRef.current && timeOfDay != null) applyTimeOfDay(lightingRef.current, timeOfDay);
  }, [timeOfDay]);

  // Effect 1: Initialize vanilla Three.js scene environment
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    // Photo overlay: the canvas fills the photo frame; elsewhere it is full width × the height prop
    const sizeOf = () => ({ w: parent.clientWidth, h: arPhoto ? parent.clientHeight : height });
    const width = parent.clientWidth || 800;
    const viewHeight = sizeOf().h || height;

    const pad = 6;
    const currentWidth  = Math.max(Number(lotWidth)  || 10, 1);
    const currentLength = Math.max(Number(lotLength) || 10, 1);
    const gw = currentWidth  + pad;
    const gl = currentLength + pad;
    const cx = currentWidth  / 2;
    const cz = currentLength / 2;

    // 1. Scene
    const scene = new THREE.Scene();
    if (arPhoto) {
      scene.background = null;   // transparent: the photo underneath shows through
    } else if (arMode) {
      // No photo uploaded — pleasant sky gradient fallback
      scene.background = new THREE.Color('#c8e8f4');
    } else {
      scene.background = new THREE.Color('#f8fafc');
    }

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / viewHeight, 0.1, 1000);
    placeOverview(camera, currentWidth, currentLength);   // the photo overlay replaces this with the photo's camera

    // 3. Renderer
    // preserveDrawingBuffer lets callers snapshot the canvas (portfolio 3D renders)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer, alpha: arPhoto });
    if (arPhoto) renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, liteRef.current ? 1.5 : 2));
    renderer.setSize(width, viewHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, arMode ? 0.9 : 0.7);
    ambientLightRef.current = ambientLight; // exposed for Effect 4 colour tinting
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(cx + gw, Math.max(gw, gl) * 1.5, cz - gl);
    dirLight.castShadow = true;
    const shadowSize = liteRef.current ? 1024 : 2048;
    dirLight.shadow.mapSize.width = shadowSize;
    dirLight.shadow.mapSize.height = shadowSize;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = Math.max(gw, gl) * 8;
    const shadowBound = Math.max(gw, gl) * 1.5;
    dirLight.shadow.camera.left   = -shadowBound;
    dirLight.shadow.camera.right  =  shadowBound;
    dirLight.shadow.camera.top    =  shadowBound;
    dirLight.shadow.camera.bottom = -shadowBound;
    dirLight.target.position.set(cx, 0, cz);
    scene.add(dirLight.target);
    scene.add(dirLight);

    // Time-of-day rig (landing hero): warm garden lights along the lot edge, off in daylight
    let lamps = null;
    if (timeOfDayRef.current != null && !arMode) {
      lamps = buildGardenLights(currentWidth, currentLength);
      scene.add(lamps.group);
      lightingRef.current = { scene, sun: dirLight, ambient: ambientLight, lamps, cx, cz, reach: Math.max(gw, gl) * 1.5 };
      applyTimeOfDay(lightingRef.current, timeOfDayRef.current);
    }

    // 5. Ground plane
    const groundGeo = new THREE.PlaneGeometry(gw, gl);
    groundGeo.rotateX(-Math.PI / 2);
    let groundMat;
    if (arMode) {
      // Shadow-only ground: transparent plane that only shows plant shadows over the photo
      groundMat = new THREE.ShadowMaterial({ opacity: 0.28, transparent: true });
    } else {
      groundMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#2d6a4f'),
        roughness: 0.75,
        metalness: 0.0,
      });
    }
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(cx, 0.0, cz);
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid — only in 3D mode
    let gridHelper = null;
    if (!arMode) {
      const gridSpan = Math.max(gw, gl);
      const gridDivs = Math.round(gridSpan);
      gridHelper = new THREE.GridHelper(gridSpan, gridDivs, 0xffffff, 0xffffff);
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.25;
      gridHelper.scale.set(gw / gridSpan, 1, gl / gridSpan);
      gridHelper.position.set(cx, 0.001, cz);
      scene.add(gridHelper);
    }

    // AR spatial grid — subtle ground reference overlay in Photo Overlay mode
    let arGridHelper = null;
    if (arMode) {
      const gridSpan = arPhoto ? Math.max(currentWidth, currentLength) : Math.max(gw, gl);
      const gridDivs = Math.max(1, Math.round(gridSpan));
      arGridHelper = new THREE.GridHelper(gridSpan, gridDivs, 0xffffff, 0xffffff);
      // GridHelper has a material array [center-line mat, grid-line mat] — patch both
      const mats = Array.isArray(arGridHelper.material)
        ? arGridHelper.material
        : [arGridHelper.material];
      mats.forEach(m => {
        m.transparent = true;
        m.opacity = 0.3;
        m.depthWrite = false;
      });
      arGridHelper.scale.set((arPhoto ? currentWidth : gw) / gridSpan, 1, (arPhoto ? currentLength : gl) / gridSpan);
      arGridHelper.position.set(cx, 0.002, cz);
      scene.add(arGridHelper);
    }
    // The lot's edge on the photo: what the four pins are lining up
    let lotOutline = null;
    if (arPhoto) {
      const pts = [[0, 0], [currentWidth, 0], [currentWidth, currentLength], [0, currentLength]]
        .map(([x, z]) => new THREE.Vector3(x, 0.01, z));
      lotOutline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.95, depthWrite: false }));
      scene.add(lotOutline);
    }
    gridObjectsRef.current = [arGridHelper, lotOutline].filter(Boolean);
    gridObjectsRef.current.forEach((o) => { o.visible = arGridRef.current; });

    // 6. Empty group for AI plants
    const aiGroup = new THREE.Group();
    scene.add(aiGroup);
    aiPlantsGroupRef.current = aiGroup;
    placePlantsRef.current();   // a rebuilt scene starts empty: put the plants back
    sceneRef.current = scene;
    planGroupRef.current = null;
    drawPlanRef.current();      // and the beds and lawn

    // 7. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(cx, 0, cz);
    if (arPhoto) {
      controls.enabled = false;   // the photo's camera is fixed: moving it would break the match
    } else if (arMode) {
      // No photo: a gentle, limited orbit over the sky backdrop
      controls.minPolarAngle = Math.PI / 4;
      controls.maxPolarAngle = Math.PI / 2.2;
      controls.minAzimuthAngle = -Math.PI / 5;
      controls.maxAzimuthAngle = Math.PI / 5;
      controls.enablePan = false;
    } else {
      controls.enablePan = viewRef.current.enablePan;
    }
    controls.enableZoom = viewRef.current.enableZoom;
    controls.autoRotate = viewRef.current.autoRotate;
    controls.autoRotateSpeed = 0.6;
    controls.update();
    // Store refs so Effect 3 and Effect 4 can update camera/light without reinit
    cameraRef.current   = camera;
    controlsRef.current = controls;
    applyPoseRef.current();

    // 7b. Editing: hover (mouse) shows the height card; click or tap selects; drag moves a plant on
    // the ground, kept inside the lot. Mouse: drag any plant straight away. Touch: the first tap
    // selects, then dragging the selected plant moves it, so a finger that starts on a plant can still
    // turn the view. Runs in the capture phase so the orbit controls never see a plant drag.
    const markers = buildMarkers();
    scene.add(markers.group);
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const groundHit = new THREE.Vector3();
    const st = interactRef.current;
    const entries = entriesRef.current;
    let down = null;   // { x, y, id, key, drag: { e, dx, dz } | null, moved }
    const aim = (ev) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
    };
    const setHover = (key) => {
      if (st.hoverKey === key) return;
      st.hoverKey = key;
      setHoverKey(key);
    };
    const select = (key) => {
      st.selectedKey = key;
      setSelectedKey(key);
    };
    const releaseOrbit = () => { controls.enabled = !arPhoto; };
    const onDown = (ev) => {
      if (!st.on || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      aim(ev);
      const hit = pickEntry(ray, entriesRef.current);
      down = { x: ev.clientX, y: ev.clientY, id: ev.pointerId, key: hit?.key ?? null, drag: null, moved: false };
      const grab = hit && st.edit && (ev.pointerType === 'mouse' || hit.key === st.selectedKey);
      if (!grab || !ray.ray.intersectPlane(groundPlane, groundHit)) return;
      const p = hit.live || hit.plant;
      down.drag = { e: hit, dx: Number(p.x) - groundHit.x, dz: Number(p.z) - groundHit.z };
      controls.enabled = false;   // checked by the orbit controls' own pointerdown, which runs next
      canvas.setPointerCapture?.(ev.pointerId);
      ev.preventDefault();
    };
    const onMove = (ev) => {
      if (!st.on) return;
      if (down?.drag && ev.pointerId === down.id) {
        if (!down.moved && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 4) return;
        down.moved = true;
        st.dragging = true;
        canvas.style.cursor = 'grabbing';
        aim(ev);
        if (!ray.ray.intersectPlane(groundPlane, groundHit)) return;
        const inset = 0.1;
        const e = down.drag.e;
        e.live = {
          x: Math.min(currentWidth - inset, Math.max(inset, groundHit.x + down.drag.dx)),
          z: Math.min(currentLength - inset, Math.max(inset, groundHit.z + down.drag.dz)),
        };
        poseEntry(e, stageRef.current);
        return;
      }
      if (down || ev.pointerType !== 'mouse') return;   // hover is for a mouse that isn't pressed
      aim(ev);
      const hit = pickEntry(ray, entriesRef.current);
      setHover(hit?.key ?? null);
      canvas.style.cursor = hit ? (st.edit ? 'grab' : 'pointer') : '';
    };
    const onUp = (ev) => {
      if (!down || ev.pointerId !== down.id) return;
      const d = down;
      down = null;
      st.dragging = false;
      if (d.drag) {
        releaseOrbit();
        canvas.releasePointerCapture?.(ev.pointerId);
        canvas.style.cursor = ev.pointerType === 'mouse' ? 'grab' : '';
      }
      if (d.drag && d.moved && d.drag.e.live) {
        // Hand the new spot back; the plant stays where it was dropped until the new list arrives
        const { e } = d.drag;
        const x = Math.round(e.live.x * 100) / 100, z = Math.round(e.live.z * 100) / 100;
        const list = plantsRef.current || [];
        select(e.key);
        onChangeRef.current?.(list.map((p, i) => (plantKey(p, i) === e.key ? { ...p, x, z } : p)), { type: 'move', key: e.key });
        return;
      }
      // A tap or click (not a camera drag): select what is under it, or let go on empty ground
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 6) select(d.key);
    };
    const onLeave = () => { if (!down) { setHover(null); canvas.style.cursor = ''; } };
    const onCancel = (ev) => {
      if (!down || ev.pointerId !== down.id) return;
      if (down.drag) { down.drag.e.live = null; poseEntry(down.drag.e, stageRef.current); releaseOrbit(); }
      down = null;
      st.dragging = false;
    };
    canvas.addEventListener('pointerdown', onDown, { capture: true });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);

    // Every frame: rings, measuring line, and the HTML card / buttons over the 3D point they belong to
    const proj = new THREE.Vector3();
    const toScreen = (x, y, z) => {
      proj.set(x, y, z).project(camera);
      if (proj.z > 1 || proj.z < -1) return null;
      return { x: ((proj.x + 1) / 2) * canvas.clientWidth, y: ((1 - proj.y) / 2) * canvas.clientHeight };
    };
    const updateOverlay = () => {
      const entries = entriesRef.current;
      const sel = st.on && st.selectedKey ? entries.get(st.selectedKey) : null;
      const hov = st.on && st.hoverKey ? entries.get(st.hoverKey) : null;
      const ring = (m, e) => {
        m.visible = !!e;
        if (!e) return;
        const p = e.node.position;
        const r = e.loaded && e.footNow ? e.footNow : e.foot;
        m.position.set(p.x, 0.03, p.z);
        m.scale.setScalar(Math.max(0.4, r));
      };
      // Items with designer's notes: an amber ring each (pooled, so nothing is created per frame)
      const notes = st.on ? notesRef.current : null;
      let w = 0;
      if (notes) {
        entries.forEach((e) => {
          if (!e.plant.uid || !notes[e.plant.uid]?.length || e.dead || e.plant.is_existing) return;
          const m = markers.warnRing(w++);
          ring(m, e);
          m.scale.multiplyScalar(1.12);
        });
      }
      markers.hideWarnFrom(w);
      // Tidy preview: a blue ring where each item would go, a dashed line from where it is now
      const moves = previewRef.current;
      let m = 0;
      if (moves?.length) {
        const byUid = new Map();
        entries.forEach((e) => { if (e.plant.uid && !e.dead) byUid.set(e.plant.uid, e); });
        moves.forEach((mv) => {
          const e = byUid.get(mv.uid);
          if (!e) return;
          const { ring: pr, line } = markers.preview(m++);
          ring(pr, e);
          pr.position.set(mv.x, 0.04, mv.z);
          const pos = line.geometry.attributes.position;
          pos.setXYZ(0, e.node.position.x, 0.06, e.node.position.z);
          pos.setXYZ(1, mv.x, 0.06, mv.z);
          pos.needsUpdate = true;
          line.computeLineDistances();
          line.visible = true;
        });
      }
      markers.hidePreviewFrom(m);
      ring(markers.sel, sel);
      ring(markers.hover, hov && hov !== sel ? hov : null);
      const focus = st.dragging ? null : (hov || sel);
      const h = focus ? entryHeight(focus, stageRef.current) : 0;
      markers.measure.visible = !!focus && h > 0;
      if (markers.measure.visible) {
        markers.measure.position.set(focus.node.position.x, 0, focus.node.position.z);
        markers.line.scale.y = h;
        markers.tickTop.position.y = h;
      }
      // The buttons go first (under the selected item's base); the card then keeps clear of them
      const W = canvas.clientWidth, H = canvas.clientHeight;
      let barBox = null;
      const bar = toolbarRef.current;
      if (bar) {
        const at = sel && !st.dragging && toScreen(sel.node.position.x, 0, sel.node.position.z);
        bar.style.visibility = at ? 'visible' : 'hidden';
        if (at) {
          const bw = bar.offsetWidth, bh = bar.offsetHeight;
          const left = Math.min(W - bw - 4, Math.max(4, at.x - bw / 2));
          const top = Math.min(H - bh - 4, Math.max(4, at.y + 16));
          bar.style.transform = `translate(${left}px, ${top}px)`;
          barBox = { left, top, right: left + bw, bottom: top + bh };
        }
      }
      const card = cardRef.current;
      if (card) {
        const at = focus && toScreen(focus.node.position.x, h || 1, focus.node.position.z);
        card.style.visibility = at ? 'visible' : 'hidden';
        if (at) {
          const cw = card.offsetWidth, ch = card.offsetHeight;
          // Beside the top, hanging down into view; flipped to the left near the right edge
          const left = at.x + 14 + cw > W ? Math.max(4, at.x - 14 - cw) : at.x + 14;
          let top = Math.min(H - ch - 4, Math.max(4, at.y - ch * 0.25));
          // Short plants: top and base are close on screen, so the card would cover the buttons.
          // Lift it clear above them; with no room above, put it just below them instead.
          if (barBox && left < barBox.right && left + cw > barBox.left && top < barBox.bottom + 6 && top + ch > barBox.top - 6) {
            top = barBox.top - 6 - ch >= 4 ? barBox.top - 6 - ch : Math.min(H - ch - 4, barBox.bottom + 6);
          }
          card.style.transform = `translate(${left}px, ${top}px)`;
        }
      }
    };

    // 8. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!viewRef.current.active) return;
      if (!arPhoto) controls.update();   // update() re-aims at the target, which would undo the photo's camera
      updateOverlay();
      renderer.render(scene, camera);
    };
    animate();

    // Follow the container, not just the window: panels open, scrollbars appear and
    // phones rotate without a window resize, which left the canvas at its old width.
    const handleResize = () => {
      const { w, h } = sizeOf();
      if (!w || !h) return;
      if (!arPhoto) {
        camera.aspect = w / h;   // the photo camera's aspect is the photo's own, and the frame matches it
        camera.updateProjectionMatrix();
      }
      renderer.setSize(w, h, false);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(parent);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onDown, { capture: true });
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.style.cursor = '';
      st.dragging = false;
      scene.remove(markers.group);
      markers.dispose();
      entries.forEach(dropEntry);
      entries.clear();
      controls.dispose();
      renderer.dispose();
      ground.geometry.dispose();
      groundMat.dispose();
      if (gridHelper) gridHelper.dispose();
      if (arGridHelper) arGridHelper.dispose();
      if (lotOutline) { lotOutline.geometry.dispose(); lotOutline.material.dispose(); }
      if (lamps) lamps.dispose();
      disposePlanGroup(planGroupRef.current);
      planGroupRef.current = null;
      sceneRef.current = null;
      lightingRef.current = null;
      // Null out refs so Effects 3 & 4 don't touch disposed objects
      cameraRef.current      = null;
      controlsRef.current    = null;
      ambientLightRef.current = null;
    };
  }, [lotWidth, lotLength, arMode, backgroundImageUrl, height, preserveDrawingBuffer]); // eslint-disable-line react-hooks/exhaustive-deps -- arPhoto follows arMode + backgroundImageUrl

  // Beds (mulch) and the open lawn (grass) of the design, drawn on the ground in the 3D view
  useLayoutEffect(() => {
    drawPlanRef.current = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (planGroupRef.current) {
        scene.remove(planGroupRef.current);
        disposePlanGroup(planGroupRef.current);
        planGroupRef.current = null;
      }
      if (arMode || !gardenPlan?.lawn) return;
      const group = buildPlanGroup(gardenPlan, Math.max(Number(lotWidth) || 10, 1), Math.max(Number(lotLength) || 10, 1));
      scene.add(group);
      planGroupRef.current = group;
    };
  });
  useEffect(() => { drawPlanRef.current(); }, [gardenPlan, arMode, lotWidth, lotLength]);

  // Effect 2: Place the plants. Each one is kept by its key (uid from the AI Designer, else its index
  // + plant), so a plant that was moved, turned or regrown is just updated, not reloaded; only new
  // plants load and removed ones are disposed. A rebuilt scene (new size, photo or mode) or a new
  // inventory starts again from an empty group. Refreshed after every render so the scene setup
  // can call it with the latest plants.
  useLayoutEffect(() => {
    placePlantsRef.current = () => {
      const aiGroup = aiPlantsGroupRef.current;
      if (!aiGroup) return;
      const last = placedRef.current;
      if (last.group === aiGroup && last.plants === plants && last.inventory === inventory && last.arMode === arMode) return;
      const rebuild = last.group !== aiGroup || last.inventory !== inventory || last.arMode !== arMode;
      placedRef.current = { group: aiGroup, plants, inventory, arMode };

      const entries = entriesRef.current;
      if (rebuild) { entries.forEach(dropEntry); entries.clear(); }
      const seen = new Set();
      (Array.isArray(plants) ? plants : []).forEach((plant, i) => {
        const key = plantKey(plant, i);
        seen.add(key);
        const old = entries.get(key);
        if (old) { old.plant = plant; old.live = null; poseEntry(old, stageRef.current); return; }
        entries.set(key, createEntry(aiGroup, plant, key, inventory, arMode, () => stageRef.current));
      });
      entries.forEach((e, key) => { if (!seen.has(key)) { dropEntry(e); entries.delete(key); } });

      // The selected or hovered plant was removed
      const st = interactRef.current;
      if (st.selectedKey && !entries.has(st.selectedKey)) { st.selectedKey = null; setSelectedKey(null); }
      if (st.hoverKey && !entries.has(st.hoverKey)) { st.hoverKey = null; setHoverKey(null); }
    };
  });
  useEffect(() => { placePlantsRef.current(); }, [plants, inventory, arMode]);

  useEffect(() => { notesRef.current = notesByUid; }, [notesByUid]);
  useEffect(() => { previewRef.current = previewMoves; }, [previewMoves]);

  // Growth stage: redraw every loaded plant at its planting / 2-year / fully grown height
  useEffect(() => {
    stageRef.current = growthStage;
    entriesRef.current.forEach((e) => poseEntry(e, growthStage));
  }, [growthStage]);

  // Editing on/off (off while the photo pins are being placed)
  const interactive = (editable || showHeights) && !editCorners;
  const canEdit = editable && !editCorners && typeof onPlantsChange === 'function';
  useLayoutEffect(() => {
    plantsRef.current = plants;
    onChangeRef.current = onPlantsChange;
  });
  useEffect(() => {
    interactRef.current.on = interactive;
    interactRef.current.edit = canEdit;   // while off, nothing is drawn or shown for the kept selection
  }, [interactive, canEdit]);

  // Edits go back to the caller as a new plant list (this component never keeps its own copy)
  const editSelected = (change) => {
    const key = interactRef.current.selectedKey;
    const list = plantsRef.current;
    if (!key || !Array.isArray(list)) return;
    const next = change === 'remove'
      ? list.filter((p, i) => plantKey(p, i) !== key)
      : list.map((p, i) => (plantKey(p, i) === key ? { ...p, rotation: ((Number(p.rotation) || 0) + 45) % 360 } : p));
    if (change === 'remove') { interactRef.current.selectedKey = null; setSelectedKey(null); }
    onChangeRef.current?.(next, { type: change, key });
  };
  const editRef = useRef(editSelected);
  useLayoutEffect(() => { editRef.current = editSelected; });

  // Select an item from outside (focus = { uid, n }: a plant just added or swapped), once it is in the list
  useEffect(() => {
    if (!focus?.uid || !canEdit || !Array.isArray(plants)) return;
    const i = plants.findIndex((p) => p.uid === focus.uid);
    if (i < 0) return;
    const key = plantKey(plants[i], i);
    interactRef.current.selectedKey = key;
    setSelectedKey(key);
  }, [focus, plants, canEdit]);

  // Keyboard: Delete removes, R turns, Esc lets go of the selected plant
  useEffect(() => {
    if (!canEdit || !selectedKey) return undefined;
    const onKey = (ev) => {
      const t = ev.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); editRef.current('remove'); }
      else if (ev.key === 'r' || ev.key === 'R') editRef.current('rotate');
      else if (ev.key === 'Escape') { interactRef.current.selectedKey = null; setSelectedKey(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, selectedKey]);

  // The card for the hovered (else selected) item, and the buttons for the selected one
  const focusKey = interactive ? (hoverKey ?? selectedKey) : null;
  const focusIdx = focusKey && Array.isArray(plants) ? plants.findIndex((p, i) => plantKey(p, i) === focusKey) : -1;
  const focusPlant = focusIdx >= 0 && !plants[focusIdx].is_existing ? plants[focusIdx] : null;
  const focusMatch = focusPlant ? findMatch(inventory, String(focusPlant.plant_id).toLowerCase()) : null;
  const focusCat = focusMatch?.category || 'plant';
  const overlay = interactive && (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 4 }}>
      {focusPlant && (
        <div ref={cardRef} style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden' }}>
          <PlantHeightCard name={focusMatch?.name || focusPlant.name || 'Plant'} category={focusCat} stage={growthStage}
            shown={focusMatch ? Number(stageSize(focusMatch, growthStage, focusCat)) || 0 : 0}
            heights={{ planting: Number(focusMatch?.planting_height) || 0, established: Number(focusMatch?.real_world_size) || 0,
              mature: Number(focusMatch?.mature_height) || 0 }}
            notes={(focusPlant.uid && notesByUid?.[focusPlant.uid]) || []}
            growthNote={focusMatch ? growthNote(resolveModelUrl(focusMatch.model_file), growthStage) : ''}
            wide={focusMatch ? stageSpread(focusMatch, growthStage, focusCat) : 0} />
        </div>
      )}
      {canEdit && selectedKey && (
        <div ref={toolbarRef} role="toolbar" aria-label={`${focusMatch?.name || 'Plant'} actions`}
          style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'auto', display: 'flex', gap: 4,
            padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.96)', boxShadow: '0 6px 18px rgba(15,23,42,0.22)',
            border: '1px solid #E2E8F0', fontFamily: "'Inter', system-ui, sans-serif" }}>
          <button type="button" onClick={() => editSelected('rotate')} title="Turn 45° (R)" style={TOOL_BTN('#065F46')}>
            <RotateCw size={15} aria-hidden="true" /> Turn
          </button>
          {onSwapRequest && focusPlant?.uid && (
            <button type="button" onClick={() => onSwapRequest(focusPlant.uid)} title="Swap for a similar plant" style={TOOL_BTN('#1E40AF')}>
              <Replace size={15} aria-hidden="true" /> Swap
            </button>
          )}
          <button type="button" onClick={() => editSelected('remove')} title="Remove (Delete)" style={TOOL_BTN('#B91C1C')}>
            <Trash2 size={15} aria-hidden="true" /> Remove
          </button>
        </div>
      )}
    </div>
  );

  if (!arPhoto) {
    return (
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          className="w-full block focus:outline-none"
          style={{ width: '100%', height: `${height}px`, display: 'block' }}
        />
        {overlay}
      </div>
    );
  }
  // The largest frame with the photo's own shape that fits the space
  const aspect = photoSize ? photoSize.w / photoSize.h : 4 / 3;
  const frameW = Math.max(1, Math.min(wrapWidth || 0, height * aspect));
  const frameH = frameW / aspect;
  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
      <div ref={frameRef} style={{ position: 'relative', width: `${frameW}px`, height: `${frameH}px`,
        backgroundImage: `url("${backgroundImageUrl}")`, backgroundSize: '100% 100%' }}>
        <canvas ref={canvasRef} className="focus:outline-none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
        {overlay}
        {editCorners && (
          <CornerPins frameRef={frameRef} corners={setup?.pins || defaultPins(setup?.mode || 'edges')}
            labels={pinLabels(setup?.mode || 'edges')} onChange={onCornersChange} />
        )}
      </div>
    </div>
  );
}

/* ── Four draggable pins on the yard (photo overlay): corners, or back corners + side edges ── */
function CornerPins({ frameRef, corners, labels, onChange }) {
  const drag = useRef(null);
  const move = (e) => {
    const i = drag.current;
    const box = frameRef.current?.getBoundingClientRect();
    if (i == null || !box) return;
    const u = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const v = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    onChange?.(corners.map((c, k) => (k === i ? { u, v } : c)));
  };
  const points = corners.map(c => `${c.u * 100},${c.v * 100}`).join(' ');
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 5, touchAction: 'none' }}
      onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <polygon points={points} fill="rgba(251,191,36,0.10)" stroke="#fbbf24" strokeWidth="0.5" vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 2 }} strokeDasharray="6 4" />
      </svg>
      {corners.map((c, i) => (
        <button key={labels[i]} type="button" aria-label={`Move the ${labels[i].toLowerCase()} pin`}
          onPointerDown={(e) => { drag.current = i; e.currentTarget.parentElement.setPointerCapture?.(e.pointerId); e.preventDefault(); }}
          style={{ position: 'absolute', left: `${c.u * 100}%`, top: `${c.v * 100}%`, transform: 'translate(-50%, -50%)',
            width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'transparent', padding: 0, cursor: 'grab', touchAction: 'none' }}>
          <span style={{ position: 'absolute', left: '50%', top: '50%', width: 18, height: 18, transform: 'translate(-50%, -50%)', borderRadius: '50%',
            background: '#fbbf24', border: '3px solid #ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
          <span style={{ position: 'absolute', left: '50%', top: c.v > 0.5 ? -14 : 40, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 11, fontWeight: 800, color: '#0f172a', background: 'rgba(251,191,36,0.95)', borderRadius: 4, padding: '1px 6px', pointerEvents: 'none' }}>
            {labels[i]}
          </span>
        </button>
      ))}
    </div>
  );
}


/* ── The overview camera: the whole lot in view at any lot shape and canvas shape ── */
const VIEW_ELEVATION = (35 * Math.PI) / 180;   // looking down at the garden from the house side
const PLANT_ROOM = 3;                          // m of plant height to keep in frame

const FRAME_FILL = 0.9;                        // the lot's farthest corner at 90% of the way to the frame edge

function placeOverview(camera, w, l) {
  const at = (d) => {
    camera.position.set(w / 2, Math.sin(VIEW_ELEVATION) * d, l / 2 + Math.cos(VIEW_ELEVATION) * d);
    camera.lookAt(w / 2, 0, l / 2);
    camera.updateMatrixWorld();
  };
  camera.updateProjectionMatrix();
  const corners = [];
  for (const x of [0, w]) for (const z of [0, l]) for (const y of [0, PLANT_ROOM]) corners.push(new THREE.Vector3(x, y, z));
  const reach = (d) => {   // how far towards the frame edge the lot reaches from distance d (1 = the edge)
    at(d);
    return Math.max(...corners.map(c => {
      if (c.clone().applyMatrix4(camera.matrixWorldInverse).z > -camera.near) return Infinity;   // behind the camera
      const p = c.clone().project(camera);
      return Math.max(Math.abs(p.x), Math.abs(p.y));
    }));
  };
  // Bracket from well outside the bounding sphere's distance in to where the lot just fills the frame
  const vfov = (camera.fov * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  let far = (0.5 * Math.hypot(w, l, PLANT_ROOM)) / Math.sin(Math.min(vfov, hfov) / 2);
  for (let i = 0; i < 8 && reach(far) > FRAME_FILL; i++) far *= 1.5;   // tall-for-its-size lots need more room
  let near = far * 0.3;
  for (let i = 0; i < 24; i++) {
    const mid = (near + far) / 2;
    if (reach(mid) > FRAME_FILL) near = mid; else far = mid;
  }
  at(far);
}


/* ── Garden plan: mulched beds around an open lawn ──────────────────────────── */
const BED_COLOR = '#6b4e37';    // dark mulch
const LAWN_COLOR = '#5b9a45';   // fresh turf, lighter than the surroundings

function buildPlanGroup(plan, w, l) {
  const group = new THREE.Group();
  const flat = (geo, color, y) => {
    geo.rotateX(-Math.PI / 2);   // shape (x, y) → ground (x, 0, -y): shapes below are drawn at (x, -z)
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }));
    mesh.position.y = y;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const beds = new THREE.PlaneGeometry(w, l);
  beds.translate(w / 2, -l / 2, 0);
  flat(beds, BED_COLOR, 0.004);

  const lawn = new THREE.Shape();
  const { lawn: g, entry: e } = plan;
  if (g.shape === 'ellipse') {
    lawn.absellipse(g.cx, -g.cz, g.rx, g.rz, 0, Math.PI * 2, false, 0);
  } else {
    lawn.moveTo(g.x0, -g.z0); lawn.lineTo(g.x1, -g.z0); lawn.lineTo(g.x1, -g.z1); lawn.lineTo(g.x0, -g.z1); lawn.closePath();
  }
  flat(new THREE.ShapeGeometry(lawn, 48), LAWN_COLOR, 0.007);
  if (e) {
    const entry = new THREE.PlaneGeometry(e.x1 - e.x0, e.z1 - e.z0);
    entry.translate((e.x0 + e.x1) / 2, -(e.z0 + e.z1) / 2, 0);
    flat(entry, LAWN_COLOR, 0.007);
  }
  return group;
}

function disposePlanGroup(group) {
  group?.children.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
}


/* ── Time of day (landing hero) ─────────────────────────────────────────────── */
const SKY = { noon: new THREE.Color('#eaf4fb'), golden: new THREE.Color('#fbe3c4'), night: new THREE.Color('#0d1b33') };
const SUN = { noon: new THREE.Color('#fff7ea'), golden: new THREE.Color('#ffa65c'), moon: new THREE.Color('#9db2ff') };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Low path lights along the front and sides of the lot, like a real installed garden
function buildGardenLights(w, l) {
  const group = new THREE.Group();
  const lights = [];
  const posts = [];
  const capGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.32, 10);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#2b2b2b', emissive: new THREE.Color('#ffc477'), emissiveIntensity: 0 });
  const spots = [[0.12, 0.92], [0.5, 0.97], [0.88, 0.92], [0.04, 0.45], [0.96, 0.45]];
  spots.forEach(([fx, fz]) => {
    const x = fx * w;  // the lot spans 0..w × 0..l
    const z = fz * l;
    const post = new THREE.Mesh(capGeo, glowMat);
    post.position.set(x, 0.16, z);
    group.add(post);
    posts.push(post);
    const light = new THREE.PointLight('#ffbf70', 0, Math.max(w, l) * 0.55, 2);
    light.position.set(x, 0.45, z);
    group.add(light);
    lights.push(light);
  });
  return {
    group, lights, posts, glowMat,
    dispose: () => { capGeo.dispose(); glowMat.dispose(); lights.forEach(li => li.dispose()); },
  };
}

function applyTimeOfDay(rig, hour) {
  const { scene, sun, ambient, lamps, cx, cz, reach } = rig;
  const h = Math.min(21, Math.max(5, Number(hour) || 12));
  const arc = clamp01((h - 6) / 12);                                  // 0 sunrise (east) → 1 sunset (west)
  const elevation = Math.sin(Math.PI * arc);                          // 0 at the horizon, 1 at noon
  const day = clamp01((h - 5.5) / 1.5) * clamp01((19 - h) / 1.5);     // 0 at night, 1 in daylight
  const golden = day * (1 - clamp01(elevation / 0.55));               // warm light when the sun is low

  // Sun (or moon at night)
  if (day > 0) {
    sun.position.set(cx + Math.cos(Math.PI * arc) * reach, Math.max(0.25, elevation) * reach, cz - reach * 0.45);
    sun.color.copy(SUN.noon).lerp(SUN.golden, golden);
    sun.intensity = 0.25 + day * (0.45 + 0.6 * elevation);
  } else {
    sun.position.set(cx - reach * 0.4, reach, cz - reach * 0.6);
    sun.color.copy(SUN.moon);
    sun.intensity = 0.22;
  }
  ambient.intensity = 0.22 + 0.5 * day;
  ambient.color.copy(SUN.moon).lerp(new THREE.Color('#ffffff'), day);

  // Sky
  const sky = SKY.night.clone().lerp(SKY.noon, day).lerp(SKY.golden, golden * 0.85);
  scene.background = sky;

  // Garden lights fade in from dusk
  const dark = 1 - day;
  lamps.lights.forEach(li => { li.intensity = 9 * dark; });
  lamps.glowMat.emissiveIntensity = 2.2 * dark;
  // Posts only appear from dusk: in full daylight they read as specks on the lawn
  lamps.posts.forEach(post => { post.visible = dark > 0.02; });
}

/* ── Plants in the scene: one entry per plant, updated in place when it moves ── */
// An entry: { key, plant, live (x/z while dragging), node (placeholder, then the model), disc, match
// (catalog item), loaded, base (scale at the established size), minY, foot (radius on the ground), dead }

const plantKey = (plant, i) => `${plant.uid ?? i}|${plant.is_existing ? 'existing' : plant.plant_id}`;

const TREEISH = (id) => id.includes('tree') || id.includes('oak') || id.includes('palm');
const SHRUBBY = (id) => ['shrub', 'fern', 'boxwood', 'bamboo', 'banana'].some((w) => id.includes(w));

function findMatch(inventory, pId) {
  return inventory.find(item => {
    if (item.id.toString() === pId || item.id === parseInt(pId, 10)) return true;
    const itemName = item.name.toLowerCase();
    return pId.split('_').some(term => !['plant', 'tree', 'flower', 'shrub'].includes(term) && itemName.includes(term));
  });
}

function disposeNode(node) {
  // Catalog models are shared by every copy (modelCache): only placeholders and markers are freed
  if (!node.userData?.shared) {
    if (node.geometry) node.geometry.dispose();
    if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach((m) => m.dispose());
  }
  if (node.children) node.children.forEach(disposeNode);
}

// One download and parse per model file for the whole visit: every plant using it is a clone that
// shares its geometry and materials (20 geraniums = 1 parse, not 20; much lighter on phones). The
// shared parts are never disposed (a catalog has a few dozen models). A failed load can be retried.
const modelCache = new Map();   // url → Promise<THREE.Object3D> (the template, never added to a scene)
function loadTemplate(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, new Promise((resolve, reject) => {
      new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, (gltf) => {
        // Planted, not potted: the pot and soil go before the model is measured (data/plantedModel.js)
        const template = plantOut(gltf.scene, url);
        template.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
          child.userData.shared = true;
          if (child.material) (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => { m.side = THREE.DoubleSide; });
          if (child.geometry) { child.geometry.computeBoundingBox(); child.geometry.computeBoundingSphere(); }
        });
        resolve(template);
      }, undefined, (err) => { modelCache.delete(url); reject(err); });
    }));
  }
  return modelCache.get(url);
}

// The model's size at a growth stage, as a share of its established size (non-plants: 1)
function stageFactor(e, stage) {
  const est = Number(e.match?.real_world_size) || 0;
  if (!est || (e.match.category || 'plant') !== 'plant') return 1;
  return (Number(stageSize(e.match, stage, 'plant')) || est) / est;
}

// Metres tall the entry is drawn at this growth stage (0 = unknown size)
function entryHeight(e, stage) {
  if (!e?.match) return 0;
  return Number(stageSize(e.match, stage, e.match.category || 'plant')) || 0;
}

function placeholderFor(pId) {
  if (TREEISH(pId)) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 }));
    trunk.position.y = 1.2;
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 }));
    canopy.position.y = 2.4 + 0.7;
    const g = new THREE.Group();
    [trunk, canopy].forEach((m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); });
    return g;
  }
  // Shown until the plant's model loads: a soft green cone (shrubs) or mound, not a bright ball
  const shrub = SHRUBBY(pId);
  const mesh = shrub
    ? new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 }))
    : new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9, transparent: true, opacity: 0.55 }));
  mesh.geometry.translate(0, shrub ? 0.6 : 0.35, 0);   // base on the ground, so moving never changes y
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function existingMarker(plant) {
  // Walls: invisible occluders (write depth so plants behind them are hidden). Ground obstacles: hidden outlines.
  let mesh;
  if (plant.type === 'structural_wall') {
    const h = plant.height || 4;
    mesh = new THREE.Mesh(new THREE.BoxGeometry(plant.width || 5, h, 1), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
    mesh.position.set(plant.x, h / 2, plant.z);
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(plant.width || 2, 0.05, plant.width || 2),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true, transparent: true, opacity: 0.3 }));
    mesh.position.set(plant.x, 0.025, plant.z);
    mesh.visible = false;   // debug outline only: hidden so it never slices plants
  }
  return mesh;
}

function createEntry(group, plant, key, inventory, arMode, getStage) {
  const e = { key, plant, live: null, group, node: null, disc: null, match: null, loaded: false, base: 1, minY: 0, foot: 0.45, dead: false };
  if (plant.is_existing) {
    e.node = existingMarker(plant);
    group.add(e.node);
    return e;
  }
  const pId = String(plant.plant_id).toLowerCase();
  e.match = findMatch(inventory, pId) || null;
  e.foot = TREEISH(pId) ? 1.0 : SHRUBBY(pId) ? 0.6 : 0.4;
  e.node = placeholderFor(pId);
  group.add(e.node);

  // Contact-shadow disc (fake AO): grounds the plants on the photo
  if (arMode) {
    const r = TREEISH(pId) ? 0.8 : SHRUBBY(pId) ? 0.5 : 0.28;
    const geo = new THREE.CircleGeometry(r, 14);
    geo.rotateX(-Math.PI / 2);
    e.disc = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
    e.disc.renderOrder = 1;
    group.add(e.disc);
  }
  poseEntry(e, getStage());

  const modelUrl = e.match ? resolveModelUrl(e.match.model_file) : null;
  if (!modelUrl) return e;
  // On load failure the procedural placeholder stays in the scene
  loadTemplate(modelUrl).then((template) => {
    if (e.dead) return;   // removed while it was loading
    const model = template.clone(true);   // shares geometry + materials with every other copy
    e.rig = rigGrowth(model, modelUrl);    // parts that grow their own way (palm trunk, fruit, flowers)
    e.byParts = growsByParts(modelUrl);
    // Exact vertex bounds (measured once per model): the fast box floated models rotated in the file
    const box = exactBounds(template, template);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      // Same rule as the Studio (data/modelSizing.js): height, or longest side for hardscape
      e.base = e.match.real_world_size
        ? realScale(size, Number(e.match.real_world_size), e.match.category || 'plant')
        : (pId.includes('tree') ? 3.5 : pId.includes('shrub') ? 1.5 : 1.0) / maxDim;
      e.minY = box.min.y;   // the model's lowest point goes on the ground
      e.foot = Math.max(0.3, (Math.max(size.x, size.z) * e.base) / 2);
      e.rawW = Math.max(size.x, size.z);   // the model's own widest side (for its real width per stage)
    }
    group.remove(e.node);
    disposeNode(e.node);
    e.node = model;
    e.loaded = true;
    group.add(model);
    poseEntry(e, getStage());
  }).catch((err) => console.error('Failed to load plant GLB model:', modelUrl, err));
  return e;
}

function poseEntry(e, stage) {
  if (e.plant.is_existing) return;
  const p = e.live || e.plant;
  e.node.position.x = Number(p.x);
  e.node.position.z = Number(p.z);
  e.node.rotation.y = ((Number(e.plant.rotation) || 0) * Math.PI) / 180;
  if (e.loaded && e.byParts) {
    // Grows part by part (data/plantGrowth.js): reshape, then size the new shape to this stage's height
    e.rig.pose(stageFactor(e, stage), stage);
    const box = rigBounds(e.node);
    const size = box.getSize(new THREE.Vector3());
    const h = Number(stageSize(e.match, stage, 'plant')) || size.y;
    const s = size.y > 0 ? h / size.y : 1;
    const target = stageSpread(e.match, stage, 'plant');
    const w = s * widthFit(target, Math.max(size.x, size.z) * s);
    e.node.scale.set(w, s, w);
    e.node.position.y = -box.min.y * s;
    e.footNow = Math.max(0.3, (Math.max(size.x, size.z) * w) / 2);
  } else if (e.loaded) {
    e.rig?.pose(stageFactor(e, stage), stage);   // flowers / fruit for this stage
    // Height and width grow separately: drawn at the plant's real width at this stage (its spread),
    // within a believable stretch (data/modelSizing.widthFit). A palm's crown barely widens.
    const s = e.base * stageFactor(e, stage);
    const target = e.match ? stageSpread(e.match, stage, e.match.category || 'plant') : 0;
    const w = s * widthFit(target, e.rawW * s);
    e.node.scale.set(w, s, w);
    e.node.position.y = -e.minY * s;
    e.footNow = Math.max(0.3, (e.rawW * w) / 2);
  }
  if (e.disc) e.disc.position.set(Number(p.x), 0.01, Number(p.z));
}

function dropEntry(e) {
  e.dead = true;
  [e.node, e.disc].forEach((n) => { if (n) { e.group.remove(n); disposeNode(n); } });
}

// The plant under the pointer: the nearest real mesh hit, else (small or leafy plants the ray slips
// through) the nearest bounding box it passes through
const _box = new THREE.Box3();
const _hit = new THREE.Vector3();
function pickEntry(raycaster, entries) {
  let best = null, bestMesh = Infinity, bestBox = Infinity, boxOnly = null;
  entries.forEach((e) => {
    if (e.plant.is_existing || e.dead) return;
    _box.setFromObject(e.node);
    if (_box.isEmpty() || !raycaster.ray.intersectBox(_box, _hit)) return;
    const boxD = _hit.distanceTo(raycaster.ray.origin);
    const meshHits = raycaster.intersectObject(e.node, true);
    if (meshHits.length && meshHits[0].distance < bestMesh) { bestMesh = meshHits[0].distance; best = e; }
    if (boxD < bestBox) { bestBox = boxD; boxOnly = e; }
  });
  return best || boxOnly;
}

// Selection ring, hover ring and the ground-to-top measuring line (drawn over the leaves)
function buildMarkers() {
  const group = new THREE.Group();
  const ring = (color, opacity) => {
    const geo = new THREE.RingGeometry(0.86, 1, 40);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 998;
    m.visible = false;
    group.add(m);
    return m;
  };
  const sel = ring(0x10b981, 0.9);
  const hover = ring(0x34d399, 0.5);
  const warnGeo = new THREE.RingGeometry(0.88, 1, 40);
  warnGeo.rotateX(-Math.PI / 2);
  const warnMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const warn = [];
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const dashMat = new THREE.LineDashedMaterial({ color: 0x2563eb, dashSize: 0.18, gapSize: 0.12, depthTest: false, transparent: true });
  const previews = [];
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 });
  const lineGeo = new THREE.CylinderGeometry(0.025, 0.025, 1, 6);
  lineGeo.translate(0, 0.5, 0);
  const line = new THREE.Mesh(lineGeo, white);
  const tickGeo = new THREE.BoxGeometry(0.32, 0.05, 0.05);
  const tickLow = new THREE.Mesh(tickGeo, white);
  const tickTop = new THREE.Mesh(tickGeo, white);
  const measure = new THREE.Group();
  [line, tickLow, tickTop].forEach((m) => { m.renderOrder = 999; measure.add(m); });
  tickLow.position.y = 0.02;
  measure.visible = false;
  group.add(measure);
  return {
    group, sel, hover, measure, line, tickTop,
    warnRing(i) {
      if (!warn[i]) {
        const m = new THREE.Mesh(warnGeo, warnMat);
        m.renderOrder = 997;
        group.add(m);
        warn[i] = m;
      }
      return warn[i];
    },
    hideWarnFrom(i) { for (let k = i; k < warn.length; k++) warn[k].visible = false; },
    preview(i) {
      if (!previews[i]) {
        const r = new THREE.Mesh(warnGeo, blueMat);
        r.renderOrder = 1000;
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const line = new THREE.Line(geo, dashMat);
        line.renderOrder = 1000;
        line.frustumCulled = false;
        group.add(r, line);
        previews[i] = { ring: r, line };
      }
      return previews[i];
    },
    hidePreviewFrom(i) {
      for (let k = i; k < previews.length; k++) { previews[k].ring.visible = false; previews[k].line.visible = false; }
    },
    dispose() {
      [sel, hover].forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      warnGeo.dispose(); warnMat.dispose(); blueMat.dispose(); dashMat.dispose();
      previews.forEach((pv) => pv.line.geometry.dispose());
      lineGeo.dispose(); tickGeo.dispose(); white.dispose();
    },
  };
}
