// Personagens em volumes lisos e pintados, com proporções robustas: mãos e ombros grandes.
import * as THREE from 'three';
import { lerp, suave, lisa as lisaBase, fundir, F, capsula, tronco, matPintado } from './util.js';
const lisa = lisaBase;

const mesh = (geo, mat, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = sombra; return m; };
const pivo = (pai, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); pai.add(g); return g; };
const basico = new THREE.MeshBasicMaterial({ vertexColors: true });
const gema = new THREE.OctahedronGeometry(1);

// ---------- SACI ----------
export function criarSaci() {
  const raiz = new THREE.Group(), corpo = pivo(raiz, 0, 0, 0);
  const mat = matPintado();
  const pele = '#a86a3c', peleC = '#c98a55', sombra = '#6d4226', verm = '#d42a1f', vermE = '#7c1311', couro = '#6a4426', ouro = '#d9ab45';

  corpo.add(mesh(fundir([
    // perna única, forte, com pé grande
    lisa(tronco(0.2, 0.14, 0.62), pele, { base: sombra, p: [0.02, 0.38, 0] }),
    lisa(capsula(0.22, 0.28), pele, { base: sombra, p: [0.02, 0.86, 0] }),
    lisa(F.bola, peleC, { base: sombra, p: [0.02, 0.1, 0.17], s: [0.27, 0.15, 0.42] }),
    // calção vermelho e faixa de couro
    lisa(tronco(0.41, 0.34, 0.5), verm, { base: vermE, p: [0, 1.14, 0] }),
    lisa(F.cone, vermE, { p: [0.26, 0.82, 0.14], r: [3.14, 0, 0], s: [0.14, 0.34, 0.1] }),
    lisa(F.cone, verm, { base: vermE, p: [-0.27, 0.84, -0.08], r: [3.14, 0, 0], s: [0.13, 0.3, 0.1] }),
    lisa(tronco(0.43, 0.43, 0.13), couro, { base: '#46291a', p: [0, 1.38, 0] }),
    lisa(F.caixa, ouro, { base: '#8a6a22', p: [0, 1.38, 0.41], s: [0.26, 0.2, 0.07] }),
    // tronco magro de ombros largos
    lisa(F.bola, peleC, { base: pele, p: [0, 1.78, 0], s: [0.5, 0.48, 0.33] }),
    lisa(F.bola, peleC, { p: [0.15, 1.88, 0.2], s: [0.2, 0.17, 0.13] }),
    lisa(F.bola, peleC, { p: [-0.15, 1.88, 0.2], s: [0.2, 0.17, 0.13] }),
    // colar de sementes e dentes
    lisa(new THREE.TorusGeometry(0.26, 0.04, 6, 14), '#eadfbe', { p: [0, 2.13, 0.09], r: [1.25, 0, 0], var: 0.3 }),
    lisa(F.cone, '#fbf4dc', { p: [0.1, 1.99, 0.32], r: [3.14, 0, 0], s: [0.04, 0.13, 0.04] }),
    lisa(F.cone, '#fbf4dc', { p: [-0.1, 1.99, 0.32], r: [3.14, 0, 0], s: [0.04, 0.13, 0.04] }),
    lisa(gema, '#65ff9f', { p: [0, 1.97, 0.34], s: [0.075, 0.11, 0.05], var: 0 }),
  ]), mat));

  const cabeca = pivo(corpo, 0, 2.25, 0.03);
  cabeca.add(mesh(fundir([
    lisa(F.bola, peleC, { base: pele, p: [0, 0.27, 0], s: [0.47, 0.46, 0.44] }),
    lisa(F.bola, peleC, { base: pele, p: [0, 0.06, 0.1], s: [0.31, 0.2, 0.33] }), // queixo
    lisa(F.bola, peleC, { p: [0, 0.2, 0.43], s: [0.09, 0.08, 0.1] }), // nariz
    lisa(F.bola, peleC, { base: pele, p: [0.48, 0.3, 0], r: [0, 0, -0.45], s: [0.16, 0.09, 0.07] }), // orelhas pontudas
    lisa(F.bola, peleC, { base: pele, p: [-0.48, 0.3, 0], r: [0, 0, 0.45], s: [0.16, 0.09, 0.07] }),
    lisa(F.bola, '#fff8e8', { p: [0.19, 0.34, 0.37], s: [0.12, 0.11, 0.07], var: 0 }),
    lisa(F.bola, '#fff8e8', { p: [-0.19, 0.34, 0.37], s: [0.12, 0.11, 0.07], var: 0 }),
    lisa(F.bola, '#1b100a', { p: [0.2, 0.34, 0.425], s: [0.055, 0.075, 0.03], var: 0 }),
    lisa(F.bola, '#1b100a', { p: [-0.18, 0.34, 0.425], s: [0.055, 0.075, 0.03], var: 0 }),
    lisa(F.caixa, sombra, { p: [0.2, 0.47, 0.39], r: [0, 0, 0.32], s: [0.22, 0.05, 0.05] }), // sobrancelhas
    lisa(F.caixa, sombra, { p: [-0.2, 0.47, 0.39], r: [0, 0, -0.32], s: [0.22, 0.05, 0.05] }),
    // sorriso de quem aprontou, de lado
    lisa(F.bola, '#4a1f14', { p: [0.08, 0.05, 0.4], r: [0, 0, -0.22], s: [0.2, 0.042, 0.05], var: 0 }),
    lisa(F.caixa, '#fff8e8', { p: [0.14, 0.065, 0.435], r: [0, 0, -0.22], s: [0.07, 0.03, 0.02], var: 0 }),
    // gorro grande e caído
    lisa(tronco(0.42, 0.51, 0.34), verm, { base: vermE, topo: '#ee4a2c', p: [0, 0.62, -0.03] }),
    lisa(tronco(0.26, 0.42, 0.42), verm, { topo: '#ee4a2c', p: [-0.04, 0.95, -0.13], r: [-0.3, 0, 0.18] }),
    lisa(tronco(0.13, 0.26, 0.44), verm, { p: [-0.14, 1.25, -0.33], r: [-0.8, 0, 0.45] }),
    lisa(F.cone, '#ee4a2c', { base: verm, p: [-0.31, 1.33, -0.62], r: [-1.5, 0, 0.9], s: [0.13, 0.5, 0.13] }),
    lisa(new THREE.TorusGeometry(0.48, 0.07, 7, 16), ouro, { base: '#8f6d24', p: [0, 0.47, -0.02], r: [1.5, 0, 0] }),
  ]), mat));

  const braco = (lado) => {
    const p = pivo(corpo, lado * 0.53, 2.05, 0);
    p.add(mesh(fundir([
      lisa(F.bola, peleC, { base: pele, s: [0.21, 0.2, 0.21] }),
      lisa(capsula(0.1, 0.42), pele, { base: sombra, p: [0, -0.34, 0] }),
      lisa(capsula(0.115, 0.34), pele, { base: sombra, p: [0, -0.74, 0] }),
      lisa(tronco(0.15, 0.15, 0.14), couro, { p: [0, -0.74, 0] }),
      lisa(F.bola, peleC, { base: pele, p: [0, -1.07, 0.02], s: [0.2, 0.2, 0.19] }), // mão grande
    ]), mat));
    return p;
  };
  const bD = braco(1), bE = braco(-1);

  const atualizar = (a, dt) => {
    a.fase += dt * (a.andando ? 10.5 : 2.6);
    const pulo = Math.abs(Math.sin(a.fase));
    if (a.girando > 0) {
      corpo.rotation.y += dt * 26; corpo.position.y = 0.3; corpo.rotation.x = 0;
    } else {
      corpo.rotation.y *= Math.max(0, 1 - dt * 14);
      if (a.andando) {
        corpo.position.y = pulo * 0.52;
        corpo.scale.set(1 + (0.5 - pulo) * 0.11, 1 + (pulo - 0.5) * 0.15, 1 + (0.5 - pulo) * 0.11);
        corpo.rotation.x = 0.22;
        bD.rotation.x = -0.75 - pulo * 0.55; bE.rotation.x = 0.55 + pulo * 0.35;
        bD.rotation.z = 0.42; bE.rotation.z = -0.42;
      } else {
        corpo.position.y = Math.sin(a.fase) * 0.035;
        corpo.scale.set(1, 1 + Math.sin(a.fase) * 0.015, 1);
        corpo.rotation.x *= 0.8;
        bD.rotation.x = lerp(bD.rotation.x, 0.08, dt * 8); bE.rotation.x = lerp(bE.rotation.x, 0.08, dt * 8);
        bD.rotation.z = 0.2; bE.rotation.z = -0.2;
      }
    }
    if (a.atkT > 0) {
      const g = Math.sin((1 - a.atkT / a.atkDur) * Math.PI);
      bD.rotation.x = -2.6 * g; bD.rotation.z = 0.3 + g * 0.8;
      corpo.rotation.y = g * 0.9;
    }
    cabeca.rotation.z = Math.sin(a.fase * 0.45) * 0.05;
  };
  return { raiz, mat, atualizar, altura: 4.4 };
}

