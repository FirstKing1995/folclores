// Cenário do mapa completo: três rotas, rio, mata fechada, bases. A forma vem de sim/mapa.js.
import * as THREE from 'three';
import { clamp, lerp, suave, sorteio, fbm, ruido, lisa, fundir, F, tronco } from './util.js';
import { criarTexturas } from './texturas.js';
import { U } from './sim/fixo.js';
import { ROTAS, NOMES_ROTA, TORRES, BASES, FONTES, OBSTACULOS, livre } from './sim/mapa.js';

const EXT = 130; // o terreno passa da borda do mapa para esconder o horizonte
const R2 = Math.SQRT1_2;

// ---------- Campos de distância, calculados uma vez ----------
const PASSO = 2, LADO = Math.floor((EXT * 2) / PASSO) + 1;
const novoCampo = () => new Float32Array(LADO * LADO);
const cRota = novoCampo(), cLateral = novoCampo(), cPraca = novoCampo(), cMata = novoCampo();
const distSeg = (px, pz, a, b) => {
  const vx = b[0] - a[0], vz = b[1] - a[1], wx = px - a[0], wz = pz - a[1];
  const t = clamp((vx * wx + vz * wz) / (vx * vx + vz * vz), 0, 1);
  return Math.hypot(wx - vx * t, wz - vz * t);
};
const PRACAS = [];
for (const lado of ['mata', 'sertao']) for (const r of NOMES_ROTA) for (const [x, z] of TORRES[lado][r]) PRACAS.push([x, z, 0]);
PRACAS.push([...BASES.mata, 7], [...BASES.sertao, 7], [...FONTES.mata, 4], [...FONTES.sertao, 4]);
for (let j = 0; j < LADO; j++) for (let i = 0; i < LADO; i++) {
  const x = -EXT + i * PASSO, z = -EXT + j * PASSO, o = j * LADO + i;
  let dr = 1e9, dl = 1e9;
  for (const n of NOMES_ROTA) {
    const r = ROTAS[n];
    for (let k = 0; k + 1 < r.length; k++) {
      const d = distSeg(x, z, r[k], r[k + 1]);
      if (d < dr) dr = d;
      if (n !== 'rio' && d < dl) dl = d;
    }
  }
  cRota[o] = dr; cLateral[o] = dl;
  let dp = 1e9;
  for (const [px, pz, extra] of PRACAS) dp = Math.min(dp, Math.hypot(x - px, z - pz) - extra);
  cPraca[o] = dp;
  let m = 0;
  for (const [cx, cz, rx, rz] of OBSTACULOS) {
    const q = 1 - Math.hypot((x - cx) / rx, (z - cz) / rz);
    if (q > m) m = q;
  }
  cMata[o] = m;
}
const amostra = (c, x, z) => {
  const fx = clamp((x + EXT) / PASSO, 0, LADO - 1.001), fz = clamp((z + EXT) / PASSO, 0, LADO - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), a = fx - i, b = fz - j, o = j * LADO + i;
  return lerp(lerp(c[o], c[o + 1], a), lerp(c[o + LADO], c[o + LADO + 1], a), b);
};
const dCaminho = (x, z) => amostra(cRota, x, z);
const dPraca = (x, z) => amostra(cPraca, x, z);

// Ruído em tabela: a máscara do chão tem centenas de milhares de pontos, e o ruído direto custaria segundos no celular.
const TAB = 256, tabela = new Float32Array(TAB * TAB);
for (let j = 0; j < TAB; j++) for (let i = 0; i < TAB; i++) tabela[j * TAB + i] = fbm(i * 0.11, j * 0.11, 3);
const rTab = (x, z) => {
  const i = Math.floor(x), j = Math.floor(z), a = x - i, b = z - j;
  const i0 = i & 255, i1 = (i + 1) & 255, j0 = (j & 255) << 8, j1 = ((j + 1) & 255) << 8;
  return lerp(lerp(tabela[j0 | i0], tabela[j0 | i1], a), lerp(tabela[j1 | i0], tabela[j1 | i1], a), b);
};

// ---------- Geografia ----------
const eixoRio = (x, z) => {
  const s = (x + z) * R2, c = (x - z) * R2;
  return c + (3 * Math.sin(s * 0.06) + 1.4 * Math.sin(s * 0.14 + 1)) * suave(6, 24, Math.abs(s));
};
const dRio = (x, z) => Math.abs(eixoRio(x, z)) - (5 + 0.9 * (ruido((x + z) * 0.15, 7) - 0.5));
export const ladoSertao = (x, z) => suave(-14, 14, (x - z) * R2 + (ruido((x + z) * 0.06, 3) - 0.5) * 8);

