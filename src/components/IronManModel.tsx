import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ReactorState } from '../types';

// Asset: Iron Man GLB from github.com/CikguSyahril/IronManAR (Marvel IP, fan model —
// keep this project personal/non-commercial), compressed with gltf-transform
// (Draco geometry + WebP textures, 31.5 MB → 2.9 MB).
const SUIT_URL = `${import.meta.env.BASE_URL}models/ironman.glb`;
const DRACO_PATH = `${import.meta.env.BASE_URL}draco/`;
const SUIT_HEIGHT = 1.8;

// Auxiliary liveries. The albedo is recoloured by luminance inside the suit
// shader, so each palette reads as a dark plate finish plus a bright trim.
const AUX_LIVERIES: { a: number; b: number }[] = [
  { a: 0x1d2a35, b: 0xc9dae5 }, // steel blue / silver
  { a: 0x24272b, b: 0xb4bdc4 }, // gunmetal
  { a: 0x2a2118, b: 0xdaa955 }, // black plate / gold trim
  { a: 0x1f2b28, b: 0xb8cabe }, // dark patina / pale steel
  { a: 0x2c1f1b, b: 0xd18b63 }, // graphite / copper trim
];

/** Soft radial sprite used for the reactor throw, boot thrusters and dust. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(235, 252, 255, 1)');
    gradient.addColorStop(0.28, 'rgba(150, 232, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function IronManModel({ state, squad }: { state: ReactorState; squad: number }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<ReactorState>(state);
  stateRef.current = state;
  const squadRef = useRef(squad);
  squadRef.current = squad;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral keeps the burgundy/gold saturation that ACES washes out.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    camera.position.set(0, 1.0, 4.18);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envTexture;

    scene.add(new THREE.HemisphereLight(0x9fd4ff, 0x05070b, 0.7));
    const key = new THREE.DirectionalLight(0xfff0da, 2.7);
    key.position.set(2.2, 3.2, 3.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x5fdcff, 3.4);
    rim.position.set(-3.2, 2.4, -2.4);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x8ea8ff, 1.1);
    fill.position.set(-2.6, 1.1, 3.2);
    scene.add(fill);
    const top = new THREE.DirectionalLight(0xffffff, 1.2);
    top.position.set(0.3, 4.8, 1.4);
    scene.add(top);

    const suit = new THREE.Group();
    scene.add(suit);

    const glowTexture = makeGlowTexture();

    // Floor bounce so the figure sits in the hologram instead of floating.
    const floorGlowMaterial = new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0x2c7d92,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const floorGlowGeometry = new THREE.PlaneGeometry(1.9, 1.9);
    const floorGlow = new THREE.Mesh(floorGlowGeometry, floorGlowMaterial);
    floorGlow.rotation.x = -Math.PI / 2;
    floorGlow.position.set(0, 0.004, 0.05);
    suit.add(floorGlow);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.64, 0);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.minPolarAngle = 1.3;
    controls.maxPolarAngle = 1.72;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.16;
    controls.update();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) controls.autoRotate = false;

    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    const emissiveMaterials: { material: THREE.MeshStandardMaterial; base: number }[] = [];
    const raycaster = new THREE.Raycaster();
    const FORWARD = new THREE.Vector3(0, 0, -1);

    // The face lights live inside the suit's own shader: a small lens mask in the
    // mesh's local space darkens the eye slits and chin vent in place and re-lights
    // them additively. No overlay meshes, nothing sitting on top of the helmet.
    const eyeGlow = { value: 0 };
    const mouthGlow = { value: 0 };
    const faceEyeL = { value: new THREE.Vector3() };
    const faceEyeR = { value: new THREE.Vector3() };
    const faceMouth = { value: new THREE.Vector3() };
    const faceEyeRadius = { value: new THREE.Vector2(0.0266, 0.0060) };
    const faceMouthRadius = { value: new THREE.Vector2(0.0185, 0.0026) };
    const faceEyeSlant = { value: new THREE.Vector2(-0.1, 0.1) };
    const faceDepth = { value: 0.013 };

    /** World-space surface point on the helmet at (x, y), expressed in mesh space. */
    const surfacePoint = (
      root: THREE.Object3D,
      x: number,
      y: number,
      target: THREE.Vector3,
      onScale: (unit: number) => void,
    ) => {
      raycaster.set(new THREE.Vector3(x, y, 2), FORWARD);
      const hit = raycaster.intersectObject(root, true)[0];
      if (!hit) return false;
      target.copy(hit.point);
      hit.object.worldToLocal(target);
      onScale(hit.object.getWorldScale(new THREE.Vector3()).x || 1);
      return true;
    };

    /** Measure the helmet once so every replica shares the same lens anchors. */
    const buildFaceAnchors = (root: THREE.Object3D) => {
      const probes: { x: number; y: number; target: THREE.Vector3 }[] = [
        { x: -0.0465, y: 1.679, target: faceEyeR.value },
        { x: 0.0465, y: 1.679, target: faceEyeL.value },
        { x: 0, y: 1.607, target: faceMouth.value },
      ];
      let unit = 0;
      for (const probe of probes) {
        if (!surfacePoint(root, probe.x, probe.y, probe.target, (scale) => (unit = scale))) return;
      }
      if (!unit) return;
      // Radii are authored in metres and stored in mesh units so the shader can
      // compare them directly with `position`.
      faceEyeRadius.value.set(0.0266 / unit, 0.0060 / unit);
      faceMouthRadius.value.set(0.0185 / unit, 0.0026 / unit);
      faceDepth.value = 0.013 / unit;
    };

    /**
     * Installs the suit shader on a material. `livery` recolours the albedo by
     * luminance; hero and replicas share the same program, with their own tint
     * uniforms, and every copy shares the face-light uniforms so the whole
     * formation lights up with JARVIS.
     */
    const installSuitShader = (
      material: THREE.MeshStandardMaterial,
      livery?: { a: number; b: number },
    ) => {
      const tintA = { value: new THREE.Color(livery ? livery.a : 0xffffff) };
      const tintB = { value: new THREE.Color(livery ? livery.b : 0xffffff) };
      const tintMix = { value: livery ? 0.92 : 0 };

      material.customProgramCacheKey = () => 'suit-face-lights-v1';
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uEyeL = faceEyeL;
        shader.uniforms.uEyeR = faceEyeR;
        shader.uniforms.uMouth = faceMouth;
        shader.uniforms.uEyeRadius = faceEyeRadius;
        shader.uniforms.uMouthRadius = faceMouthRadius;
        shader.uniforms.uEyeSlant = faceEyeSlant;
        shader.uniforms.uFaceDepth = faceDepth;
        shader.uniforms.uEyeGlow = eyeGlow;
        shader.uniforms.uMouthGlow = mouthGlow;
        shader.uniforms.uTintA = tintA;
        shader.uniforms.uTintB = tintB;
        shader.uniforms.uTintMix = tintMix;

        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vSuitPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSuitPos = position;');

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            [
              '#include <common>',
              'varying vec3 vSuitPos;',
              'uniform vec3 uEyeL;',
              'uniform vec3 uEyeR;',
              'uniform vec3 uMouth;',
              'uniform vec2 uEyeRadius;',
              'uniform vec2 uMouthRadius;',
              'uniform vec2 uEyeSlant;',
              'uniform float uFaceDepth;',
              'uniform float uEyeGlow;',
              'uniform float uMouthGlow;',
              'uniform vec3 uTintA;',
              'uniform vec3 uTintB;',
              'uniform float uTintMix;',
              '// Soft elliptical lens lying on the helmet surface (full weight inside,',
              '// feathered at the rim) limited to a thin shell in front of the head.',
              'float suitLens( vec3 p, vec3 center, vec2 radius, float slant ) {',
              '  vec3 d = p - center;',
              '  float shell = 1.0 - smoothstep( uFaceDepth * 0.55, uFaceDepth, abs( d.z ) );',
              '  float c = cos( slant );',
              '  float s = sin( slant );',
              '  vec2 v = vec2( c * d.x + s * d.y, c * d.y - s * d.x );',
              '  float k = length( v / radius );',
              '  return ( 1.0 - smoothstep( 0.68, 1.0, k ) ) * shell;',
              '}',
            ].join('\n'),
          )
          .replace(
            '#include <color_fragment>',
            [
              '#include <color_fragment>',
              '// Auxiliary livery: remap the painted albedo onto a two-tone finish,',
              '// keeping panel-line contrast by driving the blend with luminance.',
              'float tintLum = dot( diffuseColor.rgb, vec3( 0.30, 0.59, 0.11 ) );',
              'vec3 tinted = mix( uTintA, uTintB, smoothstep( 0.02, 0.42, tintLum ) );',
              'diffuseColor.rgb = mix( diffuseColor.rgb, tinted, uTintMix );',
              'float faceEye = max(',
              '  suitLens( vSuitPos, uEyeL, uEyeRadius, uEyeSlant.y ),',
              '  suitLens( vSuitPos, uEyeR, uEyeRadius, uEyeSlant.x )',
              ');',
              'float faceMouth = suitLens( vSuitPos, uMouth, uMouthRadius, 0.0 );',
              'float faceLens = max( faceEye, faceMouth );',
              '// Darken the baked white slits so they read as dark lenses while idle.',
              'diffuseColor.rgb *= ( 1.0 - 0.93 * faceEye ) * ( 1.0 - 0.5 * faceMouth );',
            ].join('\n'),
          )
          .replace(
            '#include <emissivemap_fragment>',
            [
              '#include <emissivemap_fragment>',
              '// Drop the asset emissive under the lens so the slit reads dead while idle.',
              'totalEmissiveRadiance *= 1.0 - 0.85 * faceLens;',
            ].join('\n'),
          )
          .replace(
            '#include <opaque_fragment>',
            [
              '// The slits are polished lenses: their pale look is reflected light, not',
              '// albedo. Kill that reflection, then emit the glow from the slit itself.',
              'outgoingLight *= 1.0 - 0.95 * faceLens;',
              'outgoingLight += vec3( 0.62, 0.94, 1.0 ) * ( faceEye * uEyeGlow + faceMouth * uMouthGlow );',
              '#include <opaque_fragment>',
            ].join('\n'),
          );
      };
      material.needsUpdate = true;
    };

    let model: THREE.Object3D | null = null;
    let modelBaseY = 0;
    let cancelled = false;

    // ---------------------------------------------------------------- squadron
    // Units are real duplicates that fly in from above under boot thrust, not
    // scale-in placeholders, so the assembly reads as an arrival.
    const FLIGHT_MS = 1150;
    const FLIGHT_HEIGHT = 3.6;

    const squadSlots = (index: number) => {
      const side = index % 2 === 0 ? 1 : -1;
      const rank = Math.floor(index / 2);
      return {
        x: side * (0.86 + rank * 0.44),
        z: -0.52 - rank * 0.6,
        yaw: side * (0.08 + rank * 0.035),
      };
    };

    type Trooper = {
      holder: THREE.Group;
      body: THREE.Group;
      index: number;
      x: number;
      z: number;
      yaw: number;
      born: number;
      dying: boolean;
      dyingAt: number;
      dustAt: number;
      jets: THREE.Group;
      dust: THREE.Mesh;
      dustMaterial: THREE.MeshBasicMaterial;
      coreMaterial: THREE.SpriteMaterial;
      plumeMaterial: THREE.SpriteMaterial;
      material: THREE.MeshStandardMaterial;
    };
    const troopers: Trooper[] = [];
    let deployAt = -1e6;
    // Assembly is framed head-on: the camera turns to face the formation, then
    // the slow idle orbit resumes.
    let swingUntil = 0;

    const dustGeometry = new THREE.PlaneGeometry(1.5, 1.5);

    /** Two boot thrusters plus an outer plume, billboarded under each foot. */
    const buildJets = (coreMaterial: THREE.SpriteMaterial, plumeMaterial: THREE.SpriteMaterial) => {
      const group = new THREE.Group();
      for (const side of [-1, 1]) {
        const core = new THREE.Sprite(coreMaterial);
        core.scale.set(0.14, 0.42, 1);
        core.position.set(side * 0.105, -0.17, 0.02);
        group.add(core);

        const plume = new THREE.Sprite(plumeMaterial);
        plume.scale.set(0.22, 0.68, 1);
        plume.position.set(side * 0.105, -0.3, 0.02);
        group.add(plume);
      }
      return group;
    };

    const spawnTrooper = (index: number) => {
      if (!model) return;
      const slot = squadSlots(index);
      const holder = new THREE.Group();
      const body = new THREE.Group();

      const replica = model.clone(true);
      const livery = AUX_LIVERIES[index % AUX_LIVERIES.length];
      let auxMaterial: THREE.MeshStandardMaterial | null = null;
      replica.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const source = mesh.material as THREE.MeshStandardMaterial;
        if (!auxMaterial) {
          auxMaterial = source.clone();
          auxMaterial.emissiveIntensity = Math.min(auxMaterial.emissiveIntensity ?? 1, 0.45);
          installSuitShader(auxMaterial, livery);
        }
        mesh.material = auxMaterial;
      });

      const coreMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xf2feff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const plumeMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0x6fd8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const jets = buildJets(coreMaterial, plumeMaterial);
      body.add(jets);
      body.add(replica);
      holder.add(body);
      holder.position.set(slot.x, FLIGHT_HEIGHT, slot.z);
      holder.rotation.y = slot.yaw;
      suit.add(holder);

      const dustMaterial = new THREE.MeshBasicMaterial({
        map: glowTexture,
        color: 0xa8ecff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const dust = new THREE.Mesh(dustGeometry, dustMaterial);
      dust.rotation.x = -Math.PI / 2;
      dust.position.set(slot.x, 0.008, slot.z);
      suit.add(dust);

      troopers.push({
        holder,
        body,
        index,
        x: slot.x,
        z: slot.z,
        yaw: slot.yaw,
        born: performance.now(),
        dying: false,
        dyingAt: 0,
        dustAt: 0,
        jets,
        dust,
        dustMaterial,
        coreMaterial,
        plumeMaterial,
        material: auxMaterial as unknown as THREE.MeshStandardMaterial,
      });
      deployAt = performance.now();
    };

    const settleSquad = (want: number) => {
      if (!model) return;
      const alive = troopers.filter((trooper) => !trooper.dying);
      if (want > alive.length) {
        if (alive.length === 0) swingUntil = performance.now() + 1800;
        const used = new Set(alive.map((trooper) => trooper.index));
        let missing = want - alive.length;
        let slot = 0;
        while (missing > 0 && slot < 32) {
          if (!used.has(slot)) {
            spawnTrooper(slot);
            used.add(slot);
            missing -= 1;
          }
          slot += 1;
        }
      } else if (want < alive.length) {
        const nowMs = performance.now();
        for (let i = alive.length - 1; i >= want; i -= 1) {
          alive[i].dying = true;
          alive[i].dyingAt = nowMs;
        }
      }
    };

    const disposeModel = (root: THREE.Object3D) => {
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) value.dispose();
          });
          material.dispose();
        });
      });
    };

    loader.load(
      SUIT_URL,
      (gltf) => {
        if (cancelled) {
          disposeModel(gltf.scene);
          return;
        }
        const root = gltf.scene;
        let suitMaterial: THREE.MeshStandardMaterial | null = null;
        root.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.frustumCulled = false;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            const standard = material as THREE.MeshStandardMaterial;
            if (!suitMaterial) suitMaterial = standard;
            standard.envMapIntensity = 1.15;
            // The source ships a very weak normal scale (0.32); lift it so the
            // panel lines and helmet edges stay crisp instead of reading soft.
            standard.normalScale?.set(0.85, 0.85);
            [standard.map, standard.normalMap, standard.roughnessMap, standard.metalnessMap, standard.emissiveMap].forEach(
              (texture) => {
                if (texture) texture.anisotropy = maxAnisotropy;
              },
            );
            if (standard.emissive && standard.emissiveIntensity > 0) {
              emissiveMaterials.push({ material: standard, base: standard.emissiveIntensity });
            }
            standard.needsUpdate = true;
          });
        });

        // Normalise height, put the feet at the floor and centre the figure.
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const scale = SUIT_HEIGHT / Math.max(size.y, 0.001);
        root.scale.setScalar(scale);
        root.updateMatrixWorld(true);
        const scaled = new THREE.Box3().setFromObject(root);
        const center = scaled.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= scaled.min.y;

        // The asset already faces +Z, i.e. the camera.

        suit.add(root);
        root.updateMatrixWorld(true);
        model = root;
        modelBaseY = root.position.y;
        if (suitMaterial) {
          buildFaceAnchors(root);
          installSuitShader(suitMaterial);
        }

        controls.target.set(0, SUIT_HEIGHT * 0.5, 0);
        controls.update();
      },
      undefined,
      (error) => {
        console.warn('Suit asset failed to load', error);
      },
    );

    const start = performance.now();
    let frame = 0;
    let lastFrame = performance.now();
    const render = () => {
      frame = requestAnimationFrame(render);
      const nowMs = performance.now();
      const dt = Math.min(0.06, Math.max(0.001, (nowMs - lastFrame) / 1000));
      lastFrame = nowMs;
      const t = (nowMs - start) / 1000;
      const current = stateRef.current;
      const pulse = current === 'speaking' ? 1.75 : current === 'thinking' ? 1.3 : 1;
      const desiredSquad = Math.max(0, Math.min(10, Math.round(squadRef.current)));
      if (model) settleSquad(desiredSquad);

      if (model) {
        const flicker = 1 + Math.sin(t * 3) * 0.06;
        emissiveMaterials.forEach(({ material, base }) => {
          // The asset's emissive map also tints the plates, so honouring its full
          // 3.2x strength blows the red/gold out to white. Cap it at the level that
          // keeps the armour rich; the reactor and face are driven separately.
          material.emissiveIntensity = Math.min(base, 1.15) * pulse * flicker;
        });

        // Eye slits and mouth glow only while JARVIS is speaking.
        const speaking = current === 'speaking';
        const blink = (t % 2.7) < 0.12;
        const eyePower = speaking && !blink ? 0.6 + 0.4 * Math.abs(Math.sin(t * 7.4)) : 0;
        const mouthPower = speaking ? 0.4 + 0.6 * Math.abs(Math.sin(t * 11.3)) : 0;
        // Every unit shares the face shader, so the whole formation lights up
        // with JARVIS; the ignition flash runs across all of them on assembly.
        const flash = Math.max(0, 1 - (nowMs - deployAt) / 900);
        eyeGlow.value = eyePower * 3.2 + flash * 1.4;
        mouthGlow.value = mouthPower * 1.5 + flash * 0.5;

        model.position.y = modelBaseY + (reducedMotion ? 0 : Math.sin(t * 0.8) * 0.006);
      }

      // Fly-in, touchdown, and the powered-down climb out on dismissal.
      let standing = 0;
      for (const trooper of troopers) {
        const launch = nowMs - trooper.born - trooper.index * 90;
        const flight = THREE.MathUtils.clamp(launch / FLIGHT_MS, 0, 1);
        const descent = 1 - Math.pow(1 - flight, 3);
        const fade = trooper.dying ? THREE.MathUtils.clamp((nowMs - trooper.dyingAt) / 900, 0, 1) : 0;

        let jet = 0;
        if (trooper.dying) {
          jet = THREE.MathUtils.clamp(fade * 2, 0, 1) * (1 - THREE.MathUtils.clamp((fade - 0.72) / 0.28, 0, 1));
          trooper.holder.position.y = fade * fade * FLIGHT_HEIGHT;
          trooper.holder.scale.setScalar(1 - Math.pow(fade, 3));
          trooper.body.rotation.x = fade * 0.12;
          trooper.body.position.y = 0;
        } else {
          // Descends feet-first on a shallow arc, slipping outward and back as
          // it drops, then decelerates into its slot.
          const drift = 1 - descent;
          trooper.holder.position.x = trooper.x * (1 + drift * 0.38);
          trooper.holder.position.z = trooper.z - drift * 1.0;
          trooper.holder.position.y = (1 - descent) * FLIGHT_HEIGHT;
          trooper.body.rotation.x = -(1 - THREE.MathUtils.smoothstep(flight, 0.55, 0.96)) * 0.2;
          // Absorb the landing: a short dip as the boots take the weight.
          const settle = THREE.MathUtils.clamp((flight - 0.9) / 0.1, 0, 1);
          trooper.body.position.y = -Math.sin(settle * Math.PI) * 0.055;
          jet = 1 - THREE.MathUtils.smoothstep(flight, 0.8, 0.98);
          if (flight >= 0.9 && !trooper.dustAt) trooper.dustAt = nowMs;
        }

        // Idle sway once the unit is on the deck.
        const grounded = !trooper.dying && flight >= 1;
        trooper.holder.rotation.y =
          trooper.yaw + (grounded && !reducedMotion ? Math.sin(t * 0.6 + trooper.index) * 0.014 : 0);

        const shimmer = reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(t * 34 + trooper.index * 1.7);
        trooper.coreMaterial.opacity = jet * shimmer;
        trooper.plumeMaterial.opacity = jet * shimmer * 0.55;
        for (const child of trooper.jets.children) {
          if (!(child instanceof THREE.Sprite)) continue;
          const isCore = child.material === trooper.coreMaterial;
          const height =
            (isCore ? 0.42 : 0.68) *
            (0.85 + jet * 0.5 + (reducedMotion ? 0 : 0.08 * Math.sin(t * 27 + trooper.index)));
          child.scale.set(isCore ? 0.14 : 0.22, height, 1);
        }

        if (trooper.dustAt) {
          const burst = THREE.MathUtils.clamp((nowMs - trooper.dustAt) / 700, 0, 1);
          const ringScale = 0.7 + burst * 1.9;
          trooper.dust.scale.setScalar(ringScale);
          trooper.dustMaterial.opacity = Math.max(0, 1 - burst) * 0.5;
        } else {
          trooper.dustMaterial.opacity = 0;
        }

        if (!trooper.dying) standing += 1;
      }

      for (let i = troopers.length - 1; i >= 0; i -= 1) {
        const trooper = troopers[i];
        if (trooper.dying && nowMs - trooper.dyingAt > 920) {
          suit.remove(trooper.holder);
          suit.remove(trooper.dust);
          trooper.coreMaterial.dispose();
          trooper.plumeMaterial.dispose();
          trooper.dustMaterial.dispose();
          trooper.material?.dispose();
          troopers.splice(i, 1);
        }
      }

      // Widen the shot only as far as the formation actually needs.
      const formation = desiredSquad > 0 || troopers.length > 0;
      const tanV = Math.tan((camera.fov * Math.PI) / 360);
      const aspect = Math.max(camera.aspect, 0.4);
      const fit = formation ? Math.max(3.0 / (tanV * aspect), 1.5 / tanV) + 1.5 : 4.18;
      const offset = camera.position.clone().sub(controls.target);
      const distance = offset.length() || fit;
      const eased = THREE.MathUtils.damp(distance, fit, 2.4, dt);
      const swinging = nowMs < swingUntil;
      const phi = Math.acos(THREE.MathUtils.clamp(offset.y / Math.max(distance, 0.001), -1, 1));
      let theta = Math.atan2(offset.x, offset.z);
      if (swinging) theta = THREE.MathUtils.damp(theta, 0, 3.4, dt);
      controls.autoRotate = !swinging && !reducedMotion;
      camera.position.set(
        controls.target.x + eased * Math.sin(phi) * Math.sin(theta),
        controls.target.y + eased * Math.cos(phi),
        controls.target.z + eased * Math.sin(phi) * Math.cos(theta),
      );

      const glowScale = 1 + standing * 0.2;
      floorGlow.scale.setScalar(THREE.MathUtils.damp(floorGlow.scale.x, glowScale, 2, dt));
      floorGlowMaterial.opacity = THREE.MathUtils.damp(
        floorGlowMaterial.opacity,
        standing > 0 ? 0.17 : 0.24,
        2,
        dt,
      );

      controls.update();
      renderer.render(scene, camera);
    };

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      draco.dispose();
      if (model) disposeModel(model);
      glowTexture.dispose();
      dustGeometry.dispose();
      floorGlowGeometry.dispose();
      floorGlowMaterial.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      className="suit-canvas"
      ref={hostRef}
      role="img"
      aria-label="Iron Man Mark VII armour — drag to rotate"
    />
  );
}
