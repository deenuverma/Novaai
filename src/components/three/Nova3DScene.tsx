import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type Nova3DVoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Nova3DSceneProps {
  className?: string;
  audioLevel?: number;
  voiceState?: Nova3DVoiceState;
  interactive?: boolean;
  compact?: boolean;
}

const _dummyObj = new THREE.Object3D();
const _tempColor = new THREE.Color();

// Emerald Jade, Warm Champagne Bronze & Obsidian Titanium Studio Palette
const HEX_EMERALD_DEEP = 0x064e3b;
const HEX_EMERALD_CORE = 0x059669;
const HEX_EMERALD_BRIGHT = 0x10b981;
const HEX_MINT_LUMINOUS = 0x6ee7b7;
const HEX_BRONZE_DEEP = 0x8c5e3c;
const HEX_BRONZE_CHAMPAGNE = 0xc8956b;
const HEX_TITANIUM_SLATE = 0x24342d;

function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(5, 150, 105, 0.44)');
    grad.addColorStop(0.5, 'rgba(200, 149, 107, 0.16)');
    grad.addColorStop(1, 'rgba(5, 150, 105, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Nova3DScene({
  className = 'h-72 w-full',
  audioLevel = 0,
  voiceState = 'idle',
  interactive = true,
  compact = false,
}: Nova3DSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const audioLevelRef = useRef(audioLevel);
  const voiceStateRef = useRef<Nova3DVoiceState>(voiceState);
  const [webglFailed, setWebglFailed] = useState(false);

  audioLevelRef.current = audioLevel;
  voiceStateRef.current = voiceState;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl =
          probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setClearColor(0x000000, 0);

    const initWidth = Math.max(container.clientWidth, 200);
    const initHeight = Math.max(container.clientHeight, 200);
    renderer.setSize(initWidth, initHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Studio PBR environment reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      compact ? 42 : 40,
      initWidth / initHeight,
      0.1,
      50
    );
    camera.position.set(0, 0.25, compact ? 5.8 : 6.2);
    camera.lookAt(0, 0, 0);

    // 3-Point Warm Champagne Bronze & Cool Emerald Studio Rig
    const hemiLight = new THREE.HemisphereLight(
      HEX_MINT_LUMINOUS,
      HEX_EMERALD_DEEP,
      1.1
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(HEX_BRONZE_CHAMPAGNE, 2.5);
    keyLight.position.set(4.5, 5.5, 5.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(HEX_EMERALD_BRIGHT, 2.3);
    rimLight.position.set(-5.0, 2.5, -4.0);
    scene.add(rimLight);

    const corePointLight = new THREE.PointLight(HEX_MINT_LUMINOUS, 2.1, 8);
    corePointLight.position.set(0, 0, 0);
    scene.add(corePointLight);

    // Composite 9-Part Procedural Model (Emerald Jade, Champagne Bronze & Titanium)
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const disposables: Array<{ dispose: () => void }> = [envTarget];

    // 1. Primary Silhouette: Faceted Emerald Jade Crystal Core
    const coreGeo = new THREE.IcosahedronGeometry(0.95, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: HEX_EMERALD_CORE,
      emissive: HEX_EMERALD_DEEP,
      emissiveIntensity: 0.35,
      metalness: 0.38,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      flatShading: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    rootGroup.add(coreMesh);
    disposables.push(coreGeo, coreMat);

    // 2. Inner Luminous Mint Nucleus
    const nucleusGeo = new THREE.OctahedronGeometry(0.56, 0);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: HEX_MINT_LUMINOUS,
      emissive: HEX_EMERALD_BRIGHT,
      emissiveIntensity: 0.85,
      metalness: 0.22,
      roughness: 0.42,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    rootGroup.add(nucleusMesh);
    disposables.push(nucleusGeo, nucleusMat);

    // 3. Geodesic Champagne Bronze Wire Cage around Core
    const cageGeo = new THREE.IcosahedronGeometry(1.16, 1);
    const cageMat = new THREE.MeshStandardMaterial({
      color: HEX_BRONZE_CHAMPAGNE,
      emissive: HEX_BRONZE_DEEP,
      emissiveIntensity: 0.22,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: true,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    rootGroup.add(cageMesh);
    disposables.push(cageGeo, cageMat);

    // 4, 5, 6. Secondary Read: 3 Precision Gyroscopic Rings (Brushed Bronze, Matte Titanium & Emerald)
    const ring1Geo = new THREE.TorusGeometry(1.52, 0.055, 20, 84);
    const ringBronzeMat = new THREE.MeshPhysicalMaterial({
      color: HEX_BRONZE_CHAMPAGNE,
      emissive: HEX_BRONZE_DEEP,
      emissiveIntensity: 0.16,
      metalness: 0.94,
      roughness: 0.15,
      anisotropy: 0.8,
      clearcoat: 0.75,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ringBronzeMat);
    ring1.rotation.x = Math.PI * 0.32;
    rootGroup.add(ring1);
    disposables.push(ring1Geo, ringBronzeMat);

    const ring2Geo = new THREE.TorusGeometry(1.86, 0.048, 20, 96);
    const ringTitaniumMat = new THREE.MeshStandardMaterial({
      color: HEX_TITANIUM_SLATE,
      emissive: HEX_EMERALD_DEEP,
      emissiveIntensity: 0.22,
      metalness: 0.62,
      roughness: 0.46, // >= 0.25 roughness contrast vs brushed bronze ring
    });
    const ring2 = new THREE.Mesh(ring2Geo, ringTitaniumMat);
    ring2.rotation.y = Math.PI * 0.28;
    ring2.rotation.x = -Math.PI * 0.22;
    rootGroup.add(ring2);
    disposables.push(ring2Geo, ringTitaniumMat);

    const ring3Geo = new THREE.TorusGeometry(2.18, 0.034, 16, 100);
    const ringEmeraldMat = new THREE.MeshStandardMaterial({
      color: HEX_EMERALD_BRIGHT,
      emissive: HEX_EMERALD_DEEP,
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ringEmeraldMat);
    ring3.rotation.z = Math.PI * 0.18;
    ring3.rotation.x = Math.PI * 0.44;
    rootGroup.add(ring3);
    disposables.push(ring3Geo, ringEmeraldMat);

    // 7. Extruded Beveled Knowledge Prisms Orbiting Core
    const prismShape = new THREE.Shape();
    const s = 0.14;
    prismShape.moveTo(0, s);
    prismShape.lineTo(s * 0.86, 0);
    prismShape.lineTo(0, -s);
    prismShape.lineTo(-s * 0.86, 0);
    prismShape.closePath();

    const prismGeo = new THREE.ExtrudeGeometry(prismShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });
    prismGeo.center();
    disposables.push(prismGeo);

    const prismGroup = new THREE.Group();
    rootGroup.add(prismGroup);
    const prismMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const isBronze = i % 2 === 0;
      const mesh = new THREE.Mesh(
        prismGeo,
        isBronze ? ringBronzeMat : ringEmeraldMat
      );
      const angle = (i / 4) * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * 2.35,
        (i % 2 === 0 ? 1 : -1) * 0.45,
        Math.sin(angle) * 2.35
      );
      prismGroup.add(mesh);
      prismMeshes.push(mesh);
    }

    // 8. Accent Detail: InstancedMesh of 36 Emerald & Champagne Bronze Orbital Nodes
    const satCount = 36;
    const satGeo = new THREE.DodecahedronGeometry(0.065, 0);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.78,
    });
    const satellites = new THREE.InstancedMesh(satGeo, satMat, satCount);
    satellites.frustumCulled = false;

    const satData = Array.from({ length: satCount }, (_, idx) => ({
      radius: 1.45 + (idx % 5) * 0.24,
      angle: (idx / satCount) * Math.PI * 2,
      speed: 0.35 + (idx % 4) * 0.14,
      yAmp: 0.35 + (idx % 3) * 0.28,
      scale: 0.85 + (idx % 3) * 0.15,
    }));

    for (let i = 0; i < satCount; i++) {
      const d = satData[i];
      _dummyObj.position.set(
        Math.cos(d.angle) * d.radius,
        Math.sin(d.angle * 2) * d.yAmp,
        Math.sin(d.angle) * d.radius
      );
      _dummyObj.scale.setScalar(d.scale);
      _dummyObj.updateMatrix();
      satellites.setMatrixAt(i, _dummyObj.matrix);
      _tempColor.setHex(
        i % 2 === 0 ? HEX_BRONZE_CHAMPAGNE : HEX_EMERALD_BRIGHT
      );
      satellites.setColorAt(i, _tempColor);
    }
    satellites.instanceMatrix.needsUpdate = true;
    if (satellites.instanceColor) satellites.instanceColor.needsUpdate = true;
    satellites.computeBoundingSphere();
    rootGroup.add(satellites);
    disposables.push(satGeo, satMat);

    // 9. Soft Emerald & Bronze Radial Contact Grounding Plane
    const shadowTex = createRadialContactShadowTexture();
    shadowTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const shadowGeo = new THREE.PlaneGeometry(4.6, 4.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -2.25;
    scene.add(shadowPlane);
    disposables.push(shadowTex, shadowGeo, shadowMat);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer Interaction Kinematics
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let isDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (!interactive) return;
      isDragging = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      if (isDragging) {
        const dx = e.clientX - lastPointerX;
        const dy = e.clientY - lastPointerY;
        lastPointerX = e.clientX;
        lastPointerY = e.clientY;
        targetRotY += dx * 0.01;
        targetRotX = THREE.MathUtils.clamp(targetRotX + dy * 0.008, -0.7, 0.7);
      } else if (rect.width > 0 && rect.height > 0) {
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        targetRotY = nx * 0.42;
        targetRotX = ny * 0.28;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 160);
      const h = Math.max(container.clientHeight, 160);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
    let elapsed = 0;
    let smoothedLevel = 0;
    let smoothedScale = 1;
    let frameId = 0;
    let unmounted = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (unmounted) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const state = voiceStateRef.current;
      const rawLevel = THREE.MathUtils.clamp(audioLevelRef.current, 0, 1);

      const speedMult = prefersReducedMotion
        ? 0.2
        : state === 'speaking'
          ? 2.2
          : state === 'thinking'
            ? 2.8
            : state === 'listening'
              ? 1.5
              : 1.0;

      elapsed += dt * speedMult;
      smoothedLevel = THREE.MathUtils.damp(smoothedLevel, rawLevel, 10, dt);

      const desiredScale =
        state === 'speaking'
          ? 1.06 + smoothedLevel * 0.34
          : state === 'listening'
            ? 1.02 + smoothedLevel * 0.24
            : state === 'thinking'
              ? 1.04 + Math.sin(elapsed * 4) * 0.05
              : 1.0 + Math.sin(elapsed * 1.8) * 0.03;

      smoothedScale = THREE.MathUtils.damp(smoothedScale, desiredScale, 8, dt);

      currentRotX = THREE.MathUtils.damp(currentRotX, targetRotX, 6, dt);
      currentRotY = THREE.MathUtils.damp(currentRotY, targetRotY, 6, dt);

      rootGroup.rotation.x = currentRotX;
      rootGroup.rotation.y = currentRotY + elapsed * 0.22;
      rootGroup.position.y = Math.sin(elapsed * 1.4) * 0.09;

      coreMesh.scale.setScalar(smoothedScale);
      coreMesh.rotation.y = elapsed * 0.45;
      coreMesh.rotation.z = elapsed * 0.25;

      nucleusMesh.scale.setScalar(0.95 + smoothedLevel * 0.45);
      nucleusMesh.rotation.x = -elapsed * 0.9;
      nucleusMat.emissiveIntensity =
        state === 'speaking'
          ? 1.15 + smoothedLevel * 1.1
          : state === 'listening'
            ? 0.95 + smoothedLevel * 0.8
            : 0.85;

      cageMesh.scale.setScalar(1.0 + smoothedLevel * 0.18);
      cageMesh.rotation.y = -elapsed * 0.35;

      ring1.rotation.z = elapsed * 0.72;
      ring2.rotation.x = -Math.PI * 0.22 + elapsed * 0.54;
      ring3.rotation.y = elapsed * 0.42;

      prismGroup.rotation.y = -elapsed * 0.5;
      for (let i = 0; i < prismMeshes.length; i++) {
        prismMeshes[i].rotation.x = elapsed * 1.2 + i;
        prismMeshes[i].rotation.y = elapsed * 0.9 + i;
      }

      for (let i = 0; i < satCount; i++) {
        const d = satData[i];
        const a = d.angle + elapsed * d.speed;
        const r = d.radius + smoothedLevel * 0.22;
        _dummyObj.position.set(
          Math.cos(a) * r,
          Math.sin(a * 2 + i) * d.yAmp,
          Math.sin(a) * r
        );
        _dummyObj.rotation.set(a, a * 0.5, 0);
        _dummyObj.scale.setScalar(d.scale * (1 + smoothedLevel * 0.25));
        _dummyObj.updateMatrix();
        satellites.setMatrixAt(i, _dummyObj.matrix);
      }
      satellites.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      for (const item of disposables) {
        try {
          item.dispose();
        } catch {
          // ignore
        }
      }
      renderer.dispose();
    };
  }, [compact, interactive]);

  if (webglFailed) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-[#10B981]/35 bg-gradient-to-br from-[#064E3B] via-[#0F2922] to-[#2B1F16] p-6 text-center ${className}`}
      >
        <div className="h-28 w-28 rounded-full border-2 border-[#C8956B] bg-[#059669] shadow-lg" />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      aria-label="Interactive 3D Emerald and Bronze Nova Core"
      className={`relative select-none touch-none ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${className}`}
    />
  );
}
