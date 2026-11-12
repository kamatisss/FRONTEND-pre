import React, { useRef, useEffect, useLayoutEffect, useMemo, useState, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Catalog models are Meshopt-compressed (see scripts/optimize-models.md); drei's useGLTF enables this by default
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { realScale, stageSize, stageSpread, widthFit, DEFAULT_GROWTH_STAGE } from '../data/modelSizing';
import PlantHeightCard from './PlantHeightCard';
import { getInventoryItems } from '../services/api';
import { resolveModelUrl } from '../data/modelCatalog';
import { FENCE_OUTLINE, defaultPins, normalizePins, pinLabels, solvePhotoPose, suggestLength, vantageOf } from '../data/photoPose';
import { exactBounds } from '../services/modelBounds';
import { plantOut } from '../data/plantedModel';
import { rigGrowth, rigBounds, growsByParts, growthNote } from '../data/plantGrowth';
import { RotateCw, Trash2, Replace } from 'lucide-react';
import { buildGround, buildBackdrop, buildDimensions, buildMetreGrid, metres, SKY_DAY, DIM_OFFSET } from '../data/gardenGround';
import { buildYard, hasSurvey, pavedAreas, keptTree, WALL_HEIGHT } from '../data/yardScene';
import { photoPixels, photoGroundCanvas } from '../data/photoGround';
import { buildGrass, DEFAULT_LAWN_LOOK } from '../data/grassField';
import { swayObject, setSway } from '../data/plantSway';
import { buildGroundcover } from '../data/groundcoverField';
import { plantBeds, bedSpread } from '../data/plantBeds';
import { layoutSpacing } from '../data/pricing';

import CornerPins from './PhotoPins';
const TOOL_BTN = (fg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 40, padding: '0 12px', borderRadius: 999, border: 'none',
  background: 'transparent', color: fg, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
});
const FIT_WARN = 0.025;   // pins further than this (share of the photo) from a W × L rectangle: say so

