import * as THREE from 'three';
import { VoxelWorld } from './voxel.js';
import { C } from './palette.js';
import { roofYanshan, roofXieshan, eaveRing } from './roofs.js';

export const SITE = 268;

/* ------------------------------------------------------------------ 地面 */

function rnd(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * 用 Canvas 程序化绘制整片场地铺装：草地、甬路、庭院、园圃。
 * 1 体素 = PX 像素，Nearest 放大保持体素像素质感。
 */
export function createGround(regions) {
  const PX = 2;
  const half = SITE / 2;
  const size = SITE * PX;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');

  const px = (wx) => (wx + half) * PX;
  const py = (wz) => (wz + half) * PX;

  // 底：郊野草地
  g.fillStyle = '#4d6b39';
  g.fillRect(0, 0, size, size);
  for (let z = -half; z < half; z++) {
    for (let x = -half; x < half; x++) {
      const n = rnd(x, z);
      if (n > 0.86) continue;
      const base = n > 0.62 ? [72, 100, 54] : n > 0.34 ? [62, 90, 48] : [54, 80, 44];
      const k = 0.9 + rnd(x * 3.1, z * 7.3) * 0.22;
      g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      g.fillRect(px(x), py(z), PX, PX);
    }
  }

  const fill = (x0, z0, x1, z1, col) => {
    g.fillStyle = col;
    g.fillRect(px(x0), py(z0), (x1 - x0 + 1) * PX, (z1 - z0 + 1) * PX);
  };

  // 铺地：石砖格 + 噪点
  function paving(x0, z0, x1, z1, tone = [196, 184, 160], cell = 4) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const mx = Math.floor((x - x0) / cell), mz = Math.floor((z - z0) / cell);
        const edge = (x - x0) % cell === 0 || (z - z0) % cell === 0;
        const seam = (mx + mz) % 2 === 0;
        let k = 0.94 + rnd(x * 1.7, z * 2.9) * 0.14;
        if (edge) k *= 0.82;
        if (seam) k *= 0.96;
        g.fillStyle = `rgb(${Math.min(255, tone[0] * k) | 0},${Math.min(255, tone[1] * k) | 0},${Math.min(255, tone[2] * k) | 0})`;
        g.fillRect(px(x), py(z), PX, PX);
      }
    }
  }

  // 夯土 / 砾石
  function gravel(x0, z0, x1, z1, tone = [150, 142, 128]) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const k = 0.82 + rnd(x * 5.3, z * 9.1) * 0.36;
        g.fillStyle = `rgb(${tone[0] * k | 0},${tone[1] * k | 0},${tone[2] * k | 0})`;
        g.fillRect(px(x), py(z), PX, PX);
      }
    }
  }

  for (const r of regions) {
    if (r.kind === 'paving') paving(r.x0, r.z0, r.x1, r.z1, r.tone, r.cell);
    else if (r.kind === 'gravel') gravel(r.x0, r.z0, r.x1, r.z1, r.tone);
    else if (r.kind === 'moss') {
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
        const k = 0.82 + rnd(x * 2.3, z * 4.7) * 0.3;
        g.fillStyle = `rgb(${52 * k | 0},${78 * k | 0},${44 * k | 0})`;
        g.fillRect(px(x), py(z), PX, PX);
      }
    } else if (r.kind === 'rect') fill(r.x0, r.z0, r.x1, r.z1, r.color);
    else if (r.kind === 'water') {
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
        const k = 0.86 + rnd(x * 1.9, z * 3.3) * 0.26;
        g.fillStyle = `rgb(${38 * k | 0},${66 * k | 0},${74 * k | 0})`;
        g.fillRect(px(x), py(z), PX, PX);
      }
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.97, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SITE, SITE), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.5;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------- 围墙 / 院墙 */

export function makeWallRun(vw, x0, z0, x1, z1, o = {}) {
  const h = o.h ?? 9;
  const t = o.thickness ?? 3;
  const body = o.wall ?? C.brick;
  const cap = o.cap ?? C.tileGrey;
  const capDeep = o.capDeep ?? C.tileGreyDeep;
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const ax0 = Math.min(x0, x1), ax1 = Math.max(x0, x1);
  const az0 = Math.min(z0, z1), az1 = Math.max(z0, z1);

  if (alongX) {
    vw.box(ax0, 0, az0, ax1, h - 1, az0 + t - 1, body);
    vw.box(ax0, h - 1, az0, ax1, h - 1, az0 + t - 1, C.brickDeep);
    vw.box(ax0, h, az0 - 1, ax1, h, az0 + t, cap);
    vw.box(ax0, h + 1, az0, ax1, h + 1, az0 + t - 1, capDeep);
    for (let x = ax0 + 3; x <= ax1 - 3; x += 6) vw.box(x, 0, az0 - 1, x, h + 1, az0 + t, C.brickDeep);
  } else {
    vw.box(ax0, 0, az0, ax0 + t - 1, h - 1, az1, body);
    vw.box(ax0, h - 1, az0, ax0 + t - 1, h - 1, az1, C.brickDeep);
    vw.box(ax0 - 1, h, az0, ax0 + t, h, az1, cap);
    vw.box(ax0, h + 1, az0, ax0 + t - 1, h + 1, az1, capDeep);
    for (let z = az0 + 3; z <= az1 - 3; z += 6) vw.box(ax0 - 1, 0, z, ax0 + t, h + 1, z, C.brickDeep);
  }
  return vw;
}

