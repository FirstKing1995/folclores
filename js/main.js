// Laboratório de estilo: uma luta jogável para validar visual, controles e desempenho.
// A lógica aqui é provisória; a simulação definitiva entra na Etapa 1.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { criarMundo, alturaChao, andavel, caminhoZ, GUARDIOES, TOCHAS } from './mundo.js';
import { criarGuardiao, geoRocha } from './atores.js';
import { Efeitos } from './efeitos.js';
import { carregarAtivos, criarSaciFinal, criarTropaFinal } from './ativos.js';

const params = new URLSearchParams(location.search);
const ehToque = matchMedia('(pointer: coarse)').matches;
const ORDEM = ['alta', 'media', 'baixa'];
const qualidade = ORDEM.includes(params.get('q')) ? params.get('q')
  : localStorage.getItem('folclores.qualidade') || (ehToque ? 'media' : 'alta');

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ canvas: $('tela'), antialias: qualidade !== 'baixa', powerPreference: 'high-performance' });
const LIMITE_DPR = { alta: 2, media: 1.5, baixa: 1 };
let dpr = Math.min(devicePixelRatio, LIMITE_DPR[qualidade]);
renderer.setPixelRatio(dpr);
renderer.shadowMap.enabled = qualidade !== 'baixa';
renderer.shadowMap.type = THREE.PCFShadowMap;

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 5, 220);
const tInicioMundo = performance.now();
const ativos = await carregarAtivos();
const tAtivos = Math.round(performance.now() - tInicioMundo);
const mundo = criarMundo(cena, qualidade, ativos.kit);
const tempoMundo = Math.round(performance.now() - tInicioMundo);
const fx = new Efeitos(cena, $('camada'), qualidade);

mundo.sol.castShadow = qualidade !== 'baixa';
mundo.sol.shadow.mapSize.setScalar(qualidade === 'alta' ? 2048 : 1024);
const sc = mundo.sol.shadow.camera;
sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 80;
mundo.sol.shadow.bias = -0.0015;
mundo.sol.shadow.normalBias = 0.03;

let largura = 1, altura = 1, distCam = 34;
const dirCam = new THREE.Vector3(0.5, 0.64, 0.5).normalize();
function ajustarTela() {
  largura = innerWidth; altura = innerHeight;
  renderer.setSize(largura, altura, false);
  camera.aspect = largura / altura;
  const deitado = largura >= altura;
  camera.fov = deitado ? 30 : 42;
  distCam = deitado ? 40 : 44;
  camera.updateProjectionMatrix();
  $('girar').classList.toggle('ver', !deitado && ehToque);
}
addEventListener('resize', ajustarTela);
ajustarTela();

// ---------- Atores ----------
const atores = [];
const geoBarra = new THREE.PlaneGeometry(1, 1);
geoBarra.translate(0.5, 0, 0);
const matFundoBarra = new THREE.MeshBasicMaterial({ color: '#16110d', depthTest: false, transparent: true });
const matBarra = {
  heroi: new THREE.MeshBasicMaterial({ color: '#ffd23f', depthTest: false, transparent: true }),
  mata: new THREE.MeshBasicMaterial({ color: '#59d36b', depthTest: false, transparent: true }),
  sertao: new THREE.MeshBasicMaterial({ color: '#f0552e', depthTest: false, transparent: true }),
};

function novaBarra(a, lg, alt, mat) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(geoBarra, matFundoBarra), v = new THREE.Mesh(geoBarra, mat);
  f.scale.set(lg + 0.12, alt + 0.12, 1); f.position.x = -(lg + 0.12) / 2; f.renderOrder = 10;
  v.scale.set(lg, alt, 1); v.position.set(-lg / 2, 0, 0.01); v.renderOrder = 11;
  g.add(f, v);
  cena.add(g);
  a.barra = g; a.barraV = v; a.lgBarra = lg;
}

function novoAtor(tipo, lado, x, z, vis, cfg) {
  const a = {
    tipo, lado, x, z, vis, y: 0, fase: Math.random() * 6, rot: lado === 'mata' ? 1.57 : -1.57, andando: false,
    vida: cfg.vida, vidaMax: cfg.vida, vel: cfg.vel ?? 0, raio: cfg.raio, atkT: 0, atkDur: cfg.atkDur ?? 0.4, cd: 0,
    flash: 0, atordoado: 0, girando: 0, morto: false, acordado: 0, ativo: false, renasce: 0, alvo: null, faixa: 0,
  };
  a.y = alturaChao(x, z);
  cena.add(vis.raiz);
  novaBarra(a, cfg.lgBarra, cfg.altBarra, tipo === 'heroi' ? matBarra.heroi : matBarra[lado]);
  atores.push(a);
  return a;
}

const inicio = [-22, caminhoZ(-22)];
const visSaci = criarSaciFinal(ativos);
const heroi = novoAtor('heroi', 'mata', inicio[0], inicio[1], visSaci, { vida: 620, vel: 8.2, raio: 0.65, lgBarra: 2.1, altBarra: 0.24, atkDur: 0.26 });
const gMata = novoAtor('guardiao', 'mata', GUARDIOES.mata[0], GUARDIOES.mata[1], criarGuardiao('mata'), { vida: 1800, raio: 2.5, lgBarra: 4.2, altBarra: 0.3, atkDur: 1.1 });
const gSertao = novoAtor('guardiao', 'sertao', GUARDIOES.sertao[0], GUARDIOES.sertao[1], criarGuardiao('sertao'), { vida: 1800, raio: 2.5, lgBarra: 4.2, altBarra: 0.3, atkDur: 1.1 });
gMata.rot = 1.1; gSertao.rot = -2.0;