// The lot size labels on the dimension lines (same look as the Studio's)
const LOT_LABEL = {
  position: 'absolute', left: 0, top: 0, visibility: 'hidden', padding: '3px 9px', borderRadius: 999,
  background: 'rgba(255,255,255,0.92)', color: '#065F46', fontFamily: "'Inter', system-ui, sans-serif",
  fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', userSelect: 'none',
};   // m: a photo taken standing in the yard; outside this the pins or width are likely off

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
// layout_engine.GardenPlan.to_dict). The 3D view paints the beds as mulch and the lawn as turf
// (data/gardenGround.js); the photo overlay doesn't (the real ground is in the photo).
//
// 3D view ground: the lot at true size with a kerb, a surround fading into the haze and a sky.
// lotLabels (default on) adds dimension lines and "W m · House side" / "L m" labels; marketing
// scenes (landing hero, portfolio renders) turn them off. showGrid draws a 1 m grid over the lot.
//
// survey: what the customer marked in "Mark your yard" (dimensions.siteSurvey). The 3D view then rebuilds
// their yard round the design (data/yardScene.js): the house, boundary walls with gates, paved areas.
// Plants they keep (is_existing items with r) are drawn as trees of that size in the 3D view.
//
// photoGround: in the 3D view, their yard photo (backgroundImageUrl, lined up by photoCorners) laid back
// onto the lot as the ground (data/photoGround.js) instead of the design's beds and lawn, whose edges are
// then dashed on it. onPhotoGround({ state: 'off'|'working'|'ready'|'failed', coverage, reason }).
//
// groundcover: the design's groundcover over its beds ([{plant_id, name, area_sqm, sunlight}], backend
// groundcover.py), drawn growing with the growth stage (data/groundcoverField.js); not on the photo ground.
export default function ThreeGardenCanvas({
  plants, lotWidth, lotLength, backgroundImageUrl, arMode = false, arGrid = false, gardenPlan = null,
  photoCorners = null, editCorners = false, onCornersChange, onPoseStatus,
  photoTone = null, preserveDrawingBuffer = false,
  height = 450, enableZoom = true, enablePan = true, autoRotate = false, active = true,
  lite = false, timeOfDay = null,
  editable = false, onPlantsChange, showHeights = editable, growthStage = DEFAULT_GROWTH_STAGE,
  notesByUid = null, onSwapRequest = null, focus = null, previewMoves = null,
  showGrid = false, lotLabels = true, survey = null, photoGround = false, onPhotoGround = null, groundcover = null,
  lawnLook = DEFAULT_LAWN_LOOK,   // how long the lawn's grass is (data/grassField.js LAWN_LOOKS)
  ref,   // React 19: ref.current.exportGlb({ title }) → a .glb Blob of the garden as drawn
}) {
  const canvasRef = useRef(null);
  const aiPlantsGroupRef = useRef(null);
  const ambientLightRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);        // for the photo preview (renderPhotoPreview)
  const markersGroupRef = useRef(null);    // selection / hover rings and height lines: left out of exports
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
  const drawGroundcoverRef = useRef(() => {});
  const groundcoverRef = useRef(null);   // { group, dispose }
  // 3D view ground extras: the 1 m grid (shown/hidden, not rebuilt), the lot labels' anchors and elements
  const showGridRef = useRef(showGrid);
  const lotGridRef = useRef(null);
  const lotLabelsRef = useRef(lotLabels);
  const dimsRef = useRef(null);
  const frontLabelRef = useRef(null);
  const sideLabelRef = useRef(null);
  useEffect(() => {
    showGridRef.current = showGrid;
    if (lotGridRef.current) lotGridRef.current.visible = showGrid;
  }, [showGrid]);
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
      const heightWarn = pose.ok && !!given && pose.mode !== 'corners'
        && (pose.cameraHeight < vantageOf(given).range[0] || pose.cameraHeight > vantageOf(given).range[1]);   // where they said they took it from
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

  // Their own ground from the photo (3D view): the photo is read once per url, the ground rebuilt when the
  // pins or the lot change. Worked out after a paint so the button press shows at once.
  const [photoTex, setPhotoTex] = useState(null);   // { key, canvas, coverage }
  const photoStatusRef = useRef(onPhotoGround);
  useLayoutEffect(() => { photoStatusRef.current = onPhotoGround; });
  const pixelsRef = useRef({ url: null, px: null });
  const photoKey = photoGround && !arMode && backgroundImageUrl && setup
    ? `${backgroundImageUrl}|${setupKey}|${lotWidth}|${lotLength}|${lite ? 1 : 0}` : '';
  useEffect(() => {
    const report = (st) => photoStatusRef.current?.(st);
    if (!photoKey) {
      setPhotoTex(null);
      report({ state: 'off', reason: photoGround && !setup ? 'no_pins' : null });
      return undefined;
    }
    let alive = true;
    report({ state: 'working' });
    const w = Math.max(Number(lotWidth) || 10, 1), l = Math.max(Number(lotLength) || 10, 1);
    const pixels = () => (pixelsRef.current.url === backgroundImageUrl ? Promise.resolve(pixelsRef.current.px)
      : new Promise((resolve, reject) => {
        const img = new Image();
        if (!/^(blob|data):/.test(backgroundImageUrl)) img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const px = photoPixels(img);
            pixelsRef.current = { url: backgroundImageUrl, px };
            resolve(px);
          } catch (e) { reject(e); }   // a photo from another site without CORS can't be read
        };
        img.onerror = () => reject(new Error('load'));
        img.src = backgroundImageUrl;
      }));
    pixels().then((px) => new Promise((resolve) => setTimeout(() => resolve(px), 30))).then((px) => {
      if (!alive) return;
      const pose = solvePhotoPose(setup, w, l, px.iw, px.ih);
      if (!pose.ok) { setPhotoTex(null); report({ state: 'failed', reason: 'pins' }); return; }
      const { canvas, coverage } = photoGroundCanvas(px, pose, w, l, { maxSide: lite ? 1024 : 1536 });
      if (!alive) return;
      setPhotoTex({ key: photoKey, canvas, coverage });
      report({ state: coverage > 0.02 ? 'ready' : 'failed', coverage, reason: coverage > 0.02 ? null : 'outside' });
    }).catch(() => { if (alive) { setPhotoTex(null); report({ state: 'failed', reason: 'photo' }); } });
    return () => { alive = false; };
  }, [photoKey]); // eslint-disable-line react-hooks/exhaustive-deps -- photoKey stands for the photo, pins and lot

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
      scene.background = new THREE.Color(SKY_DAY.horizon);   // behind the sky dome; seen only while it loads
    }

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / viewHeight, 0.1, arMode ? 1000 : 2500);   // 3D view: out to the sky dome
    placeOverview(camera, currentWidth, currentLength, !arMode && lotLabelsRef.current ? DIM_MARGIN : 0);   // the photo overlay replaces this with the photo's camera

    // 3. Renderer
    // preserveDrawingBuffer lets callers snapshot the canvas (portfolio 3D renders)
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer, alpha: arPhoto });
    if (arPhoto) renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, liteRef.current ? 1.5 : 2));
    renderer.setSize(width, viewHeight, false);
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (!arMode) {
      // Neutral tone mapping (as in the Studio): bright sun rolls off instead of clipping to white and
      // plant colours stay true. Not on the photo overlay, whose plants are matched to the raw photo.
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.05;
    }

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, arMode ? 0.9 : 0.25);
    ambientLightRef.current = ambientLight; // exposed for Effect 4 colour tinting
    scene.add(ambientLight);
    // 3D view: open-sky light, bluish from above and green bounce from the lawn, instead of flat ambient
    let skyLight = null;
    if (!arMode) {
      skyLight = new THREE.HemisphereLight('#dceaf7', '#5d7046', 1.15);
      scene.add(skyLight);
    }

    const dirLight = new THREE.DirectionalLight(arMode ? 0xffffff : '#fff6e8', arMode ? 1.0 : 2.1);
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
    // 5. Ground. 3D view: the surround and sky here; the lot itself (lawn, beds, paths, kerbs) is
    // painted by drawPlanRef below, as it changes with the design. Photo overlay: a see-through plane
    // that only catches the plants' shadows on the photo.
    let backdrop = null, shadowGround = null;
    if (arMode) {
      const geo = new THREE.PlaneGeometry(gw, gl);
      geo.rotateX(-Math.PI / 2);
      shadowGround = new THREE.Mesh(geo, new THREE.ShadowMaterial({ opacity: 0.28, transparent: true }));
      shadowGround.position.set(cx, 0.0, cz);
      shadowGround.receiveShadow = true;
      scene.add(shadowGround);
    } else {
      backdrop = buildBackdrop(currentWidth, currentLength);
      scene.add(backdrop.group);
      scene.fog = backdrop.fog;
    }

    let lamps = null;
    if (timeOfDayRef.current != null && !arMode) {
      lamps = buildGardenLights(currentWidth, currentLength);
      scene.add(lamps.group);
      lightingRef.current = { scene, sun: dirLight, ambient: ambientLight, skyLight, backdrop, lamps, cx, cz, reach: Math.max(gw, gl) * 1.5 };
      applyTimeOfDay(lightingRef.current, timeOfDayRef.current);
    }

    // 1 m grid over the lot (3D view: when asked for; it stays square on any lot)
    let lotGrid = null;
    if (!arMode) {
      lotGrid = buildMetreGrid(currentWidth, currentLength);
      lotGrid.group.visible = showGridRef.current;
      scene.add(lotGrid.group);
    }
    lotGridRef.current = lotGrid?.group || null;

    // AR spatial grid — subtle ground reference overlay in Photo Overlay mode (1 m cells over the lot)
    let arGridHelper = null;
    if (arMode) {
      arGridHelper = buildMetreGrid(currentWidth, currentLength, { y: 0.002, minor: 0.3, major: 0.45 });
      scene.add(arGridHelper.group);
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
    gridObjectsRef.current = [arGridHelper?.group, lotOutline].filter(Boolean);
    gridObjectsRef.current.forEach((o) => { o.visible = arGridRef.current; });

    // 6. Empty group for AI plants
    const aiGroup = new THREE.Group();
    scene.add(aiGroup);
    aiPlantsGroupRef.current = aiGroup;
    placePlantsRef.current();   // a rebuilt scene starts empty: put the plants back
    sceneRef.current = scene;
    planGroupRef.current = null;
    drawPlanRef.current();      // and the beds and lawn
    groundcoverRef.current = null;
    drawGroundcoverRef.current();   // and the groundcover in the beds

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
      // Stay above the ground (just short of eye level at the horizon) and near enough to see the garden
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.maxDistance = Math.hypot(currentWidth, currentLength) * 3 + 20;
      controls.screenSpacePanning = false;   // pan along the ground, not up into the sky
    }
    controls.enableZoom = viewRef.current.enableZoom;
    controls.autoRotate = viewRef.current.autoRotate;
    controls.autoRotateSpeed = 0.6;
    controls.update();
    // Store refs so Effect 3 and Effect 4 can update camera/light without reinit
    cameraRef.current   = camera;
    controlsRef.current = controls;
    planGroupRef.current?.update(camera, true);
    applyPoseRef.current();

    // 7b. Editing: hover (mouse) shows the height card; click or tap selects; drag moves a plant on
    // the ground, kept inside the lot. Mouse: drag any plant straight away. Touch: the first tap
    // selects, then dragging the selected plant moves it, so a finger that starts on a plant can still
    // turn the view. Runs in the capture phase so the orbit controls never see a plant drag.
    const markers = buildMarkers();
    scene.add(markers.group);
    markersGroupRef.current = markers.group;
    rendererRef.current = renderer;
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

    // Lot labels: centred on their dimension lines, kept inside the canvas (hidden when far off it)
    const labelPos = new THREE.Vector3();
    const placeLotLabels = () => {
      const anchors = dimsRef.current?.anchors;
      if (!anchors) return;
      const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
      [[frontLabelRef.current, anchors.front], [sideLabelRef.current, anchors.side]].forEach(([el, at]) => {
        if (!el) return;
        labelPos.copy(at).project(camera);
        const x = (labelPos.x + 1) / 2 * W, y = (1 - labelPos.y) / 2 * H;
        const behind = labelPos.z > 1;
        const lw = el.offsetWidth, lh = el.offsetHeight;
        const off = behind || x < -lw || x > W + lw || y < -lh || y > H + lh;
        el.style.visibility = off ? 'hidden' : 'visible';
        if (off) return;
        const left = Math.min(W - lw - 6, Math.max(6, x - lw / 2));
        const top = Math.min(H - lh - 6, Math.max(6, y - lh / 2));
        el.style.transform = `translate(${left}px, ${top}px)`;
      });
    };

    // 8. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!viewRef.current.active) return;
      if (!arPhoto) controls.update();   // update() re-aims at the target, which would undo the photo's camera
      updateOverlay();
      planGroupRef.current?.update(camera);   // walls / house between the camera and the garden fade
      planGroupRef.current?.tick(performance.now() / 1000);   // the lawn's wind
      setSway(!arMode, performance.now() / 1000);              // plants in the wind: the 3D view only, not over the photo
      placeLotLabels();
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
      markersGroupRef.current = null;
      rendererRef.current = null;
      markers.dispose();
      entries.forEach(dropEntry);
      entries.clear();
      controls.dispose();
      renderer.dispose();
      if (shadowGround) { shadowGround.geometry.dispose(); shadowGround.material.dispose(); }
      backdrop?.dispose();
      dimsRef.current = null;
      lotGrid?.dispose();
      lotGridRef.current = null;
      arGridHelper?.dispose();
      if (lotOutline) { lotOutline.geometry.dispose(); lotOutline.material.dispose(); }
      if (lamps) lamps.dispose();
      planGroupRef.current?.dispose();
      planGroupRef.current = null;
      groundcoverRef.current?.dispose();
      groundcoverRef.current = null;
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
        scene.remove(planGroupRef.current.group);
        planGroupRef.current.dispose();
        planGroupRef.current = null;
      }
      dimsRef.current = null;
      if (arMode) return;
      const built = buildSurroundings(gardenPlan, survey, Math.max(Number(lotWidth) || 10, 1), Math.max(Number(lotLength) || 10, 1),
        { lite: liteRef.current, anisotropy: Math.min(8, rendererRef.current?.capabilities.getMaxAnisotropy() || 4), labels: lotLabelsRef.current,
          photo: photoTex?.key === photoKey && photoKey ? photoTex.canvas : null, beds: bedsRef.current, look: lawnLook });
      scene.add(built.group);
      dimsRef.current = built.dims;
      if (cameraRef.current) built.update(cameraRef.current, true);
      planGroupRef.current = built;   // { group, dims, update, dispose }
    };
  });
  // A design without an AI plan (made in the Studio, the landing sample): beds round its plants (data/plantBeds.js),
  // mulched or carpeted with its groundcover, the grass only on the lawn between them
  const bedsKey = gardenPlan?.lawn || !Array.isArray(plants) ? ''
    : JSON.stringify(plants.filter(p => !p.is_existing).map(p => [p.plant_id, Math.round(Number(p.x) * 20), Math.round(Number(p.z) * 20)])) + inventory.length;
  const beds = useMemo(() => {
    if (!bedsKey) return null;
    const w = Math.max(Number(lotWidth) || 10, 1), l = Math.max(Number(lotLength) || 10, 1);
    const list = plants.filter(p => !p.is_existing).map(p => ({ p, m: findMatch(inventory, String(p.plant_id).toLowerCase()) }))
      .filter(({ m }) => m && (m.category || 'plant') === 'plant' && !m.is_groundcover)
      .map(({ p, m }) => ({ x: Number(p.x), z: Number(p.z), spread: bedSpread(m, layoutSpacing) }));
    return plantBeds(list, w, l, { outline: survey?.outline || gardenPlan?.outline });
  }, [bedsKey, lotWidth, lotLength]); // eslint-disable-line react-hooks/exhaustive-deps -- bedsKey stands for plants + inventory
  const bedsRef = useRef(null);
  bedsRef.current = beds;

  // The survey as a stable key: callers may pass a new but equal object on every render
  const surveyKey = hasSurvey(survey) ? JSON.stringify([survey.items || [], survey.sun?.house || null, survey.outline || null]) : '';
  useEffect(() => { drawPlanRef.current(); }, [gardenPlan, arMode, lotWidth, lotLength, surveyKey, photoTex, photoKey, beds, lawnLook]);   // surveyKey stands for survey

  // Groundcover over the beds: redrawn on its own when the stage, the plants (the shade under tall crowns) or the
  // design change — not with the whole ground
  const gcKey = Array.isArray(groundcover) && groundcover.length ? JSON.stringify(groundcover) : '';
  useLayoutEffect(() => {
    drawGroundcoverRef.current = () => {
      const scene = sceneRef.current;
      if (!scene) return;
      if (groundcoverRef.current) {
        scene.remove(groundcoverRef.current.group);
        groundcoverRef.current.dispose();
        groundcoverRef.current = null;
      }
      if (arMode || !gcKey || (photoKey && photoTex?.key === photoKey)) return;   // the photo shows the real ground
      const find = (p) => findMatch(inventory, String(p.plant_id).toLowerCase());
      const built = buildGroundcover(gardenPlan?.lawn ? gardenPlan : null, Math.max(Number(lotWidth) || 10, 1), Math.max(Number(lotLength) || 10, 1),
        groundcover, {
          plants: Array.isArray(plants) ? plants : [], stage: growthStage, lite: liteRef.current,
          outline: survey?.outline, paved: hasSurvey(survey) ? pavedAreas(survey) : [], beds: gardenPlan?.lawn ? null : beds,
          heightOf: (p) => { const m = find(p); return m ? Math.max(Number(m.real_world_size) || 0, Number(m.mature_height) || 0) : 0; },
          spreadOf: (p) => { const m = find(p); return m ? Number(m.mature_spread || m.established_spread) || 0 : 0; },
        });
      scene.add(built.group);
      groundcoverRef.current = built;
    };
  });
  useEffect(() => { drawGroundcoverRef.current(); },
    [gcKey, gardenPlan, arMode, lotWidth, lotLength, growthStage, plants, inventory, surveyKey, photoTex, photoKey, beds]);   // gcKey stands for groundcover

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

  // Download as .glb: the lot, the beds and lawn, and every plant exactly as drawn (position, turn,
  // growth stage). Rebuilt ground and beds, so it works from the photo overlay too (there the ground
  // is see-through and the beds aren't drawn). Waits for models still loading; failed ones keep
  // their stand-in shape.
  const waitForModels = async () => {
    const pending = () => [...entriesRef.current.values()].filter((e) => !e.dead && !e.plant.is_existing
      && !e.loaded && !e.failed && e.match && resolveModelUrl(e.match.model_file));
    for (let waited = 0; pending().length && waited < 30000; waited += 300) {
      await new Promise((r) => setTimeout(r, 300));
    }
    if (pending().length) throw new Error('Some plants are still loading. Try again in a moment.');
  };
  useImperativeHandle(ref, () => ({
    // Photo overlay only: the design drawn over the customer's photo at (up to) the photo's own
    // resolution, plus the untouched photo → { before, after } canvases of the same size. Renders
    // the live scene once at that size with the rings / grid hidden, then puts everything back, all
    // in one go so nothing flickers on screen.
    async renderPhotoPreview({ maxSide = 1600 } = {}) {
      if (!arPhoto || !photoSize) throw new Error('Open the photo overlay with your yard photo first.');
      await waitForModels();
      const photo = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not read your yard photo.'));
        img.src = backgroundImageUrl;
      });
      const renderer = rendererRef.current, scene = sceneRef.current, camera = cameraRef.current;
      if (!renderer || !scene || !camera) throw new Error('The 3D view is not ready yet.');
      const scale = Math.min(1, maxSide / Math.max(photoSize.w, photoSize.h));
      const W = Math.round(photoSize.w * scale), H = Math.round(photoSize.h * scale);
      const canvasOf = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
      const before = canvasOf();
      before.getContext('2d').drawImage(photo, 0, 0, W, H);
      const after = canvasOf();
      const ctx = after.getContext('2d');
      ctx.drawImage(photo, 0, 0, W, H);

      // From here to the restore: no awaits, so the screen never shows the resized canvas
      const hidden = [markersGroupRef.current, ...gridObjectsRef.current].filter((o) => o?.visible);
      hidden.forEach((o) => { o.visible = false; });
      const ratio = renderer.getPixelRatio();
      const size = renderer.getSize(new THREE.Vector2());
      try {
        setSway(false, 0);
        renderer.setPixelRatio(1);
        renderer.setSize(W, H, false);
        renderer.render(scene, camera);
        const gl = renderer.getContext();   // a phone may cap the drawing size: read what was really drawn
        ctx.drawImage(renderer.domElement, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, 0, W, H);
      } finally {
        hidden.forEach((o) => { o.visible = true; });
        renderer.setPixelRatio(ratio);
        renderer.setSize(size.x, size.y, false);
        renderer.render(scene, camera);
      }
      return { before, after };
    },

    // 3D view only: a tidy overview of the whole lot (the default framing, not wherever the customer
    // turned the view), without rings or labels, at width × height → a canvas. For the PDF proposal.
    async renderOverview({ width = 1600, height = 1000 } = {}) {
      if (arMode) throw new Error('Switch to the 3D view for this picture.');
      await waitForModels();
      const renderer = rendererRef.current, scene = sceneRef.current, live = cameraRef.current;
      if (!renderer || !scene || !live) throw new Error('The 3D view is not ready yet.');
      const cam = new THREE.PerspectiveCamera(45, width / height, 0.1, 2500);
      const ow = Math.max(Number(lotWidth) || 10, 1), ol = Math.max(Number(lotLength) || 10, 1);
      placeOverview(cam, ow, ol, dimsRef.current ? DIM_MARGIN : 0);
      // The screen framing fills the view edge to edge; a printed picture leaves a little room round the
      // lot and its measurements
      const centre = new THREE.Vector3(ow / 2, 0, ol / 2);
      cam.position.sub(centre).multiplyScalar(1.25).add(centre);
      cam.lookAt(centre);
      cam.updateMatrixWorld();
      const out = Object.assign(document.createElement('canvas'), { width, height });
      // No awaits until the restore: the screen never shows the resized canvas
      const hidden = [markersGroupRef.current].filter((o) => o?.visible);
      hidden.forEach((o) => { o.visible = false; });
      const ratio = renderer.getPixelRatio();
      const size = renderer.getSize(new THREE.Vector2());
      try {
        planGroupRef.current?.update(cam, true);
        setSway(false, 0);   // a still picture: plants at rest…
        planGroupRef.current?.tick(0);   // …and the lawn too
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        renderer.render(scene, cam);
        const gl = renderer.getContext();
        const octx = out.getContext('2d');
        octx.drawImage(renderer.domElement, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, 0, width, height);
        const anchors = dimsRef.current?.anchors;
        if (anchors) {
          drawPill(octx, anchors.front, cam, width, height, `${metres(ow)} · House side`);
          drawPill(octx, anchors.side, cam, width, height, metres(ol));
        }
      } finally {
        hidden.forEach((o) => { o.visible = true; });
        renderer.setPixelRatio(ratio);
        renderer.setSize(size.x, size.y, false);
        planGroupRef.current?.update(live, true);
        renderer.render(scene, live);
      }
      return out;
    },

    async exportGlb({ title } = {}) {
      await waitForModels();

      const w = Math.max(Number(lotWidth) || 10, 1);
      const l = Math.max(Number(lotLength) || 10, 1);
      const root = new THREE.Group();
      root.name = title || 'Garden design';
      const ground = buildSurroundings(gardenPlan, survey, w, l, { exporting: true });
      root.add(ground.group);

      const plantsGroup = new THREE.Group();
      plantsGroup.name = 'Plants and features';
      const names = [];
      const kept = new THREE.Group();
      kept.name = 'Already in the yard';
      entriesRef.current.forEach((e) => {
        if (e.dead || !e.node) return;
        if (e.plant.is_existing) {
          if (e.node.userData.keptTree) kept.add(Object.assign(e.node.clone(true), { name: e.plant.label || 'Kept plant' }));
          return;
        }
        const copy = e.node.clone(true);   // shares geometry/materials: the exporter writes each model once
        copy.name = e.match?.name || e.plant.name || 'Plant';
        plantsGroup.add(copy);
        if (e.match?.name) names.push(e.match.name);
      });
      root.add(plantsGroup);
      if (kept.children.length) root.add(kept);
      root.position.set(-w / 2, 0, -l / 2);   // the lot's centre at the file's origin

      try {
        const { exportGlb, creditsFor } = await import('../data/gardenExport');
        return await exportGlb(root, { title: root.name, credits: creditsFor(names) });
      } finally {
        ground.dispose();
      }
    },
  }), [lotWidth, lotLength, gardenPlan, arMode, arPhoto, photoSize, backgroundImageUrl, survey]);

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
    const w = Math.max(Number(lotWidth) || 10, 1), l = Math.max(Number(lotLength) || 10, 1);
    return (
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          className="w-full block focus:outline-none"
          style={{ width: '100%', height: `${height}px`, display: 'block' }}
        />
        {lotLabels && !arMode && (
          <div aria-label={`Lot ${metres(w)} wide (house side) by ${metres(l)} long`} role="img"
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 3 }}>
            <span ref={frontLabelRef} style={LOT_LABEL}>{metres(w)} · House side</span>
            <span ref={sideLabelRef} style={LOT_LABEL}>{metres(l)}</span>
          </div>
        )}
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
            labels={pinLabels(setup?.mode || 'edges', setup)} outline={setup?.mode === 'points' ? false : setup?.mode === 'fences' ? FENCE_OUTLINE : true} onChange={onCornersChange} />
        )}
      </div>
    </div>
  );
}

