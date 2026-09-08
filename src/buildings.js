import { VoxelWorld } from './voxel.js';
import { C } from './palette.js';
import { roofWudian, roofXieshan, roofYanshan, roofZanjian, eaveRing, dougongBand } from './roofs.js';

/** 把以原点为中心、正面朝 +z 建造的体素模型盖到场景指定位置 */
export function stamp(target, local, cx, cz, rot = 0, mirror = false, dy = 0) {
  target.merge(local, (x, y, z) => {
    let X = x, Z = z;
    if (rot === 1) { X = -z; Z = x; }
    else if (rot === 2) { X = -x; Z = -z; }
    else if (rot === 3) { X = z; Z = -x; }
    if (mirror) X = -X;
    return [X + cx, y + dy, Z + cz];
  });
}

function wallFaces(vw, x0, z0, x1, z1, y0, y1, color) {
  for (let y = y0; y <= y1; y++) {
    vw.ring(x0, z0, x1, z1, y, color);
  }
}

function bayPositions(half, bays) {
  const out = [];
  for (let i = 0; i <= bays; i++) out.push(Math.round(-half + (2 * half * i) / bays));
  return [...new Set(out)];
}

function lattice(vw, x0, y0, x1, y1, z, o = {}) {
  const frame = o.lattice ?? C.lattice;
  const voidC = o.glassFace ?? C.interior;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const border = x === x0 || x === x1 || y === y0 || y === y1;
      const mull = (x - x0) % 2 === 0 || (y - y0) % 2 === 0;
      vw.set(x, y, z, border || mull ? frame : voidC);
    }
  }
}

function doorLeaves(vw, cx, y0, y1, z, halfW, o = {}) {
  const body = o.door ?? C.doorDark;
  const x0 = cx - halfW, x1 = cx + halfW;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      let c = body;
      const midY = y0 + Math.round((y1 - y0) * 0.55);
      if (y === y1 || y === y0 || y === midY) c = C.timberDeep;
      else if ((x - x0) % 2 === 1 && (y - y0) % 2 === 1) c = C.douGold;
      vw.set(x, y, z, c);
    }
  }
  vw.box(x0 - 1, y0, z, x1 + 1, y0, z, C.stoneCool);
  vw.box(x0 - 1, y1 + 1, z, x1 + 1, y1 + 1, z, C.timberDeep);
}

/** 台基：多层须弥座 + 踏跺 + 栏杆 */
function terrace(vw, hw, hd, tiers, o) {
  const TH = o.tierH ?? 3;
  const spreadX = o.tierSpreadX ?? 6;
  const spreadZ = o.tierSpreadZ ?? 5;
  for (let i = 0; i < tiers; i++) {
    const ax = hw + spreadX - i * (o.tierInsetX ?? 3);
    const az = hd + spreadZ - i * (o.tierInsetZ ?? 3);
    const y0 = i * TH, y1 = y0 + TH - 1;
    vw.box(-ax, y0, -az, ax, y1, az, C.stone);
    vw.ring(-ax, -az, ax, az, y1, C.stoneDeep); // 阶条石
    vw.ring(-ax, -az, ax, az, y0, C.stoneDark); // 下碱
    // 每层正面踏跺
    const steps = TH;
    for (let s = 0; s < steps; s++) {
      const y = y0 + s;
      const z = az + (steps - 1 - s);
      vw.box(-4, y, z, 4, y, z, C.stoneCool);
      vw.box(-4, y0, z + 1, 4, y, z + 1, C.stoneCool);
    }
    railing(vw, ax, az, y1, 4);
  }
  // 上层角部御路
  return tiers * TH;
}

function railing(vw, ax, az, y, gapFront) {
  const post = (x, z) => {
    vw.set(x, y + 1, z, C.stone);
    vw.set(x, y + 2, z, C.stoneDeep);
  };
  const skip = (x, z) => gapFront && z === az && Math.abs(x) <= gapFront;

  for (let x = -ax; x <= ax; x += 3) {
    if (!skip(x, az)) post(x, az);
    if (!skip(x, -az)) post(x, -az);
  }
  for (let z = -az; z <= az; z += 3) {
    post(ax, z);
    post(-ax, z);
  }
  // 栏板
  for (let x = -ax; x <= ax; x++) {
    if (!skip(x, az)) vw.set(x, y + 1, az, C.plasterShade);
    if (!skip(x, -az)) vw.set(x, y + 1, -az, C.plasterShade);
  }
  for (let z = -az; z <= az; z++) {
    vw.set(ax, y + 1, z, C.plasterShade);
    vw.set(-ax, y + 1, z, C.plasterShade);
  }
  for (const x of [-ax, ax]) for (let z = -az; z <= az; z += 3) post(x, z);
}