gMata.vis.raiz.scale.setScalar(0.92); gSertao.vis.raiz.scale.setScalar(0.92);

function novaTropa(lado, faixa) {
  const x = lado === 'mata' ? -36 + Math.random() * 2 : 36 - Math.random() * 2;
  const a = novoAtor('tropa', lado, x, caminhoZ(x) + faixa, criarTropaFinal(ativos, lado), { vida: lado === 'mata' ? 150 : 130, vel: 3.3, raio: 0.6, lgBarra: 1.25, altBarra: 0.15, atkDur: 0.45 });
  a.faixa = faixa;
  return a;
}
let tempoOnda = 1.5;
function ondas(dt) {
  tempoOnda -= dt;
  if (tempoOnda > 0) return;
  tempoOnda = 13;
  const vivas = atores.filter((a) => a.tipo === 'tropa').length;
  if (vivas > (qualidade === 'baixa' ? 10 : 18)) return;
  for (const f of [-1.2, 0, 1.2]) { novaTropa('mata', f); novaTropa('sertao', f); }
}

function remover(a) {
  cena.remove(a.vis.raiz, a.barra);
  a.vis.mat.dispose();
  atores.splice(atores.indexOf(a), 1);
}

const inimigo = (a, b) => a.lado !== b.lado && !b.morto;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const corImpacto = (a) => (a.tipo === 'tropa' ? (a.lado === 'sertao' ? '#ff9a2b' : '#b7a489') : a.tipo === 'guardiao' ? (a.lado === 'mata' ? '#b7a489' : '#b36a42') : '#ffd23f');

let parada = 0, tremor = 0;
function ferir(alvo, dano, fonte, opc = {}) {
  if (alvo.morto || (alvo === heroi && invulneravel > 0)) return;
  alvo.vida -= dano;
  alvo.flash = 1;
  fx.numero(alvo.x, alvo.y + alvo.vis.altura, alvo.z, Math.round(dano), alvo === heroi ? 'contra' : opc.forte ? 'forte' : '');
  fx.estilhacos(alvo.x, alvo.y + alvo.vis.altura * 0.45, alvo.z, corImpacto(alvo), opc.forte ? 9 : 5, 5);
  if (alvo.tipo === 'guardiao' && fonte) alvo.ativo = true;
  if (opc.empurra && alvo.tipo !== 'guardiao' && fonte) {
    const d = Math.max(0.01, dist(alvo, fonte));
    mover(alvo, ((alvo.x - fonte.x) / d) * opc.empurra, ((alvo.z - fonte.z) / d) * opc.empurra);
  }
  if (alvo.vida <= 0) morrer(alvo);
}

function morrer(a) {
  a.morto = true;
  a.barra.visible = false;
  if (a.tipo === 'tropa') {
    fx.estilhacos(a.x, a.y + 1, a.z, corImpacto(a), 16, 7, 0.17);
    fx.brilho(a.x, a.y + 1, a.z, a.lado === 'sertao' ? '#ff8a26' : '#7dffb0', 12, { vel: 3, vida: 0.5, tam: 1 });
    remover(a);
  } else if (a.tipo === 'guardiao') {
    fx.estilhacos(a.x, a.y + 4, a.z, corImpacto(a), 60, 13, 0.32);
    fx.brilho(a.x, a.y + 3, a.z, a.lado === 'sertao' ? '#ff8a26' : '#7dffb0', 40, { vel: 6, vida: 1, tam: 2, disp: 2 });
    fx.anel(a.x, a.y, a.z, 10, '#fff2cf', 0.7);
    tremor = 1; parada = 0.14;
    a.vis.raiz.visible = false;
    a.renasce = 9;
  } else {
    fx.estilhacos(a.x, a.y + 1, a.z, '#e0271d', 20, 7);
    a.vis.raiz.visible = false;
    a.renasce = 3;
    $('aviso').textContent = 'Volta em 3 segundos';
    $('aviso').classList.add('ver');
  }
}

function renascer(a) {
  a.morto = false; a.vida = a.vidaMax; a.barra.visible = true; a.vis.raiz.visible = true;
  if (a === heroi) {
    a.x = inicio[0]; a.z = inicio[1]; invulneravel = 2;
    $('aviso').classList.remove('ver');
    fx.anel(a.x, a.y, a.z, 3.5, '#ffd23f');
  } else {
    a.ativo = false; a.acordado = 0;
    fx.anel(a.x, a.y, a.z, 6, a.lado === 'mata' ? '#7dffb0' : '#ff8a26', 0.9);
  }
}

function mover(a, dx, dz) {
  if (andavel(a.x + dx, a.z)) a.x += dx;
  if (andavel(a.x, a.z + dz)) a.z += dz;
  for (const g of [gMata, gSertao]) {
    if (g.morto || g === a) continue;
    const d = dist(a, g), m = g.raio + a.raio;
    if (d < m && d > 0.001) { a.x = g.x + ((a.x - g.x) / d) * m; a.z = g.z + ((a.z - g.z) / d) * m; }
  }
}

