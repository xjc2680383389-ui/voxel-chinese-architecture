import { C } from './palette.js';
import { cornersLift } from './voxel.js';

/**
 * 屋顶形制库。以「脊线沿 x 轴」为基准：
 *   w = 面阔方向（脊线方向）总跨，d = 进深方向（出坡方向）总跨。
 * axis:'z' 时内部交换 x/z，供非坐北朝南的建筑直接调用。
 *
 * 屋面用「瓦垄」明暗相间条纹模拟筒瓦：每隔 3 列压暗一格，
 * 檐口一行单色作滴水，脊线独立上色。
 */

function emitter(vw, o) {
  const rot = o.axis === 'z';
  return (x, y, z, color) => {
    if (rot) vw.set(o.cz + z, y, o.cx + x, color);
    else vw.set(o.cx + x, y, o.cz + z, color);
  };
}

function stripe(u, i, o) {
  if (i === 0) return o.eave ?? C.ridgeGold;
  const period = o.gap ?? 3;
  const m = ((u % period) + period) % period;
  return m === 0 ? (o.tileDeep ?? C.tileGoldDeep) : (o.tile ?? C.tileGold);
}

/** 出坡方向（z 边）与山坡方向（x 边）各自的瓦垄基准坐标 */
function edges(vw, o, put, ax, az, y, i, hw, hd, lift) {
  for (let x = -ax; x <= ax; x++) {
    const c = stripe(x, i, o);
    put(x, y + cornersLift(x, -az, hw, Math.max(az, 0.001), lift, i), -az, c);
    if (az !== 0) put(x, y + cornersLift(x, az, hw, Math.max(az, 0.001), lift, i), az, c);
  }
  for (let z = -az + 1; z <= az - 1; z++) {
    const c = stripe(z, i, o);
    put(-ax, y + cornersLift(-ax, z, hw, Math.max(az, 0.001), lift, i), z, c);
    if (ax !== 0) put(ax, y + cornersLift(ax, z, hw, Math.max(az, 0.001), lift, i), z, c);
  }
}

function ridge(vw, o, put, halfX, y, color) {
  const hx = Math.max(0, Math.round(halfX));
  for (let x = -hx; x <= hx; x++) put(x, y, 0, color);
  const gold = o.ornament ?? C.ridgeGold;
  for (const s of [-1, 1]) {
    // 正吻
    put(s * hx, y + 1, 0, gold);
    put(s * (hx - 1), y + 1, 0, gold);
    put(s * hx, y + 2, 0, gold);
    // 垂兽
    put(s * (hx + 1), y, 0, gold);
  }
}

/** 庑殿顶（四阿顶）：一条正脊、四个坡面，等级最高 */
export function roofWudian(vw, o) {
  const put = emitter(vw, o);
  const hw = o.w / 2, hd = o.d / 2;
  const h = o.h;
  const rh = o.ridgeHalf != null ? o.ridgeHalf : hw - Math.max(2, hd * 0.62);
  const lift = o.lift ?? 2;

  for (let i = 0; i < h; i++) {
    const t = h > 1 ? i / (h - 1) : 0;
    const ax = Math.round(hw - (hw - Math.max(0, rh)) * Math.pow(t, 0.6));
    const az = Math.round(hd * (1 - Math.pow(t, 0.78)));
    edges(vw, o, put, ax, az, o.baseY + i, i, hw, hd, lift);
  }
  ridge(vw, o, put, rh, o.baseY + h - 1, o.ridge ?? C.ridgeDark);
  if (o.soffit !== false) eaveSoffit(vw, o);
}

/** 歇山顶：下部四阿围廊、上部悬山两坡，两侧露三角形山花 */
export function roofXieshan(vw, o) {
  const put = emitter(vw, o);
  const hw = o.w / 2, hd = o.d / 2;
  const h = o.h;
  const h1 = Math.max(2, Math.round(h * 0.4));
  const hwU = hw - (o.gableInset ?? 3);
  const hdU = hd * (o.gableRatio ?? 0.55);
  const gable = o.gable ?? C.plaster;
  const boren = o.boren ?? C.vermilion;
  const lift = o.lift ?? 2;

  for (let i = 0; i < h1; i++) {
    const t = i / h1;
    const ax = Math.round(hw - (hw - hwU) * Math.pow(t, 0.7));
    const az = Math.round(hd - (hd - hdU) * Math.pow(t, 0.7));
    edges(vw, o, put, ax, az, o.baseY + i, i, hw, hd, lift);
  }

  const up = Math.max(1, h - h1);
  for (let i = 0; i < up; i++) {
    const t = up > 1 ? i / (up - 1) : 0;
    const az = Math.round(hwU >= 0 ? hdU * (1 - Math.pow(t, 0.8)) : 0);
    const ax = Math.round(hwU);
    const y = o.baseY + h1 + i;
    for (let x = -ax; x <= ax; x++) {
      const c = stripe(x, i === 0 ? 0 : i + h1, o);
      put(x, y, -az, c);
      if (az !== 0) put(x, y, az, c);
    }
    // 山花三角面 + 博风板
    for (const s of [-1, 1]) {
      for (let z = -az; z <= az; z++) {
        const edge = z === -az || z === az;
        put(s * ax, y, z, edge ? boren : (z + y) % 4 === 0 ? C.plasterShade : gable);
      }
    }
  }
  ridge(vw, o, put, hwU, o.baseY + h - 1, o.ridge ?? C.ridgeDark);
  if (o.soffit !== false) eaveSoffit(vw, o);
}

