// O jogo: liga a simulação (sim/), o desenho (vista.js) e os controles.
// A partida em si é calculada só pela simulação, em passos fixos de 50 ms.
import * as THREE from 'three';
import { clamp } from './util.js';
import { criarMundo, alturaChao } from './mundo.js';
import { Efeitos } from './efeitos.js';
import { carregarAtivos } from './ativos.js';
import { Vista } from './vista.js';
import { U, MS_TICK } from './sim/fixo.js';
import { criarPartida, passo as passoSim, heroiDe, hashEstado, SACI, atacavel, FORA } from './sim/partida.js';
import { ROTAS, NOMES_ROTA, OBSTACULOS, BASES, FONTES } from './sim/mapa.js';

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
const tInicio = performance.now();
const ativos = await carregarAtivos();
const tAtivos = Math.round(performance.now() - tInicio);
const mundo = criarMundo(cena, qualidade, ativos.kit);
const tempoMundo = Math.round(performance.now() - tInicio);
const fx = new Efeitos(cena, $('camada'), qualidade);

mundo.sol.castShadow = qualidade !== 'baixa';
mundo.sol.shadow.mapSize.setScalar(qualidade === 'alta' ? 2048 : 1024);
const sc = mundo.sol.shadow.camera;
sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 90;
mundo.sol.shadow.bias = -0.0015;
mundo.sol.shadow.normalBias = 0.03;

let largura = 1, altura = 1, distCam = 40;
const dirCam = new THREE.Vector3(0, 0.74, 0.67).normalize();
function ajustarTela() {
  largura = innerWidth; altura = innerHeight;
  renderer.setSize(largura, altura, false);
  camera.aspect = largura / altura;
  const deitado = largura >= altura;
  camera.fov = deitado ? 30 : 42;
  distCam = deitado ? 44 : 48;
  camera.updateProjectionMatrix();
  $('girar').classList.toggle('ver', !deitado && ehToque);
}
addEventListener('resize', ajustarTela);
ajustarTela();

// ---------- A partida ----------
const JOGADOR = 0;
const semente = params.has('semente') ? Number(params.get('semente')) | 0 : (Date.now() & 0x7fffffff);
const LISTA_HEROIS = [
  { lado: 'mata', rota: 'rio' },
  { lado: 'mata', bot: true, rota: 'serra' },
  { lado: 'mata', bot: true, rota: 'mangue' },
  { lado: 'sertao', bot: true, rota: 'rio' },
  { lado: 'sertao', bot: true, rota: 'serra' },
  { lado: 'sertao', bot: true, rota: 'mangue' },
];
const e = criarPartida({ semente, herois: LISTA_HEROIS });
const eu = heroiDe(e, JOGADOR);
let fila = [];
const enviar = (c) => fila.push({ j: JOGADOR, ...c });
const comandos = []; // gravados para repetir a partida depois

function aoFalar(ev) {
  if (ev.tipo === 'heroi') {
    if (ev.id === eu.id) mostrarAviso('Você caiu. Volta em instantes.', 0);
    else mostrarAviso(ev.lado === eu.lado ? 'Um aliado caiu' : 'Inimigo derrubado', 1500);
  } else if (ev.tipo === 'torre') {
    mostrarAviso(ev.lado === eu.lado ? 'Perdemos um Guardião de Itá' : 'Guardião inimigo destruído', 2500);
  }
}

const vista = new Vista({ cena, camera, ativos, mundo, fx, jogadorJ: JOGADOR, aoFalar });
vista.alvoCam.set(eu.x / U, 0, eu.z / U);
for (const ent of e.ents) vista.registrar(ent);
vista.aposPasso(e);

let tAviso = 0;
function mostrarAviso(txt, ms) {
  $('aviso').textContent = txt;
  $('aviso').classList.add('ver');
  clearTimeout(tAviso);
  if (ms) tAviso = setTimeout(() => $('aviso').classList.remove('ver'), ms);
}

// ---------- Controles ----------
const raycaster = new THREE.Raycaster();
const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _p = new THREE.Vector3(), _n = new THREE.Vector2();
function pontoChao(cx, cy) {
  _n.set((cx / largura) * 2 - 1, -(cy / altura) * 2 + 1);
  raycaster.setFromCamera(_n, camera);
  return raycaster.ray.intersectPlane(plano, _p) ? { x: _p.x, z: _p.z } : null;
}

// A direção da tela já é a direção do mapa: a câmera olha reto para o mapa.
let ultimoDir = [0, 0];
function enviarDir(x, z) {
  const ix = Math.round(x * U), iz = Math.round(z * U);
  if (ix === ultimoDir[0] && iz === ultimoDir[1]) return;
  ultimoDir = [ix, iz];
  enviar({ c: 'dir', x: ix, z: iz });
}

