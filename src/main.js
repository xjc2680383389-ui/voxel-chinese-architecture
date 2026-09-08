import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelWorld, setGlowLevel } from './voxel.js';
import { C } from './palette.js';
import { stamp, makeHall, makeTower, makePagoda, makePavilion, makeCorridor } from './buildings.js';
import {
  SITE, createGround, makeWallRun, makeScreenWall, makeTree,
  makeLion, makeIncenseBurner, makeHangingLantern, makeLanternPost,
  makeStoneLantern, makePaifang,
} from './environment.js';

/* ============================================================ 光照预设 */

const PRESETS = {
  chen: {
    label: '晨',
    sun: { dir: [1.15, 0.42, 0.75], color: 0xffd7b0, intensity: 2.5 },
    hemi: { sky: 0xa8c8e8, ground: 0x6b5f4a, intensity: 0.85 },
    amb: { color: 0x9fb6cc, intensity: 0.35 },
    sky: { top: 0x2f5f96, mid: 0x9fc4dd, bottom: 0xf0c9a8 },
    fog: { color: 0xcfdce4, near: 190, far: 660 },
    glow: 0.15, exposure: 1.0, shadowTint: 0.55,
  },
  wu: {
    label: '午',
    sun: { dir: [0.35, 1.25, 0.55], color: 0xfff4e0, intensity: 3.1 },
    hemi: { sky: 0xbcdcf5, ground: 0x8a7c60, intensity: 0.95 },
    amb: { color: 0xdfe9f2, intensity: 0.4 },
    sky: { top: 0x2a6bb0, mid: 0x9cc8ea, bottom: 0xe8eef0 },
    fog: { color: 0xdbe6ec, near: 240, far: 780 },
    glow: 0.08, exposure: 1.0, shadowTint: 0.5,
  },
  hun: {
    label: '昏',
    sun: { dir: [-1.35, 0.30, 0.42], color: 0xff9c4a, intensity: 3.0 },
    hemi: { sky: 0x8b82b8, ground: 0x6b523c, intensity: 1.15 },
    amb: { color: 0x8f7f96, intensity: 0.62 },
    sky: { top: 0x24315c, mid: 0x8f6a86, bottom: 0xf09a4e },
    fog: { color: 0x8a6f78, near: 150, far: 580 },
    glow: 0.55, exposure: 1.04, shadowTint: 0.42,
  },
  ye: {
    label: '夜',
    sun: { dir: [-0.6, 0.95, -0.5], color: 0x93a9d8, intensity: 0.5 },
    hemi: { sky: 0x2b3a63, ground: 0x14161c, intensity: 0.42 },
    amb: { color: 0x2f3c5c, intensity: 0.4 },
    sky: { top: 0x050a1c, mid: 0x142140, bottom: 0x2a2f4a },
    fog: { color: 0x121a2e, near: 120, far: 520 },
    glow: 1.0, exposure: 1.15, shadowTint: 0.25,
  },
};

/* ============================================================ 场景装配 */

const WALL_X = 92;
const WALL_Z = 92;
const BUILDING_COUNT = 12;

