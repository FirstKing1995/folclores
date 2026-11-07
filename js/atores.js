// Guardiões de Itá: golems feitos por código, com silhueta pensada para a câmera alta.
import * as THREE from 'three';
import { lerp, suave, lisa, fundir, F, tronco, matPintado } from './util.js';

const mesh = (geo, mat, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = sombra; return m; };
const pivo = (pai, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); pai.add(g); return g; };
const gema = new THREE.OctahedronGeometry(1);
const bloco = new THREE.SphereGeometry(1, 9, 6);

const PALETA = {
  mata: { p: '#ded9c6', pE: '#8d9184', pT: '#f6f2e0', p2: '#c6c2ae', cap: '#7fb542', capE: '#3f7f3a', capT: '#bfe063', ouro: '#e6bd58', ouroE: '#8f6d24', olho: '#c9ffd8', marca: '#5dffa2' },
  sertao: { p: '#d99c6c', pE: '#7f4b31', pT: '#f2c592', p2: '#c0835a', cap: '#54423c', capE: '#2c2320', capT: '#7c6459', ouro: '#e3a748', ouroE: '#8a5a22', olho: '#fff0a8', marca: '#ff9a35' },
};

export function criarGuardiao(lado) {
  const mata = lado === 'mata';
  const c = PALETA[lado];
  const raiz = new THREE.Group(), corpo = pivo(raiz, 0, 0, 0);
  const mat = matPintado({}, true);
  const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true });

  const pedra = (p, s, sem, cor = c.p, extra = {}) => lisa(bloco, cor, { base: c.pE, topo: c.pT, topoEm: 0.55, bossa: 0.32, semente: sem, p, s, var: 0.12, ...extra });
  const cap = (p, s, sem) => lisa(bloco, c.cap, { base: c.capE, topo: c.capT, topoEm: 0.4, bossa: 0.38, semente: sem, p, s, var: 0.18 });
  const brilha = (geo, p, s, r) => lisa(geo, c.marca, { p, s, r, var: 0 });

  // Peito em forma de cunha: largo em cima, cintura fina, para ler como figura e não como monte.
  const pecas = [
    pedra([0, 4.15, 0], [1.72, 1.32, 1.2], 1),
    pedra([0, 2.85, 0.02], [1.02, 0.86, 0.82], 2, c.p2),
    lisa(tronco(1.12, 1.08, 0.36, 12), '#7a5230', { base: '#4b3220', p: [0, 2.22, 0] }),
    lisa(F.caixa, c.ouro, { base: c.ouroE, p: [0, 2.22, 1.03], s: [0.98, 0.56, 0.16] }),
    pedra([0, 1.75, 0], [1, 0.62, 0.76], 3, c.p2),
    // placas de musgo (Mata) ou carvão (Sertão) só no alto das costas
    cap([0, 5.1, -0.35], [1.15, 0.36, 0.72], 5),
    cap([0.72, 4.9, 0.08], [0.46, 0.2, 0.46], 6),
  ];
  const brilhos = [
    brilha(gema, [0, 2.22, 1.16], [0.24, 0.24, 0.1]),
    // runa no peito e no topo: é o que a câmera alta enxerga
    brilha(F.caixa, [0, 4.46, 1.2], [1.1, 0.13, 0.06]),
    brilha(F.caixa, [0, 4.06, 1.25], [0.34, 0.34, 0.06], [0, 0, 0.785]),
  ];
  if (mata) {
    // muda de samaúma nascendo das costas: copa verde clara, visível de longe
    pecas.push(lisa(tronco(0.1, 0.22, 1.5, 7), '#8a6a44', { base: '#5a4430', p: [-0.55, 5.8, -0.45], r: [0.12, 0, 0.16] }));
    pecas.push(cap([-0.68, 6.85, -0.48], [1.12, 0.74, 1.12], 8));
    pecas.push(cap([-0.1, 6.5, -0.28], [0.58, 0.4, 0.58], 9));
    pecas.push(cap([-1.24, 6.45, -0.5], [0.52, 0.36, 0.52], 10));
  } else {
    // cristas de pedra em brasa nas costas
    for (let i = 0; i < 4; i++) {
      const x = -0.9 + i * 0.6;
      pecas.push(lisa(F.cone, c.p2, { base: c.pE, topo: c.pT, p: [x, 5.55 + (i % 2 ? 0.34 : 0), -0.45], r: [-0.25, 0, x * -0.3], s: [0.34, 1.35 + (i % 2 ? 0.5 : 0), 0.34] }));
      brilhos.push(lisa(F.cone, '#ffb040', { base: '#ff7a1a', topo: '#ffe58e', p: [x, 6.15 + (i % 2 ? 0.55 : 0), -0.55], r: [-0.25, 0, x * -0.3], s: [0.13, 0.62, 0.13], var: 0 }));
    }
  }
  corpo.add(mesh(fundir(pecas), mat));
  corpo.add(mesh(fundir(brilhos), matGlow, false));

  // Cabeça baixa e projetada, com olhos fortes.
  const cabeca = pivo(corpo, 0, 5.2, 0.98);
  cabeca.add(mesh(fundir([
    pedra([0, 0.2, 0.08], [0.82, 0.74, 0.76], 40),
    pedra([0, -0.26, 0.34], [0.66, 0.36, 0.5], 41, c.p2),
    lisa(F.caixa, c.pE, { p: [0.33, 0.44, 0.74], r: [0, 0, 0.38], s: [0.56, 0.15, 0.22] }),
    lisa(F.caixa, c.pE, { p: [-0.33, 0.44, 0.74], r: [0, 0, -0.38], s: [0.56, 0.15, 0.22] }),
    lisa(tronco(0.06, 0.28, 1, 8), mata ? '#e0cfa4' : '#f0c08a', { base: mata ? '#8e7450' : '#a35c30', p: [0.9, 0.9, 0], r: [0, 0, -0.85] }),
    lisa(tronco(0.06, 0.28, 1, 8), mata ? '#e0cfa4' : '#f0c08a', { base: mata ? '#8e7450' : '#a35c30', p: [-0.9, 0.9, 0], r: [0, 0, 0.85] }),
  ]), mat));
  cabeca.add(mesh(fundir([
    lisa(F.bola, c.olho, { p: [0.33, 0.28, 0.78], s: [0.2, 0.13, 0.07], var: 0 }),
    lisa(F.bola, c.olho, { p: [-0.33, 0.28, 0.78], s: [0.2, 0.13, 0.07], var: 0 }),
  ]), matGlow, false));

  // Braços longos e separados do tronco: é o vão que desenha o golem visto de cima.
  const braco = (s) => {
    const om = pivo(corpo, s * 2.32, 4.72, 0.05);
    om.add(mesh(fundir([
      pedra([0, 0.02, 0], [1, 0.84, 1], 50 + s),
      cap([0, 0.62, 0], [0.68, 0.24, 0.68], 54 + s),
      lisa(tronco(1, 1, 0.2, 12), c.ouro, { base: c.ouroE, p: [0, -0.56, 0] }),
      pedra([s * 0.05, -1.32, 0], [0.62, 0.92, 0.62], 52 + s, c.p2),
    ]), mat));
    const ante = pivo(om, s * 0.08, -2.05, 0);
    ante.add(mesh(fundir([
      pedra([0, -0.46, 0], [0.78, 0.92, 0.78], 70 + s),
      lisa(tronco(0.86, 0.86, 0.18, 12), c.ouro, { base: c.ouroE, p: [0, -0.74, 0] }),
      pedra([0, -1.5, 0.06], [1.04, 0.84, 1.02], 72 + s, c.p2), // punho enorme
    ]), mat));
    return { om, ante };
  };
  const bD = braco(1), bE = braco(-1);

  const perna = (s) => {
    const p = pivo(raiz, s * 0.95, 1.9, 0);
    p.add(mesh(fundir([
      pedra([0, -0.45, 0], [0.74, 0.86, 0.74], 80 + s, c.p2),
      pedra([0, -1.5, 0.16], [0.92, 0.5, 1.2], 82 + s),
    ]), mat));
    return p;
  };
  perna(1); perna(-1);

  const dim = new THREE.Color('#6d6a60'), forte = new THREE.Color('#ffffff');
  const atualizar = (a, dt) => {
    a.fase += dt * 1.6;
    a.acordado = lerp(a.acordado, a.ativo ? 1 : 0, dt * 2.5);
    const w = a.acordado;
    // Dormindo, fica de joelhos com os punhos apoiados, ainda com cara de figura.
    corpo.position.y = lerp(-0.62, Math.sin(a.fase) * 0.06, w);
    corpo.rotation.x = lerp(0.2, 0, w);
    cabeca.rotation.x = lerp(0.42, 0, w);
    bD.om.rotation.z = lerp(0.06, 0.18, w); bE.om.rotation.z = lerp(-0.06, -0.18, w);
    bD.om.rotation.x = lerp(-0.1, Math.sin(a.fase) * 0.05, w); bE.om.rotation.x = lerp(-0.1, -Math.sin(a.fase) * 0.05, w);
    bD.ante.rotation.x = lerp(-0.18, -0.35, w); bE.ante.rotation.x = lerp(-0.18, -0.35, w);
    matGlow.color.copy(dim).lerp(forte, 0.3 + w * 0.7 + Math.sin(a.fase * 3) * 0.05 * w);
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
  return { raiz, mat, atualizar, altura: 8.2, matGlow };
}

export const geoRocha = fundir([lisa(new THREE.SphereGeometry(1, 9, 6), '#d6d2c0', { base: '#7c7e72', bossa: 0.45, semente: 90, s: 0.58 })]);