const mouse = { x: null, z: null };
const entrada = { destino: null };
const teclas = new Set();
function atualizarTeclas() {
  let sx = 0, sy = 0;
  if (teclas.has('ArrowLeft')) sx -= 1;
  if (teclas.has('ArrowRight')) sx += 1;
  if (teclas.has('ArrowUp')) sy -= 1;
  if (teclas.has('ArrowDown')) sy += 1;
  if (sx || sy) { const d = Math.hypot(sx, sy); enviarDir(sx / d, sy / d); entrada.destino = null; }
  else if (!joy.ativo) enviarDir(0, 0);
}
function miraMouse() {
  if (mouse.x === null) return {};
  const x = Math.round((mouse.x - eu.x / U) * U), z = Math.round((mouse.z - eu.z / U) * U);
  return Math.hypot(x, z) > 500 ? { x, z } : {};
}
let segurandoAtaque = false;
addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (k.startsWith('Arrow')) { teclas.add(k); atualizarTeclas(); ev.preventDefault(); }
  if (k === 'a' || k === ' ') { segurandoAtaque = true; enviar({ c: 'atk' }); ev.preventDefault(); }
  if (k === 'q') enviar({ c: 'q', ...miraMouse() });
  if (k === 'w') enviar({ c: 'w' });
  if (k === 'e') enviar({ c: 'e', ...miraMouse() });
});
addEventListener('keyup', (ev) => {
  if (ev.key.startsWith('Arrow')) { teclas.delete(ev.key); atualizarTeclas(); }
  if (ev.key === 'a' || ev.key === 'A' || ev.key === ' ') segurandoAtaque = false;
});

const joy = { ativo: false, id: -1, cx: 0, cy: 0 };
const zona = $('zona');
const elJoy = $('joy'), elPino = $('pino');
function inimigoEm(x, z) {
  let m = null, md = 3;
  for (const a of e.ents) {
    if (!atacavel(e, eu, a)) continue;
    const d = Math.hypot(a.x / U - x, a.z / U - z) - a.raio / U;
    if (d < md) { md = d; m = a; }
  }
  return m;
}
zona.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  if (ev.pointerType === 'mouse') {
    const p = pontoChao(ev.clientX, ev.clientY);
    if (!p) return;
    const alvo = inimigoEm(p.x, p.z);
    if (alvo) { enviar({ c: 'alvo', id: alvo.id }); entrada.destino = null; return; }
    entrada.destino = p;
    enviar({ c: 'ir', x: Math.round(p.x * U), z: Math.round(p.z * U) });
    fx.anel(p.x, alturaChao(p.x, p.z), p.z, 1.2, '#ffe48a', 0.3);
    return;
  }
  if (joy.ativo || ev.clientX > largura * 0.5) return;
  joy.ativo = true; joy.id = ev.pointerId; joy.cx = ev.clientX; joy.cy = ev.clientY;
  zona.setPointerCapture(ev.pointerId);
  elJoy.style.transform = `translate(${joy.cx}px,${joy.cy}px)`;
  elJoy.classList.add('ver');
  elPino.style.transform = 'translate(-50%,-50%)';
});
zona.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'mouse') {
    const p = pontoChao(ev.clientX, ev.clientY);
    if (p) { mouse.x = p.x; mouse.z = p.z; }
    return;
  }
  if (!joy.ativo || ev.pointerId !== joy.id) return;
  const dx = ev.clientX - joy.cx, dy = ev.clientY - joy.cy, d = Math.hypot(dx, dy), max = 58;
  const q = Math.min(d, max), ux = d ? dx / d : 0, uy = d ? dy / d : 0;
  elPino.style.transform = `translate(calc(-50% + ${ux * q}px),calc(-50% + ${uy * q}px))`;
  if (d < 8) { enviarDir(0, 0); return; }
  enviarDir(ux, uy);
  entrada.destino = null;
});
const soltarJoy = (ev) => {
  if (ev.pointerId !== joy.id) return;
  joy.ativo = false; joy.id = -1; enviarDir(0, 0);
  elJoy.classList.remove('ver');
};
zona.addEventListener('pointerup', soltarJoy);
zona.addEventListener('pointercancel', soltarJoy);
zona.addEventListener('contextmenu', (ev) => ev.preventDefault());

