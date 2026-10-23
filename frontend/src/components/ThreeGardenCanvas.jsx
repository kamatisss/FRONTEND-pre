import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// Catalog models are Meshopt-compressed (see scripts/optimize-models.md); drei's useGLTF enables this by default
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { realScale } from '../data/modelSizing';
import { getInventoryItems } from '../services/api';
import { resolveModelUrl } from '../data/modelCatalog';
import { CORNER_LABELS, defaultCorners, solvePhotoCamera, suggestLength, validCorners } from '../data/photoPose';

const FIT_WARN = 0.025;   // pins further than this (share of the photo) from a W × L rectangle: say so

// height: canvas height in px. enableZoom / enablePan / autoRotate tune the orbit controls
// (the landing hero turns zoom off so the mouse wheel keeps scrolling the page).
// active=false pauses rendering, e.g. while the canvas is scrolled out of view.
// lite: lighter rendering for phones (lower pixel ratio, smaller shadow map).
// timeOfDay: hour 5–21 drives the sun (position, colour, sky) and, after dusk, warm garden
// lights along the lot edge. null (the default) keeps the fixed daylight every other screen uses.
//
// Photo overlay (arMode with backgroundImageUrl): the photo is shown at its own shape and colours
// (the browser draws it; the 3D scene is transparent on top), and the camera is the one that took
// the photo, solved from photoCorners — four pins on the yard's corners (data/photoPose.js). Without
// pins a typical "standing at the front" guess is used. The camera is fixed: moving it would break
// the match with the photo. editCorners shows draggable pins (onCornersChange gets the new ones);
// onPoseStatus({ ok, reason, fitError }) reports whether the pins make sense.
export default function ThreeGardenCanvas({
  plants, lotWidth, lotLength, backgroundImageUrl, arMode = false, arGrid = false,
  photoCorners = null, editCorners = false, onCornersChange, onPoseStatus,
  photoTone = null, readOnly = false, preserveDrawingBuffer = false,
  height = 450, enableZoom = true, enablePan = true, autoRotate = false, active = true,
  lite = false, timeOfDay = null,
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
    getInventoryItems('plant')
      .then(data => {
        if (isMounted) setInventory(data);
      })
      .catch(err => {
        console.error('Error fetching plant inventory in 3D Canvas:', err);
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
  const corners = validCorners(photoCorners) ? photoCorners : null;
  // Kept in refs (refreshed after every render, before the other effects) so the scene setup can apply them too
  useLayoutEffect(() => {
    poseRef.current = { corners, photoSize, lot: [lotWidth, lotLength], onStatus: onPoseStatus };
    applyPoseRef.current = () => {
      const camera = cameraRef.current;
      const { corners: pins, photoSize: size, lot, onStatus } = poseRef.current;
      if (!camera || !arPhoto || !size) return;
      const pose = solvePhotoCamera(pins || defaultCorners(), lot[0], lot[1], size.w, size.h);
      const mismatch = pose.ok && pins && pose.fitError > FIT_WARN;
      onStatus?.({ ok: pose.ok, reason: pose.reason, fitError: pose.fitError, guessed: !pins,
        fitWarn: mismatch, suggestedLength: mismatch ? suggestLength(pins, lot[0], size.w, size.h) : null });
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
  useEffect(() => { applyPoseRef.current(); }, [corners, photoSize, lotWidth, lotLength, arPhoto]);

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
    const camDist   = Math.max(gw, gl) * 1.1 + 6;
    const camHeight = Math.max(gw, gl) * 0.6 + 4;

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
    camera.position.set(cx, camHeight, cz + camDist);   // the photo overlay replaces this with the photo's camera

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

    // 8. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!viewRef.current.active) return;
      if (!arPhoto) controls.update();   // update() re-aims at the target, which would undo the photo's camera
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
      controls.dispose();
      renderer.dispose();
      ground.geometry.dispose();
      groundMat.dispose();
      if (gridHelper) gridHelper.dispose();
      if (arGridHelper) arGridHelper.dispose();
      if (lotOutline) { lotOutline.geometry.dispose(); lotOutline.material.dispose(); }
      if (lamps) lamps.dispose();
      lightingRef.current = null;
      // Null out refs so Effects 3 & 4 don't touch disposed objects
      cameraRef.current      = null;
      controlsRef.current    = null;
      ambientLightRef.current = null;
    };
  }, [lotWidth, lotLength, arMode, backgroundImageUrl, height, preserveDrawingBuffer]); // eslint-disable-line react-hooks/exhaustive-deps -- arPhoto follows arMode + backgroundImageUrl

  // Effect 2: Place, position, rotate, and dispose AI plants when props change — and again whenever
  // the scene is rebuilt (new size, photo or mode), which starts with an empty plant group.
  // Refreshed after every render so the scene setup can call it with the latest plants.
  useLayoutEffect(() => {
    placePlantsRef.current = () => {
      const aiGroup = aiPlantsGroupRef.current;
      if (!aiGroup) return;
      const last = placedRef.current;
      if (last.group === aiGroup && last.plants === plants && last.inventory === inventory && last.arMode === arMode) return;
      placedRef.current = { group: aiGroup, plants, inventory, arMode };

      const disposeNode = (node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((mat) => mat.dispose());
          } else {
            node.material.dispose();
          }
        }
        if (node.children) node.children.forEach(disposeNode);
      };

      // Clear existing children and dispose resources
      while (aiGroup.children.length > 0) {
        const child = aiGroup.children[0];
        aiGroup.remove(child);
        disposeNode(child);
      }

      if (!plants || !Array.isArray(plants)) return;

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

      plants.forEach((plant) => {
        if (plant.is_existing) {
          let geometry;
          let material;

          let obstacleY;
          if (plant.type === 'structural_wall') {
            const wallH = plant.height || 4;
            geometry = new THREE.BoxGeometry(plant.width || 5, wallH, 1);
            // Invisible occluder: writes depth so plants behind walls are hidden
            material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
            obstacleY = wallH / 2;
          } else {
            // Ground obstacles (pools, paths, etc.) — flat 2D boundary outline
            geometry = new THREE.BoxGeometry(plant.width || 2, 0.05, plant.width || 2);
            material = new THREE.MeshBasicMaterial({
              color: 0x22c55e,
              wireframe: true,
              transparent: true,
              opacity: 0.3
            });
            obstacleY = 0.025;
          }

          const obstacleMesh = new THREE.Mesh(geometry, material);
          obstacleMesh.position.set(plant.x, obstacleY, plant.z);
          obstacleMesh.visible = false; // Hide layout boundaries and debug obstacle meshes to prevent invisible wall slicing issues
          aiGroup.add(obstacleMesh);
          return;
        }

        const pId = plant.plant_id.toLowerCase();
        let placeholderMesh = null;

        if (pId.includes('tree') || pId.includes('oak') || pId.includes('palm')) {
          const trunkHeight = 2.4;
          const trunkRadius = 0.25;
          const trunkGeo = new THREE.CylinderGeometry(trunkRadius, trunkRadius * 1.2, trunkHeight, 8);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
          const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
          trunkMesh.position.y = trunkHeight / 2;
          trunkMesh.castShadow = true;
          trunkMesh.receiveShadow = true;

          const canopyRadius = 1.0;
          const canopyGeo = new THREE.SphereGeometry(canopyRadius, 8, 8);
          const canopyMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
          const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
          canopyMesh.position.y = trunkHeight + canopyRadius * 0.7;
          canopyMesh.castShadow = true;
          canopyMesh.receiveShadow = true;

          const treeGroup = new THREE.Group();
          treeGroup.add(trunkMesh);
          treeGroup.add(canopyMesh);
          treeGroup.position.set(plant.x, 0, plant.z);
          treeGroup.rotation.y = (plant.rotation * Math.PI) / 180;

          placeholderMesh = treeGroup;

        } else if (pId.includes('shrub') || pId.includes('fern') || pId.includes('boxwood') || pId.includes('bamboo') || pId.includes('banana')) {
          const height = 1.2;
          const radius = 0.6;
          const geo = new THREE.ConeGeometry(radius, height, 8);
          const mat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(plant.x, height / 2, plant.z);
          mesh.rotation.y = (plant.rotation * Math.PI) / 180;

          placeholderMesh = mesh;

        } else {
          // Shown until the plant's model loads: a soft green mound, not a bright ball
          const radius = 0.35;
          const geo = new THREE.SphereGeometry(radius, 10, 8);
          const mat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9, transparent: true, opacity: 0.55 });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(plant.x, radius, plant.z);
          mesh.rotation.y = (plant.rotation * Math.PI) / 180;

          placeholderMesh = mesh;
        }

        if (placeholderMesh) aiGroup.add(placeholderMesh);

        // Contact-shadow disc (fake AO) — grounding ring that appears in AR mode only
        if (arMode) {
          const shadowR =
            (pId.includes('tree') || pId.includes('oak') || pId.includes('palm')) ? 0.8 :
            (pId.includes('shrub') || pId.includes('fern') || pId.includes('boxwood') || pId.includes('bamboo') || pId.includes('banana')) ? 0.5 : 0.28;
          const contactGeo = new THREE.CircleGeometry(shadowR, 14);
          contactGeo.rotateX(-Math.PI / 2);
          const contactMat = new THREE.MeshBasicMaterial({
            color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false,
          });
          const contactDisc = new THREE.Mesh(contactGeo, contactMat);
          contactDisc.position.set(plant.x, 0.01, plant.z);
          contactDisc.renderOrder = 1;
          aiGroup.add(contactDisc);
        }

        const match = inventory.find(item => {
          if (item.id.toString() === pId || item.id === parseInt(pId, 10)) return true;
          const itemName = item.name.toLowerCase();
          const terms = pId.split('_');
          return terms.some(term =>
            term !== 'plant' &&
            term !== 'tree' &&
            term !== 'flower' &&
            term !== 'shrub' &&
            itemName.includes(term)
          );
        });

        const modelUrl = match ? resolveModelUrl(match.model_file) : null;
        if (modelUrl) {
          // On load failure the procedural placeholder above stays in the scene
          loader.load(
            modelUrl,
            (gltf) => {
              const model = gltf.scene;

              model.position.set(plant.x, 0, plant.z);
              model.rotation.y = (plant.rotation * Math.PI) / 180;

              model.traverse((child) => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                  child.frustumCulled = false;
                  if (child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach((mat) => {
                        mat.side = THREE.DoubleSide;
                      });
                    } else {
                      child.material.side = THREE.DoubleSide;
                    }
                  }
                  if (child.geometry) {
                    child.geometry.computeBoundingBox();
                    child.geometry.computeBoundingSphere();
                  }
                }
              });

              model.updateWorldMatrix(true, true);
              const box = new THREE.Box3().setFromObject(model);
              const size = new THREE.Vector3();
              box.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);

              if (maxDim > 0) {
                let scaleFactor;
                if (match.real_world_size) {
                  // Same rule as the Studio (data/modelSizing.js): height, or longest side for hardscape
                  scaleFactor = realScale(size, Number(match.real_world_size), match.category || 'plant');
                } else {
                  const guess = pId.includes('tree') ? 3.5 : pId.includes('shrub') ? 1.5 : 1.0;
                  scaleFactor = guess / maxDim;
                }
                model.scale.setScalar(scaleFactor);
                // Pin lowest point of the model to ground level
                model.position.y = -box.min.y * scaleFactor;
              }

              if (placeholderMesh) {
                aiGroup.remove(placeholderMesh);
                disposeNode(placeholderMesh);
              }
              aiGroup.add(model);
            },
            undefined,
            (err) => {
              console.error("Failed to load plant GLB model:", modelUrl, err);
            }
          );
        }
      });
    };
  });
  useEffect(() => { placePlantsRef.current(); }, [plants, inventory, arMode]);

  if (!arPhoto) {
    return (
      <canvas
        ref={canvasRef}
        className="w-full block focus:outline-none"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
      />
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
        {editCorners && (
          <CornerPins frameRef={frameRef} corners={corners || defaultCorners()} onChange={onCornersChange} />
        )}
      </div>
    </div>
  );
}

