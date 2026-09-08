import * as THREE from 'three';

const OFF = 320;
const MASK = 1023;

const keyOf = (x, y, z) => (x + OFF) | ((y + OFF) << 10) | ((z + OFF) << 20);
const unx = (k) => (k & MASK) - OFF;
const uny = (k) => ((k >>> 10) & MASK) - OFF;
const unz = (k) => ((k >>> 20) & MASK) - OFF;

function hash3(x, y, z) {
  let h = x * 374761393 + y * 668265263 + z * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * 体素容器：写入即去重（后写覆盖先写），最终用一个 InstancedMesh 提交，
 * 因此场景中体素总数只影响显存，不影响 draw call 数量。
 */
export class VoxelWorld {
  constructor() {
    this.cells = new Map();
  }

  get count() {
    return this.cells.size;
  }

  set(x, y, z, color) {
    this.cells.set(keyOf(Math.round(x), Math.round(y), Math.round(z)), color);
    return this;
  }

  get(x, y, z) {
    return this.cells.get(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  erase(x, y, z) {
    this.cells.delete(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  /** 开洞：删除区间内所有体素，可用 lining 给洞口描边以免露出墙芯 */
  cut(x0, y0, z0, x1, y1, z1, lining) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.erase(x, y, z);
    if (lining === undefined) return this;
    for (let y = ay; y <= by; y++) {
      for (let x = ax; x <= bx; x++) {
        if (!this.has(x, y, az - 1)) this.set(x, y, az - 1, lining);
        if (!this.has(x, y, bz + 1)) this.set(x, y, bz + 1, lining);
      }
      for (let z = az; z <= bz; z++) {
        if (!this.has(ax - 1, y, z)) this.set(ax - 1, y, z, lining);
        if (!this.has(bx + 1, y, z)) this.set(bx + 1, y, z, lining);
      }
    }
    return this;
  }

  has(x, y, z) {
    return this.cells.has(keyOf(Math.round(x), Math.round(y), Math.round(z)));
  }

  /** 合并另一个世界，可带变换 */
  merge(other, tf) {
    for (const [k, v] of other.cells) {
      let x = unx(k), y = uny(k), z = unz(k);
      if (tf) {
        const r = tf(x, y, z);
        x = r[0]; y = r[1]; z = r[2];
      }
      this.set(x, y, z, v);
    }
    return this;
  }

  /** 长方体；默认只生成外壳（六个面），solid=true 时实心 */
  box(x0, y0, z0, x1, y1, z1, color, { solid = false } = {}) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let y = ay; y <= by; y++) {
      for (let z = az; z <= bz; z++) {
        for (let x = ax; x <= bx; x++) {
          if (!solid) {
            const onShell = x === ax || x === bx || y === ay || y === by || z === az || z === bz;
            if (!onShell) continue;
          }
          this.set(x, y, z, color);
        }
      }
    }
    return this;
  }

  /** 水平实心矩形（楼板 / 台面 / 铺地） */
  slab(x0, z0, x1, z1, y, color) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.set(x, y, z, color);
    return this;
  }

  /** 矩形边框（仅四周） */
  ring(x0, z0, x1, z1, y, color) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    for (let x = ax; x <= bx; x++) { this.set(x, y, az, color); this.set(x, y, bz, color); }
    for (let z = az + 1; z <= bz - 1; z++) { this.set(ax, y, z, color); this.set(bx, y, z, color); }
    return this;
  }

  /** 外框矩形减去内框矩形的环形带（檐下、月台边缘） */
  band(x0, z0, x1, z1, ix0, iz0, ix1, iz1, y, color) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1);
    const az = Math.min(z0, z1), bz = Math.max(z0, z1);
    const cx0 = Math.min(ix0, ix1), cx1 = Math.max(ix0, ix1);
    const cz0 = Math.min(iz0, iz1), cz1 = Math.max(iz0, iz1);
    for (let z = az; z <= bz; z++) {
      for (let x = ax; x <= bx; x++) {
        if (x > cx0 && x < cx1 && z > cz0 && z < cz1) continue;
        this.set(x, y, z, color);
      }
    }
    return this;
  }

  /** 立柱：截面 cross x cross，居中于 (x,z) */
  post(x, z, y0, y1, color, cross = 1) {
    const h = (cross - 1) / 2;
    this.box(x - h, y0, z - h, x + h, y1, z + h, color, { solid: true });
    return this;
  }

  build({ emissive = false, castShadow = true, receiveShadow = true } = {}) {
    const n = this.cells.size;
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      emissive
        ? new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
        : new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.92,
            metalness: 0.03,
            dithering: true,
          }),
      n
    );
    mesh.frustumCulled = false;
    mesh.castShadow = emissive ? false : castShadow;
    mesh.receiveShadow = !emissive;

    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    const base = new Float32Array(n * 3);
    let i = 0;
    for (const [k, v] of this.cells) {
      m.makeTranslation(unx(k), uny(k), unz(k));
      mesh.setMatrixAt(i, m);
      col.setHex(v);
      const g = 0.93 + hash3(unx(k), uny(k), unz(k)) * 0.14;
      col.multiplyScalar(g);
      base[i * 3] = col.r; base[i * 3 + 1] = col.g; base[i * 3 + 2] = col.b;
      mesh.setColorAt(i, col);
      i++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.baseColors = base;
    mesh.userData.emissiveKind = emissive;
    return mesh;
  }
}

/** 夜间让灯笼、火苗等自发光体素提亮 */
export function setGlowLevel(mesh, level) {
  const base = mesh.userData.baseColors;
  if (!base || !mesh.instanceColor) return;
  const col = new THREE.Color();
  const arr = mesh.instanceColor.array;
  for (let i = 0; i < base.length / 3; i++) {
    const k = 0.35 + level * 1.55;
    arr[i * 3] = Math.min(1, base[i * 3] * k);
    arr[i * 3 + 1] = Math.min(1, base[i * 3 + 1] * k);
    arr[i * 3 + 2] = Math.min(1, base[i * 3 + 2] * k);
  }
  mesh.instanceColor.needsUpdate = true;
}

// —— 常用几何辅助 ——
export function cornersLift(x, z, hw, hd, maxLift, layer) {
  if (maxLift <= 0 || layer > 2) return 0;
  const fx = hw > 0 ? Math.abs(x) / hw : 0;
  const fz = hd > 0 ? Math.abs(z) / hd : 0;
  const cf = Math.min(1, Math.pow(fx * fz, 0.85) * 1.35);
  const fall = Math.pow(0.42, layer);
  return Math.round(maxLift * cf * fall);
}