const botao = (id, fn) => $(id).addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); });
botao('btnW', () => enviar({ c: 'w' }));
botao('btnE', () => enviar({ c: 'e', ...miraMouse() }));
$('btnA').addEventListener('pointerdown', (ev) => { ev.preventDefault(); segurandoAtaque = true; enviar({ c: 'atk' }); $('btnA').setPointerCapture(ev.pointerId); });
for (const nome of ['pointerup', 'pointercancel']) $('btnA').addEventListener(nome, () => { segurandoAtaque = false; });

// Q: arrastar para mirar no toque; toque ou clique simples usa o alvo mais próximo.
const miraQ = { ativa: false, x: 0, z: 1, arrastou: false };
const elQ = $('btnQ');
let qToque = null;
elQ.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  if (ev.pointerType === 'mouse') { enviar({ c: 'q', ...miraMouse() }); return; }
  qToque = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
  elQ.setPointerCapture(ev.pointerId);
  miraQ.ativa = true; miraQ.arrastou = false;
  miraQ.x = eu.fx ? eu.fx / U : 0; miraQ.z = eu.fz ? eu.fz / U : 1;
});
elQ.addEventListener('pointermove', (ev) => {
  if (!qToque || ev.pointerId !== qToque.id) return;
  const dx = ev.clientX - qToque.x, dy = ev.clientY - qToque.y, d = Math.hypot(dx, dy);
  if (d < 14) return;
  miraQ.x = dx / d; miraQ.z = dy / d; miraQ.arrastou = true;
});
elQ.addEventListener('pointerup', (ev) => {
  if (!qToque || ev.pointerId !== qToque.id) return;
  qToque = null; miraQ.ativa = false;
  enviar(miraQ.arrastou ? { c: 'q', x: Math.round(miraQ.x * U), z: Math.round(miraQ.z * U) } : { c: 'q' });
});
elQ.addEventListener('pointercancel', () => { qToque = null; miraQ.ativa = false; });

const marcador = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe48a', transparent: true, opacity: 0.85, depthWrite: false }));
marcador.visible = false;
cena.add(marcador);
const geoSeta = new THREE.PlaneGeometry(1.5, 7.8).rotateX(-Math.PI / 2).translate(0, 0, 3.9);
const miraSeta = new THREE.Mesh(geoSeta, new THREE.MeshBasicMaterial({ color: '#d9fff0', transparent: true, opacity: 0.34, depthWrite: false }));
miraSeta.visible = false;
cena.add(miraSeta);

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