function alturaTerreno(x, z) {
  const ondas = (fbm(x * 0.07 + 4, z * 0.07, 3) - 0.5) * 3;
  let h = ondas * suave(3, 10, dCaminho(x, z)) * suave(5, 11, dPraca(x, z));
  h += amostra(cMata, x, z) * 3;
  const fora = Math.max(Math.abs(x), Math.abs(z)) - 92;
  if (fora > 0) h += suave(0, 24, fora) * (5 + fbm(x * 0.05, z * 0.05, 2) * 5);
  h = lerp(-1.6, h, suave(-0.6, 3.1, dRio(x, z)));
  // as rotas laterais atravessam o rio por um vau de pedra
  const dl = amostra(cLateral, x, z);
  if (dl < 7) h = lerp(Math.max(h, 0), h, suave(3.5, 7, dl));
  return h;
}

const PONTE_X = 8.6, PONTE_Z = 4.2, ARCO = 1.25;
const uPonte = (x, z) => (x - z) * R2, vPonte = (x, z) => (x + z) * R2;
export const naPonte = (x, z) => Math.abs(uPonte(x, z)) < PONTE_X && Math.abs(vPonte(x, z)) < PONTE_Z;
const arcoPonte = (u) => ARCO * (1 - (u / PONTE_X) ** 2);
export const alturaChao = (x, z) => (naPonte(x, z) ? Math.max(arcoPonte(uPonte(x, z)), alturaTerreno(x, z)) : alturaTerreno(x, z));

// Lanternas nas beiras de cada rota, de tanto em tanto.
function pontosAoLongoDaRota(espaco, afasta) {
  const lista = [];
  for (const n of NOMES_ROTA) {
    const r = ROTAS[n];
    for (let k = 0; k + 1 < r.length; k++) {
      const [ax, az] = r[k], [bx, bz] = r[k + 1], L = Math.hypot(bx - ax, bz - az);
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let d = espaco / 2; d < L; d += espaco) lista.push({ x: ax + ux * d, z: az + uz * d, ox: -uz * afasta, oz: ux * afasta });
    }
  }
  return lista;
}
export const TOCHAS = pontosAoLongoDaRota(26, 6.2)
  .map((p, i) => (i % 2 ? [p.x + p.ox, p.z + p.oz] : [p.x - p.ox, p.z - p.oz]))
  .filter(([x, z]) => dRio(x, z) > 1 && dPraca(x, z) > 6);

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

function mandacaru() {
  const cor = '#5d9a70', base = '#33664e', topo = '#8fc284';
  const b = (l, y, alto) => [
    lisa(tronco(0.2, 0.2, 0.82), cor, { base, p: [l * 0.55, y, 0], r: [0, 0, 1.57] }),
    lisa(tronco(0.2, 0.23, alto), cor, { base, topo, p: [l * 0.96, y + alto / 2, 0] }),
  ];
  return fundir([lisa(tronco(0.3, 0.4, 4.2), cor, { base, topo, p: [0, 2.1, 0] }), ...b(1, 1.8, 1.6), ...b(-1, 2.5, 1.2)]);
}

// ---------- Plano das árvores ----------
function planejar(n) {
  const r = sorteio(20261107), arvores = [];
  const perto = (x, z, d) => arvores.some((a) => Math.abs(a.x - x) < d && Math.abs(a.z - z) < d && Math.hypot(a.x - x, a.z - z) < d);
  const poe = (x, z) => {
    const ser = ladoSertao(x, z), v = r();
    let tipo;
    if (ser > 0.5) tipo = v < 0.34 ? 'copaLaranja' : v < 0.54 ? 'copaAmarela' : v < 0.78 ? 'mandacaru' : 'copaOliva';
    else tipo = v < 0.72 ? 'copaVerde' : v < 0.86 ? 'buriti' : v < 0.95 ? 'copaAmarela' : 'copaRoxa';
    arvores.push({ tipo, x, z, y: alturaTerreno(x, z) - 0.1, ry: r() * 6.28, s: 0.8 + r() * 0.42 });
  };
  // mata fechada: é ela que mostra por onde não dá para passar
  let tent = 0, alvo = n.arvores * 0.6;
  while (arvores.length < alvo && tent++ < 12000) {
    const x = (r() - 0.5) * 184, z = (r() - 0.5) * 184;
    if (livre(Math.round(x * U), Math.round(z * U)) || dRio(x, z) < 1 || perto(x, z, n.espaco)) continue;
    poe(x, z);
  }
  // muralha de árvores além da borda
  alvo = n.arvores * 0.9; tent = 0;
  while (arvores.length < alvo && tent++ < 12000) {
    const x = (r() - 0.5) * 240, z = (r() - 0.5) * 240, m = Math.max(Math.abs(x), Math.abs(z));
    if (m < 94 || m > 118 || dRio(x, z) < 1 || perto(x, z, n.espaco + 1)) continue;
    poe(x, z);
  }
  // algumas soltas nos clarões
  alvo = n.arvores; tent = 0;
  while (arvores.length < alvo && tent++ < 8000) {
    const x = (r() - 0.5) * 180, z = (r() - 0.5) * 180;
    if (dCaminho(x, z) < 9 || dPraca(x, z) < 9 || dRio(x, z) < 2 || perto(x, z, 9)) continue;
    poe(x, z);
  }
  return { arvores, r };
}