function olhar(a, x, z, dt, vel = 14) {
  const alvo = Math.atan2(x - a.x, z - a.z);
  let d = alvo - a.rot;
  while (d > Math.PI) d -= 6.283;
  while (d < -Math.PI) d += 6.283;
  a.rot += d * Math.min(1, dt * vel);
}

// ---------- Pedras arremessadas ----------
const matRocha = new THREE.MeshLambertMaterial({ vertexColors: true });
const rochas = [];
for (let i = 0; i < 8; i++) {
  const m = new THREE.Mesh(geoRocha, matRocha);
  m.visible = false; m.castShadow = true;
  cena.add(m);
  rochas.push({ m, ativa: false, t: 0, dur: 1, de: new THREE.Vector3(), para: new THREE.Vector3(), lado: 'mata', fonte: null });
}
function lancarRocha(g, alvo) {
  const r = rochas.find((q) => !q.ativa);
  if (!r) return;
  const e = g.vis.raiz.scale.x;
  r.ativa = true; r.t = 0; r.lado = g.lado; r.fonte = g;
  r.de.set(g.x + Math.sin(g.rot) * 1.5, g.y + 8 * e, g.z + Math.cos(g.rot) * 1.5);
  // mira onde o alvo vai estar
  const lidera = alvo.andando ? 0.45 : 0;
  const px = alvo.x + (alvo.mx ?? 0) * lidera, pz = alvo.z + (alvo.mz ?? 0) * lidera;
  r.para.set(px, alturaChao(px, pz), pz);
  r.dur = 0.75 + dist(g, alvo) * 0.018;
  r.m.visible = true;
  fx.anel(px, r.para.y, pz, 2.2, g.lado === 'mata' ? '#7dffb0' : '#ff7a22', r.dur);
}
function atualizarRochas(dt) {
  for (const r of rochas) {
    if (!r.ativa) continue;
    r.t += dt;
    const t = Math.min(1, r.t / r.dur);
    r.m.position.lerpVectors(r.de, r.para, t);
    r.m.position.y += Math.sin(t * Math.PI) * 4.5;
    r.m.rotation.x += dt * 7; r.m.rotation.z += dt * 5;
    if (t >= 1) {
      r.ativa = false; r.m.visible = false;
      fx.estilhacos(r.para.x, r.para.y + 0.3, r.para.z, r.lado === 'mata' ? '#b7a489' : '#b36a42', 14, 8, 0.18);
      fx.brilho(r.para.x, r.para.y + 0.4, r.para.z, r.lado === 'mata' ? '#7dffb0' : '#ff8a26', 10, { vel: 4, vida: 0.4, tam: 1.2 });
      tremor = Math.max(tremor, 0.28);
      for (let i = atores.length - 1; i >= 0; i--) {
        const a = atores[i];
        if (a.lado === r.lado || a.morto) continue;
        if (Math.hypot(a.x - r.para.x, a.z - r.para.z) < 2.2 + a.raio * 0.5) ferir(a, a === heroi ? 55 : 42, r.fonte, { empurra: 0.4 });
      }
    }
  }
}

// ---------- Saci: comandos ----------
let invulneravel = 0;
const entrada = { x: 0, z: 0, destino: null, mira: new THREE.Vector3(1, 0, 0), mouse: null };
const cooldowns = { a: 0, q: 0, w: 0, e: 0 };
const CD = { a: 0.42, q: 5, w: 9, e: 16 };
let dash = null;
const ventanias = [];

function maisProximo(maxD) {
  let m = null, md = maxD;
  for (const a of atores) {
    if (!inimigo(heroi, a)) continue;
    const d = dist(heroi, a) - a.raio;
    if (d < md) { md = d; m = a; }
  }
  return m;
}

function atacar() {
  if (heroi.morto || cooldowns.a > 0 || heroi.atordoado > 0) return;
  const alvo = maisProximo(3.4);
  cooldowns.a = CD.a;
  heroi.atkT = heroi.atkDur;
  if (alvo) {
    heroi.rot = Math.atan2(alvo.x - heroi.x, alvo.z - heroi.z);
    const d = dist(heroi, alvo) - alvo.raio - heroi.raio;
    if (d > 0.1) { const f = d / Math.max(0.01, dist(heroi, alvo)); mover(heroi, (alvo.x - heroi.x) * f, (alvo.z - heroi.z) * f); }
    ferir(alvo, 34 + Math.random() * 8, heroi, { empurra: 0.3 });
    parada = Math.max(parada, 0.035);
    tremor = Math.max(tremor, 0.09);
    fx.brilho(alvo.x, alvo.y + 1.1, alvo.z, '#fff2cf', 7, { vel: 4, vida: 0.22, tam: 1 });
  }
  const f = [Math.sin(heroi.rot), Math.cos(heroi.rot)];
  fx.brilho(heroi.x + f[0] * 1.2, heroi.y + 1.2, heroi.z + f[1] * 1.2, '#d9fff0', 8, { vel: 3, vida: 0.2, tam: 0.55, disp: 0.8 });
}

