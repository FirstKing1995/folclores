// Cenário: colinas de capim, rio, ponte arqueada, calçamento, árvores grossas e lanternas.
import * as THREE from 'three';
import { clamp, lerp, suave, sorteio, ruido, fbm, lisa, fundir, F, tronco } from './util.js';
import { criarTexturas } from './texturas.js';

const EXT_X = 60, EXT_Z = 42;

// ---------- Geografia ----------
export const caminhoZ = (x) => (3.2 * Math.sin(x * 0.14) + 1.1 * Math.sin(x * 0.31 + 1)) * suave(8, 16, Math.abs(x));
const dCaminho = (x, z) => Math.abs(z - caminhoZ(x));
const rioX = (z) => (2.8 * Math.sin(z * 0.085) + 1.6 * Math.sin(z * 0.19 + 1)) * suave(4, 14, Math.abs(z));
const dRio = (x, z) => Math.abs(x - rioX(z)) - (4.4 + 0.9 * (ruido(z * 0.22, 7) - 0.5));
export const ladoSertao = (x) => suave(-8, 8, x + (ruido(x * 0.12, 3) - 0.5) * 6);
export const GUARDIOES = { mata: [-15.5, -4.6], sertao: [15.5, 4.6] };
const dPraca = (x, z) => Math.min(Math.hypot(x - GUARDIOES.mata[0], z - GUARDIOES.mata[1]), Math.hypot(x - GUARDIOES.sertao[0], z - GUARDIOES.sertao[1]));

function alturaTerreno(x, z) {
  const ondas = (fbm(x * 0.07 + 4, z * 0.07, 3) - 0.5) * 3;
  let h = ondas * suave(2.5, 9, dCaminho(x, z)) * suave(4.5, 8, dPraca(x, z));
  h += suave(13, 26, Math.abs(z)) * (3.2 + fbm(x * 0.05, z * 0.05, 2) * 4);
  h += suave(40, 56, Math.abs(x)) * 3;
  return lerp(-1.95, h, suave(-0.6, 3.1, dRio(x, z)));
}

const PONTE_X = 8.6, PONTE_Z = 2.6, ARCO = 1.25;
export const naPonte = (x, z) => Math.abs(x) < PONTE_X && Math.abs(z) < PONTE_Z;
const arcoPonte = (x) => ARCO * (1 - (x / PONTE_X) ** 2);
export const alturaChao = (x, z) => (naPonte(x, z) ? Math.max(arcoPonte(x), alturaTerreno(x, z)) : alturaTerreno(x, z));
export const andavel = (x, z) => naPonte(x, z) || (dRio(x, z) > 0.8 && Math.abs(z) < 15.5 && Math.abs(x) < 41);

export const TOCHAS = [[-9.6, 3.7], [-9.6, -3.7], [9.6, 3.7], [9.6, -3.7], [-21, 2.9], [21, -2.2], [-29, -3.6], [29, 3.9]];

// ---------- Vento ----------
function comVento(mat, tempo, forca) {
  const anterior = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    anterior?.(s, r);
    s.uniforms.uT = tempo;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float fase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.4;
        float pes = position.y * position.y * ${forca.toFixed(5)};
        transformed.x += sin(uT * 1.4 + fase + position.y * .3) * pes;
        transformed.z += cos(uT * 1.1 + fase * 1.3) * pes * 0.6;
      #endif`);
  };
  mat.customProgramCacheKey = () => 'vento' + forca;
  return mat;
}