/** 琉璃影壁 */
export function makeScreenWall(vw, gw, o = {}) {
  const w = o.w ?? 20, h = o.h ?? 7;
  const hw = Math.floor(w / 2);
  vw.box(-hw, 0, -1, hw, 1, 1, C.stone);
  vw.ring(-hw, -1, hw, 1, 1, C.stoneDeep);
  vw.box(-hw, 2, -1, hw, h, 1, o.wall ?? C.brick);
  // 琉璃心
  for (let x = -hw + 3; x <= hw - 3; x++) {
    for (let y = 3; y <= h - 2; y++) {
      const border = x === -hw + 3 || x === hw - 3 || y === 3 || y === h - 2;
      const c = border ? C.ridgeGold : (x + y) % 3 === 0 ? C.tileGreen : (x + y) % 3 === 1 ? C.tileBlue : C.tileGreenDeep;
      vw.set(x, y, 2, c);
      vw.set(x, y, -2, c);
    }
  }
  const ry = h + 1;
  roofYanshan(vw, { cx: 0, cz: 0, baseY: ry, w: w + 4, d: 8, h: 3, tile: C.tileGreen, tileDeep: C.tileGreenDeep, eave: C.ridgeGold, lift: 1, soffit: false, ridge: C.ridgeDark });
  void gw;
  return vw;
}

/* ------------------------------------------------------------------ 植物 */

const PINE = [C.pineA, C.pineB, C.pineC];

export function makeTree(kind, h, seed = 1) {
  const vw = new VoxelWorld();
  const pick = (t) => PINE[Math.floor(rnd(t * 3.7 + seed, seed * 1.31) * 3) % 3];
  if (kind === 'cypress') {
    vw.post(0, 0, 0, 1, C.trunk, 1);
    for (let y = 2; y < h; y++) {
      const t = (y - 2) / Math.max(1, h - 2);
      const r = Math.max(0, Math.round((1 - t) * 2.2 + (rnd(y, seed) > 0.62 ? 1 : 0)));
      if (r === 0) vw.set(0, y, 0, pick(y));
      else vw.ring(-r, -r, r, r, y, pick(y));
    }
  } else if (kind === 'pine') {
    vw.post(0, 0, 0, h - 3, C.trunk, 1);
    const tiers = Math.max(3, Math.round(h / 4));
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const y = Math.round(3 + t * (h - 4));
      const r = Math.round((1 - t * 0.85) * 4 + 1);
      vw.slab(-r, -r, r, r, y, pick(y + i));
      if (r > 1) vw.ring(-r, -r, r, r, y, pick(y));
    }
    vw.slab(-1, -1, 1, 1, h - 1, C.pineB);
  } else {
    vw.post(0, 0, 0, h - 4, C.trunk, 1);
    const r = Math.max(2, Math.round(h * 0.36));
    for (let y = h - 4; y <= h; y++) {
      const k = Math.max(0, Math.round(r - Math.abs(y - (h - 1)) * 0.8));
      if (k === 0) vw.set(0, y, 0, C.pineB);
      else vw.ring(-k, -k, k, k, y, pick(y));
    }
  }
  return vw;
}

/* --------------------------------------------------------------- 陈设小件 */

export function makeLion(vw, o = {}) {
  const s = o.stone ?? C.stoneCool;
  vw.box(-2, 0, -2, 2, 1, 2, C.stone);
  vw.box(-2, 2, -2, 2, 2, 2, s);
  vw.box(-1, 3, -2, 1, 5, 1, s);
  vw.box(-1, 6, -1, 1, 7, 1, s);            // 头
  vw.box(-2, 6, 0, -2, 7, 1, C.stoneDark);  // 鬃
  vw.box(2, 6, 0, 2, 7, 1, C.stoneDark);
  vw.set(0, 6, 2, C.stoneDark);
  vw.box(-1, 3, 2, 1, 4, 2, s);             // 胸
  vw.set(2, 3, -2, s);                      // 尾
  vw.set(2, 4, -2, s);
  vw.set(-2, 3, 2, C.gold);                 // 绣球
  return vw;
}

export function makeIncenseBurner(vw, gw) {
  vw.box(-2, 0, -2, 2, 0, 2, C.stone);
  vw.post(-1, -1, 1, 2, C.bronzeDeep, 1);
  vw.post(1, -1, 1, 2, C.bronzeDeep, 1);
  vw.post(-1, 1, 1, 2, C.bronzeDeep, 1);
  vw.post(1, 1, 1, 2, C.bronzeDeep, 1);
  vw.box(-2, 3, -2, 2, 5, 2, C.bronze);
  vw.ring(-2, -2, 2, 2, 6, C.bronzeDeep);
  vw.box(-1, 6, -1, 1, 6, 1, C.bronzeDeep);
  for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) vw.set(x, 7, z, C.bronzeDeep);
  vw.set(0, 7, 0, C.gold);
  gw.set(0, 6, 0, C.fire);
  gw.set(0, 7, 0, C.lanternGlow);
  return vw;
}