function direcaoMira(dx, dz) {
  if (dx !== undefined && Math.hypot(dx, dz) > 0.1) { const d = Math.hypot(dx, dz); return [dx / d, dz / d]; }
  if (entrada.mouse) {
    const mx = entrada.mouse.x - heroi.x, mz = entrada.mouse.z - heroi.z, d = Math.hypot(mx, mz);
    if (d > 0.5) return [mx / d, mz / d];
  }
  const a = maisProximo(11);
  if (a) { const d = Math.max(0.01, dist(heroi, a)); return [(a.x - heroi.x) / d, (a.z - heroi.z) / d]; }
  return [Math.sin(heroi.rot), Math.cos(heroi.rot)];
}

function habQ(dx, dz) {
  if (heroi.morto || cooldowns.q > 0 || heroi.atordoado > 0) return;
  cooldowns.q = CD.q;
  const [x, z] = direcaoMira(dx, dz);
  dash = { x, z, t: 0.32, atingidos: new Set() };
  heroi.girando = 0.32;
  heroi.rot = Math.atan2(x, z);
  fx.tornado(heroi.x, heroi.y, heroi.z, 0.75, 0.7);
  fx.anel(heroi.x, heroi.y, heroi.z, 2.8, '#d9fff0', 0.35);
  entrada.destino = null;
}
function habW() {
  if (heroi.morto || cooldowns.w > 0) return;
  cooldowns.w = CD.w;
  fx.anel(heroi.x, heroi.y, heroi.z, 6.5, '#ff5b3a', 0.55);
  fx.anel(heroi.x, heroi.y, heroi.z, 4, '#ffd23f', 0.42);
  fx.brilho(heroi.x, heroi.y + 1, heroi.z, '#ff5b3a', 26, { vel: 8, vida: 0.6, tam: 0.9, sobe: 0.7 });
  heroi.atkT = heroi.atkDur;
  tremor = Math.max(tremor, 0.3);
  for (let i = atores.length - 1; i >= 0; i--) {
    const a = atores[i];
    if (inimigo(heroi, a) && dist(heroi, a) - a.raio < 6.5) {
      if (a.tipo !== 'guardiao') a.atordoado = 1.5;
      ferir(a, 44, heroi);
    }
  }
}
function habE() {
  if (heroi.morto || cooldowns.e > 0) return;
  cooldowns.e = CD.e;
  const [dx, dz] = direcaoMira();
  const x = heroi.x + dx * 4.5, z = heroi.z + dz * 4.5;
  const y = alturaChao(x, z);
  ventanias.push({ x, z, y, t: 3.4, tick: 0 });
  fx.tornado(x, y, z, 3.4, 2.1);
  fx.anel(x, y, z, 7, '#d9fff0', 0.7);
  tremor = Math.max(tremor, 0.55); parada = Math.max(parada, 0.07);
  $('clarao').classList.remove('anim'); void $('clarao').offsetWidth; $('clarao').classList.add('anim');
}

// ---------- Lógica ----------
function passoHeroi(dt) {
  const a = heroi;
  a.mx = 0; a.mz = 0;
  if (a.morto) { a.renasce -= dt; if (a.renasce <= 0) renascer(a); return; }
  if (invulneravel > 0) invulneravel -= dt;
  if (a.vida < a.vidaMax) a.vida = Math.min(a.vidaMax, a.vida + dt * 9);
  if (dash) {
    dash.t -= dt;
    const passo = 26 * dt;
    mover(a, dash.x * passo, dash.z * passo);
    a.y = alturaChao(a.x, a.z);
    fx.brilho(a.x, a.y + 0.9, a.z, '#d9fff0', 3, { vel: 1.2, vida: 0.4, tam: 0.9, disp: 0.9 });
    for (let i = atores.length - 1; i >= 0; i--) {
      const b = atores[i];
      if (inimigo(a, b) && !dash.atingidos.has(b) && dist(a, b) - b.raio < 2.1) {
        dash.atingidos.add(b);
        ferir(b, 72, a, { forte: true, empurra: 1.1 });
        parada = Math.max(parada, 0.05); tremor = Math.max(tremor, 0.22);
      }
    }
    if (dash.t <= 0) dash = null;
    a.andando = false;
    return;
  }
  let mx = entrada.x, mz = entrada.z;
  if (mx === 0 && mz === 0 && entrada.destino) {
    const dx = entrada.destino.x - a.x, dz = entrada.destino.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.25) entrada.destino = null; else { mx = dx / d; mz = dz / d; }
  } else if (mx !== 0 || mz !== 0) entrada.destino = null;
  a.andando = mx !== 0 || mz !== 0;
  if (a.andando && a.atordoado <= 0) {
    a.mx = mx * a.vel; a.mz = mz * a.vel;
    const yAntes = a.y;
    mover(a, mx * a.vel * dt, mz * a.vel * dt);
    olhar(a, a.x + mx, a.z + mz, dt);
    if (Math.floor(a.fase / Math.PI) !== Math.floor((a.fase + dt * 10.5) / Math.PI)) {
      fx.estilhacos(a.x, yAntes + 0.1, a.z, '#d6bd82', 2, 1.8, 0.06);
      fx.brilho(a.x, a.y + 0.1, a.z, '#d9fff0', 1, { vel: 0.6, vida: 0.4, tam: 0.6, sobe: 0.5 });
    }
  }
}