const anelCd = { q: elQ, w: $('btnW'), e: $('btnE') };
const CD = { q: SACI.q.cd, w: SACI.w.cd, e: SACI.e.cd };
const CHAVE = { q: 'cdQ', w: 'cdW', e: 'cdE' };
const fmtTempo = (t) => { const s = Math.floor((t * MS_TICK) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function atualizarHud() {
  $('vidaBarra').style.transform = `scaleX(${clamp(eu.vida / eu.vidaMax, 0, 1)})`;
  $('vidaTxt').textContent = `${Math.max(0, eu.vida)} / ${eu.vidaMax}`;
  for (const k of ['q', 'w', 'e']) {
    const el = anelCd[k], cd = eu[CHAVE[k]], f = cd / CD[k];
    el.style.setProperty('--cd', (f * 360).toFixed(0) + 'deg');
    el.classList.toggle('espera', f > 0);
    el.querySelector('.tempo').textContent = f > 0 ? Math.ceil((cd * MS_TICK) / 1000) : '';
  }
  $('placarMata').textContent = e.placar.mata;
  $('placarSertao').textContent = e.placar.sertao;
  $('relogio').textContent = fmtTempo(e.tick);
  if (eu.morto) $('aviso').textContent = `Você caiu. Volta em ${Math.ceil((eu.renasce * MS_TICK) / 1000)} s`;
  else if ($('aviso').textContent.startsWith('Você caiu')) $('aviso').classList.remove('ver');
}

// ---------- Minimapa ----------
const elMini = $('mini');
const ladoMini = 150, escMini = ladoMini / 200;
elMini.width = elMini.height = ladoMini;
const ctxMini = elMini.getContext('2d');
const fundoMini = document.createElement('canvas');
fundoMini.width = fundoMini.height = ladoMini;
{
  const c = fundoMini.getContext('2d');
  const P = (v) => (v + 100) * escMini;
  c.fillStyle = '#3f5a2e'; c.fillRect(0, 0, ladoMini, ladoMini);
  c.fillStyle = 'rgba(138,84,40,.45)';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(ladoMini, 0); c.lineTo(ladoMini, ladoMini); c.closePath(); c.fill();
  c.fillStyle = '#24401f';
  for (const [x, z, rx, rz] of OBSTACULOS) { c.beginPath(); c.ellipse(P(x), P(z), rx * escMini, rz * escMini, 0, 0, 6.283); c.fill(); }
  c.strokeStyle = '#3f9aa8'; c.lineWidth = 7; c.beginPath(); c.moveTo(0, 0); c.lineTo(ladoMini, ladoMini); c.stroke();
  c.strokeStyle = '#d8c79a'; c.lineWidth = 4; c.lineJoin = 'round';
  for (const n of NOMES_ROTA) { c.beginPath(); ROTAS[n].forEach(([x, z], i) => (i ? c.lineTo(P(x), P(z)) : c.moveTo(P(x), P(z)))); c.stroke(); }
}
function desenharMini() {
  const c = ctxMini, P = (v) => (v / U + 100) * escMini;
  c.drawImage(fundoMini, 0, 0);
  for (const a of e.ents) {
    if (a.morto) continue;
    const meu = a.lado === eu.lado;
    if (a.tipo === 'tropa') {
      c.fillStyle = meu ? '#9dffba' : '#ff9b7a';
      c.fillRect(P(a.x) - 1, P(a.z) - 1, 2, 2);
    } else if (a.tipo === 'torre' || a.tipo === 'base') {
      const t = a.tipo === 'base' ? 5 : 3;
      c.fillStyle = meu ? '#3fe07f' : '#ff5a36';
      c.strokeStyle = '#10140c'; c.lineWidth = 1;
      c.fillRect(P(a.x) - t, P(a.z) - t, t * 2, t * 2);
      c.strokeRect(P(a.x) - t, P(a.z) - t, t * 2, t * 2);
    }
  }
  for (const a of e.ents) {
    if (a.tipo !== 'heroi' || a.morto) continue;
    c.fillStyle = a === eu ? '#ffd23f' : a.lado === eu.lado ? '#3fe07f' : '#ff5a36';
    c.strokeStyle = '#10140c'; c.lineWidth = 1.2;
    c.beginPath(); c.arc(P(a.x), P(a.z), a === eu ? 4.5 : 3.5, 0, 6.283); c.fill(); c.stroke();
  }
  // o que a câmera está vendo
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1;
  const w = 36 * (largura / altura) * 0.75 * escMini, h = 27 * escMini;
  c.strokeRect((vista.alvoCam.x + 100) * escMini - w, (vista.alvoCam.z + 100) * escMini - h, w * 2, h * 2);
}
elMini.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); ev.stopPropagation();
  const r = elMini.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * 200 - 100, z = ((ev.clientY - r.top) / r.height) * 200 - 100;
  enviar({ c: 'ir', x: Math.round(x * U), z: Math.round(z * U) });
  entrada.destino = { x, z };
});

// ---------- Fim de partida ----------
function mostrarFim(vencedor) {
  const ganhou = vencedor === eu.lado;
  $('fimTitulo').textContent = ganhou ? 'Vitória' : 'Derrota';
  $('fimLinha').textContent = ganhou ? 'O Juazeiro caiu. A Mata venceu o território.' : 'A Samaúma caiu. O Sertão tomou o território.';
  $('fimDados').textContent = `Tempo ${fmtTempo(e.tick)}  ·  Abates ${eu.abates}  ·  Quedas ${eu.mortes}  ·  Placar ${e.placar.mata} a ${e.placar.sertao}`;
  $('fim').classList.toggle('derrota', !ganhou);
  $('fim').classList.add('ver');
}
$('jogarDeNovo').addEventListener('click', () => location.reload());

// ---------- Laço ----------
let ultimo = performance.now(), tempo = 0, acum = 0, iniciado = false;
let medFrames = 0, medTempo = 0, fpsAtual = 0, baixou = 0, checagem = 0, miniEspera = 0, fimMostrado = false;
const autoQualidade = !params.has('q');
const _v = new THREE.Vector3();
const corte = { x: 1e9, z: 1e9, aspect: 0 };

function umPasso() {
  if (segurandoAtaque) enviar({ c: 'atk' });
  const lote = fila;
  fila = [];
  if (lote.length) comandos.push([e.tick + 1, lote]);
  passoSim(e, lote);
  vista.aposPasso(e);
  if (e.fim && !fimMostrado) { fimMostrado = true; setTimeout(() => mostrarFim(e.fim.vencedor), 1200); }
}