// ---------- GUARDIÃO DE ITÁ ----------
let bolaR = new THREE.SphereGeometry(1, 11, 8);
let texRocha = null;
// Usa uma pedra do pacote como bloco dos golems: normaliza o tamanho para raio 1.
export function usarRocha(parte) {
  texRocha = parte.mat.map;
}
function _semUso(parte) {
  const g = parte.geo.clone();
  g.computeBoundingBox();
  const c = new THREE.Vector3(), t = new THREE.Vector3();
  g.boundingBox.getCenter(c);
  g.boundingBox.getSize(t);
  g.translate(-c.x, -c.y, -c.z);
  g.scale(2 / t.x, 2 / t.y, 2 / t.z);
  bolaR = g;
  texRocha = parte.mat.map;
}
export function criarGuardiao(lado) {
  const mata = lado === 'mata';
  const c = mata
    ? { p: '#b9b7a8', pE: '#6a6c60', pT: '#d6d3bf', p2: '#9c9a8c', folha: '#6f9f39', folhaE: '#2f6a33', folhaT: '#a8cb52', ouro: '#d6ad4c', olho: '#9dffba', marca: '#58ff9c', pano: '#59733a' }
    : { p: '#b77a50', pE: '#5a372a', pT: '#d09a68', p2: '#94664a', folha: '#3d3433', folhaE: '#221c1b', folhaT: '#574a45', ouro: '#c98d3e', olho: '#ffe28a', marca: '#ff8a26', pano: '#7c3016' };
  const raiz = new THREE.Group(), corpo = pivo(raiz, 0, 0, 0);
  const mat = matPintado(texRocha ? { map: texRocha } : {}, true);
  const lisa = (g, cor, o = {}) => lisaBase(g, cor, { manterUV: true, ...(g === bolaR ? { bossa: 0.4 } : {}), ...o });
  const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const E = 1.55;
  const roca = (x, y, z, s, sem, cor = c.p, extra = {}) => lisa(bolaR, cor, { base: c.pE, topo: c.pT, topoEm: 0.6, semente: sem, p: [x * E, y * E, z * E], s: typeof s === 'number' ? s * E : s.map((v) => v * E), var: 0.14, ...extra });

  const pecas = [
    roca(0, 2.72, 0, [1.34, 1.08, 0.98], 1),
    roca(0, 1.78, 0.04, [0.92, 0.62, 0.74], 2, c.p2),
    roca(0.6, 3.1, 0.42, 0.47, 3),
    roca(-0.56, 3, 0.48, 0.44, 4, c.p2),
    // cinturão e placa dourada com gema
    lisa(tronco(0.95 * E, 0.92 * E, 0.3 * E, 14), '#5a3a22', { base: '#38231a', p: [0, 1.46 * E, 0] }),
    lisa(F.caixa, c.ouro, { base: '#7f5f1f', p: [0, 1.46 * E, 0.86 * E], s: [0.68 * E, 0.42 * E, 0.13 * E] }),
    lisa(F.cone, c.pano, { base: '#2d2218', p: [0, 0.98 * E, 0.45 * E], r: [3.14, 0, 0], s: [0.62 * E, 0.8 * E, 0.2 * E] }),
    lisa(F.cone, c.pano, { base: '#2d2218', p: [0, 0.98 * E, -0.5 * E], r: [3.14, 0, 0], s: [0.56 * E, 0.74 * E, 0.2 * E] }),
  ];
  // dorso coberto de musgo (Mata) ou carvão (Sertão)
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4, q = 0.28 + (i % 4) * 0.27;
    pecas.push(lisa(bolaR, c.folha, { base: c.folhaE, topo: c.folhaT, topoEm: 0.5, bossa: 0.4, semente: 20 + i, p: [Math.cos(a) * q * E * 1.1, (3.56 + (i % 3) * 0.1 - q * 0.22) * E, Math.sin(a) * q * E * 0.7 - 0.16 * E], s: [(0.46 - i * 0.012) * E, 0.26 * E, (0.46 - i * 0.012) * E] }));
  }
  corpo.add(mesh(fundir(pecas), mat));
  corpo.add(mesh(fundir([
    lisa(gema, c.marca, { p: [0, 1.46 * E, 0.97 * E], s: [0.17 * E, 0.17 * E, 0.08 * E], var: 0 }),
    lisa(F.caixa, c.marca, { p: [0, 2.75 * E, 0.97 * E], s: [0.5 * E, 0.075 * E, 0.04], var: 0 }),
    lisa(F.caixa, c.marca, { p: [0, 2.5 * E, 0.95 * E], r: [0, 0, 0.785], s: [0.25 * E, 0.25 * E, 0.04], var: 0 }),
  ]), matGlow, false));

  const cabeca = pivo(corpo, 0, 3.74 * E, 0.34 * E);
  cabeca.add(mesh(fundir([
    roca(0, 0.14, 0.08, [0.56, 0.58, 0.54], 40),
    roca(0, -0.1, 0.25, [0.42, 0.28, 0.36], 41, c.p2),
    lisa(F.caixa, c.pE, { p: [0.22 * E, 0.34 * E, 0.5 * E], r: [0, 0, 0.38], s: [0.36 * E, 0.09 * E, 0.13 * E] }), // sobrancelhas de pedra
    lisa(F.caixa, c.pE, { p: [-0.22 * E, 0.34 * E, 0.5 * E], r: [0, 0, -0.38], s: [0.36 * E, 0.09 * E, 0.13 * E] }),
    lisa(tronco(0.05 * E, 0.2 * E, 0.74 * E), mata ? '#c6b58c' : '#dba878', { base: mata ? '#7e6443' : '#94512c', p: [0.58 * E, 0.62 * E, 0], r: [0, 0, -0.78] }),
    lisa(tronco(0.05 * E, 0.2 * E, 0.74 * E), mata ? '#c6b58c' : '#dba878', { base: mata ? '#7e6443' : '#94512c', p: [-0.58 * E, 0.62 * E, 0], r: [0, 0, 0.78] }),
    lisa(new THREE.TorusGeometry(0.42 * E, 0.05 * E, 6, 16), c.ouro, { base: '#7f5f1f', p: [0, 0.46 * E, 0.08 * E], r: [1.45, 0, 0] }),
  ]), mat));
  cabeca.add(mesh(fundir([
    lisa(F.bola, c.olho, { p: [0.22 * E, 0.22 * E, 0.56 * E], s: [0.12 * E, 0.075 * E, 0.04], var: 0 }),
    lisa(F.bola, c.olho, { p: [-0.22 * E, 0.22 * E, 0.56 * E], s: [0.12 * E, 0.075 * E, 0.04], var: 0 }),
  ]), matGlow, false));

  const braco = (s) => {
    const om = pivo(corpo, s * 1.4 * E, 3.05 * E, 0.05);
    const p1 = [
      lisa(bolaR, c.p, { base: c.pE, topo: c.pT, topoEm: 0.6, bossa: 0.34, semente: 50 + s, s: [0.72 * E, 0.66 * E, 0.72 * E] }),
      lisa(tronco(0.74 * E, 0.74 * E, 0.13 * E, 14), c.ouro, { base: '#7f5f1f', p: [0, -0.34 * E, 0] }),
      lisa(bolaR, c.p2, { base: c.pE, bossa: 0.3, semente: 52 + s, p: [s * 0.06 * E, -0.86 * E, 0], s: [0.5 * E, 0.62 * E, 0.5 * E] }),
    ];
    for (let i = 0; i < 5; i++) p1.push(lisa(bolaR, c.folha, { base: c.folhaE, topo: c.folhaT, topoEm: 0.5, bossa: 0.4, semente: 60 + i + s, p: [Math.cos(i * 1.256) * 0.34 * E, 0.5 * E, Math.sin(i * 1.256) * 0.34 * E], s: [0.28 * E, 0.17 * E, 0.28 * E] }));
    om.add(mesh(fundir(p1), mat));
    const ante = pivo(om, s * 0.06 * E, -1.3 * E, 0);
    ante.add(mesh(fundir([
      lisa(bolaR, c.p, { base: c.pE, bossa: 0.3, semente: 70 + s, p: [0, -0.32 * E, 0], s: [0.62 * E, 0.72 * E, 0.62 * E] }),
      lisa(bolaR, c.p2, { base: c.pE, topo: c.pT, bossa: 0.35, semente: 72 + s, p: [0, -1 * E, 0.04 * E], s: [0.76 * E, 0.6 * E, 0.74 * E] }), // punho enorme
      lisa(tronco(0.68 * E, 0.68 * E, 0.13 * E, 14), c.ouro, { base: '#7f5f1f', p: [0, -0.46 * E, 0] }),
    ]), mat));
    return { om, ante };
  };
  const bD = braco(1), bE = braco(-1);
  const perna = (s) => {
    const p = pivo(raiz, s * 0.64 * E, 1.3 * E, 0);
    p.add(mesh(fundir([
      lisa(bolaR, c.p2, { base: c.pE, bossa: 0.3, semente: 80 + s, p: [0, -0.3 * E, 0], s: [0.54 * E, 0.62 * E, 0.54 * E] }),
      lisa(bolaR, c.p, { base: c.pE, bossa: 0.28, semente: 82 + s, p: [0, -0.98 * E, 0.1 * E], s: [0.68 * E, 0.42 * E, 0.86 * E] }),
    ]), mat));
  };
  perna(1); perna(-1);

  const dim = new THREE.Color('#3b3a36'), forte = new THREE.Color('#ffffff');
  const atualizar = (a, dt) => {
    a.fase += dt * 1.6;
    a.acordado = lerp(a.acordado, a.ativo ? 1 : 0, dt * 2.5);
    const w = a.acordado;
    corpo.position.y = lerp(-1.25, Math.sin(a.fase) * 0.06, w);
    corpo.rotation.x = lerp(0.42, 0, w);
    cabeca.rotation.x = lerp(0.5, 0, w);
    bD.om.rotation.z = lerp(0.1, -0.12, w); bE.om.rotation.z = lerp(-0.1, 0.12, w);
    bD.om.rotation.x = lerp(0.5, Math.sin(a.fase) * 0.05, w); bE.om.rotation.x = lerp(0.5, -Math.sin(a.fase) * 0.05, w);
    bD.ante.rotation.x = lerp(0.1, -0.35, w); bE.ante.rotation.x = lerp(0.1, -0.35, w);
    matGlow.color.copy(dim).lerp(forte, 0.15 + w * 0.85 + Math.sin(a.fase * 3) * 0.05 * w);
    if (a.atkT > 0) {
      const t = 1 - a.atkT / a.atkDur;
      const sobe = t < 0.55 ? suave(0, 0.55, t) : 1 - suave(0.55, 0.8, t);
      bD.om.rotation.x = -2.5 * sobe;
      bD.ante.rotation.x = -0.9 * sobe;
      corpo.rotation.y = sobe * -0.35;
      corpo.rotation.x = -0.14 * sobe + (t > 0.55 ? 0.2 * (1 - suave(0.55, 1, t)) : 0);
    } else {
      corpo.rotation.y *= Math.max(0, 1 - dt * 6);
    }
  };
  return { raiz, mat, atualizar, altura: 7.8, matGlow };
}