/** 悬挂灯笼（写入自发光世界） */
export function makeHangingLantern(vw, gw, x, y, z) {
  vw.set(x, y + 2, z, C.timberDeep);
  vw.box(x - 1, y + 1, z - 1, x + 1, y + 1, z + 1, C.ridgeGold);
  gw.box(x - 1, y - 1, z - 1, x + 1, y, z + 1, C.lanternGlow);
  vw.box(x - 1, y - 2, z - 1, x + 1, y - 2, z + 1, C.ridgeGold);
  vw.set(x, y - 3, z, C.lanternBody);
}

/** 庭前灯杆 */
export function makeLanternPost(vw, gw, x, z) {
  const y0 = 0;
  vw.box(x - 1, y0, z - 1, x + 1, y0, z + 1, C.stone);
  for (let y = y0 + 1; y <= y0 + 9; y++) vw.set(x, y, z, C.bronzeDeep);
  vw.box(x - 1, y0 + 10, z - 1, x + 1, y0 + 10, z + 1, C.bronze);
  gw.box(x - 1, y0 + 11, z - 1, x + 1, y0 + 13, z + 1, C.lanternGlow);
  vw.box(x - 1, y0 + 14, z - 1, x + 1, y0 + 14, z + 1, C.ridgeGold);
  vw.set(x, y0 + 15, z, C.lanternBody);
  return vw;
}

/** 石灯笼（经幢） */
export function makeStoneLantern(vw, gw) {
  vw.box(-1, 0, -1, 1, 1, 1, C.stone);
  vw.post(0, 0, 2, 4, C.stoneDeep, 1);
  vw.box(-2, 5, -2, 2, 5, 2, C.stone);
  gw.box(-1, 6, -1, 1, 7, 1, C.candle);
  vw.box(-2, 8, -2, 2, 8, 2, C.stoneDeep);
  vw.ring(-1, -1, 1, 1, 9, C.stoneCool);
  vw.set(0, 10, 0, C.stoneDark);
  return vw;
}

/** 牌楼：四柱三间，动线上的标志性入口 */
export function makePaifang(vw, gw, o = {}) {
  const half = o.half ?? 12;
  const h = o.h ?? 14;
  const bays = [[half, h], [half - 4, h - 3], [-(half - 4), h - 3], [-half, h]];
  for (const [x, hh] of bays) {
    vw.post(x, 2, 0, 1, C.stone, 3);
    vw.post(x, -2, 0, 1, C.stone, 3);
    vw.post(x, 2, 2, hh, C.vermilion, 2);
    vw.post(x, -2, 2, hh, C.vermilion, 2);
    // 抱鼓石
    vw.box(x - 1, 2, 4, x + 1, 3, 5, C.stoneCool);
    vw.box(x - 1, 2, -5, x + 1, 3, -4, C.stoneCool);
  }
  const roofAt = (x, hh, w) => {
    eaveRing(vw, { cx: x, cz: 0, baseY: hh + 1, w, d: 12, h: 3, shrink: 1.7, tile: o.tile ?? C.tileGreen, eave: C.ridgeGold, lift: 2 });
    roofXieshan(vw, { cx: x, cz: 0, baseY: hh + 4, w: w - 2, d: 12, h: 4, tile: o.tile ?? C.tileGreen, tileDeep: o.tileDeep ?? C.tileGreenDeep, ridge: C.ridgeDark, eave: C.ridgeGold, lift: 2, soffit: false, gable: C.plaster, gableInset: 2, gableRatio: 0.55 });
  };
  roofAt(0, h, 2 * half - 4);
  roofAt(half - 4, h - 3, 8);
  roofAt(-(half - 4), h - 3, 8);
  // 额枋与斗拱
  for (const [x, hh] of bays.slice(1, 3)) {
    vw.box(x - 2, hh, -2, x + 2, hh + 1, 2, C.douGreen);
    vw.ring(x - 2, -2, x + 2, 2, hh + 2, C.douGold);
  }
  vw.box(-half, h - 1, -1, half, h, 1, C.timberDeep);
  plaqueBar(vw, 0, h + 1);
  void gw;
  return vw;
}

function plaqueBar(vw, x, y) {
  vw.box(x - 3, y, 2, x + 3, y + 3, 2, C.tileBlue);
  vw.ring(x - 3, 2, x + 3, 2, y, C.ridgeGold);
  vw.ring(x - 3, 2, x + 3, 2, y + 3, C.ridgeGold);
  for (let i = 0; i < 3; i++) vw.set(x, y + 1 + (i % 2), 2, C.gold);
}