/**
 * 殿 / 门 / 阁 通用体：台基 + 柱网 + 墙体 + 门窗 + 斗拱 + 屋顶。
 * o.w 面阔(沿 x)，o.d 进深(沿 z)，o.h 每层檐高，o.levels 重檐层数。
 */
export function makeHall(o) {
  const vw = new VoxelWorld();
  const hw = Math.floor(o.w / 2), hd = Math.floor(o.d / 2);
  const bays = o.bays ?? Math.max(3, Math.round(o.w / 4));
  const depthBays = o.depthBays ?? Math.max(1, Math.round(o.d / 5));
  const wallC = o.wall ?? C.wallRed;
  const colC = o.column ?? C.vermilion;
  const tile = o.tile ?? C.tileGold;
  const tileDeep = o.tileDeep ?? C.tileGoldDeep;
  const over = o.over ?? 3;
  const roofFn = o.roof === 'wudian' ? roofWudian : o.roof === 'yan' ? roofYanshan : roofXieshan;

  let y = o.terrace ? terrace(vw, hw, hd, o.terrace, o) : 0;
  const xs = bayPositions(hw, bays);
  const zs = bayPositions(hd, depthBays);

  const levels = o.levels ?? 1;
  let curHw = hw, curHd = hd, curY = y;

  for (let lv = 0; lv < levels; lv++) {
    const isLast = lv === levels - 1;
    const storeyH = lv === 0 ? o.h : o.h2 ?? Math.round(o.h * 0.8);
    const inset = o.wallInset ?? 2;

    // 柱网（外圈）
    for (const x of xs) col(vw, x, curHd, curY, storeyH, colC, o.colCross);
    for (const z of zs) {
      if (Math.abs(z) === curHd) continue;
      col(vw, curHw, z, curY, storeyH, colC, o.colCross);
      col(vw, -curHw, z, curY, storeyH, colC, o.colCross);
    }

    // 檐柱与墙体之间的廊：墙体向内退 inset
    const wx = curHw - inset, wz = curHd - inset;
    wallFaces(vw, -wx, -wz, wx, wz, curY, curY + storeyH - 1, wallC);
    vw.ring(-wx, -wz, wx, wz, curY, C.stoneDeep);            // 下肩（石碱）
    vw.ring(-wx, -wz, wx, wz, curY + storeyH - 1, C.timberDeep); // 檐枋位置

    // 山面 / 檐面 门窗
    const openings = lv === 0 ? o.openings ?? 1 : 0;
    facade(vw, xs, wz, curY, storeyH, { ...o, openings });
    facadeBack(vw, xs, -wz, curY, storeyH);
    sideWindows(vw, wx, zs, curY, storeyH);

    const dgY = curY + storeyH;
    dougongBand(vw, {
      w: curHw * 2, d: curHd * 2, baseY: dgY, eaveInset: 0,
      step: 3, color: C.douRed, color2: C.douGreen, color3: C.douGold, beam: C.vermilionDeep,
    });

    const roofBase = dgY + 3;
    const ov = over + lv;
    const rw = (curHw + ov) * 2, rd = (curHd + ov) * 2;
    const common = {
      cx: 0, cz: 0, w: rw, d: rd, tile, tileDeep,
      eave: o.eave ?? C.ridgeGold, lift: o.lift ?? 3, gap: o.gap ?? 3,
    };
    if (isLast) {
      roofFn(vw, {
        ...common, baseY: roofBase,
        h: o.roofH ?? Math.max(4, Math.round(o.d * 0.34)),
        ridge: o.ridge ?? C.ridgeDark, ornament: o.ornament ?? C.ridgeGold,
        ridgeHalf: o.ridgeHalf, soffitInset: ov,
        gable: o.gable ?? C.plaster, boren: C.vermilion,
        gableInset: o.gableInset ?? 3, gableRatio: o.gableRatio ?? 0.55,
      });
    } else {
      const skirt = o.skirtH ?? 5;
      eaveRing(vw, { ...common, baseY: roofBase, h: skirt, shrink: 1.35 });
      // 平座：上层柱网收进
      curHw = Math.round(hw * 0.72);
      curHd = Math.round(hd * 0.74);
      curY = roofBase + skirt;
      vw.band(-(curHw + over), -(curHd + over), curHw + over, curHd + over,
        -curHw + 1, -curHd + 1, curHw - 1, curHd - 1, curY - 1, C.timberDeep);
      railRing(vw, curHw + over, curHd + over, curY - 1, 5);
    }
  }

  if (o.plaque !== false) plaque(vw, hd - (o.wallInset ?? 2), y + (o.h ?? 10) - 3, o.plaqueW ?? 7);
  if (o.cut) for (const c of o.cut) vw.cut(c[0], c[1], c[2], c[3], c[4], c[5], o.cutLining);
  return vw;
}