// ---------- CAVALEIRO DE FOGO ----------
const G_CAV = () => {
  const aco = '#8b8d94', acoE = '#3b3c44', acoT = '#c0c2c6', ouro = '#d09a3f', ouroE = '#7a5519', pano = '#d86a1f', panoE = '#7d2c10';
  const corpo = fundir([
    lisa(F.bola, aco, { base: acoE, topo: acoT, p: [0, 1.22, 0], s: [0.42, 0.42, 0.32] }),
    lisa(tronco(0.34, 0.28, 0.32), '#5b3a22', { base: '#38231a', p: [0, 0.86, 0] }),
    lisa(tronco(0.36, 0.36, 0.09), ouro, { base: ouroE, p: [0, 0.9, 0] }),
    lisa(F.caixa, ouro, { base: ouroE, p: [0, 1.22, 0.31], r: [0, 0, 0.785], s: [0.2, 0.2, 0.05] }),
    // ombreiras grandes com aba dourada
    lisa(F.bola, aco, { base: acoE, topo: acoT, p: [0.48, 1.53, 0], s: [0.3, 0.24, 0.32] }),
    lisa(F.bola, aco, { base: acoE, topo: acoT, p: [-0.48, 1.53, 0], s: [0.3, 0.24, 0.32] }),
    lisa(new THREE.TorusGeometry(0.28, 0.05, 6, 14), ouro, { base: ouroE, p: [0.48, 1.42, 0], r: [1.57, 0, 0] }),
    lisa(new THREE.TorusGeometry(0.28, 0.05, 6, 14), ouro, { base: ouroE, p: [-0.48, 1.42, 0], r: [1.57, 0, 0] }),
    // saiote e capa laranja rasgados
    lisa(F.cone, pano, { base: panoE, p: [0, 0.57, 0.08], r: [3.14, 0, 0], s: [0.28, 0.54, 0.14] }),
    lisa(F.cone, pano, { base: panoE, p: [0, 0.9, -0.36], r: [3.05, 0, 0], s: [0.46, 1.12, 0.1] }),
    // pernas e botas
    lisa(capsula(0.11, 0.3), acoE, { p: [0.17, 0.48, 0] }),
    lisa(capsula(0.11, 0.3), acoE, { p: [-0.17, 0.48, 0] }),
    lisa(F.bola, aco, { base: acoE, p: [0.17, 0.12, 0.06], s: [0.16, 0.13, 0.26] }),
    lisa(F.bola, aco, { base: acoE, p: [-0.17, 0.12, 0.06], s: [0.16, 0.13, 0.26] }),
    // braços
    lisa(capsula(0.1, 0.42), acoE, { p: [-0.55, 1.1, 0.02], r: [0, 0, -0.12] }),
    lisa(F.bola, aco, { p: [-0.6, 0.78, 0.03], s: 0.14 }),
    lisa(capsula(0.1, 0.34), acoE, { p: [0.55, 1.14, 0.05], r: [0.4, 0, 0.1] }),
  ]);
  const brilho = fundir([
    lisa(F.cone, '#ff8a26', { base: '#ff5b16', topo: '#ffd25a', p: [0, 1.95, 0], s: [0.3, 0.72, 0.3], var: 0.1 }),
    lisa(F.cone, '#ffd25a', { base: '#ffa32e', topo: '#fff3b0', p: [0.05, 2.08, 0.04], s: [0.17, 0.52, 0.17], var: 0.1 }),
    lisa(gema, '#ffc14a', { p: [0, 1.22, 0.37], s: [0.07, 0.1, 0.04], var: 0 }),
  ]);
  const espada = fundir([
    lisa(F.caixa, '#ffb040', { base: '#ff7a1a', topo: '#ffe58e', p: [0, 0.54, 0], s: [0.14, 1.02, 0.045], var: 0.05 }),
    lisa(F.caixa, '#a77422', { p: [0, 0.02, 0], s: [0.38, 0.08, 0.1] }),
  ]);
  return { corpo, brilho, espada };
};
// ---------- FILHOTE DE ITÁ ----------
const G_FIL = () => ({
  corpo: fundir([
    lisa(bolaR, '#b9b7a8', { base: '#696c60', topo: '#d6d3bf', bossa: 0.36, semente: 1, p: [0, 0.8, 0], s: [0.66, 0.6, 0.56] }),
    lisa(bolaR, '#6f9f39', { base: '#2f6a33', topo: '#b0d15a', topoEm: 0.45, bossa: 0.4, semente: 2, p: [0.02, 1.27, -0.08], s: [0.56, 0.27, 0.46] }),
    lisa(bolaR, '#84ad42', { base: '#3a7735', bossa: 0.3, semente: 3, p: [-0.34, 1.2, 0.14], s: [0.24, 0.15, 0.24] }),
    lisa(bolaR, '#9c9a8c', { base: '#5a5c52', bossa: 0.25, semente: 4, p: [0.22, 0.17, 0.04], s: [0.26, 0.2, 0.33] }),
    lisa(bolaR, '#9c9a8c', { base: '#5a5c52', bossa: 0.25, semente: 5, p: [-0.22, 0.17, 0.04], s: [0.26, 0.2, 0.33] }),
    lisa(bolaR, '#adab9b', { base: '#62645a', bossa: 0.3, semente: 6, p: [0.62, 0.66, 0.02], s: [0.23, 0.36, 0.23] }),
    lisa(bolaR, '#adab9b', { base: '#62645a', bossa: 0.3, semente: 7, p: [-0.62, 0.66, 0.02], s: [0.23, 0.36, 0.23] }),
    lisa(F.caixa, '#d6ad4c', { base: '#7f5f1f', p: [0, 0.57, 0.53], s: [0.25, 0.25, 0.05], r: [0, 0, 0.785] }),
  ]),
  brilho: fundir([
    lisa(F.bola, '#a7ffc1', { p: [0.2, 0.9, 0.53], s: [0.09, 0.06, 0.03], var: 0 }),
    lisa(F.bola, '#a7ffc1', { p: [-0.2, 0.9, 0.53], s: [0.09, 0.06, 0.03], var: 0 }),
    lisa(gema, '#5cff9c', { p: [0, 0.57, 0.57], s: [0.06, 0.09, 0.03], var: 0 }),
  ]),
});
let gCav = null, gFil = null;