function desenhar(dt, alfa) {
  tempo += dt;
  mundo.atualizar(tempo);
  vista.quadro(dt, alfa, e, eu);
  vista.tremor = Math.max(0, vista.tremor - dt * 2.4);
  const k = vista.tremor * vista.tremor * 0.55;
  const ac = vista.alvoCam;
  camera.position.set(
    ac.x + dirCam.x * distCam + Math.sin(tempo * 57) * k,
    0.7 + dirCam.y * distCam + Math.sin(tempo * 71) * k,
    ac.z + dirCam.z * distCam + Math.cos(tempo * 63) * k,
  );
  camera.lookAt(ac.x, 0.7, ac.z);
  mundo.sol.position.set(ac.x - 14, 28, ac.z + 12);
  mundo.sol.target.position.set(ac.x, 0, ac.z);

  // só as plantas em volta da câmera vão para o desenho; refaz a lista a cada poucos metros
  if (Math.abs(ac.x - corte.x) > 5 || Math.abs(ac.z - corte.z) > 5 || corte.aspect !== camera.aspect) {
    corte.x = ac.x; corte.z = ac.z; corte.aspect = camera.aspect;
    const t = Math.tan((camera.fov * Math.PI) / 360) * distCam;
    mundo.cortar(ac.x, ac.z, t * camera.aspect * 1.5 + 12, t * 1.9 + 16, t * 1.2 + 12);
  }

  // furo nas árvores à frente do herói
  const v = vista.reg.get(eu.id);
  if (v) {
    camera.updateMatrixWorld();
    _v.set(v.x, v.y + 1.8, v.z).project(camera);
    const u = mundo.uFuro.value, px = renderer.getPixelRatio();
    u.set(((_v.x + 1) / 2) * largura * px, ((_v.y + 1) / 2) * altura * px, _v.z * 0.5 + 0.5, Math.min(largura, altura) * px * 0.17);
  }
  marcador.visible = !!entrada.destino && eu.cam.length > 0;
  if (marcador.visible) {
    marcador.position.set(entrada.destino.x, alturaChao(entrada.destino.x, entrada.destino.z) + 0.1, entrada.destino.z);
    marcador.rotation.y = tempo * 3;
  }
  if (miraQ.ativa && v) {
    miraSeta.visible = true;
    miraSeta.position.set(v.x, v.y + 0.14, v.z);
    miraSeta.rotation.y = Math.atan2(miraQ.x, miraQ.z);
  } else miraSeta.visible = false;

  fx.atualizar(dt, camera, largura, altura);
  atualizarHud();
  miniEspera -= dt;
  if (miniEspera <= 0) { miniEspera = 0.2; desenharMini(); }
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
  const dt = Math.min(dtReal, 0.05);
  if (iniciado && !e.fim) {
    acum += Math.min(dtReal, 0.25) * 1000;
    let n = 0;
    while (acum >= MS_TICK && n++ < 5) { umPasso(); acum -= MS_TICK; }
  }
  desenhar(dt, clamp(acum / MS_TICK, 0, 1));
  medFrames++; medTempo += dtReal;
  if (medTempo >= 1) {
    fpsAtual = medFrames / medTempo;
    const inf = renderer.info.render;
    $('perf').textContent = `${fpsAtual.toFixed(0)} q/s  ·  ${inf.calls} chamadas  ·  ${(inf.triangles / 1000).toFixed(0)} mil triângulos  ·  resolução ${dpr.toFixed(2)}x  ·  ${qualidade}`;
    medFrames = 0; medTempo = 0;
    checagem++;
    if (autoQualidade && iniciado && checagem >= 4 && fpsAtual < 27 && !document.hidden) { reduzirCarga(); checagem = 0; }
  }
}

$('carregando').classList.add('pronto');
$('entrar').addEventListener('click', () => {
  $('carregando').classList.add('fim');
  setTimeout(() => $('carregando').remove(), 700);
  iniciado = true;
  ultimo = performance.now();
  mostrarAviso('Proteja a Samaúma. Derrube o Juazeiro.', 3500);
});
renderer.setAnimationLoop(quadro);

// Ganchos de teste; o painel escondido congela o requestAnimationFrame.
window.__lab = {
  carregouEm: Math.round(performance.now()), tempoMundo, tAtivos,
  e, eu, vista, cena, camera, renderer, mundo, enviar, comandos, semente, hashEstado, FORA, BASES, FONTES, heroiDe,
  iniciar() { iniciado = true; },
  ir(x, z) { eu.x = Math.round(x * U); eu.z = Math.round(z * U); vista.alvoCam.x = x; vista.alvoCam.z = z; const r = vista.reg.get(eu.id); if (r) { r.x = r.ax = r.nx = x; r.z = r.az = r.nz = z; } },
  simular(s) {
    const r = renderer.render;
    renderer.render = () => {};
    for (let i = 0; i < s * 20; i++) { if (!e.fim) umPasso(); desenhar(0.05, 1); }
    renderer.render = r;
    renderer.render(cena, camera);
  },
};