function passoGuardiao(g, dt) {
  if (g.morto) { g.renasce -= dt; if (g.renasce <= 0) renascer(g); return; }
  g.cd -= dt;
  const ALCANCE = 13;
  let alvo = null, m = ALCANCE;
  for (const a of atores) {
    if (!inimigo(g, a)) continue;
    let d = dist(g, a);
    if (d > ALCANCE) continue;
    if (a === heroi) d += 4; // tropas têm prioridade sobre o herói
    if (d < m) { m = d; alvo = a; }
  }
  g.ativo = !!alvo;
  if (!alvo) return;
  olhar(g, alvo.x, alvo.z, dt, 3);
  if (g.cd <= 0 && g.acordado > 0.75) {
    g.cd = 2.1;
    g.atkT = g.atkDur;
    g.alvo = alvo;
    g.lancou = false;
  }
  if (g.atkT > 0 && !g.lancou && g.atkT < g.atkDur * 0.45 && g.alvo) {
    g.lancou = true;
    if (!g.alvo.morto) lancarRocha(g, g.alvo);
  }
}

function passoTropa(a, dt) {
  a.cd -= dt;
  if (a.atordoado > 0) { a.atordoado -= dt; a.andando = false; if (Math.random() < dt * 8) fx.brilho(a.x, a.y + a.vis.altura, a.z, '#ffd23f', 1, { vel: 1.4, vida: 0.4, tam: 0.45, sobe: 0.3 }); return; }
  let alvo = null, m = 8;
  for (const b of atores) {
    if (!inimigo(a, b)) continue;
    const d = dist(a, b) - b.raio;
    if (d < m) { m = d; alvo = b; }
  }
  const alc = a.raio + 0.85;
  if (alvo && m <= alc) {
    a.andando = false;
    olhar(a, alvo.x, alvo.z, dt);
    if (a.cd <= 0) { a.cd = 1.05; a.atkT = a.atkDur; a.alvoAtk = alvo; a.bateu = false; }
    if (a.atkT > 0 && !a.bateu && a.atkT < a.atkDur * 0.5 && a.alvoAtk && !a.alvoAtk.morto) {
      a.bateu = true;
      ferir(a.alvoAtk, a.alvoAtk === heroi ? 14 : 18, a);
      if (a.lado === 'sertao') fx.brilho(a.alvoAtk.x, a.alvoAtk.y + 1, a.alvoAtk.z, '#ff8a26', 4, { vel: 2.5, vida: 0.25, tam: 0.7 });
    }
    return;
  }
  let dx, dz;
  if (alvo) { dx = alvo.x - a.x; dz = alvo.z - a.z; }
  else {
    const px = a.x + (a.lado === 'mata' ? 2.5 : -2.5);
    dx = px - a.x; dz = caminhoZ(px) + a.faixa - a.z;
  }
  const d = Math.hypot(dx, dz) || 1;
  let vx = (dx / d) * a.vel, vz = (dz / d) * a.vel;
  // afastamento leve entre tropas do mesmo lado
  for (const b of atores) {
    if (b === a || b.tipo !== 'tropa' || b.lado !== a.lado) continue;
    const q = dist(a, b);
    if (q < 1.25 && q > 0.01) { vx += ((a.x - b.x) / q) * 2.4; vz += ((a.z - b.z) / q) * 2.4; }
  }
  a.andando = true;
  a.mx = vx; a.mz = vz;
  mover(a, vx * dt, vz * dt);
  olhar(a, a.x + vx, a.z + vz, dt, 8);
  if (a.lado === 'mata' ? a.x > 34 : a.x < -34) remover(a);
}

function passoLogica(dt) {
  ondas(dt);
  for (const k in cooldowns) if (cooldowns[k] > 0) cooldowns[k] = Math.max(0, cooldowns[k] - dt);
  if (heroi.girando > 0) heroi.girando -= dt;
  passoHeroi(dt);
  passoGuardiao(gMata, dt);
  passoGuardiao(gSertao, dt);
  for (let i = atores.length - 1; i >= 0; i--) {
    const a = atores[i];
    if (a.tipo === 'tropa') passoTropa(a, dt);
  }
  atualizarRochas(dt);
  for (let i = ventanias.length - 1; i >= 0; i--) {
    const v = ventanias[i];
    v.t -= dt; v.tick -= dt;
    if (Math.random() < dt * 30) fx.brilho(v.x, v.y + Math.random() * 4, v.z, '#d9fff0', 1, { vel: 3.5, vida: 0.5, tam: 0.6, disp: 2.2 });
    for (let k = atores.length - 1; k >= 0; k--) {
      const a = atores[k];
      if (!inimigo(heroi, a) || a.tipo === 'guardiao') continue;
      const d = Math.hypot(a.x - v.x, a.z - v.z);
      if (d < 7.5 && d > 0.6) mover(a, ((v.x - a.x) / d) * 7 * dt, ((v.z - a.z) / d) * 7 * dt);
    }
    if (v.tick <= 0) {
      v.tick = 0.42;
      for (let k = atores.length - 1; k >= 0; k--) {
        const a = atores[k];
        if (inimigo(heroi, a) && Math.hypot(a.x - v.x, a.z - v.z) - a.raio < 5.5) ferir(a, 22, heroi);
      }
    }
    if (v.t <= 0) ventanias.splice(i, 1);
  }
}

