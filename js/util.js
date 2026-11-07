// Ferramentas comuns: sorteio com semente, ruído e montagem de modelos de volumes pintados.
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const suave = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash2 = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };

export function ruido(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), ux), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), ux), uy);
}

export function fbm(x, y, oit = 3) {
  let a = 0.5, s = 0, t = 0;
  for (let i = 0; i < oit; i++) { s += ruido(x, y) * a; t += a; a *= 0.5; x = x * 2.03 + 11.1; y = y * 2.03 + 7.7; }
  return s / t;
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
let contador = 1;

// Peça de volume liso: amassa a forma, posiciona e pinta um degradê por vértice.
export function lisa(geo, cor, o = {}) {
  const g = geo.clone();
  const sem = o.semente ?? contador++ * 3.17;
  if (o.bossa) {
    const p = g.attributes.position, c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      c.fromBufferAttribute(p, i);
      const n = fbm(c.x * 1.7 + c.z * 1.1 + sem, c.y * 1.9 - c.z * 0.8 + sem * 0.7, 3) - 0.5;
      c.multiplyScalar(1 + n * o.bossa * 2);
      p.setXYZ(i, c.x, c.y, c.z);
    }
    g.computeVertexNormals();
  }
  const s = o.s ?? 1;
  const esc = typeof s === 'number' ? [s, s, s] : s;
  _e.set(...(o.r ?? [0, 0, 0]));
  _q.setFromEuler(_e);
  _m.compose(new THREE.Vector3(...(o.p ?? [0, 0, 0])), _q, new THREE.Vector3(...esc));
  g.applyMatrix4(_m);
  if (o.uv && g.attributes.uv) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * o.uv[0], uv.getY(i) * o.uv[1]);
  }
  if (!o.manterUV) g.deleteAttribute('uv');
  const f = g.index ? g.toNonIndexed() : g;
  const pos = f.attributes.position;
  f.computeBoundingBox();
  const minY = f.boundingBox.min.y, alt = Math.max(0.001, f.boundingBox.max.y - minY);
  const cBase = new THREE.Color(o.base ?? cor), cMeio = new THREE.Color(cor), cTopo = new THREE.Color(o.topo ?? cor);
  const col = new THREE.Color(), cores = new Float32Array(pos.count * 3);
  const emTopo = o.topoEm ?? 0.72, varia = o.var ?? 0.08;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), t = (y - minY) / alt;
    col.copy(cBase).lerp(cMeio, suave(0, 0.62, t));
    col.lerp(cTopo, suave(emTopo, 1, t));
    const l = 1 + (ruido(pos.getX(i) * 3.1 + sem, y * 3.1 + pos.getZ(i) * 2.3) - 0.5) * varia;
    cores[i * 3] = col.r * l; cores[i * 3 + 1] = col.g * l; cores[i * 3 + 2] = col.b * l;
  }
  f.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  return f;
}

export function fundir(pecas) {
  let total = 0;
  for (const p of pecas) total += p.attributes.position.count;
  const comUV = pecas.every((p) => p.attributes.uv);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), cor = new Float32Array(total * 3);
  const uv = comUV ? new Float32Array(total * 2) : null;
  let n = 0;
  for (const p of pecas) {
    pos.set(p.attributes.position.array, n * 3);
    nor.set(p.attributes.normal.array, n * 3);
    cor.set(p.attributes.color.array, n * 3);
    if (uv) uv.set(p.attributes.uv.array, n * 2);
    n += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

// Formas básicas.
export const F = {
  bola: new THREE.SphereGeometry(1, 12, 9),
  bolaP: new THREE.SphereGeometry(1, 10, 8),
  caixa: new THREE.BoxGeometry(1, 1, 1),
  tubo: new THREE.CylinderGeometry(1, 1, 1, 10, 1),
  cone: new THREE.ConeGeometry(1, 1, 10, 3),
};
export const capsula = (r, c) => new THREE.CapsuleGeometry(r, c, 4, 10);
export const tronco = (r1, r2, h, seg = 10) => new THREE.CylinderGeometry(r1, r2, h, seg, 2);

// Material de personagem: pinceladas no volume e um leve brilho de contorno.
export function matPintado(extra = {}, rocha = false) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, ...extra });
  m.onBeforeCompile = (s) => {
    s.vertexShader = 'varying vec3 vPintura;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vPintura = position;');
    s.fragmentShader = `varying vec3 vPintura;
      float hP(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float nP(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(hP(i),hP(i+vec3(1,0,0)),f.x),mix(hP(i+vec3(0,1,0)),hP(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hP(i+vec3(0,0,1)),hP(i+vec3(1,0,1)),f.x),mix(hP(i+vec3(0,1,1)),hP(i+vec3(1,1,1)),f.x),f.y),f.z); }
      ` + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float pincel = nP(vPintura * vec3(5.,11.,5.)) * .6 + nP(vPintura * vec3(13.,5.,13.)) * .4;
        diffuseColor.rgb *= .76 + pincel * .48;${rocha ? `
        float fenda = abs(nP(vPintura * 1.7 + 3.) - .5) + abs(nP(vPintura * 4.3) - .5) * .35;
        diffuseColor.rgb *= mix(.62, 1., smoothstep(.015, .07, fenda));
        diffuseColor.rgb *= .88 + nP(vPintura * 26.) * .26;` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float contorno = pow(1. - abs(normalize(vNormal).z), 2.6);
        totalEmissiveRadiance += vec3(1.,.86,.62) * contorno * .2;`);
  };
  m.customProgramCacheKey = () => (rocha ? 'pintadoRocha' : 'pintado1');
  return m;
}