function col(vw, x, z, y0, h, color, cross) {
  if (cross === 2) {
    vw.box(x - 1, y0, z - 1, x, y0 + h - 1, z, color, { solid: true });
    vw.box(x - 1, y0, z - 1, x + 1, y0, z + 1, C.stoneCool, { solid: true });
  } else {
    vw.post(x, z, y0, y0 + h - 1, color, 1);
    vw.post(x, z, y0, y0, C.stoneCool, 2);
  }
}

function railRing(vw, ax, az, y, gapFront) {
  for (let x = -ax; x <= ax; x += 2) {
    if (Math.abs(x) <= gapFront) continue;
    vw.set(x, y + 1, az, C.stone); vw.set(x, y + 2, az, C.stoneDeep);
    vw.set(x, y + 1, -az, C.stone); vw.set(x, y + 2, -az, C.stoneDeep);
  }
  for (let z = -az; z <= az; z += 2) {
    vw.set(ax, y + 1, z, C.stone); vw.set(ax, y + 2, z, C.stoneDeep);
    vw.set(-ax, y + 1, z, C.stone); vw.set(-ax, y + 2, z, C.stoneDeep);
  }
}

function facade(vw, xs, z, y0, h, o) {
  const n = xs.length;
  const mid = (n - 1) / 2;
  const doorCount = o.openings ?? 1;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[i] + 1, x1 = xs[i + 1] - 1;
    if (x1 < x0) continue;
    const cx = Math.round((xs[i] + xs[i + 1]) / 2);
    const dist = Math.abs(i + 0.5 - mid);
    const halfW = Math.min(Math.floor((x1 - x0) / 2), 3);
    if (dist < doorCount / 2 && halfW >= 1) {
      doorLeaves(vw, cx, y0 + 1, y0 + h - 3, z, halfW, o);
    } else if (o.windows !== false) {
      const wy0 = y0 + Math.round(h * 0.3), wy1 = y0 + h - 3;
      if (wy1 > wy0 + 1) lattice(vw, x0, wy0, x1, wy1, z, o);
    }
  }
}

function facadeBack(vw, xs, z, y0, h) {
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i] + 1, x1 = xs[i + 1] - 1;
    if (x1 <= x0) continue;
    const wy0 = y0 + Math.round(h * 0.32), wy1 = y0 + h - 3;
    if (wy1 > wy0 + 1) lattice(vw, x0, wy0, x1, wy1, z, {});
  }
}

function sideWindows(vw, wx, zs, y0, h) {
  for (let i = 0; i < zs.length - 1; i++) {
    const z0 = zs[i] + 1, z1 = zs[i + 1] - 1;
    if (z1 <= z0) continue;
    const wy0 = y0 + Math.round(h * 0.32), wy1 = y0 + h - 3;
    if (wy1 <= wy0) continue;
    for (let z = z0; z <= z1; z++) for (let y = wy0; y <= wy1; y++) {
      const border = z === z0 || z === z1 || y === wy0 || y === wy1;
      const mull = (z - z0) % 2 === 0 || (y - wy0) % 2 === 0;
      const c = border || mull ? C.lattice : C.interior;
      vw.set(wx, y, z, c);
      vw.set(-wx, y, z, c);
    }
  }
}

function plaque(vw, z, y, w) {
  const h = Math.round(w * 0.32);
  for (let x = -Math.floor(w / 2); x <= Math.floor(w / 2); x++) {
    for (let yy = y; yy <= y + h; yy++) {
      const border = Math.abs(x) === Math.floor(w / 2) || yy === y || yy === y + h;
      vw.set(x, yy, z, border ? C.gold : C.tileBlue);
    }
  }
  vw.set(-1, y + Math.round(h / 2), z, C.gold);
  vw.set(1, y + Math.round(h / 2), z, C.gold);
}