// ---------- Máscara e tom do chão ----------
function pintarMascara(w) {
  const h = w;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h), px = img.data;
  const esc = (EXT * 2) / w;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = i * esc - EXT, z = j * esc - EXT, o = (j * w + i) * 4;
    const n = rTab(x * 3.1, z * 3.1) - 0.5, n2 = rTab(x * 0.7 + 90, z * 0.7) - 0.5;
    const dc = dCaminho(x, z), dr = Math.abs(eixoRio(x, z)) - 5, dp = dPraca(x, z);
    let t = 1 - suave(5.2, 7.4, dc + n * 3);
    t = Math.max(t, 1 - suave(0.1, 2.6, dr + n * 1.8));
    t = Math.max(t, suave(0.2, 0.42, n2 + (x - z) * R2 * 0.004) * 0.85);
    t = Math.max(t, (1 - suave(5.2, 6.8, dp + n * 2)) * 0.9);
    const cal = Math.max(1 - suave(3.4, 4.3, dc + n * 1.6), 1 - suave(4.1, 4.8, dp + n * 1.3));
    const seixo = 1 - suave(-1.6, 0.2, dr + n);
    px[o] = 255 * t; px[o + 1] = 255 * clamp(cal, 0, 1); px[o + 2] = 255 * seixo; px[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.NoColorSpace;
  return tx;
}
function pintarTom(planos, pedras, largura) {
  const cv = document.createElement('canvas');
  cv.width = largura; cv.height = largura;
  const ctx = cv.getContext('2d');
  const pxU = largura / (EXT * 2);
  const P = (x, z) => [(x + EXT) * pxU, (z + EXT) * pxU];
  const bw = 300, bh = 300;
  const base = document.createElement('canvas');
  base.width = bw; base.height = bh;
  const bctx = base.getContext('2d'), img = bctx.createImageData(bw, bh);
  const A = new THREE.Color('#ece6b6'), B = new THREE.Color('#d0d8a0'), C = new THREE.Color('#fff0b0'), D = new THREE.Color('#e6c98c'), c = new THREE.Color(), c2 = new THREE.Color();
  const SERRA = new THREE.Color('#d9d6c8'), MANGUE = new THREE.Color('#b9c49a');
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const x = (i / bw) * EXT * 2 - EXT, z = (j / bh) * EXT * 2 - EXT, o = (j * bw + i) * 4;
    const n = suave(0.3, 0.7, rTab(x * 0.7, z * 0.7));
    c.copy(B).lerp(A, n); c2.copy(D).lerp(C, n); c.lerp(c2, ladoSertao(x, z));
    // Serra mais pedregosa e Mangue mais úmido, para cada rota ter cara própria
    const s = (x + z) * R2;
    if (s < -24) c.lerp(SERRA, suave(24, 60, -s) * 0.55);
    if (s > 24) c.lerp(MANGUE, suave(24, 60, s) * 0.7);
    const l = 0.86 + 0.26 * rTab(x * 1.6 + 30, z * 1.6);
    const margem = 1 - suave(-0.2, 2.2, dRio(x, z));
    const k = l * (1 - margem * 0.3) * (1 - clamp(amostra(cMata, x, z) * 2.5, 0, 1) * 0.3);
    c.convertLinearToSRGB();
    img.data[o] = 255 * clamp(c.r * k, 0, 1); img.data[o + 1] = 255 * clamp(c.g * k, 0, 1); img.data[o + 2] = 255 * clamp(c.b * k, 0, 1); img.data[o + 3] = 255;
  }
  bctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(base, 0, 0, largura, largura);

  const r = sorteio(77);
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
    if (Math.max(Math.abs(a.x), Math.abs(a.z)) > 108) continue;
    const q = a.tipo === 'buriti' ? 2.1 : a.tipo === 'mandacaru' ? 1.4 : 4.5 * a.s;
    sombra(a.x + 3.1 * a.s, a.z - 1.6 * a.s, q, 0.9);
    sombra(a.x, a.z, 1.5 * a.s, 0.8);
  }
  for (const p of pedras) sombra(p.x + 0.8 * p.s, p.z - 0.4 * p.s, 2 * p.s, 0.75);
  // inscrições nas praças dos guardiões, das bases e das fontes
  const circulo = (gx, gz, cor, raios) => {
    const [px, py] = P(gx, gz);
    ctx.strokeStyle = cor; ctx.lineWidth = 0.2 * pxU; ctx.globalAlpha = 0.9;
    for (const q of raios) { ctx.beginPath(); ctx.arc(px, py, q * pxU, 0, 6.283); ctx.stroke(); }
    ctx.globalAlpha = 1;
  };
  for (const lado of ['mata', 'sertao']) {
    const cor = lado === 'mata' ? '#3d6b4c' : '#8c4a24';
    for (const rota of NOMES_ROTA) for (const [gx, gz] of TORRES[lado][rota]) circulo(gx, gz, cor, [4.05, 4.75]);
    circulo(...BASES[lado], cor, [9.2, 10.4]);
    circulo(...FONTES[lado], lado === 'mata' ? '#2f9f7a' : '#c9742a', [14.6]);
  }
  ctx.globalCompositeOperation = 'source-over';
  const flor = ['#ffb13a', '#ffe36a', '#fff8e6', '#ff7650', '#d98af0'];
  for (let i = 0; i < 2600; i++) {
    const x = (r() - 0.5) * 184, z = (r() - 0.5) * 184;
    if (dRio(x, z) < 1.5 || dCaminho(x, z) < 6.5 || ruido(x * 0.19, z * 0.19) < 0.56) continue;
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
  const w = 420, h = w;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i / w) * EXT * 2 - EXT, z = (j / h) * EXT * 2 - EXT, o = (j * w + i) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255 * clamp(-dRio(x, z) / 4, 0, 1); img.data[o + 3] = 255;
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
        vec2 uv = vec2((p.x+${EXT.toFixed(1)})/${(EXT * 2).toFixed(1)}, 1.-(p.y+${EXT.toFixed(1)})/${(EXT * 2).toFixed(1)});
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
  // só a faixa do rio, na diagonal: evita pintar a tela toda
  const g = new THREE.PlaneGeometry(EXT * 2.9, 34, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.rotation.y = -Math.PI / 4;
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
    for (let k = 0; k < postes.length - 1; k++) {
      const a = postes[k], b = postes[k + 1], ya = arcoPonte(a), yb = arcoPonte(b);
      const ang = Math.atan2(yb - ya, b - a), L = Math.hypot(b - a, yb - ya) + 0.1;
      p.push(pecaMadeira(F.caixa, '#c8a982', { p: [(a + b) / 2, (ya + yb) / 2 - 0.34, z], r: [0, 0, ang], s: [L, 0.38, 0.34], uv: [2, 0.4] }));
      p.push(pecaMadeira(F.caixa, '#fff0d8', { base: '#e8d4b4', p: [(a + b) / 2, (ya + yb) / 2 + 1.1, z], r: [0, 0, ang], s: [L, 0.26, 0.3], uv: [2, 0.4] }));
    }
    for (const x of postes) {
      const y = arcoPonte(x);
      p.push(pecaMadeira(F.caixa, '#f3e0c2', { base: '#a98a64', topo: '#fff4e0', p: [x, y + 0.45, z], s: [0.5, 1.75, 0.5], uv: [0.6, 1.4] }));
      p.push(pecaMadeira(new THREE.ConeGeometry(0.46, 0.46, 4), '#fff4e0', { p: [x, y + 1.55, z], r: [0, 0.785, 0], base: '#e8d4b4' }));
    }
  }
  for (const x of [-4.5, 4.5]) for (const z of [-PONTE_Z + 0.2, PONTE_Z - 0.2]) p.push(pecaMadeira(F.tubo, '#a48a68', { p: [x, -0.5, z], s: [0.3, 2.4, 0.3], uv: [1, 1.5] }));
  const m = new THREE.Mesh(fundir(p), matMadeira);
  m.castShadow = m.receiveShadow = true;
  m.rotation.y = Math.PI / 4; // acompanha a rota do Rio, que corre na diagonal
  cena.add(m);
}
// Cerca só onde a mata fechada encosta na rota: assim ninguém atravessa cerca andando.
function criarCercas(cena, matMadeira) {
  const p = [];
  for (const n of NOMES_ROTA) {
    const r = ROTAS[n];
    for (let k = 0; k + 1 < r.length; k++) {
      const [ax, az] = r[k], [bx, bz] = r[k + 1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      for (const s of [-1, 1]) {
        let ant = null;
        for (let d = 3; d < L - 3; d += 3.2) {
          const x = ax + ux * d - uz * s * 6.3, z = az + uz * d + ux * s * 6.3;
          const fechado = !livre(Math.round(x * U), Math.round(z * U));
          if (!fechado || dRio(x, z) < 1 || dPraca(x, z) < 7) { ant = null; continue; }
          const y = alturaTerreno(x, z);
          p.push(pecaMadeira(F.caixa, '#ecd8ba', { base: '#a68a66', topo: '#fff0d8', p: [x, y + 0.62, z], s: [0.3, 1.34, 0.3], uv: [0.5, 1] }));
          if (ant) {
            const LL = Math.hypot(x - ant[0], z - ant[1], y - ant[2]), ry = -Math.atan2(z - ant[1], x - ant[0]), rz = Math.atan2(y - ant[2], Math.hypot(x - ant[0], z - ant[1]));
            p.push(pecaMadeira(F.caixa, '#f3e0c2', { base: '#d8c09c', p: [(x + ant[0]) / 2, (y + ant[2]) / 2 + 0.8, (z + ant[1]) / 2], r: [0, ry, rz], s: [LL, 0.16, 0.14], uv: [1.5, 0.25] }));
          }
          ant = [x, z, y];
        }
      }
    }
  }
  if (p.length) cena.add(new THREE.Mesh(fundir(p), matMadeira));
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

// Terreno em blocos, para o corte de tela desenhar só o que aparece.
function criarTerreno(cena, mat, grade) {
  const BLOCOS = 7, tam = (EXT * 2) / BLOCOS, seg = Math.max(8, Math.round(tam * grade));
  const passo = tam / seg;
  for (let bj = 0; bj < BLOCOS; bj++) for (let bi = 0; bi < BLOCOS; bi++) {
    const g = new THREE.PlaneGeometry(tam, tam, seg, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(-EXT + (bi + 0.5) * tam, 0, -EXT + (bj + 0.5) * tam);
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i);
      P.setY(i, alturaTerreno(x, z));
      // normal pelo próprio relevo: blocos vizinhos emendam sem costura
      const dx = alturaTerreno(x + passo, z) - alturaTerreno(x - passo, z), dz = alturaTerreno(x, z + passo) - alturaTerreno(x, z - passo);
      const l = Math.hypot(dx, 2 * passo, dz);
      N.setXYZ(i, -dx / l, (2 * passo) / l, -dz / l);
      // a textura do mapa é uma só para todos os blocos
      UV.setXY(i, (x + EXT) / (EXT * 2), 1 - (z + EXT) / (EXT * 2));
    }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    cena.add(m);
  }
}

// ---------- Montagem ----------
const NIVEIS = {
  alta: { tom: 2048, mascara: 1024, capim: 1500, arvores: 460, espaco: 5, grade: 0.9, arbustos: 300, pedras: 150, seixos: 220, especies: 5, tortas: 2, flores: 4 },
  media: { tom: 1536, mascara: 768, capim: 650, arvores: 300, espaco: 6, grade: 0.65, arbustos: 150, pedras: 100, seixos: 80, especies: 3, tortas: 1, flores: 2 },
  baixa: { tom: 1024, mascara: 512, capim: 240, arvores: 190, espaco: 7.5, grade: 0.42, arbustos: 60, pedras: 60, seixos: 0, especies: 2, tortas: 0, flores: 1 },
};

export function criarMundo(cena, qualidade, kit) {
  const nivel = NIVEIS[qualidade] ?? NIVEIS.media;
  const tempo = { value: 0 };
  const tx = criarTexturas(qualidade);
  const { arvores, r } = planejar(nivel);

  const pedras = [];
  let tent = 0;
  while (pedras.length < nivel.pedras && tent++ < 4000) {
    const x = (r() - 0.5) * 190, z = (r() - 0.5) * 190, dr = dRio(x, z);
    const naMargem = dr > 0.1 && dr < 1.8;
    const fechado = !livre(Math.round(x * U), Math.round(z * U));
    if (!naMargem && !fechado && (r() < 0.8 || dCaminho(x, z) < 7.5)) continue;
    if (dCaminho(x, z) < 6.8 || dPraca(x, z) < 6.5 || dr < 0) continue;
    const s = naMargem ? 0.75 + r() * 0.85 : 0.55 + r() * 0.95;
    pedras.push({ x, z, y: alturaTerreno(x, z) + 0.1 * s, ry: r() * 6.28, s });
  }

  const mascara = pintarMascara(nivel.mascara);
  const matChao = new THREE.MeshLambertMaterial({ map: pintarTom({ arvores }, pedras, nivel.tom) });
  matChao.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uG: { value: tx.grama }, uT1: { value: tx.terra }, uC: { value: tx.calcamento }, uP: { value: tx.pedra }, uM: { value: mascara } });
    s.fragmentShader = 'uniform sampler2D uG, uT1, uC, uP, uM;\n' + s.fragmentShader.replace('#include <map_fragment>', `
      vec4 tom = texture2D(map, vMapUv);
      vec3 masc = texture2D(uM, vMapUv).rgb;
      vec2 q = vMapUv * vec2(${(EXT * 2 / 5.5).toFixed(2)}, ${(EXT * 2 / 5.5).toFixed(2)});
      vec3 cg = texture2D(uG, q).rgb * (.82 + texture2D(uG, q * .23 + .37).g * .62);
      vec3 ct = mix(cg, texture2D(uT1, q * .9).rgb, masc.r);
      ct = mix(ct, texture2D(uP, q * .7).rgb * vec3(.82,.76,.66), masc.b);
      ct = mix(ct, texture2D(uC, q * 1.7).rgb, masc.g);
      diffuseColor.rgb = ct * tom.rgb * 1.62;`);
  };
  criarTerreno(cena, matChao, nivel.grade);

  const uAgua = criarAgua(cena, tempo);

  const matMadeira = new THREE.MeshLambertMaterial({ map: tx.madeira, vertexColors: true });
  criarPonte(cena, matMadeira);
  criarCercas(cena, matMadeira);
  criarLanternas(cena, matMadeira);

  // ---------- modelos da Quaternius (CC0) ----------
  // Furo: o que está entre a câmera e o herói fica vazado perto dele. x, y em pixels, z profundidade, w raio.
  const uFuro = { value: new THREE.Vector4(0, 0, 0, 1) };
  const matsConvertidos = new Map();
  const matDe = (orig, forca, recolor) => {
    const chave = `${orig.uuid}|${forca}|${recolor}`;
    if (matsConvertidos.has(chave)) return matsConvertidos.get(chave);
    const recorte = orig.alphaTest > 0 || orig.alphaMode === 'MASK' || /Leaves|Leaf|Grass|Flowers/.test(orig.name);
    const m = new THREE.MeshLambertMaterial({ map: orig.map, alphaTest: recorte ? 0.42 : 0, side: recorte ? THREE.DoubleSide : THREE.FrontSide });
    m.name = orig.name;
    if (/Rocks/.test(orig.name)) m.color.setScalar(1.75);
    const forcaU = { value: forca };
    m.onBeforeCompile = (s) => {
      s.uniforms.uT = tempo;
      s.uniforms.uForca = forcaU;
      s.uniforms.uFuro = uFuro;
      s.vertexShader = 'uniform float uT, uForca;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float fase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.4;
          float pes = position.y * position.y * uForca;
          transformed.x += sin(uT * 1.4 + fase + position.y * .3) * pes;
          transformed.z += cos(uT * 1.1 + fase * 1.3) * pes * 0.6;
        #endif`);
      s.fragmentShader = 'uniform vec4 uFuro;\n' + s.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (gl_FragCoord.z < uFuro.z) {
          float dFuro = distance(gl_FragCoord.xy, uFuro.xy) / uFuro.w;
          if (dFuro < 1.) {
            vec2 gr = floor(gl_FragCoord.xy / 2.);
            float xadrez = mod(gr.x + gr.y, 2.);
            if (dFuro < .62 || xadrez < 1.) discard;
          }
        }`);
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
  // Grupos cortáveis: cada espécie é um único desenho que recebe só as plantas em volta da câmera.
  const grupos = [];
  const _o = new THREE.Object3D(), _c = new THREE.Color();
  const criarGrupo = (partes, itens, tinge) => {
    const n = itens.length;
    if (!n) return;
    const xs = new Float32Array(n), zs = new Float32Array(n), mats = new Float32Array(n * 16), cores = tinge ? new Float32Array(n * 3) : null;
    itens.forEach((it, i) => {
      _o.position.set(it.x, it.y ?? 0, it.z);
      _o.rotation.set(0, it.ry ?? 0, 0);
      const s = it.s ?? 1;
      if (typeof s === 'number') _o.scale.setScalar(s); else _o.scale.set(...s);
      _o.updateMatrix();
      _o.matrix.toArray(mats, i * 16);
      xs[i] = it.x; zs[i] = it.z;
      if (tinge) _c.set(it.cor).toArray(cores, i * 3);
    });
    // as partes de uma espécie dividem a mesma lista de instâncias
    const vivos = new Float32Array(n * 16), vivasCores = tinge ? new Float32Array(n * 3) : null;
    const ims = partes.map(({ geo, mat, tingir }) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.instanceMatrix = new THREE.InstancedBufferAttribute(vivos, 16);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (tingir && tinge) { im.instanceColor = new THREE.InstancedBufferAttribute(vivasCores, 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      im.frustumCulled = false;
      im.count = 0;
      cena.add(im);
      return im;
    });
    grupos.push({ n, xs, zs, mats, cores, vivos, vivasCores, ims });
  };
  const cortar = (cx, cz, rx, longe, perto) => {
    for (const g of grupos) {
      let k = 0;
      for (let i = 0; i < g.n; i++) {
        const dx = g.xs[i] - cx, dz = g.zs[i] - cz;
        if (dx < -rx || dx > rx || dz < -longe || dz > perto) continue;
        if (k !== i) for (let q = 0; q < 16; q++) g.vivos[k * 16 + q] = g.mats[i * 16 + q];
        else g.vivos.set(g.mats.subarray(i * 16, i * 16 + 16), k * 16);
        if (g.cores) { g.vivasCores[k * 3] = g.cores[i * 3]; g.vivasCores[k * 3 + 1] = g.cores[i * 3 + 1]; g.vivasCores[k * 3 + 2] = g.cores[i * 3 + 2]; }
        k++;
      }
      for (const im of g.ims) {
        im.count = k;
        im.visible = k > 0;
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
  };
  // lista: { nome, x, z, y, ry, altura (em unidades do jogo), cor }. Com fixo, fica sempre na cena (árvores das bases).
  const plantar = (lista, amp = 0.2, recolorFolhas = false, fixo = false) => {
    const porNome = new Map(), saida = [];
    for (const it of lista) {
      if (!porNome.has(it.nome)) porNome.set(it.nome, []);
      porNome.get(it.nome).push(it);
    }
    for (const [nome, itens] of porNome) {
      const modelo = kit[nome];
      if (!modelo) continue;
      const larg = Math.max(modelo.altura, modelo.raio * 2);
      for (const it of itens) it.s = it.altura / (it.largura ? larg : modelo.altura);
      const partes = modelo.partes.map((parte) => {
        const tingir = recolorFolhas && /Leaves|Leaf/.test(parte.mat.name);
        return { geo: parte.geo, mat: matDe(parte.mat, amp / (modelo.altura * modelo.altura), tingir), tingir };
      });
      if (fixo) for (const p of partes) { const im = instancias(cena, p.geo, p.mat, itens, p.tingir); if (im) saida.push(im); }
      else criarGrupo(partes, itens, recolorFolhas);
    }
    return saida;
  };

  const CORES = {
    copaVerde: ['#6f9f35', '#5f9431', '#82ad3b', '#578a30'], copaOliva: ['#94a03d', '#7f9338', '#a6a943'],
    copaLaranja: ['#ec8528', '#de6c22', '#f59a33'], copaAmarela: ['#eec02f', '#e0ab2a', '#f6cf42'], copaRoxa: ['#b478d4', '#9f68c6'],
  };
  // árvores mais leves primeiro: os níveis baixos usam só o começo das listas
  const comuns = ['CommonTree_5', 'CommonTree_3', 'CommonTree_4', 'CommonTree_2', 'CommonTree_1'].slice(0, nivel.especies);
  const retorcidas = ['TwistedTree_2', 'TwistedTree_1'].slice(0, nivel.tortas);
  const listaCopas = [], listaPinhos = [], listaSecas = [];
  for (const a of arvores) {
    const qual = (l) => l[Math.floor(r() * l.length)];
    const base = { x: a.x, z: a.z, y: a.y, ry: a.ry };
    if (a.tipo.startsWith('copa')) {
      const torta = retorcidas.length > 0 && r() < (qualidade === 'alta' ? 0.25 : 0.1);
      listaCopas.push({ ...base, nome: torta ? qual(retorcidas) : qual(comuns), altura: (torta ? 9 : 10.5) * a.s, cor: qual(CORES[a.tipo]) });
    } else if (a.tipo === 'buriti') listaPinhos.push({ ...base, nome: qual(['Pine_2', 'Pine_1', 'Pine_3'].slice(0, Math.max(1, nivel.especies - 1))), altura: 11 * a.s });
    else if (a.tipo === 'mandacaru') {
      if (r() < 0.25) listaSecas.push({ ...base, nome: qual(['DeadTree_1', 'DeadTree_2']), altura: 8 * a.s });
    }
  }
  plantar(listaCopas, 0.28, true);
  plantar(listaPinhos, 0.2);
  plantar(listaSecas, 0.03);
  const matPlanta = new THREE.MeshLambertMaterial({ vertexColors: true });
  criarGrupo([{ geo: mandacaru(), mat: matPlanta }], arvores.filter((a) => a.tipo === 'mandacaru'), false);

  // As duas árvores ancestrais: Samaúma e Juazeiro.
  const arvoresBase = {
    mata: plantar([{ nome: 'CommonTree_1', x: BASES.mata[0], z: BASES.mata[1], y: 0, ry: 1, altura: 25, cor: '#5fa83a' }], 0.08, true, true),
    sertao: plantar([{ nome: 'TwistedTree_1', x: BASES.sertao[0], z: BASES.sertao[1], y: 0, ry: 4, altura: 21, cor: '#ec7a26' }], 0.05, true, true),
  };

  plantar(pedras.map((p, i) => ({ nome: ['Rock_Medium_2', 'Rock_Medium_1', 'Rock_Medium_3'][i % Math.max(2, nivel.especies)], x: p.x, z: p.z, y: p.y - 0.15, ry: p.ry, altura: 2.2 + p.s * 2.2, largura: true })), 0);
  const seixos = [];
  for (let i = 0; i < nivel.seixos; i++) {
    const x = (r() - 0.5) * 184, z = (r() - 0.5) * 184;
    const d = dCaminho(x, z);
    if (dRio(x, z) < 0.4 || d < 5 || d > 9) continue;
    seixos.push({ nome: ['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3'][i % 3], x, z, y: alturaTerreno(x, z), ry: r() * 6.28, altura: 0.3 + r() * 0.4, largura: true });
  }
  plantar(seixos, 0);

  // chão vivo: capim, arbustos, flores, cogumelos
  const espalhar = (quant, nomes, altura, regra, amp, tenta = 8, cores = null) => {
    const saida = [];
    let n = 0;
    while (saida.length < quant && n++ < quant * tenta) {
      const x = (r() - 0.5) * 200, z = (r() - 0.5) * 200;
      if (!regra(x, z)) continue;
      saida.push({ nome: nomes[Math.floor(r() * nomes.length)], x, z, y: alturaTerreno(x, z) - 0.03, ry: r() * 6.28, altura: altura * (0.75 + r() * 0.6), largura: true, cor: cores ? cores(x, z) : undefined });
    }
    plantar(saida, amp, !!cores);
  };
  const longeDoCaminho = (d) => (x, z) => dRio(x, z) > 0.2 && dCaminho(x, z) > d && dPraca(x, z) > 5.4;
  const mataR = (d) => (x, z) => longeDoCaminho(d)(x, z) && ladoSertao(x, z) < 0.55;
  const sertaoR = (d) => (x, z) => longeDoCaminho(d)(x, z) && ladoSertao(x, z) >= 0.45;
  const moita = (x, z, f) => ruido(x * f + 3, z * f) > 0.42;
  espalhar(nivel.capim * 0.62, ['Grass_Common_Short'], 1.5, (x, z) => mataR(5.6)(x, z) && moita(x, z, 0.3), 0.14);
  espalhar(nivel.capim * 0.38, ['Grass_Wispy_Short'], 1.5, (x, z) => sertaoR(5.6)(x, z) && moita(x, z, 0.3), 0.16);
  espalhar(nivel.arbustos * 0.62, ['Bush_Common', 'Bush_Common_Flowers'], 3.2, longeDoCaminho(7), 0.06, 8, (x, z) => (ladoSertao(x, z) > 0.5 ? ['#a8a240', '#c08a35', '#8f9a3c'] : ['#5f9431', '#6f9f35', '#4f8530'])[Math.floor(r() * 3)]);
  espalhar(nivel.arbustos * 0.5, ['Plant_7_Big', 'Fern_1', 'Plant_1_Big'].slice(0, nivel.especies), 2.6, mataR(6.4), 0.09);
  espalhar(nivel.arbustos * 0.46, ['Flower_3_Group', 'Clover_1', 'Flower_4_Group', 'Clover_2'].slice(0, nivel.flores), 1.5, longeDoCaminho(6), 0.05);
  if (nivel.especies > 2) espalhar(nivel.arbustos * 0.16, ['Mushroom_Common'], 1, mataR(6.2), 0);

  // vitórias-régias
  const folha = fundir([
    lisa(new THREE.CylinderGeometry(1, 0.97, 0.07, 18), '#5fa24e', { base: '#3f7d43', var: 0.2 }),
    lisa(new THREE.TorusGeometry(0.99, 0.06, 5, 18), '#b56a45', { r: [1.5708, 0, 0], p: [0, 0.05, 0], var: 0.1 }),
  ]);
  const folhas = [];
  for (let i = 0; i < 300 && folhas.length < 34; i++) {
    const s = (r() - 0.5) * 240, c = (r() - 0.5) * 7;
    const x = (s + c) * R2, z = (s - c) * R2;
    if (naPonte(x, z) || dRio(x, z) > -1.4 || amostra(cLateral, x, z) < 8) continue;
    folhas.push({ x, z, y: -0.8, ry: r() * 6.28, s: 0.5 + r() * 0.65 });
  }
  criarGrupo([{ geo: folha, mat: new THREE.MeshLambertMaterial({ vertexColors: true }) }], folhas, false);

  // luz
  const ceu = new THREE.HemisphereLight('#d8ebff', '#8d8040', 1.95);
  const sol = new THREE.DirectionalLight('#ffe7b8', 2.45);
  sol.position.set(-14, 26, 9);
  cena.add(ceu, sol, sol.target);
  cena.fog = new THREE.Fog('#a8c9b8', 66, 120);

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
    sol, tempo, definirModo, nivel, uFuro, arvoresBase, cortar,
    get brilhoChama() { return brilhoChama; },
    atualizar(t) { tempo.value = t; },
  };
}