function buildCity(matte, glow) {
  const counts = {};

  /* —— 中轴线：南 → 北 —— */

  // 1. 山门（殿式门，三洞，青砖红墙，歇山顶）
  const gate = makeHall({
    w: 28, d: 14, h: 10, bays: 5, depthBays: 1, terrace: 1,
    tierH: 2, tierSpreadX: 10, tierSpreadZ: 3, tierInsetX: 0, tierInsetZ: 0,
    roof: 'xieshan', roofH: 6, wall: C.brick, column: C.vermilion,
    tile: C.tileGrey, tileDeep: C.tileGreyDeep, ridge: C.ridgeDark,
    lift: 3, over: 4, wallInset: 2, openings: 3, plaqueW: 7,
  });
  gate.cut(-1, 2, 2, 1, 9, 8, C.interior);
  gate.cut(-7, 2, 2, -5, 8, 8, C.interior);
  gate.cut(5, 2, 2, 7, 8, 8, C.interior);
  stamp(matte, gate, 0, WALL_Z, 0);
  counts.gate = gate.count;

  // 2. 影壁
  const screen = new VoxelWorld();
  makeScreenWall(screen, glow, { w: 22, h: 8 });
  stamp(matte, screen, 0, 78, 0);

  // 3. 钟楼 / 鼓楼 对称
  const bell = makeTower({
    baseW: 13, baseD: 13, baseH: 7, archW: 5, archH: 5, baseWall: C.brick,
    w: 17, d: 13, h: 8, bays: 3, depthBays: 1, roof: 'xieshan', roofH: 7,
    tile: C.tileGreen, tileDeep: C.tileGreenDeep, instrument: 'bell', plaque: true, plaqueW: 5,
  });
  const drum = makeTower({
    baseW: 13, baseD: 13, baseH: 7, archW: 5, archH: 5, baseWall: C.brick,
    w: 17, d: 13, h: 8, bays: 3, depthBays: 1, roof: 'xieshan', roofH: 7,
    tile: C.tileGreen, tileDeep: C.tileGreenDeep, instrument: 'drum', plaque: true, plaqueW: 5,
  });
  stamp(matte, bell, -36, 60, 0);
  stamp(matte, drum, 36, 60, 0, true);
  counts.towers = bell.count + drum.count;

  // 4. 牌楼（动线上的标志，立于中轴）
  const paifang = new VoxelWorld();
  makePaifang(paifang, new VoxelWorld(), { half: 13, h: 13 });
  stamp(matte, paifang, 0, 40, 0);
  counts.paifang = paifang.count;

  // 5. 配殿 对称（坐西朝东 / 坐东朝西）
  const wing = makeHall({
    w: 22, d: 11, h: 8, bays: 5, depthBays: 1, terrace: 1,
    tierH: 2, tierSpreadX: 7, tierSpreadZ: 6, tierInsetX: 0, tierInsetZ: 0,
    roof: 'xieshan', roofH: 5, wall: C.wallRed, column: C.vermilion,
    tile: C.tileGreen, tileDeep: C.tileGreenDeep, lift: 2, over: 4, openings: 1, plaqueW: 5,
  });
  stamp(matte, wing, -46, 22, 3);
  stamp(matte, wing, 46, 22, 1, true);
  counts.wings = wing.count * 2;

  // 6. 主殿：重檐庑殿顶，三重台基 —— 全场景等级最高、体量最大
  const main = makeHall({
    w: 36, d: 24, h: 14, h2: 10, bays: 7, depthBays: 3, levels: 2, terrace: 3,
    tierH: 3, tierSpreadX: 8, tierSpreadZ: 7, tierInsetX: 3, tierInsetZ: 2,
    roof: 'wudian', roofH: 8, wall: C.wallRed, column: C.vermilion,
    tile: C.tileGold, tileDeep: C.tileGoldDeep, ridge: C.ridgeDark,
    lift: 4, over: 5, wallInset: 3, openings: 3, colCross: 2, plaqueW: 9, skirtH: 5,
  });
  stamp(matte, main, 0, -16, 0);
  counts.main = main.count;

  // 7. 后殿藏经阁：重檐歇山
  const library = makeHall({
    w: 26, d: 15, h: 11, h2: 8, bays: 5, depthBays: 2, levels: 2, terrace: 1,
    tierH: 3, tierSpreadX: 7, tierSpreadZ: 6, tierInsetX: 0, tierInsetZ: 0,
    roof: 'xieshan', roofH: 6, wall: C.wallRed, column: C.vermilion,
    tile: C.tileGreen, tileDeep: C.tileGreenDeep, ridge: C.ridgeDark,
    lift: 3, over: 4, wallInset: 2, openings: 1, plaqueW: 7,
  });
  stamp(matte, library, 0, -66, 0);
  counts.library = library.count;

  // 8. 宝塔（西北塔院，方形楼阁式，六层）
  const pagoda = makePagoda({
    stories: 6, r0: 11, storyH: 8, taper: 1.0,
    wall: C.plaster, wall2: C.plasterShade, pilaster: C.wallRedDeep,
    tile: C.tileGreen, tileDeep: C.tileGreenDeep, lift: 3,
  });
  stamp(matte, pagoda, -62, -54, 0);
  counts.pagoda = pagoda.count;

  // 9. 碑亭（东北，与塔对称）
  const pav = makePavilion({ w: 15, h: 9, tile: C.tileGreen, tileDeep: C.tileGreenDeep, stele: true });
  stamp(matte, pav, 62, -54, 0);
  counts.pavilion = pav.count;

  // 10. 游廊：围合主殿院落，动线由此转向主殿
  const corridor = makeCorridor({ len: 34, h: 6, tile: C.tileGrey, tileDeep: C.tileGreyDeep });
  stamp(matte, corridor, -30, 22, 1);
  stamp(matte, corridor, 30, 22, 3, true);
  const shortCorridor = makeCorridor({ len: 20, h: 6, tile: C.tileGrey, tileDeep: C.tileGreyDeep });
  stamp(matte, shortCorridor, -25, 40, 0);
  stamp(matte, shortCorridor, 25, 40, 0, true);
  counts.corridors = corridor.count * 2 + shortCorridor.count * 2;

  /* —— 围墙 —— */
  makeWallRun(matte, -WALL_X, WALL_Z, -24, WALL_Z, { h: 9, thickness: 3 });
  makeWallRun(matte, 24, WALL_Z, WALL_X, WALL_Z, { h: 9, thickness: 3 });
  makeWallRun(matte, -WALL_X, -WALL_Z, -WALL_X, WALL_Z, { h: 9, thickness: 3 });
  makeWallRun(matte, WALL_X, -WALL_Z, WALL_X, WALL_Z, { h: 9, thickness: 3 });

  /* —— 庭院小件 —— */
  const lion = new VoxelWorld();
  makeLion(lion);
  stamp(matte, lion, -11, 101, 2);
  stamp(matte, lion, 11, 101, 2, true);

  const burner = new VoxelWorld();
  const burnerGlow = new VoxelWorld();
  makeIncenseBurner(burner, burnerGlow);
  stamp(matte, burner, 0, -2, 0, false, 9);
  glow.merge(burnerGlow, (x, y, z) => [x, y + 9, z]);

  for (const z of [66, 52, 28, 12]) {
    for (const x of [-18, 18]) {
      const sl = new VoxelWorld();
      const slg = new VoxelWorld();
      makeStoneLantern(sl, slg);
      stamp(matte, sl, x, z, 0);
      glow.merge(slg, (x2, y2, z2) => [x2 + x, y2, z2 + z]);
    }
  }
  for (const z of [96, 84, 46, 34]) {
    for (const x of [-14, 14]) makeLanternPost(matte, glow, x, z);
  }

  // 檐下灯笼
  const lanternSpots = [
    [-9, 12, 100], [0, 12, 100], [9, 12, 100],
    [-12, 24, 22], [12, 24, 22],
    [-14, 24, 3], [-7, 24, 3], [0, 24, 3], [7, 24, 3], [14, 24, 3],
    [-10, 20, -52], [0, 20, -52], [10, 20, -52],
  ];
  for (const [x, y, z] of lanternSpots) makeHangingLantern(matte, glow, x, y, z);

  /* —— 植树 —— */
  const treeSpots = [
    ['cypress', 15, -18, 74], ['cypress', 15, 18, 74],
    ['cypress', 16, -18, 62], ['cypress', 16, 18, 62],
    ['cypress', 14, -24, 34], ['cypress', 14, 24, 34],
    ['cypress', 15, -24, 12], ['cypress', 15, 24, 12],
    ['pine', 14, -34, -34], ['pine', 14, 34, -34],
    ['pine', 12, -40, -62], ['pine', 12, 40, -62],
    ['pine', 13, -80, -30], ['pine', 13, 80, -30],
    ['pine', 11, -80, -78], ['pine', 11, 80, -78],
    ['cypress', 17, -34, 76], ['cypress', 17, 34, 76],
    ['round', 12, -66, 10], ['round', 12, 66, 10],
    ['round', 11, -70, 76], ['round', 11, 70, 76],
    ['cypress', 14, -26, 112], ['cypress', 14, 26, 112],
    ['pine', 13, -40, 118], ['pine', 13, 40, 118],
  ];
  for (const [kind, h, x, z] of treeSpots) stamp(matte, makeTree(kind, h, x * 0.37 + z * 0.11), x, z, 0);

  counts.wall = undefined;
  return counts;
}