/* ── Four draggable pins on the yard's corners (photo overlay) ─────────────── */
function CornerPins({ frameRef, corners, onChange }) {
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
        <button key={CORNER_LABELS[i]} type="button" aria-label={`Move the ${CORNER_LABELS[i].toLowerCase()} corner`}
          onPointerDown={(e) => { drag.current = i; e.currentTarget.parentElement.setPointerCapture?.(e.pointerId); e.preventDefault(); }}
          style={{ position: 'absolute', left: `${c.u * 100}%`, top: `${c.v * 100}%`, transform: 'translate(-50%, -50%)',
            width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'transparent', padding: 0, cursor: 'grab', touchAction: 'none' }}>
          <span style={{ position: 'absolute', left: '50%', top: '50%', width: 18, height: 18, transform: 'translate(-50%, -50%)', borderRadius: '50%',
            background: '#fbbf24', border: '3px solid #ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
          <span style={{ position: 'absolute', left: '50%', top: c.v > 0.5 ? -14 : 40, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 11, fontWeight: 800, color: '#0f172a', background: 'rgba(251,191,36,0.95)', borderRadius: 4, padding: '1px 6px', pointerEvents: 'none' }}>
            {CORNER_LABELS[i]}
          </span>
        </button>
      ))}
    </div>
  );
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