/** 钟鼓楼：砖砌洞子台 + 上建带回廊的四角亭式楼身 + 歇山/十字脊顶 */
export function makeTower(o) {
  const vw = new VoxelWorld();
  const bw = Math.floor(o.baseW / 2), bd = Math.floor(o.baseD / 2);
  const bh = o.baseH;
  vw.box(-bw, 0, -bd, bw, bh - 1, bd, o.baseWall ?? C.brick);
  vw.ring(-bw, -bd, bw, bd, bh - 1, o.baseWall2 ?? C.brickDeep);
  // 券洞
  const aw = Math.floor(o.archW / 2), ah = o.archH;
  vw.cut(-aw, 0, -bd - 1, aw, ah - 1, bd + 1, C.interior);
  vw.box(-aw, 0, -bd, -aw, ah - 1, bd, o.baseWall2 ?? C.brickDeep);
  vw.box(aw, 0, -bd, aw, ah - 1, bd, o.baseWall2 ?? C.brickDeep);
  for (let x = -aw; x <= aw; x++) vw.set(x, ah - 1, bd, o.baseWall2 ?? C.brickDeep);
  // 台面
  vw.slab(-bw, -bd, bw, bd, bh, C.stone);
  railing(vw, bw, bd, bh, 0);

  const pav = makeHall({
    w: o.w, d: o.d, h: o.h, bays: o.bays ?? 3, depthBays: o.depthBays ?? 1,
    roof: o.roof ?? 'xieshan', tile: o.tile, tileDeep: o.tileDeep,
    wall: o.wall ?? C.vermilionDeep, column: o.column ?? C.vermilion,
    roofH: o.roofH ?? 6, lift: o.lift ?? 3, over: o.over ?? 3,
    windows: false, plaque: o.plaque !== false, plaqueW: o.plaqueW ?? 5,
    wallInset: 1, colCross: 1,
  });
  vw.merge(pav, (x, yy, z) => [x, yy + bh + 1, z]);

  // 楼内悬钟 / 置鼓
  const iy = bh + 2;
  if (o.instrument === 'bell') {
    vw.box(-1, iy + 2, -1, 1, iy + 5, 1, C.bronze);
    vw.set(0, iy + 6, 0, C.bronzeDeep);
    vw.post(0, 0, iy, iy + 1, C.timberDeep, 1);
  } else if (o.instrument === 'drum') {
    vw.box(-2, iy + 1, -1, 2, iy + 3, 1, C.lattice);
    vw.box(-2, iy + 1, -1, -2, iy + 3, -1, C.plaster);
    vw.box(2, iy + 1, 1, 2, iy + 3, 1, C.plaster);
  }
  return vw;
}

/** 方形楼阁式宝塔 */
export function makePagoda(o) {
  const vw = new VoxelWorld();
  const stories = o.stories ?? 5;
  let r = o.r0;
  let y = 0;
  const bh = o.storyH ?? 7;
  // 塔基
  const bx = r + 5;
  vw.box(-bx, 0, -bx, bx, 2, bx, C.stone);
  vw.ring(-bx, -bx, bx, bx, 2, C.stoneDeep);
  for (let s = 0; s < 3; s++) vw.box(-4, s, bx + (2 - s), 4, s, bx + (2 - s), C.stoneCool);
  railing(vw, bx, bx, 2, 4);
  y = 3;

  for (let i = 0; i < stories; i++) {
    const rr = Math.max(3, Math.round(r));
    const bodyH = i === 0 ? bh + 3 : bh;
    // 塔身
    wallFaces(vw, -rr, -rr, rr, rr, y, y + bodyH - 1, i % 2 === 0 ? (o.wall ?? C.plaster) : (o.wall2 ?? C.plasterShade));
    // 角柱
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) vw.post(sx * rr, sz * rr, y, y + bodyH - 1, o.pilaster ?? C.wallRedDeep, 1);
    // 檐柱间门窗：正面门、余三面窗，逐层交错
    pagodaFace(vw, rr, y, bodyH, i, o);
    // 平座（层间挑台）
    const py = y + bodyH;
    vw.band(-(rr + 5), -(rr + 5), rr + 5, rr + 5, -rr + 1, -rr + 1, rr - 1, rr - 1, py, C.stoneDeep);
    railRing(vw, rr + 5, rr + 5, py, 3);
    // 塔檐
    eaveRing(vw, {
      cx: 0, cz: 0, baseY: py + 3, w: (rr + 5) * 2, d: (rr + 5) * 2, h: 4, shrink: 1.45,
      tile: o.tile ?? C.tileGreen, eave: o.tileDeep ?? C.tileGreenDeep, lift: o.lift ?? 3,
    });
    dougongBand(vw, {
      w: rr * 2, d: rr * 2, baseY: py - 2, eaveInset: 0, step: 3,
      color: C.douRed, color2: C.douGold, beam: C.timberDeep,
    });
    y = py + 7;
    r = r - (o.taper ?? 1.05);
  }

  // 塔刹
  const top = y;
  vw.box(-2, top, -2, 2, top + 1, 2, C.stoneDeep);
  vw.post(0, 0, top + 2, top + 4, C.bronze, 2);
  vw.box(-1, top + 2, -1, 1, top + 3, 1, C.gold);
  for (let k = 0; k < 4; k++) {
    const yy = top + 5 + k;
    const rad = Math.max(0, 2 - Math.round(k * 0.6));
    if (rad === 0) vw.set(0, yy, 0, C.gold);
    else vw.ring(-rad, -rad, rad, rad, yy, C.gold);
  }
  vw.set(0, top + 9, 0, C.gold);
  vw.set(0, top + 10, 0, C.ridgeGold);
  return vw;
}