/* ── The overview camera: the whole lot in view at any lot shape and canvas shape ── */
const VIEW_ELEVATION = (35 * Math.PI) / 180;   // looking down at the garden from the house side
const DIM_MARGIN = DIM_OFFSET + 0.5;          // m: the dimension lines and their labels in the default view
const PLANT_ROOM = 3;                          // m of plant height to keep in frame

const FRAME_FILL = 0.9;                        // the lot's farthest corner at 90% of the way to the frame edge

// margin: metres past the front and right edges to keep in view too (the dimension lines)
function placeOverview(camera, w, l, margin = 0) {
  const at = (d) => {
    camera.position.set(w / 2, Math.sin(VIEW_ELEVATION) * d, l / 2 + Math.cos(VIEW_ELEVATION) * d);
    camera.lookAt(w / 2, 0, l / 2);
    camera.updateMatrixWorld();
  };
  camera.updateProjectionMatrix();
  const corners = [];
  for (const x of [0, w + margin]) for (const z of [0, l + margin]) for (const y of [0, PLANT_ROOM]) corners.push(new THREE.Vector3(x, y, z));
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


/* ── The 3D view's ground and surroundings as one unit ─────────────────────────
   The painted lot (data/gardenGround.js), the customer's yard rebuilt from their survey (house, walls,
   gates: data/yardScene.js) and the dimension lines — lifted to the top of the walls when there are
   walls, so the walls don't hide them. → { group, dims, update(camera, instant), dispose } */
function buildSurroundings(plan, survey, w, l, { lite = false, exporting = false, anisotropy = 4, labels = false, photo = null, beds = null, look } = {}) {
  const walled = hasSurvey(survey);
  const ground = buildGround(plan?.lawn ? plan : null, w, l, {
    lite, exporting, anisotropy, walled, outline: survey?.outline, photo, beds: plan?.lawn ? null : beds,
    paved: walled && !photo ? pavedAreas(survey) : [] });   // on their photo, their paving is already there
  ground.group.name = plan?.lawn ? 'Lot, beds and lawn' : `Lot ${w} x ${l} m`;
  const yard = buildYard(survey, w, l, { planOutline: plan?.outline });
  const dims = labels && !exporting ? buildDimensions(w, l, { y: walled ? WALL_HEIGHT + 0.08 : 0.02 }) : null;
  // Living grass on the lawn (data/grassField.js): not in the .glb (tens of thousands of blades), not on their photo
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const grass = !exporting && !photo
    ? buildGrass(plan?.lawn ? plan : null, w, l, { outline: survey?.outline || plan?.outline, paved: walled ? pavedAreas(survey) : [], lite, still,
      beds: plan?.lawn ? null : beds, look })
    : null;
  const group = new THREE.Group();
  group.name = 'Garden and yard';
  group.add(ground.group, yard.group);
  if (grass?.mesh) group.add(grass.mesh);
  if (dims) group.add(dims.group);
  return {
    group, dims,
    update: (camera, instant) => yard.update(camera, instant),
    tick: (t) => grass?.tick(t),
    dispose: () => { ground.dispose(); yard.dispose(); dims?.dispose(); grass?.dispose(); },
  };
}

/* ── A label pill drawn onto a picture (PDF overview), centred on a point of the scene ── */
function drawPill(ctx, at, camera, W, H, text) {
  const p = at.clone().project(camera);
  if (p.z > 1) return;
  const scale = Math.max(1, W / 1000);
  ctx.save();
  ctx.font = `800 ${Math.round(13 * scale)}px Inter, system-ui, sans-serif`;
  const tw = ctx.measureText(text).width, ph = 22 * scale, pw = tw + 20 * scale;
  const x = Math.min(W - pw - 8, Math.max(8, (p.x + 1) / 2 * W - pw / 2));
  const y = Math.min(H - ph - 8, Math.max(8, (1 - p.y) / 2 * H - ph / 2));
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, pw, ph, ph / 2); else ctx.rect(x, y, pw, ph);
  ctx.fill();
  ctx.fillStyle = '#065F46';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 10 * scale, y + ph / 2 + scale);
  ctx.restore();
}