/* ============================================================ 铺地分区 */

const GROUND_REGIONS = [
  // 中轴御路
  { kind: 'paving', x0: -11, z0: -88, x1: 11, z1: 126, tone: [202, 190, 166], cell: 4 },
  { kind: 'paving', x0: -3, z0: -88, x1: 3, z1: 126, tone: [214, 202, 176], cell: 6 },
  // 山门前广场
  { kind: 'paving', x0: -34, z0: 94, x1: 34, z1: 128, tone: [188, 178, 156], cell: 4 },
  // 前院
  { kind: 'paving', x0: -60, z0: 44, x1: 60, z1: 90, tone: [194, 183, 160], cell: 4 },
  // 主殿院
  { kind: 'paving', x0: -40, z0: -36, x1: 40, z1: 40, tone: [200, 189, 165], cell: 4 },
  // 后院与塔院
  { kind: 'paving', x0: -32, z0: -88, x1: 32, z1: -40, tone: [190, 180, 158], cell: 4 },
  { kind: 'gravel', x0: -88, z0: -86, x1: -38, z1: -28, tone: [156, 148, 132] },
  { kind: 'gravel', x0: 38, z0: -86, x1: 88, z1: -28, tone: [156, 148, 132] },
  // 配殿前地坪
  { kind: 'paving', x0: -60, z0: 4, x1: -34, z1: 40, tone: [196, 185, 162], cell: 4 },
  { kind: 'paving', x0: 34, z0: 4, x1: 60, z1: 40, tone: [196, 185, 162], cell: 4 },
  // 园圃
  { kind: 'moss', x0: -88, z0: 4, x1: -66, z1: 40 },
  { kind: 'moss', x0: 66, z0: 4, x1: 88, z1: 40 },
  { kind: 'moss', x0: -88, z0: -24, x1: 88, z1: -34 },
  // 方池
  { kind: 'water', x0: -12, z0: -100, x1: 12, z1: -118 },
  { kind: 'moss', x0: -86, z0: 46, x1: -66, z1: 88 },
  { kind: 'moss', x0: 66, z0: 46, x1: 86, z1: 88 },
  { kind: 'moss', x0: -86, z0: -88, x1: -86, z1: 88 },
];