/** 悬山 / 硬山：两坡，脊沿 x */
export function roofYanshan(vw, o) {
  const put = emitter(vw, o);
  const hw = o.w / 2, hd = o.d / 2;
  const h = o.h;
  const lift = o.lift ?? 1;
  for (let i = 0; i < h; i++) {
    const t = h > 1 ? i / (h - 1) : 0;
    const az = Math.round(hd * (1 - Math.pow(t, 0.8)));
    const y = o.baseY + i;
    for (let x = -hw; x <= hw; x++) {
      const c = stripe(x, i, o);
      put(x, y + cornersLift(x, az, hw, hd, lift, i), -az, c);
      if (az !== 0) put(x, y + cornersLift(x, -az, hw, hd, lift, i), az, c);
    }
    if (o.gableWall) {
      for (const s of [-1, 1]) for (let z = -az; z <= az; z++) put(s * hw, y, z, o.gableWall);
    }
  }
  ridge(vw, o, put, hw, o.baseY + h - 1, o.ridge ?? C.ridgeDark);
  if (o.soffit !== false) eaveSoffit(vw, o);
}

/** 攒尖顶：面向一芯收束，顶置宝顶 */
export function roofZanjian(vw, o) {
  const put = emitter(vw, o);
  const hw = o.w / 2, hd = o.d / 2;
  const h = o.h;
  const lift = o.lift ?? 2;
  for (let i = 0; i < h; i++) {
    const t = h > 1 ? i / (h - 1) : 0;
    const k = Math.pow(t, o.sharp ?? 0.66);
    const ax = Math.round(hw * (1 - k)), az = Math.round(hd * (1 - k));
    if (ax < 0 || az < 0) break;
    edges(vw, o, put, ax, az, o.baseY + i, i, hw, hd, lift);
    if (ax === 0 && az === 0) break;
  }
  const top = o.baseY + h;
  const fin = o.finial ?? C.ridgeGold;
  put(0, top, 0, fin);
  put(0, top + 1, 0, fin);
  put(0, top + 2, 0, o.finial2 ?? C.gold);
  put(0, top + 3, 0, C.candle);
  if (o.soffit !== false) eaveSoffit(vw, o);
}

/** 浅坡环檐：重檐下檐、塔檐、牌楼楼身 */
export function eaveRing(vw, o) {
  const put = emitter(vw, o);
  const hw = o.w / 2, hd = o.d / 2;
  const layers = o.h ?? 2;
  const lift = o.lift ?? 2;
  for (let i = 0; i < layers; i++) {
    const ax = Math.round(hw - i * (o.shrink ?? 1.6));
    const az = Math.round(hd - i * (o.shrink ?? 1.6));
    if (ax < 1 || az < 1) break;
    edges(vw, o, put, ax, az, o.baseY + i, i, hw, hd, lift);
  }
}

/** 檐下木色顶棚，避免仰视穿透 */
function eaveSoffit(vw, o) {
  const put = emitter(vw, o);
  const hw = o.w / 2, hd = o.d / 2;
  const inset = o.soffitInset ?? 3;
  const y = o.baseY - 1;
  const col = o.soffitColor ?? C.timberDark;
  for (let x = -hw; x <= hw; x++) {
    for (let z = -hd; z <= hd; z++) {
      if (Math.abs(x) <= hw - inset && Math.abs(z) <= hd - inset) continue;
      put(x, y, z, col);
    }
  }
}

/**
 * 斗拱带：柱头上一层栌斗（朱）、一跳华拱（青绿）、散斗（金）、
 * 最上连续的檐枋（深朱）。三层分明，读作梁架而非碎点。
 */
export function dougongBand(vw, o) {
  const put = emitter(vw, o);
  const hw = Math.round(o.w / 2) - (o.eaveInset ?? 0);
  const hd = Math.round(o.d / 2) - (o.eaveInset ?? 0);
  const step = o.step ?? 3;
  const y = o.baseY;
  const red = o.color ?? C.douRed;
  const green = o.color2 ?? C.douGreen;
  const gold = o.color3 ?? C.douGold;
  const beam = o.beam ?? C.vermilionDeep;

  const pts = [];
  for (let x = -hw; x <= hw; x += step) { pts.push([x, -hd, 0]); pts.push([x, hd, 0]); }
  for (let z = -hd + step; z <= hd - step; z += step) { pts.push([-hw, z, 1]); pts.push([hw, z, 1]); }

  for (const [x, z, horiz] of pts) {
    put(x, y, z, red);
    if (horiz) {
      put(x - 1, y, z, green); put(x + 1, y, z, green);
      put(x - 1, y + 1, z, gold); put(x + 1, y + 1, z, gold);
    } else {
      put(x, y, z - 1, green); put(x, y, z + 1, green);
      put(x, y + 1, z - 1, gold); put(x, y + 1, z + 1, gold);
    }
    put(x, y + 1, z, red);
  }
  for (let x = -hw; x <= hw; x++) { put(x, y + 2, -hd, beam); put(x, y + 2, hd, beam); }
  for (let z = -hd; z <= hd; z++) { put(-hw, y + 2, z, beam); put(hw, y + 2, z, beam); }
}