/* ── Time of day (landing hero) ─────────────────────────────────────────────── */
const SKY = { noon: new THREE.Color('#eaf4fb'), golden: new THREE.Color('#fbe3c4'), night: new THREE.Color('#0d1b33') };
const SKY_TOP = { day: new THREE.Color(SKY_DAY.top), night: new THREE.Color('#06101f') };
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
  const { scene, sun, ambient, lamps, cx, cz, reach } = rig;   // + skyLight, backdrop (3D view)
  const h = Math.min(21, Math.max(5, Number(hour) || 12));
  const arc = clamp01((h - 6) / 12);                                  // 0 sunrise (east) → 1 sunset (west)
  const elevation = Math.sin(Math.PI * arc);                          // 0 at the horizon, 1 at noon
  const day = clamp01((h - 5.5) / 1.5) * clamp01((19 - h) / 1.5);     // 0 at night, 1 in daylight
  const golden = day * (1 - clamp01(elevation / 0.55));               // warm light when the sun is low

  // Sun (or moon at night)
  if (day > 0) {
    sun.position.set(cx + Math.cos(Math.PI * arc) * reach, Math.max(0.25, elevation) * reach, cz - reach * 0.45);
    sun.color.copy(SUN.noon).lerp(SUN.golden, golden);
    sun.intensity = (0.25 + day * (0.45 + 0.6 * elevation)) * (rig.skyLight ? 1.6 : 1);   // tone-mapped 3D view: brighter sun
  } else {
    sun.position.set(cx - reach * 0.4, reach, cz - reach * 0.6);
    sun.color.copy(SUN.moon);
    sun.intensity = 0.22;
  }
  ambient.intensity = (0.22 + 0.5 * day) * (rig.skyLight ? 0.35 : 1);   // the sky light does most of the fill
  ambient.color.copy(SUN.moon).lerp(new THREE.Color('#ffffff'), day);

  // Sky
  const sky = SKY.night.clone().lerp(SKY.noon, day).lerp(SKY.golden, golden * 0.85);
  scene.background = sky;
  if (rig.backdrop) {
    const top = SKY_TOP.night.clone().lerp(SKY_TOP.day, day).lerp(SKY.golden, golden * 0.35);
    rig.backdrop.setSky(top, sky);
  }
  if (rig.skyLight) rig.skyLight.intensity = 0.25 + 0.9 * day;

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