/* ============================================================== 运行时 */

const skyUniforms = {
  top: { value: new THREE.Color(0x24315c) },
  mid: { value: new THREE.Color(0x8f6a86) },
  bottom: { value: new THREE.Color(0xf09a4e) },
  sunDir: { value: new THREE.Vector3(1, 0.4, 0.4) },
  sunColor: { value: new THREE.Color(0xffb066) },
  sunSize: { value: 220 },
};

let renderer, scene, camera, controls, sun, hemi, amb, glowMesh, skyMesh;
let current = 'hun';
let introT = 0;
const clock = new THREE.Clock();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('app').appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 1.5, 2400);
  camera.fov = fitFov(camera.aspect);
  camera.updateProjectionMatrix();
  camera.position.set(208, 168, 288);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 26, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 55;
  controls.maxDistance = 620;
  controls.maxPolarAngle = 1.47;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.32;
  controls.addEventListener('start', () => { controls.autoRotate = false; introT = 1; });

  // 天空穹顶
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 32, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: skyUniforms,
      vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `
        uniform vec3 top, mid, bottom, sunColor, sunDir; uniform float sunSize; varying vec3 vW;
        void main(){
          vec3 d = normalize(vW);
          vec3 c = mix(mid, top, pow(clamp(d.y,0.,1.), 0.62));
          c = mix(c, bottom, pow(clamp(-d.y*1.6,0.,1.), 0.5));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunColor * pow(s, 90.0) * 1.5 + sunColor * pow(s, 7.0) * 0.22;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);
  skyMesh = sky;

  // 灯光
  sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -170;
  sun.shadow.camera.right = 170;
  sun.shadow.camera.top = 190;
  sun.shadow.camera.bottom = -150;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 780;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.55;
  scene.add(sun, sun.target);

  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  amb = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(hemi, amb);

  // 夜灯：少量暖光点光源（不投影）
  for (const [x, z, y] of [[0, 92, 14], [0, -8, 20], [0, 40, 12], [-62, -54, 12]]) {
    const p = new THREE.PointLight(0xffa447, 0, 90, 2);
    p.position.set(x, y, z);
    p.userData.base = [x, y, z];
    scene.add(p);
  }

  // 体素
  const matte = new VoxelWorld();
  const glow = new VoxelWorld();
  const counts = buildCity(matte, glow);

  const solid = matte.build();
  scene.add(solid);
  glowMesh = glow.build({ emissive: true, castShadow: false });
  scene.add(glowMesh);

  scene.add(createGround(GROUND_REGIONS));
  scene.fog = new THREE.Fog(0x8a6f78, 150, 580);

  applyPreset(current);

  const total = matte.count + glow.count;
  document.getElementById('stat-voxel').textContent = total.toLocaleString('en-US');
  document.getElementById('stat-build').textContent = String(BUILDING_COUNT);
  console.log('[voxel-city] voxels', matte.count, '+', glow.count, '=', total, counts);

  for (const btn of document.querySelectorAll('[data-preset]')) {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  }
  document.getElementById('reset').addEventListener('click', () => {
    introT = 0;
    controls.autoRotate = true;
  });

  window.addEventListener('resize', onResize);
  renderer.domElement.addEventListener('pointerdown', () => { introT = 1; });
  animate();
  requestAnimationFrame(() => document.getElementById('veil').classList.add('gone'));
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  current = name;
  const d = new THREE.Vector3(...p.sun.dir).normalize();
  sun.position.copy(d).multiplyScalar(320);
  sun.color.setHex(p.sun.color);
  sun.intensity = p.sun.intensity;
  sun.target.position.set(0, 10, 0);
  hemi.color.setHex(p.hemi.sky);
  hemi.groundColor.setHex(p.hemi.ground);
  hemi.intensity = p.hemi.intensity;
  amb.color.setHex(p.amb.color);
  amb.intensity = p.amb.intensity;
  skyUniforms.top.value.setHex(p.sky.top);
  skyUniforms.mid.value.setHex(p.sky.mid);
  skyUniforms.bottom.value.setHex(p.sky.bottom);
  skyUniforms.sunDir.value.copy(d);
  skyUniforms.sunColor.value.setHex(p.sun.color).multiplyScalar(p.shadowTint);
  scene.fog.color.setHex(p.fog.color);
  scene.fog.near = p.fog.near;
  scene.fog.far = p.fog.far;
  renderer.toneMappingExposure = p.exposure;
  setGlowLevel(glowMesh, p.glow);
  for (const l of scene.children) if (l.isPointLight) l.intensity = p.glow * 34;
  renderer.shadowMap.needsUpdate = true;
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset === name));
}

const HOME = { pos: new THREE.Vector3(92, 60, 118), target: new THREE.Vector3(0, 26, 4) };

/** 中轴建筑群横向跨度约 250，按水平视角反推垂直 fov，窄窗口也能看到全貌 */
function fitFov(aspect) {
  const tanH = Math.tan(THREE.MathUtils.degToRad(36));
  const v = THREE.MathUtils.radToDeg(2 * Math.atan(tanH / Math.max(aspect, 0.4)));
  return THREE.MathUtils.clamp(v, 42, 74);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = fitFov(camera.aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

let frames = 0, acc = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (introT < 1) {
    introT = Math.min(1, introT + dt / 3.2);
    const e = 1 - Math.pow(1 - introT, 3);
    camera.position.lerpVectors(new THREE.Vector3(208, 168, 288), HOME.pos, e);
    controls.target.lerpVectors(new THREE.Vector3(0, 44, 26), HOME.target, e);
  }

  controls.update();
  renderer.render(scene, camera);
  renderer.shadowMap.needsUpdate = false;

  frames++;
  acc += dt;
  if (acc >= 0.5) {
    document.getElementById('stat-fps').textContent = Math.round(frames / acc);
    frames = 0; acc = 0;
  }
}

init();