// ---------- Tochas e clima ----------
let acumuloChama = 0;
const luzTocha = new THREE.PointLight('#ff9a3c', 0, 13, 1.7);
if (qualidade === 'alta') cena.add(luzTocha);
function efeitosAmbiente(dt, t) {
  acumuloChama += dt;
  const passo = qualidade === 'baixa' ? 0.09 : 0.045;
  while (acumuloChama > passo) {
    acumuloChama -= passo;
    const [x, z] = TOCHAS[Math.floor(Math.random() * TOCHAS.length)];
    if (Math.abs(x - heroi.x) > 32 || Math.abs(z - heroi.z) > 28) continue;
    const y = alturaChao(x, z);
    fx.brilho(x + 0.62, y + 1.92, z, '#ff8f2c', 1, { vel: 0.1, vida: 0.5, tam: 1.05 * mundo.brilhoChama, sobe: 0.15, disp: 0.12 });
    fx.brilho(x + 0.62, y + 1.92, z, '#ffd98a', 1, { vel: 0.05, vida: 0.32, tam: 0.42, sobe: 0.1, disp: 0.08 });
  }
  if (Math.random() < dt * 5) {
    // pétalas e pó no ar
    const a = Math.random() * 6.28, q = 6 + Math.random() * 14;
    fx.brilho(heroi.x + Math.cos(a) * q, heroi.y + 1 + Math.random() * 4, heroi.z + Math.sin(a) * q, modo === 'noite' ? '#7dffda' : '#fff2a8', 1, { vel: 0.5, vida: 2.2, tam: 0.22, sobe: 0.1 });
  }
  for (const b of atores) {
    if (b.tipo === 'tropa' && b.lado === 'sertao' && Math.random() < dt * 9)
      fx.brilho(b.x, b.y + 1.4, b.z, '#ff8a26', 1, { vel: 0.35, vida: 0.4, tam: 0.34, sobe: 1.3, disp: 0.5 });
    if (b === gSertao && !b.morto && Math.random() < dt * 8)
      fx.brilho(b.x + (Math.random() - 0.5) * 2.6, b.y + 3 + Math.random() * 3, b.z + (Math.random() - 0.5) * 2.6, '#ff7a22', 1, { vel: 0.3, vida: 0.75, tam: 0.3, sobe: 1 });
    if (b === gMata && !b.morto && Math.random() < dt * 4)
      fx.brilho(b.x + (Math.random() - 0.5) * 3.2, b.y + 3 + Math.random() * 3, b.z + (Math.random() - 0.5) * 3.2, '#7dffb0', 1, { vel: 0.2, vida: 1.1, tam: 0.22, sobe: 0.5 });
  }
  if (qualidade === 'alta') {
    let perto = TOCHAS[0], md = 1e9;
    for (const q of TOCHAS) { const d = Math.hypot(q[0] - heroi.x, q[1] - heroi.z); if (d < md) { md = d; perto = q; } }
    luzTocha.position.set(perto[0], alturaChao(perto[0], perto[1]) + 2.3, perto[1]);
    luzTocha.intensity = (mundo.brilhoChama > 1 ? 60 : 9) * (0.88 + Math.sin(t * 13) * 0.07 + Math.sin(t * 29) * 0.05);
  }
}

// ---------- Câmera e visual ----------
const alvoCam = new THREE.Vector3(heroi.x, 0, heroi.z);
const _q = new THREE.Quaternion();
function visual(dt, t) {
  for (const a of atores) {
    if (a.morto) continue;
    if (a.atkT > 0) a.atkT = Math.max(0, a.atkT - dt);
    a.y = lerp(a.y, alturaChao(a.x, a.z), Math.min(1, dt * 14));
    a.vis.raiz.position.set(a.x, a.y, a.z);
    a.vis.raiz.rotation.y = a.rot;
    a.vis.atualizar(a, dt);
    if (a.flash > 0) { a.flash = Math.max(0, a.flash - dt * 7); a.vis.mat.emissive.setRGB(a.flash, a.flash * 0.85, a.flash * 0.65); }
    const f = clamp(a.vida / a.vidaMax, 0, 1);
    a.barraV.scale.x = a.lgBarra * f;
    a.barra.position.set(a.x, a.y + a.vis.altura + 0.22, a.z);
  }
  camera.getWorldQuaternion(_q);
  for (const a of atores) if (!a.morto) a.barra.quaternion.copy(_q);

  alvoCam.x = lerp(alvoCam.x, heroi.x, Math.min(1, dt * 4.5));
  alvoCam.z = lerp(alvoCam.z, heroi.z, Math.min(1, dt * 4.5));
  tremor = Math.max(0, tremor - dt * 2.4);
  const k = tremor * tremor * 0.55;
  camera.position.set(
    alvoCam.x + dirCam.x * distCam + Math.sin(t * 57) * k,
    0.7 + dirCam.y * distCam + Math.sin(t * 71) * k,
    alvoCam.z + dirCam.z * distCam + Math.cos(t * 63) * k,
  );
  camera.lookAt(alvoCam.x, 0.7, alvoCam.z);
  mundo.sol.position.set(alvoCam.x - 14, 26, alvoCam.z + 9);
  mundo.sol.target.position.set(alvoCam.x, 0, alvoCam.z);

  marcador.visible = !!entrada.destino;
  if (entrada.destino) {
    marcador.position.set(entrada.destino.x, alturaChao(entrada.destino.x, entrada.destino.z) + 0.1, entrada.destino.z);
    marcador.rotation.y = t * 3;
  }
  if (miraQ.ativa) {
    miraSeta.visible = true;
    miraSeta.position.set(heroi.x, heroi.y + 0.14, heroi.z);
    miraSeta.rotation.y = Math.atan2(miraQ.x, miraQ.z);
  } else miraSeta.visible = false;
}