// The contact shadow: a unit disc with a soft radial fade (shared by every plant; never disposed)
const CONTACT_GEO = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
let contactTex = null;
function contactTexture() {
  if (!contactTex) {
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    contactTex = new THREE.CanvasTexture(c);
  }
  return contactTex;
}

function disposeNode(node) {
  // Catalog models are shared by every copy (modelCache): only placeholders and markers are freed
  if (!node.userData?.shared) {
    if (node.geometry && node.geometry !== CONTACT_GEO) node.geometry.dispose();
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
    const r = Number(plant.r) || (Number(plant.width) ? Number(plant.width) / 2 : 0);
    e.node = !arMode && plant.type !== 'structural_wall' && r > 0
      ? Object.assign(keptTree(r, Math.round(Number(plant.x) * 31 + Number(plant.z) * 17)), { name: plant.label || 'Kept plant' })
      : existingMarker(plant);
    if (e.node.userData.keptTree) {
      e.node.position.set(Number(plant.x) || 0, 0, Number(plant.z) || 0);
      swayObject(e.node);   // the trees they keep move with the rest of the garden
    }
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
  } else {
    // 3D view: a soft shadow where the plant meets the soil (the sun's shadow alone leaves plants looking set
    // down on the ground rather than growing in it); sized to the plant's spread in poseEntry
    e.disc = new THREE.Mesh(CONTACT_GEO, new THREE.MeshBasicMaterial({ map: contactTexture(), color: 0x000000, transparent: true,
      opacity: 0.5, depthWrite: false, toneMapped: false }));
    e.disc.userData.contact = true;
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
    if ((e.match?.category || 'plant') === 'plant') swayObject(model);   // plants move in the wind; benches and rocks don't
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
  }).catch((err) => { e.failed = true; console.error('Failed to load plant GLB model:', modelUrl, err); });
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
  if (e.disc) e.disc.position.set(Number(p.x), 0.012, Number(p.z));
  if (e.disc?.userData.contact) {
    const r = (e.loaded && e.footNow ? e.footNow : e.foot) * 1.25;
    e.disc.scale.set(r, 1, r);
  }
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