function instancias(cena, geo, mat, lista, tinge) {
  if (!lista.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, lista.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  lista.forEach((it, i) => {
    o.position.set(it.x, it.y ?? 0, it.z);
    o.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
    const s = it.s ?? 1;
    if (typeof s === 'number') o.scale.setScalar(s); else o.scale.set(...s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (tinge) m.setColorAt(i, c.set(it.cor));
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  cena.add(m);
  return m;
}

// ---------- Árvores ----------
function geoTronco(sem) {
  const pecas = [];
  const H = 4.9;
  const g = new THREE.CylinderGeometry(1, 1, H, 12, 9, false);
  g.translate(0, H / 2, 0);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = clamp(v.y / H, 0, 1), a = Math.atan2(v.z, v.x);
    const raiz = Math.exp(-t * 7) * (0.95 + 0.55 * Math.sin(a * 5 + sem));
    const r = lerp(0.82, 0.55, Math.pow(t, 0.7)) + raiz + 0.05 * Math.sin(a * 7 + t * 9);
    const dobra = Math.sin(t * 2.6 + sem) * 0.42 * t;
    p.setXYZ(i, (Math.cos(a) * r) * (v.length() > 0 ? Math.min(1, Math.hypot(v.x, v.z) * 1000) : 1) + dobra, v.y, (Math.sin(a) * r) * Math.min(1, Math.hypot(v.x, v.z) * 1000) + dobra * 0.5);
  }
  g.computeVertexNormals();
  pecas.push(lisa(g, '#c49a62', { base: '#6b5543', topo: '#d5ad72', topoEm: 0.6, manterUV: true, uv: [3, 2.2], var: 0.14 }));
  const galhos = [[1.1, 4.8, 0.35, -0.75, 0.25], [-1.1, 5, -0.4, 0.8, -0.35], [0.1, 5.2, 1.05, 0.2, 0.75], [-0.3, 5.1, -1.1, -0.2, -0.75]];
  for (const [x, y, z, rz, rx] of galhos) {
    pecas.push(lisa(new THREE.CylinderGeometry(0.2, 0.45, 2.8, 9, 2), '#b58d58', { base: '#8c6f4d', p: [x * 0.82, y + 0.1, z * 0.82], r: [rx, 0, rz], manterUV: true, uv: [1.5, 1.2] }));
  }
  return fundir(pecas);
}

function blocoFolha(pos, raio, centro, sem, escuro) {
  const g = new THREE.SphereGeometry(1, 8, 5);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const b = 1 + (fbm(v.x * 2 + sem, v.y * 2 + v.z * 1.5 + sem, 2) - 0.5) * 0.65;
    const m = new THREE.Vector3(v.x * raio[0] * b, v.y * raio[1] * b, v.z * raio[2] * b).add(pos);
    // luz calculada a partir do centro da copa: a árvore lê como um volume só
    d.copy(m).sub(centro).normalize();
    n.setXYZ(i, d.x * 0.75 + v.x * 0.25, d.y * 0.75 + v.y * 0.25, d.z * 0.75 + v.z * 0.25);
    p.setXYZ(i, m.x, m.y, m.z);
  }
  g.normalizeNormals?.();
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.15 + sem * 0.13, uv.getY(i) * 0.72);
  const f = g.toNonIndexed();
  const cores = new Float32Array(f.attributes.position.count * 3), P = f.attributes.position;
  const baixo = centro.y - 2.4, alto = centro.y + 2.6;
  for (let i = 0; i < P.count; i++) {
    const t = clamp((P.getY(i) - baixo) / (alto - baixo), 0, 1);
    const k = escuro ? 0.62 : 1;
    cores[i * 3] = lerp(0.62, 1.28, t) * k;
    cores[i * 3 + 1] = lerp(0.68, 1.2, t) * k;
    cores[i * 3 + 2] = lerp(0.72, 0.9, t) * k;
  }
  f.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  return f;
}
function geoCopa(sem, escuro) {
  const r = sorteio(sem), c = new THREE.Vector3(0, 6.7, 0), pecas = [];
  const n = escuro ? 2 : 7;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + sem, q = escuro ? (i ? 1.2 : 0) : (i ? 1.65 + r() * 0.7 : 0);
    const t = escuro ? 2.1 : (i ? 1.45 + r() * 0.55 : 2.2);
    const pos = new THREE.Vector3(Math.cos(a) * q, 6.5 + (escuro ? 0 : (i ? (r() - 0.45) * 1.6 : 1.1)), Math.sin(a) * q);
    pecas.push(blocoFolha(pos, [t * 1.14, t * 0.86, t * 1.14], c, sem + i * 3.3, escuro));
  }
  return fundir(pecas);
}
function buriti() {
  const p = [lisa(tronco(0.18, 0.3, 6.6), '#8d7557', { base: '#5a4634', p: [0, 3.3, 0], var: 0.3 })];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28, c = 1.8 + (i % 3) * 0.28, inc = 1.25 + (i % 2) * 0.5;
    p.push(lisa(new THREE.ConeGeometry(0.34, c, 7, 2), i % 2 ? '#86b03e' : '#65983a', { base: '#3b6d35', p: [Math.cos(a) * c * 0.42, 6.65 + (i % 2) * 0.1, Math.sin(a) * c * 0.42], r: [Math.sin(a) * inc, 0, -Math.cos(a) * inc], s: [1, 1, 0.3] }));
  }
  return fundir(p);
}
function mandacaru() {
  const cor = '#5d9a70', base = '#33664e', topo = '#8fc284';
  const b = (l, y, alto) => [
    lisa(tronco(0.2, 0.2, 0.82), cor, { base, p: [l * 0.55, y, 0], r: [0, 0, 1.57] }),
    lisa(tronco(0.2, 0.23, alto), cor, { base, topo, p: [l * 0.96, y + alto / 2, 0] }),
  ];
  return fundir([lisa(tronco(0.3, 0.4, 4.2), cor, { base, topo, p: [0, 2.1, 0] }), ...b(1, 1.8, 1.6), ...b(-1, 2.5, 1.2)]);
}
function geoCapim() {
  const pos = [], uv = [], cor = [];
  for (let i = 0; i < 2; i++) {
    const a = i * 1.57 + 0.5, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62, H = 1.0;
    pos.push(-x, 0, -z, x, 0, z, x, H, z, -x, 0, -z, x, H, z, -x, H, -z, x, 0, z, -x, 0, -z, x, H, z, x, H, z, -x, 0, -z, -x, H, -z);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1);
    const b = [0.84, 0.86, 0.72], c = [1.2, 1.18, 0.95]; cor.push(...b, ...b, ...c, ...b, ...c, ...c, ...b, ...b, ...c, ...c, ...b, ...c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  const n = new Float32Array((pos.length / 3) * 3);
  for (let i = 0; i < n.length; i += 3) { n[i] = 0.1; n[i + 1] = 0.98; n[i + 2] = 0.1; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}
function geoArbusto() {
  const c = new THREE.Vector3(0, 0.45, 0), pecas = [];
  for (let i = 0; i < 3; i++) {
    const a = i * 2.2;
    pecas.push(blocoFolha(new THREE.Vector3(Math.cos(a) * 0.5, 0.55, Math.sin(a) * 0.5), [0.85, 0.65, 0.85], c, 30 + i, false));
  }
  const g = fundir(pecas);
  const C = g.attributes.color, P = g.attributes.position;
  for (let i = 0; i < C.count; i++) {
    const t = clamp(P.getY(i) / 1.2, 0, 1);
    C.setXYZ(i, lerp(0.62, 1.22, t), lerp(0.68, 1.18, t), lerp(0.7, 0.88, t));
  }
  return g;
}
function geoPedras(sem) {
  const bol = new THREE.SphereGeometry(1, 12, 8);
  return fundir([
    lisa(bol, '#f4f2ea', { base: '#a4a6a0', topo: '#ffffff', topoEm: 0.66, bossa: 0.55, semente: sem, s: [1.5, 0.98, 1.2], manterUV: true, uv: [3, 1.6], p: [0, 0.3, 0] }),
    lisa(bol, '#eeece2', { base: '#9d9f97', bossa: 0.5, semente: sem + 3, p: [1.25, -0.05, 0.45], s: 0.65, manterUV: true, uv: [2, 1] }),
  ]);
}

// ---------- Plano ----------
function planejar(n) {
  const r = sorteio(20261106), arvores = [];
  const livre = (x, z, d) => arvores.every((a) => Math.hypot(a.x - x, a.z - z) > d);
  let tent = 0;
  while (arvores.length < n.arvores && tent++ < 8000) {
    const x = (r() - 0.5) * EXT_X * 1.85, z = (r() - 0.5) * EXT_Z * 1.85;
    const borda = Math.abs(z) > 14;
    if (dRio(x, z) < 1.6 || !livre(x, z, borda ? 4 : 6.2)) continue;
    const dz = z - caminhoZ(x);
    if (dz > -5 && dz < 8.4) continue;
    if (dPraca(x, z) < 7) continue;
    if (!borda && r() < 0.45) continue;
    const ser = ladoSertao(x), v = r();
    let tipo;
    if (ser > 0.5) tipo = v < 0.34 ? 'copaLaranja' : v < 0.54 ? 'copaAmarela' : v < 0.78 ? 'mandacaru' : 'copaOliva';
    else tipo = v < 0.72 ? 'copaVerde' : v < 0.86 ? 'buriti' : v < 0.95 ? 'copaAmarela' : 'copaRoxa';
    arvores.push({ tipo, x, z, y: alturaTerreno(x, z) - 0.1, ry: r() * 6.28, s: 0.8 + r() * 0.42 });
  }
  return { arvores, r };
}

// ---------- Máscara e tom do chão ----------
function pintarMascara() {
  const w = 720, h = Math.round(w * (EXT_Z / EXT_X));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i / w) * EXT_X * 2 - EXT_X, z = (j / h) * EXT_Z * 2 - EXT_Z, o = (j * w + i) * 4;
    const n = fbm(x * 0.55, z * 0.55, 3) - 0.5, n2 = fbm(x * 0.14 + 6, z * 0.14, 2) - 0.5;
    const dc = Math.abs(x) < 42 ? dCaminho(x, z) : 99, dr = dRio(x, z), dp = dPraca(x, z);
    let t = 1 - suave(2.1, 3.9, dc + n * 2.4);
    t = Math.max(t, (1 - suave(0.1, 2.6, dr + n * 1.8)));
    t = Math.max(t, suave(0.2, 0.42, n2 + ladoSertao(x) * 0.17) * 0.85);
    t = Math.max(t, (1 - suave(5.2, 6.8, dp + n * 2)) * 0.9);
    const cal = Math.max(1 - suave(1.35, 2, dc + n * 1.5), 1 - suave(4.1, 4.8, dp + n * 1.3));
    const seixo = 1 - suave(-1.6, 0.2, dr + n);
    img.data[o] = 255 * t; img.data[o + 1] = 255 * clamp(cal, 0, 1); img.data[o + 2] = 255 * seixo; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.NoColorSpace;
  return tx;
}
function pintarTom(planos, pedras, largura) {
  const alt = Math.round(largura * (EXT_Z / EXT_X));
  const cv = document.createElement('canvas');
  cv.width = largura; cv.height = alt;
  const ctx = cv.getContext('2d');
  const pxU = largura / (EXT_X * 2);
  const P = (x, z) => [(x + EXT_X) * pxU, (z + EXT_Z) * pxU];
  const bw = 260, bh = Math.round(bw * (EXT_Z / EXT_X));
  const base = document.createElement('canvas');
  base.width = bw; base.height = bh;
  const bctx = base.getContext('2d'), img = bctx.createImageData(bw, bh);
  const A = new THREE.Color('#ece6b6'), B = new THREE.Color('#d0d8a0'), C = new THREE.Color('#fff0b0'), D = new THREE.Color('#e6c98c'), c = new THREE.Color(), c2 = new THREE.Color();
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const x = (i / bw) * EXT_X * 2 - EXT_X, z = (j / bh) * EXT_Z * 2 - EXT_Z, o = (j * bw + i) * 4;
    const n = suave(0.3, 0.7, fbm(x * 0.09, z * 0.09, 3));
    c.copy(B).lerp(A, n); c2.copy(D).lerp(C, n); c.lerp(c2, ladoSertao(x));
    const l = 0.86 + 0.26 * fbm(x * 0.2 + 2, z * 0.2, 2);
    const margem = 1 - suave(-0.2, 2.2, dRio(x, z)) * 1;
    const k = l * (1 - margem * 0.3);
    c.convertLinearToSRGB();
    img.data[o] = 255 * clamp(c.r * k, 0, 1); img.data[o + 1] = 255 * clamp(c.g * k, 0, 1); img.data[o + 2] = 255 * clamp(c.b * k, 0, 1); img.data[o + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(base, 0, 0, largura, alt);

  const r = sorteio(77);
  // sombra de cada árvore e pedra, fria e macia
  ctx.globalCompositeOperation = 'multiply';
  const sombra = (x, z, raio, forca) => {
    const [px, py] = P(x, z);
    const g = ctx.createRadialGradient(px, py, 0, px, py, raio * pxU);
    g.addColorStop(0, `rgba(58,86,104,${forca})`);
    g.addColorStop(0.6, `rgba(70,96,110,${forca * 0.72})`);
    g.addColorStop(1, 'rgba(120,140,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(px, py, raio * pxU * 1.15, raio * pxU * 0.9, -0.35, 0, 6.283);
    ctx.fill();
  };
  for (const a of planos.arvores) {
    const q = a.tipo === 'buriti' ? 2.1 : a.tipo === 'mandacaru' ? 1.4 : 4.5 * a.s;
    sombra(a.x + 3.1 * a.s, a.z - 1.6 * a.s, q, 0.9);
    sombra(a.x, a.z, 1.5 * a.s, 0.8);
  }
  for (const p of pedras) sombra(p.x + 0.8 * p.s, p.z - 0.4 * p.s, 2 * p.s, 0.75);
  // inscrições das praças dos guardiões
  for (const [gx, gz, cor] of [[...GUARDIOES.mata, '#3d6b4c'], [...GUARDIOES.sertao, '#8c4a24']]) {
    const [px, py] = P(gx, gz);
    ctx.strokeStyle = cor; ctx.lineWidth = 0.2 * pxU; ctx.globalAlpha = 0.9;
    for (const q of [4.05, 4.75]) { ctx.beginPath(); ctx.arc(px, py, q * pxU, 0, 6.283); ctx.stroke(); }
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * 6.283, b = a + 0.11, q1 = 4.15 * pxU, q2 = 4.65 * pxU;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a) * q1, py + Math.sin(a) * q1);
      ctx.lineTo(px + Math.cos(a) * q2, py + Math.sin(a) * q2);
      ctx.lineTo(px + Math.cos(b) * q2, py + Math.sin(b) * q2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
  // flores miúdas
  const flor = ['#ffb13a', '#ffe36a', '#fff8e6', '#ff7650', '#d98af0'];
  for (let i = 0; i < 900; i++) {
    const x = (r() - 0.5) * 92, z = (r() - 0.5) * 42;
    if (dRio(x, z) < 1.5 || dCaminho(x, z) < 3.4 || ruido(x * 0.19, z * 0.19) < 0.56) continue;
    const [px, py] = P(x, z);
    ctx.fillStyle = flor[Math.floor(r() * flor.length)];
    ctx.fillRect(px, py, Math.max(1.5, pxU * 0.14), Math.max(1.5, pxU * 0.14));
  }
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.minFilter = THREE.LinearMipmapLinearFilter;
  return tx;
}

// ---------- Água ----------
function criarAgua(cena, tempo) {
  const w = 360, h = Math.round(w * (EXT_Z / EXT_X));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i / w) * EXT_X * 2 - EXT_X, z = (j / h) * EXT_Z * 2 - EXT_Z, o = (j * w + i) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255 * clamp(-dRio(x, z) / 4, 0, 1) ; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const u = {
    uT: tempo, uMask: { value: new THREE.CanvasTexture(cv) },
    uRaso: { value: new THREE.Color('#4f9f96') }, uFundo: { value: new THREE.Color('#2f7c88') },
    uBrilho: { value: new THREE.Color('#e4f6de') }, uAurora: { value: 0 },
  };
  u.uMask.value.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float uT, uAurora; uniform sampler2D uMask; uniform vec3 uRaso, uFundo, uBrilho;
      varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vW.xz, fluxo = vec2(0., uT * .45);
        vec2 uv = vec2((p.x+${EXT_X.toFixed(1)})/${(EXT_X * 2).toFixed(1)}, 1.-(p.y+${EXT_Z.toFixed(1)})/${(EXT_Z * 2).toFixed(1)});
        float m = texture2D(uMask, uv).r;
        float a1 = n(vec2(p.x*.7, p.y*.22) - fluxo*.5), a2 = n(vec2(p.x*1.7, p.y*.55) - fluxo);
        vec3 c = mix(uRaso, uFundo, smoothstep(.1,.85,m + (a1-.5)*.3));
        c *= .92 + a2 * .18;
        float l = smoothstep(.6,.66, a1*.55 + a2*.5) - smoothstep(.66,.74, a1*.55 + a2*.5);
        c += uBrilho * l * .09;
        float brilho = smoothstep(.62,.7, n(p*vec2(2.6,1.2) - fluxo*2.) * n(p*1.3 + vec2(uT*.1)) * 1.6);
        c += uBrilho * brilho * .16;
        if (uAurora > 0.) c += mix(vec3(.05,.45,.36), vec3(.2,.2,.62), sin(p.y*.17+uT*.15+a1*3.)*.5+.5) * uAurora * (.4 + a1*.6);
        float alfa = smoothstep(0.,.1,m) * .96;
        gl_FragColor = vec4(c, alfa);
        #include <colorspace_fragment>
      }`,
  });
  const g = new THREE.PlaneGeometry(EXT_X * 2, EXT_Z * 2, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = -0.82;
  m.renderOrder = 1;
  cena.add(m);
  return u;
}

// ---------- Madeira: ponte, cercas, postes ----------
function pecaMadeira(geo, cor, o) { return lisa(geo, cor, { manterUV: true, var: 0.12, ...o }); }
function criarPonte(cena, matMadeira) {
  const p = [], n = 21;
  for (let i = 0; i < n; i++) {
    const x = lerp(-PONTE_X + 0.3, PONTE_X - 0.3, i / (n - 1));
    const inc = Math.atan((-2 * ARCO * x) / (PONTE_X * PONTE_X));
    const tom = ['#fff0d8', '#f0ddc0', '#fff6e4', '#e8d4b4'][i % 4];
    p.push(pecaMadeira(F.caixa, tom, { base: '#e4cba6', p: [x, arcoPonte(x) - 0.14, 0], r: [0, 0, inc], s: [0.8, 0.22, PONTE_Z * 2 + 0.18 + (i % 3) * 0.12], uv: [0.9, 1.6] }));
  }
  const postes = [-7.9, -5.27, -2.63, 0, 2.63, 5.27, 7.9];
  for (const z of [-PONTE_Z, PONTE_Z]) {
    // viga curva sob as tábuas e corrimão
    for (let k = 0; k < postes.length - 1; k++) {
      const a = postes[k], b = postes[k + 1], ya = arcoPonte(a), yb = arcoPonte(b);
      const ang = Math.atan2(yb - ya, b - a), L = Math.hypot(b - a, yb - ya) + 0.1;
      p.push(pecaMadeira(F.caixa, '#c8a982', { p: [(a + b) / 2, (ya + yb) / 2 - 0.34, z], r: [0, 0, ang], s: [L, 0.38, 0.34], uv: [2, 0.4] }));
      p.push(pecaMadeira(F.caixa, '#fff0d8', { base: '#e8d4b4', p: [(a + b) / 2, (ya + yb) / 2 + 1.1, z], r: [0, 0, ang], s: [L, 0.26, 0.3], uv: [2, 0.4] }));
      p.push(pecaMadeira(F.caixa, '#dcc4a0', { p: [(a + b) / 2, (ya + yb) / 2 + 0.55, z], r: [0, 0, ang], s: [L, 0.14, 0.14], uv: [2, 0.3] }));
    }
    for (const x of postes) {
      const y = arcoPonte(x);
      p.push(pecaMadeira(F.caixa, '#f3e0c2', { base: '#a98a64', topo: '#fff4e0', p: [x, y + 0.45, z], s: [0.5, 1.75, 0.5], uv: [0.6, 1.4] }));
      p.push(pecaMadeira(new THREE.ConeGeometry(0.46, 0.46, 4), '#fff4e0', { p: [x, y + 1.55, z], r: [0, 0.785, 0], base: '#e8d4b4' }));
    }
  }
  // pilares dentro da água
  for (const x of [-4.5, 4.5]) for (const z of [-PONTE_Z + 0.2, PONTE_Z - 0.2]) p.push(pecaMadeira(F.tubo, '#a48a68', { p: [x, -0.5, z], s: [0.3, 2.4, 0.3], uv: [1, 1.5] }));
  const m = new THREE.Mesh(fundir(p), matMadeira);
  m.castShadow = m.receiveShadow = true;
  cena.add(m);
}
function criarCercas(cena, matMadeira) {
  const p = [];
  const trecho = (x0, x1, lado) => {
    const n = Math.max(1, Math.round((x1 - x0) / 3));
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n), z = caminhoZ(x) + lado, y = alturaTerreno(x, z);
      p.push(pecaMadeira(F.caixa, '#ecd8ba', { base: '#a68a66', topo: '#fff0d8', p: [x, y + 0.62, z], s: [0.3, 1.34, 0.3], uv: [0.5, 1] }));
      if (i < n) {
        const x2 = lerp(x0, x1, (i + 1) / n), z2 = caminhoZ(x2) + lado, y2 = alturaTerreno(x2, z2);
        const L = Math.hypot(x2 - x, z2 - z, y2 - y), ry = -Math.atan2(z2 - z, x2 - x), rz = Math.atan2(y2 - y, Math.hypot(x2 - x, z2 - z));
        for (const h of [0.5, 1.02]) p.push(pecaMadeira(F.caixa, '#f3e0c2', { base: '#d8c09c', p: [(x + x2) / 2, (y + y2) / 2 + h, (z + z2) / 2], r: [0, ry, rz], s: [L, 0.16, 0.14], uv: [1.5, 0.25] }));
      }
    }
  };
  trecho(-22, -11, 4.2); trecho(10.5, 19, -4.1); trecho(24, 35, 4.3); trecho(-37, -26, -4.1);
  if (p.length) {
    const m = new THREE.Mesh(fundir(p), matMadeira);
    m.castShadow = true;
    cena.add(m);
  }
}
function criarLanternas(cena, matMadeira) {
  const madeira = [], metal = [], luz = [];
  for (const [x, z] of TOCHAS) {
    const y = alturaChao(x, z);
    madeira.push(pecaMadeira(F.caixa, '#e0caa6', { base: '#9b7f5c', p: [x, y + 1.25, z], s: [0.27, 2.5, 0.27], uv: [0.5, 1.5] }));
    madeira.push(pecaMadeira(F.caixa, '#ecd8ba', { p: [x + 0.36, y + 2.32, z], s: [0.8, 0.16, 0.18], uv: [0.8, 0.2] }));
    metal.push(lisa(F.caixa, '#3d3a37', { p: [x + 0.62, y + 1.72, z], s: [0.5, 0.08, 0.5] }));
    metal.push(lisa(new THREE.ConeGeometry(0.42, 0.3, 4), '#4b4641', { p: [x + 0.62, y + 2.17, z], r: [0, 0.785, 0] }));
    luz.push(lisa(F.caixa, '#ffd27a', { base: '#ff9a35', p: [x + 0.62, y + 1.92, z], s: [0.36, 0.42, 0.36], var: 0 }));
  }
  cena.add(new THREE.Mesh(fundir(madeira), matMadeira));
  cena.add(new THREE.Mesh(fundir(metal), new THREE.MeshLambertMaterial({ vertexColors: true })));
  cena.add(new THREE.Mesh(fundir(luz), new THREE.MeshBasicMaterial({ vertexColors: true })));
}

// ---------- Montagem ----------
const NIVEIS = {
  alta: { tom: 2048, capim: 900, arvores: 64, grade: 1.5, arbustos: 110, pedras: 60, seixos: 120 },
  media: { tom: 1536, capim: 420, arvores: 38, grade: 1, arbustos: 60, pedras: 44, seixos: 70 },
  baixa: { tom: 1024, capim: 160, arvores: 24, grade: 0.7, arbustos: 26, pedras: 26, seixos: 30 },
};

export function criarMundo(cena, qualidade, kit) {
  const nivel = NIVEIS[qualidade] ?? NIVEIS.media;
  const tempo = { value: 0 };
  const tx = criarTexturas(qualidade);
  const { arvores, r } = planejar(nivel);

  // pedras grandes arredondadas
  const pedras = [];
  let tent = 0;
  while (pedras.length < nivel.pedras && tent++ < 1500) {
    const x = (r() - 0.5) * EXT_X * 1.7, z = (r() - 0.5) * EXT_Z * 1.7, dr = dRio(x, z);
    const naMargem = dr > 0.1 && dr < 1.8;
    if (!naMargem && (r() < 0.75 || dCaminho(x, z) < 4.4 || dr < 0)) continue;
    if (Math.abs(z) < 3.9 && Math.abs(x) < 10) continue;
    if (dPraca(x, z) < 6.5) continue;
    const s = naMargem ? 0.75 + r() * 0.85 : 0.55 + r() * 0.95;
    pedras.push({ x, z, y: alturaTerreno(x, z) + 0.1 * s, ry: r() * 6.28, s, cor: new THREE.Color().setHSL(0.58 + r() * 0.05, 0.08 + r() * 0.06, 0.82 + r() * 0.14) });
  }

  // terreno
  const gChao = new THREE.PlaneGeometry(EXT_X * 2, EXT_Z * 2, Math.round(EXT_X * 2 * nivel.grade), Math.round(EXT_Z * 2 * nivel.grade));
  gChao.rotateX(-Math.PI / 2);
  const pos = gChao.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, alturaTerreno(pos.getX(i), pos.getZ(i)));
  gChao.computeVertexNormals();
  const mascara = pintarMascara();
  const matChao = new THREE.MeshLambertMaterial({ map: pintarTom({ arvores }, pedras, nivel.tom) });
  matChao.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uG: { value: tx.grama }, uT1: { value: tx.terra }, uC: { value: tx.calcamento }, uP: { value: tx.pedra }, uM: { value: mascara } });
    s.fragmentShader = 'uniform sampler2D uG, uT1, uC, uP, uM;\n' + s.fragmentShader.replace('#include <map_fragment>', `
      vec4 tom = texture2D(map, vMapUv);
      vec3 masc = texture2D(uM, vMapUv).rgb;
      vec2 q = vMapUv * vec2(${(EXT_X * 2 / 5.5).toFixed(2)}, ${(EXT_Z * 2 / 5.5).toFixed(2)});
      vec3 cg = texture2D(uG, q).rgb * (.82 + texture2D(uG, q * .23 + .37).g * .62);
      vec3 ct = mix(cg, texture2D(uT1, q * .9).rgb, masc.r);
      ct = mix(ct, texture2D(uP, q * .7).rgb * vec3(.82,.76,.66), masc.b);
      ct = mix(ct, texture2D(uC, q * 1.1).rgb, masc.g);
      diffuseColor.rgb = ct * tom.rgb * 1.62;`);
  };
  const chao = new THREE.Mesh(gChao, matChao);
  chao.receiveShadow = true;
  cena.add(chao);

  const uAgua = criarAgua(cena, tempo);

  tx.casca.repeat.set(1, 1);
  const matMadeira = new THREE.MeshLambertMaterial({ map: tx.madeira, vertexColors: true });
  criarPonte(cena, matMadeira);
  criarCercas(cena, matMadeira);
  criarLanternas(cena, matMadeira);

  // ---------- modelos da Quaternius (CC0), plantados por células para o corte de tela funcionar ----------
  const CELULA = 40;
  const uForcaPadrao = 0.0015;
  const matsConvertidos = new Map();
  const matDe = (orig, forca, recolor) => {
    const chave = `${orig.uuid}|${forca}|${recolor}`;
    if (matsConvertidos.has(chave)) return matsConvertidos.get(chave);
    const recorte = orig.alphaTest > 0 || orig.alphaMode === 'MASK' || /Leaves|Leaf|Grass|Flowers/.test(orig.name);
    const m = new THREE.MeshLambertMaterial({ map: orig.map, alphaTest: recorte ? 0.42 : 0, side: THREE.DoubleSide });
    m.name = orig.name;
    if (/Rocks/.test(orig.name)) m.color.setScalar(1.75);
    const forcaU = { value: forca };
    m.onBeforeCompile = (s) => {
      s.uniforms.uT = tempo;
      s.uniforms.uForca = forcaU;
      s.vertexShader = 'uniform float uT, uForca;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float fase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.4;
          float pes = position.y * position.y * uForca;
          transformed.x += sin(uT * 1.4 + fase + position.y * .3) * pes;
          transformed.z += cos(uT * 1.1 + fase * 1.3) * pes * 0.6;
        #endif`);
      if (recolor) {
        // folha colorida pela espécie, mantendo só as luzes e sombras pintadas da textura
        s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `
          #if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
            float lum = dot(diffuseColor.rgb, vec3(.3,.59,.11));
            diffuseColor.rgb = vColor.rgb * (lum * 4.2 + .55);
          #endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * .34;`);
      }
    };
    m.customProgramCacheKey = () => (recolor ? 'plantaCor' : 'planta');
    matsConvertidos.set(chave, m);
    return m;
  };
  // lista: { nome, x, z, y, ry, altura (em unidades do jogo), cor }
  const plantar = (lista, amp = 0.2, recolorFolhas = false) => {
    const grupos = new Map();
    for (const it of lista) {
      const c = `${it.nome}|${Math.floor(it.x / CELULA)}|${Math.floor(it.z / CELULA)}`;
      if (!grupos.has(c)) grupos.set(c, []);
      grupos.get(c).push(it);
    }
    for (const [c, itens] of grupos) {
      const modelo = kit[c.split('|')[0]];
      if (!modelo) continue;
      const larg = Math.max(modelo.altura, modelo.raio * 2);
      for (const it of itens) it.s = it.altura / (it.largura ? larg : modelo.altura);
      for (const parte of modelo.partes) {
        const folha = /Leaves|Leaf/.test(parte.mat.name);
        const usar = recolorFolhas && folha;
        const m = matDe(parte.mat, amp / (modelo.altura * modelo.altura), usar);
        const im = instancias(cena, parte.geo, m, itens, usar);
        if (im) im.frustumCulled = true;
      }
    }
  };

  const CORES = {
    copaVerde: ['#6f9f35', '#5f9431', '#82ad3b', '#578a30'], copaOliva: ['#94a03d', '#7f9338', '#a6a943'],
    copaLaranja: ['#ec8528', '#de6c22', '#f59a33'], copaAmarela: ['#eec02f', '#e0ab2a', '#f6cf42'], copaRoxa: ['#b478d4', '#9f68c6'],
  };
  const comuns = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'];
  const retorcidas = ['TwistedTree_1', 'TwistedTree_2', 'TwistedTree_3', 'TwistedTree_4', 'TwistedTree_5'];
  const listaCopas = [], listaPinhos = [], listaSecas = [];
  for (const a of arvores) {
    const qual = (l) => l[Math.floor(r() * l.length)];
    const base = { x: a.x, z: a.z, y: a.y, ry: a.ry };
    if (a.tipo.startsWith('copa')) {
      const torta = r() < (qualidade === 'alta' ? 0.25 : 0.1);
      listaCopas.push({ ...base, nome: torta ? qual(retorcidas) : qual(comuns), altura: (torta ? 10 : 11.5) * a.s, cor: qual(CORES[a.tipo]) });
    } else if (a.tipo === 'buriti') listaPinhos.push({ ...base, nome: qual(['Pine_1', 'Pine_2', 'Pine_3']), altura: 12 * a.s });
    else if (a.tipo === 'mandacaru') {
      if (r() < 0.25) listaSecas.push({ ...base, nome: qual(['DeadTree_1', 'DeadTree_2']), altura: 8 * a.s });
    }
  }
  plantar(listaCopas, 0.28, true);
  plantar(listaPinhos, 0.2);
  plantar(listaSecas, 0.03);
  const matPlanta = new THREE.MeshLambertMaterial({ vertexColors: true });
  instancias(cena, mandacaru(), matPlanta, arvores.filter((a) => a.tipo === 'mandacaru'));

  // pedras
  plantar(pedras.map((p, i) => ({ nome: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'][i % 3], x: p.x, z: p.z, y: p.y - 0.15, ry: p.ry, altura: 2.2 + p.s * 2.2, largura: true })), 0);
  const seixos = [];
  for (let i = 0; i < nivel.seixos; i++) {
    const x = (r() - 0.5) * EXT_X * 1.7, z = (r() - 0.5) * EXT_Z * 1.3;
    if (dRio(x, z) < 0.4 || Math.abs(dCaminho(x, z) - 3) > 2.2) continue;
    seixos.push({ nome: ['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3'][i % 3], x, z, y: alturaTerreno(x, z), ry: r() * 6.28, altura: 0.3 + r() * 0.4, largura: true });
  }
  plantar(seixos, 0);

  // chão vivo: capim, arbustos, flores, cogumelos
  const espalhar = (quant, nomes, altura, regra, amp, tenta = 8, cores = null) => {
    const saida = [];
    let n = 0;
    while (saida.length < quant && n++ < quant * tenta) {
      const x = (r() - 0.5) * EXT_X * 1.85, z = (r() - 0.5) * EXT_Z * 1.85;
      if (!regra(x, z)) continue;
      saida.push({ nome: nomes[Math.floor(r() * nomes.length)], x, z, y: alturaTerreno(x, z) - 0.03, ry: r() * 6.28, altura: altura * (0.75 + r() * 0.6), largura: true, cor: cores ? cores(x) : undefined });
    }
    plantar(saida, amp, !!cores);
  };
  const longeDoCaminho = (d) => (x, z) => dRio(x, z) > 0.2 && dCaminho(x, z) > d && dPraca(x, z) > 5.4;
  const mataR = (d) => (x, z) => longeDoCaminho(d)(x, z) && ladoSertao(x) < 0.55;
  const sertaoR = (d) => (x, z) => longeDoCaminho(d)(x, z) && ladoSertao(x) >= 0.45;
  const moita = (x, z, f) => ruido(x * f + 3, z * f) > 0.42;
  espalhar(nivel.capim * 0.62, ['Grass_Common_Short'], 1.5, (x, z) => mataR(2.8)(x, z) && moita(x, z, 0.3), 0.14);
  espalhar(nivel.capim * 0.38, ['Grass_Wispy_Short'], 1.5, (x, z) => sertaoR(2.8)(x, z) && moita(x, z, 0.3), 0.16);
  espalhar(nivel.arbustos * 0.62, ['Bush_Common', 'Bush_Common_Flowers'], 3.2, longeDoCaminho(4.2), 0.06, 8, (x) => (ladoSertao(x) > 0.5 ? ['#a8a240', '#c08a35', '#8f9a3c'] : ['#5f9431', '#6f9f35', '#4f8530'])[Math.floor(r() * 3)]);
  espalhar(nivel.arbustos * 0.5, ['Fern_1', 'Plant_1_Big', 'Plant_7_Big'], 2.6, mataR(3.6), 0.09);
  espalhar(nivel.arbustos * 0.46, ['Flower_3_Group', 'Flower_4_Group', 'Clover_1', 'Clover_2'], 1.5, longeDoCaminho(3.2), 0.05);
  espalhar(nivel.arbustos * 0.16, ['Mushroom_Common'], 1, mataR(3.4), 0);
  // vitórias-régias
  const folha = fundir([
    lisa(new THREE.CylinderGeometry(1, 0.97, 0.07, 18), '#5fa24e', { base: '#3f7d43', var: 0.2 }),
    lisa(new THREE.TorusGeometry(0.99, 0.06, 5, 18), '#b56a45', { r: [1.5708, 0, 0], p: [0, 0.05, 0], var: 0.1 }),
  ]);
  const folhas = [];
  for (let i = 0; i < 90 && folhas.length < 16; i++) {
    const z = (r() - 0.5) * 60, x = rioX(z) + (r() - 0.5) * 7;
    if (Math.abs(z) < 4.2 || dRio(x, z) > -1) continue;
    folhas.push({ x, z, y: -0.8, ry: r() * 6.28, s: 0.5 + r() * 0.65 });
  }
  instancias(cena, folha, new THREE.MeshLambertMaterial({ vertexColors: true }), folhas);

  // marcos de pedra com gemas nas praças
  const matPedra = new THREE.MeshLambertMaterial({ map: tx.pedra, vertexColors: true });
  const marco = (x, z, cor, ouro) => {
    const y = alturaTerreno(x, z);
    const geo = fundir([
      lisa(F.caixa, '#c2c0b6', { base: '#7f7f76', manterUV: true, p: [0, 0.32, 0], s: [1.8, 0.64, 1.8], uv: [1, 0.4] }),
      lisa(F.caixa, '#cdcabf', { base: '#8c8b80', topo: '#dcd9cc', manterUV: true, p: [0, 2.15, 0], s: [1.15, 3.1, 1.15], uv: [0.8, 2] }),
      lisa(F.caixa, '#c2c0b6', { manterUV: true, p: [0, 3.9, 0], s: [1.55, 0.42, 1.55], uv: [1, 0.3] }),
    ]);
    const m = new THREE.Mesh(geo, matPedra);
    m.position.set(x, y, z); m.castShadow = true;
    const orn = new THREE.Mesh(fundir([
      lisa(F.caixa, ouro, { base: '#8a6a22', p: [0, 0.74, 0], s: [1.86, 0.17, 1.86] }),
      lisa(F.caixa, ouro, { base: '#8a6a22', p: [0, 3.62, 0], s: [1.26, 0.15, 1.26] }),
    ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
    orn.position.copy(m.position);
    const gema = new THREE.Mesh(fundir([0, 1.5708, 3.1416, 4.7124].map((a) => lisa(new THREE.OctahedronGeometry(1), cor, { p: [Math.sin(a) * 0.6, 2.3, Math.cos(a) * 0.6], s: [0.2, 0.36, 0.2], var: 0 }))), new THREE.MeshBasicMaterial({ vertexColors: true }));
    gema.position.copy(m.position);
    cena.add(m, orn, gema);
  };
  marco(-10.4, 8.6, '#62ff9e', '#d6ad4c');
  marco(10.4, -8.6, '#ffb45e', '#c98d3e');

  // luz
  const ceu = new THREE.HemisphereLight('#d8ebff', '#8d8040', 1.95);
  const sol = new THREE.DirectionalLight('#ffe7b8', 2.45);
  sol.position.set(-14, 26, 9);
  cena.add(ceu, sol, sol.target);
  cena.fog = new THREE.Fog('#a8c9b8', 62, 118);

  const modos = {
    dia: { fundo: '#a8c9b8', neblina: '#a8c9b8', ceuC: '#d8ebff', ceuB: '#8d8040', ceuI: 1.95, solC: '#ffe7b8', solI: 2.45, chao: '#ffffff', raso: '#4f9f96', funda: '#2f7c88', brilho: '#e4f6de', aurora: 0, chama: 0.7 },
    noite: { fundo: '#0e2140', neblina: '#0e2140', ceuC: '#8497c4', ceuB: '#26405a', ceuI: 1.35, solC: '#b8cdf5', solI: 0.9, chao: '#d4dbf2', raso: '#2f7380', funda: '#1a4468', brilho: '#7fd8d0', aurora: 0.16, chama: 1.6 },
  };
  let brilhoChama = 0.7;
  const definirModo = (nome) => {
    const m = modos[nome];
    cena.background = new THREE.Color(m.fundo);
    cena.fog.color.set(m.neblina);
    ceu.color.set(m.ceuC); ceu.groundColor.set(m.ceuB); ceu.intensity = m.ceuI;
    sol.color.set(m.solC); sol.intensity = m.solI;
    matChao.color.set(m.chao);
    uAgua.uRaso.value.set(m.raso); uAgua.uFundo.value.set(m.funda); uAgua.uBrilho.value.set(m.brilho); uAgua.uAurora.value = m.aurora;
    brilhoChama = m.chama;
  };
  definirModo('dia');

  return {
    sol, tempo, definirModo, nivel,
    get brilhoChama() { return brilhoChama; },
    atualizar(t) { tempo.value = t; },
  };
}