const marcador = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe48a', transparent: true, opacity: 0.85, depthWrite: false }));
marcador.visible = false;
cena.add(marcador);
const miraQ = { ativa: false, x: 0, z: 1 };
const geoSeta = new THREE.PlaneGeometry(1.5, 7);
geoSeta.rotateX(-Math.PI / 2);
geoSeta.translate(0, 0, 3.5);
const miraSeta = new THREE.Mesh(geoSeta, new THREE.MeshBasicMaterial({ color: '#d9fff0', transparent: true, opacity: 0.34, depthWrite: false }));
miraSeta.visible = false;
cena.add(miraSeta);

// ---------- Controles ----------
const raycaster = new THREE.Raycaster();
const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _p = new THREE.Vector3(), _n = new THREE.Vector2();
function pontoChao(cx, cy) {
  _n.set((cx / largura) * 2 - 1, -(cy / altura) * 2 + 1);
  raycaster.setFromCamera(_n, camera);
  return raycaster.ray.intersectPlane(plano, _p) ? { x: _p.x, z: _p.z } : null;
}

// transforma direção da tela em direção do mundo, com câmera a 45 graus
const telaParaMundo = (sx, sy) => [(sx + sy) * Math.SQRT1_2, (sy - sx) * Math.SQRT1_2];

const teclas = new Set();
function atualizarTeclas() {
  let sx = 0, sy = 0;
  if (teclas.has('ArrowLeft')) sx -= 1;
  if (teclas.has('ArrowRight')) sx += 1;
  if (teclas.has('ArrowUp')) sy -= 1;
  if (teclas.has('ArrowDown')) sy += 1;
  if (sx || sy) {
    const d = Math.hypot(sx, sy);
    [entrada.x, entrada.z] = telaParaMundo(sx / d, sy / d);
  } else if (!joy.ativo) { entrada.x = 0; entrada.z = 0; }
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k.startsWith('Arrow')) { teclas.add(k); atualizarTeclas(); e.preventDefault(); }
  if (k === 'a' || k === ' ') atacar();
  if (k === 'q') habQ();
  if (k === 'w') habW();
  if (k === 'e') habE();
});
addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) { teclas.delete(e.key); atualizarTeclas(); } });

const joy = { ativo: false, id: -1, cx: 0, cy: 0 };
const zona = $('zona');
const elJoy = $('joy'), elPino = $('pino');
zona.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.pointerType === 'mouse') {
    const p = pontoChao(e.clientX, e.clientY);
    if (p) { entrada.destino = p; fx.anel(p.x, alturaChao(p.x, p.z), p.z, 1.2, '#ffe48a', 0.3); }
    return;
  }
  if (joy.ativo || e.clientX > largura * 0.5) return;
  joy.ativo = true; joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY;
  zona.setPointerCapture(e.pointerId);
  elJoy.style.transform = `translate(${joy.cx}px,${joy.cy}px)`;
  elJoy.classList.add('ver');
  elPino.style.transform = 'translate(-50%,-50%)';
});
zona.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') { entrada.mouse = pontoChao(e.clientX, e.clientY); return; }
  if (!joy.ativo || e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.cx, dy = e.clientY - joy.cy, d = Math.hypot(dx, dy), max = 58;
  const q = Math.min(d, max), ux = d ? dx / d : 0, uy = d ? dy / d : 0;
  elPino.style.transform = `translate(calc(-50% + ${ux * q}px),calc(-50% + ${uy * q}px))`;
  if (d < 8) { entrada.x = 0; entrada.z = 0; return; }
  [entrada.x, entrada.z] = telaParaMundo(ux, uy);
});
const soltarJoy = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.ativo = false; joy.id = -1; entrada.x = 0; entrada.z = 0;
  elJoy.classList.remove('ver');
};
zona.addEventListener('pointerup', soltarJoy);
zona.addEventListener('pointercancel', soltarJoy);
zona.addEventListener('contextmenu', (e) => e.preventDefault());

const botao = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
botao('btnW', habW);
botao('btnE', habE);
let segurandoAtaque = false;
$('btnA').addEventListener('pointerdown', (e) => { e.preventDefault(); segurandoAtaque = true; atacar(); $('btnA').setPointerCapture(e.pointerId); });
for (const ev of ['pointerup', 'pointercancel']) $('btnA').addEventListener(ev, () => { segurandoAtaque = false; });