function pagodaFace(vw, rr, y, bodyH, story, o) {
  const faceSigns = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (let f = 0; f < 4; f++) {
    const [sx, sz] = faceSigns[f];
    const isDoor = (f + story) % 4 === 0;
    const w = Math.max(1, Math.round(rr * 0.42));
    for (let a = -w; a <= w; a++) {
      for (let t = 0; t < bodyH - 2; t++) {
        const yy = y + 1 + t;
        const x = sx === 0 ? a : sx * rr;
        const z = sz === 0 ? a : sz * rr;
        if (isDoor) {
          const border = Math.abs(a) === w || t === bodyH - 3;
          vw.set(x, yy, z, border ? C.timberDeep : C.doorDark);
        } else {
          const border = Math.abs(a) === w || t === bodyH - 3 || t === 0;
          const mull = (a + w) % 2 === 0 || t % 2 === 0;
          vw.set(x, yy, z, border || mull ? (o.lattice ?? C.lattice) : C.interior);
        }
      }
    }
  }
}

/** 方亭：四柱或八柱 + 攒尖顶，用于碑亭、井亭 */
export function makePavilion(o) {
  const vw = new VoxelWorld();
  const r = Math.floor(o.w / 2);
  const h = o.h ?? 8;
  vw.slab(-r - 1, -r - 1, r + 1, r + 1, 0, C.stone);
  vw.ring(-r - 1, -r - 1, r + 1, r + 1, 0, C.stoneDeep);
  for (const [x, z] of [[-r, -r], [-r, r], [r, -r], [r, r]]) {
    vw.post(x, z, 1, h, o.column ?? C.vermilion, 1);
    vw.post(x, z, 1, 1, C.stoneCool, 2);
  }
  dougongBand(vw, { w: r * 2, d: r * 2, baseY: h + 1, eaveInset: 0, step: 3, color: C.douGreen, color2: C.douGold, beam: C.timberDeep });
  roofZanjian(vw, {
    cx: 0, cz: 0, baseY: h + 4, w: (r + 3) * 2, d: (r + 3) * 2,
    h: Math.max(4, Math.round(r * 0.9)), tile: o.tile ?? C.tileGreen, tileDeep: o.tileDeep ?? C.tileGreenDeep,
    lift: 3, soffit: false, finial: C.gold,
  });
  if (o.stele) {
    vw.box(-2, 1, -1, 2, h - 2, 1, C.stoneCool);
    vw.box(-2, h - 1, -1, 2, h - 1, 1, C.stoneDeep);
    vw.ring(-2, -1, 2, 1, h, C.stoneDark);
    for (let t = 3; t < h - 3; t += 2) vw.set(0, t, 2, C.timberDeep);
  }
  return vw;
}

/** 游廊：一面开敞的柱廊 + 薄檐顶，用于连接各建筑的动线 */
export function makeCorridor(o) {
  const vw = new VoxelWorld();
  const half = Math.floor(o.len / 2);
  const h = o.h ?? 6;
  vw.slab(-half, -2, half, 2, 0, C.paving ?? C.stoneCool);
  for (let x = -half; x <= half; x += 3) {
    for (const z of [-2, 2]) {
      vw.post(x, z, 1, h, o.column ?? C.vermilion, 1);
      vw.set(x, h + 1, z, C.douGold);
    }
    vw.box(-half, h + 2, -2, half, h + 2, 2, C.timberDeep);
  }
  roofYanshan(vw, {
    cx: 0, cz: 0, baseY: h + 3, w: half * 2 + 2, d: 8, h: 3,
    tile: o.tile ?? C.tileGrey, tileDeep: o.tileGreyDeep, eave: C.tileGreyDeep,
    lift: 1, soffit: false, ridge: C.ridgeDark, gableWall: null,
  });
  // 美人靠
  for (let x = -half; x <= half; x += 1) { vw.set(x, 2, -2, C.timber); vw.set(x, 2, 2, C.timber); }
  return vw;
}