export function criarTropa(lado) {
  const raiz = new THREE.Group(), corpo = pivo(raiz, 0, 0, 0);
  const fogo = lado === 'sertao';
  const mat = matPintado({}, !fogo);
  if (fogo) gCav = gCav || G_CAV(); else gFil = gFil || G_FIL();
  const g = fogo ? gCav : gFil;
  corpo.add(mesh(g.corpo, mat));
  corpo.add(mesh(g.brilho, basico, false));
  let espada = null;
  if (fogo) { espada = pivo(corpo, 0.56, 0.98, 0.18); espada.add(mesh(g.espada, basico, false)); espada.rotation.x = 0.8; }
  const atualizar = (a, dt) => {
    a.fase += dt * (a.andando ? 9 : 2);
    const b = Math.sin(a.fase);
    corpo.position.y = a.andando ? Math.abs(b) * 0.12 : b * 0.015;
    corpo.rotation.z = a.andando ? b * 0.08 : 0;
    corpo.rotation.x = a.andando ? 0.08 : 0;
    if (a.atkT > 0) {
      const g2 = Math.sin((1 - a.atkT / a.atkDur) * Math.PI);
      corpo.rotation.x = 0.1 + g2 * 0.5;
      if (espada) espada.rotation.x = 0.8 - g2 * 2.4;
    } else if (espada) espada.rotation.x = 0.8;
  };
  return { raiz, mat, atualizar, altura: fogo ? 2.8 : 2 };
}

export const geoRocha = fundir([lisa(new THREE.SphereGeometry(1, 11, 8), '#b9b7a8', { base: '#696c60', bossa: 0.45, semente: 90, s: 0.58 })]);