// Q: arrastar para mirar no toque; toque ou clique simples usa o alvo mais próximo.
const elQ = $('btnQ');
let qToque = null;
elQ.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.pointerType === 'mouse') { habQ(); return; }
  qToque = { id: e.pointerId, x: e.clientX, y: e.clientY };
  elQ.setPointerCapture(e.pointerId);
  miraQ.ativa = true;
  const [x, z] = direcaoMira();
  miraQ.x = x; miraQ.z = z;
});
elQ.addEventListener('pointermove', (e) => {
  if (!qToque || e.pointerId !== qToque.id) return;
  const dx = e.clientX - qToque.x, dy = e.clientY - qToque.y;
  if (Math.hypot(dx, dy) < 14) return;
  const d = Math.hypot(dx, dy);
  [miraQ.x, miraQ.z] = telaParaMundo(dx / d, dy / d);
});
const soltarQ = (e) => {
  if (!qToque || e.pointerId !== qToque.id) return;
  qToque = null; miraQ.ativa = false;
  habQ(miraQ.x, miraQ.z);
};
elQ.addEventListener('pointerup', soltarQ);
elQ.addEventListener('pointercancel', () => { qToque = null; miraQ.ativa = false; });

// ---------- Painel ----------
let modo = 'dia';
const elModo = $('btnModo');
elModo.addEventListener('click', () => {
  modo = modo === 'dia' ? 'noite' : 'dia';
  mundo.definirModo(modo);
  elModo.querySelector('span').textContent = modo === 'dia' ? 'Anoitecer' : 'Amanhecer';
});
const elQual = $('btnQual');
elQual.querySelector('span').textContent = { alta: 'Qualidade alta', media: 'Qualidade média', baixa: 'Qualidade baixa' }[qualidade];
elQual.addEventListener('click', () => {
  const prox = ORDEM[(ORDEM.indexOf(qualidade) + 1) % 3];
  localStorage.setItem('folclores.qualidade', prox);
  const url = new URL(location.href);
  url.searchParams.delete('q');
  location.href = url.href;
});
$('btnPainel').addEventListener('click', () => $('perf').classList.toggle('ver'));

const anelCd = { a: $('btnA'), q: elQ, w: $('btnW'), e: $('btnE') };
function atualizarHud() {
  $('vidaBarra').style.transform = `scaleX(${clamp(heroi.vida / heroi.vidaMax, 0, 1)})`;
  $('vidaTxt').textContent = `${Math.max(0, Math.round(heroi.vida))} / ${heroi.vidaMax}`;
  for (const k of ['q', 'w', 'e']) {
    const el = anelCd[k], f = cooldowns[k] / CD[k];
    el.style.setProperty('--cd', (f * 360).toFixed(0) + 'deg');
    el.classList.toggle('espera', f > 0);
    el.querySelector('.tempo').textContent = f > 0 ? Math.ceil(cooldowns[k]) : '';
  }
}

// ---------- Laço ----------
let ultimo = performance.now(), tempo = 0;
let medFrames = 0, medTempo = 0, fpsAtual = 0, baixou = 0, checagem = 0;
const autoQualidade = !params.has('q');

function passo(dt) {
  tempo += dt;
  mundo.atualizar(tempo);
  if (parada > 0) parada -= dt;
  else {
    passoLogica(dt);
    if (segurandoAtaque) atacar();
  }
  efeitosAmbiente(dt, tempo);
  visual(dt, tempo);
  fx.atualizar(dt, camera, largura, altura);
  atualizarHud();
  renderer.render(cena, camera);
}

function reduzirCarga() {
  if (baixou === 0 && dpr > 1) { dpr = Math.max(1, dpr * 0.75); renderer.setPixelRatio(dpr); renderer.setSize(largura, altura, false); }
  else if (baixou === 1 && renderer.shadowMap.enabled) { mundo.sol.castShadow = false; }
  else if (dpr > 0.75) { dpr = Math.max(0.75, dpr * 0.85); renderer.setPixelRatio(dpr); renderer.setSize(largura, altura, false); }
  baixou++;
}

function quadro() {
  const agora = performance.now();
  const dtReal = (agora - ultimo) / 1000;
  ultimo = agora;
  passo(Math.min(dtReal, 0.05));
  medFrames++; medTempo += dtReal;
  if (medTempo >= 1) {
    fpsAtual = medFrames / medTempo;
    const inf = renderer.info.render;
    $('perf').textContent = `${fpsAtual.toFixed(0)} q/s  ·  ${inf.calls} chamadas  ·  ${(inf.triangles / 1000).toFixed(0)} mil triângulos  ·  resolução ${dpr.toFixed(2)}x  ·  ${qualidade}`;
    medFrames = 0; medTempo = 0;
    checagem++;
    if (autoQualidade && checagem >= 4 && fpsAtual < 27 && !document.hidden) { reduzirCarga(); checagem = 0; }
  }
}

// entrada no jogo depois de montar tudo
$('carregando').classList.add('pronto');
$('entrar').addEventListener('click', () => {
  $('carregando').classList.add('fim');
  setTimeout(() => $('carregando').remove(), 700);
});
renderer.setAnimationLoop(quadro);

// Ganchos de teste; o painel escondido congela o requestAnimationFrame.
window.__lab = {
  carregouEm: Math.round(performance.now()),
  tempoMundo, tAtivos,
  tInicioMundo: Math.round(tInicioMundo),
  passo, heroi, atores, entrada, habQ, habW, habE, atacar, cena, camera, renderer, mundo,
  ir(x, z) { heroi.x = x; heroi.z = z; alvoCam.x = x; alvoCam.z = z; },
  simular(s) {
    const r = renderer.render;
    renderer.render = () => {};
    for (let i = 0; i < s * 30; i++) passo(1 / 30);
    renderer.render = r;
    renderer.render(cena, camera);
  },
};
