// A partida inteira, sem desenho: com a mesma semente e os mesmos comandos, o resultado é idêntico.
// O estado é um objeto simples de inteiros, textos e listas: dá para copiar por JSON e continuar dali.
import { U, un, seg, divi, isqrt, dist2, vetor, sorteioAte } from './fixo.js';
import { BASES, FONTES, RAIO_FONTE, ROTAS, NOMES_ROTA, TORRES, livre, caminho } from './mapa.js';
import { decidirBot } from './bots.js';

// ---------- Números do jogo ----------
export const SACI = {
  vida: 620, vel: un(8) / 20 | 0, raio: un(0.65), regenCada: 2,
  atk: { alcance: un(3.4), base: 34, extra: 9, cd: seg(0.42) },
  q: { cd: seg(5), passos: 6, passo: un(1.3), raioHit: un(2.1), dano: 72 },
  w: { cd: seg(9), raio: un(6.5), dano: 44, atordoa: seg(1.5), atordoaHeroi: seg(0.8) },
  e: { cd: seg(16), dist: un(4.5), dura: seg(3.4), raioPuxa: un(7.5), puxa: un(7) / 20 | 0, raioDano: un(5.5), dano: 22, cada: seg(0.42) },
};
export const TROPA = { vida: { mata: 150, sertao: 150 }, vel: un(5) / 20 | 0, raio: un(0.6), alcance: un(0.85), dano: 18, cd: seg(1.05), golpe: seg(0.22), visao: un(9) };
export const TORRE = {
  externa: { vida: 1500, raio: un(2.6), alcance: un(14), dano: 90, danoTropa: 58, cd: seg(2.1) },
  interna: { vida: 1800, raio: un(2.6), alcance: un(14), dano: 110, danoTropa: 66, cd: seg(2) },
  base: { vida: 3600, raio: un(6), alcance: un(13), dano: 120, danoTropa: 70, cd: seg(2) },
};
export const INTERVALO_ONDA = seg(30);
const POR_ONDA = 3;
const LIMITE_TROPAS = 72;
const RAIO_PEDRA = un(2.2);
const ACORDAR = seg(0.75);
const CURA_FONTE = 8; // por passo
const REFORCO_ROTA = 170; // % das tropas da rota cuja torre interna inimiga caiu
const CERCO_DESDE = seg(600); // depois de 10 minutos, estruturas apanham mais
const CERCO_POR_MIN = 12; // % a mais por minuto
export const FORA = { renasceBase: seg(5), renascePorMinuto: seg(2), renasceMax: seg(25) };

const LADOS = ['mata', 'sertao'];
const inimigoDe = (lado) => (lado === 'mata' ? 'sertao' : 'mata');

// ---------- Criação ----------
function novaEnt(e, tipo, lado, x, z, vidaMax, raio) {
  const a = { id: e.prox++, tipo, lado, x, z, vx: 0, vz: 0, vida: vidaMax, vidaMax, raio, morto: 0 };
  e.ents.push(a);
  return a;
}

export function criarPartida({ semente = 1, herois = [], ondas = true } = {}) {
  const e = {
    tick: 0, rng: semente | 0, prox: 1, ents: [], pedras: [], areas: [],
    fim: null, placar: { mata: 0, sertao: 0 }, onda: 0, proxOnda: seg(5), ondas: ondas ? 1 : 0, eventos: [],
  };
  for (const lado of LADOS) {
    const [bx, bz] = BASES[lado];
    const b = novaEnt(e, 'base', lado, un(bx), un(bz), TORRE.base.vida, TORRE.base.raio);
    Object.assign(b, { nivel: 'base', rota: '', cd: 0, alvo: 0, ativo: 0, acorda: 0, atkT: 0 });
    for (const rota of NOMES_ROTA) {
      TORRES[lado][rota].forEach(([x, z], k) => {
        const nivel = k === 0 ? 'externa' : 'interna';
        const t = novaEnt(e, 'torre', lado, un(x), un(z), TORRE[nivel].vida, TORRE[nivel].raio);
        Object.assign(t, { nivel, rota, cd: 0, alvo: 0, ativo: 0, acorda: 0, atkT: 0 });
      });
    }
  }
  herois.forEach((h, j) => {
    const [fx, fz] = FONTES[h.lado];
    const a = novaEnt(e, 'heroi', h.lado, un(fx) + un(j % 3) - un(1), un(fz) - un(j % 2), SACI.vida, SACI.raio);
    Object.assign(a, {
      j, bot: h.bot ? 1 : 0, rota: h.rota ?? NOMES_ROTA[j % 3], nome: h.nome ?? 'Saci', vel: SACI.vel,
      dx: 0, dz: 0, cam: [], alvo: 0, cdA: 0, cdQ: 0, cdW: 0, cdE: 0, dash: null,
      atordoado: 0, invul: 0, renasce: 0, abates: 0, mortes: 0, agro: 0, atkT: 0, recua: 0, destBot: [0, 0], pensa: j,
    });
  });
  return e;
}

// ---------- Consultas ----------
export const pegar = (e, id) => { for (const a of e.ents) if (a.id === id) return a; return null; };
export const heroiDe = (e, j) => { for (const a of e.ents) if (a.tipo === 'heroi' && a.j === j) return a; return null; };
export const inimigo = (a, b) => a.lado !== b.lado && !b.morto;

// Torre só pode ser atacada depois da anterior na mesma rota; a base, depois de cair uma torre interna.
export function protegida(e, b) {
  if (b.tipo === 'base') {
    for (const t of e.ents) if (t.tipo === 'torre' && t.lado === b.lado && t.nivel === 'interna' && t.morto) return false;
    return true;
  }
  if (b.tipo === 'torre' && b.nivel === 'interna') {
    for (const t of e.ents) if (t.tipo === 'torre' && t.lado === b.lado && t.rota === b.rota && t.nivel === 'externa' && !t.morto) return true;
  }
  return false;
}
export function atacavel(e, a, b) {
  if (!inimigo(a, b)) return false;
  if (b.tipo === 'heroi' && b.invul > 0) return false;
  return !((b.tipo === 'torre' || b.tipo === 'base') && protegida(e, b));
}
const distBorda = (a, b) => isqrt(dist2(a.x, a.z, b.x, b.z)) - b.raio;

// ---------- Movimento ----------
function mover(e, a, dx, dz) {
  if (dx === 0 && dz === 0) return;
  if (livre(a.x + dx, a.z)) a.x += dx;
  if (livre(a.x, a.z + dz)) a.z += dz;
  for (const b of e.ents) {
    if ((b.tipo !== 'torre' && b.tipo !== 'base') || b.morto || b === a) continue;
    const m = b.raio + a.raio, ex = a.x - b.x, ez = a.z - b.z;
    if (Math.abs(ex) >= m || Math.abs(ez) >= m) continue;
    const q = ex * ex + ez * ez;
    if (q >= m * m) continue;
    const d = isqrt(q);
    const [ux, uz] = d > 0 ? [divi(ex * U, d), divi(ez * U, d)] : [U, 0];
    const nx = b.x + divi(ux * m, U), nz = b.z + divi(uz * m, U);
    if (livre(nx, nz)) { a.x = nx; a.z = nz; }
  }
}
function empurrar(e, a, fonte, forca) {
  if (a.tipo !== 'heroi' && a.tipo !== 'tropa') return;
  const [dx, dz] = vetor(a.x - fonte.x, a.z - fonte.z, forca);
  mover(e, a, dx, dz);
}

// ---------- Dano ----------
function ferir(e, alvo, dano, fonte, opc = {}) {
  if (alvo.morto || (alvo.tipo === 'heroi' && alvo.invul > 0)) return;
  if ((alvo.tipo === 'torre' || alvo.tipo === 'base') && e.tick > CERCO_DESDE) dano = divi(dano * (100 + divi((e.tick - CERCO_DESDE) * CERCO_POR_MIN, seg(60))), 100);
  alvo.vida -= dano;
  e.eventos.push({ k: 'dano', id: alvo.id, v: dano, forte: opc.forte ? 1 : 0 });
  if (fonte && fonte.tipo === 'heroi' && alvo.tipo === 'heroi') fonte.agro = e.tick + seg(2);
  if (opc.empurra && fonte) empurrar(e, alvo, fonte, opc.empurra);
  if (alvo.vida <= 0) morrer(e, alvo, fonte);
}

function morrer(e, a, fonte) {
  a.vida = 0;
  a.morto = 1;
  e.eventos.push({ k: 'morte', id: a.id, x: a.x, z: a.z, tipo: a.tipo, lado: a.lado });
  if (a.tipo === 'heroi') {
    a.mortes++;
    a.dash = null; a.cam = []; a.alvo = 0; a.dx = 0; a.dz = 0; a.atkT = 0; a.atordoado = 0;
    const min = divi(e.tick, seg(60));
    a.renasce = Math.min(FORA.renasceMax, FORA.renasceBase + min * FORA.renascePorMinuto);
    e.placar[inimigoDe(a.lado)]++;
    if (fonte && fonte.tipo === 'heroi') fonte.abates++;
  } else if (a.tipo === 'base') {
    e.fim = { vencedor: inimigoDe(a.lado), tick: e.tick };
    e.eventos.push({ k: 'fim', vencedor: e.fim.vencedor });
  }
}

// ---------- Comandos ----------
const ehInt = Number.isInteger;
function aplicar(e, c) {
  const h = heroiDe(e, c.j);
  if (!h || h.morto || e.fim) return;
  switch (c.c) {
    case 'dir': // joystick ou teclas: vetor de até 1000
      if (!ehInt(c.x) || !ehInt(c.z)) return;
      h.dx = Math.max(-U, Math.min(U, c.x)); h.dz = Math.max(-U, Math.min(U, c.z));
      if (h.dx || h.dz) { h.cam = []; h.alvo = 0; }
      break;
    case 'ir':
      if (!ehInt(c.x) || !ehInt(c.z)) return;
      h.dx = 0; h.dz = 0; h.alvo = 0;
      h.cam = caminho(h.x, h.z, c.x, c.z);
      break;
    case 'alvo':
      if (!ehInt(c.id)) return;
      h.alvo = c.id; h.cam = []; h.dx = 0; h.dz = 0;
      break;
    case 'atk': golpe(e, h); break;
    case 'q': habQ(e, h, c.x, c.z); break;
    case 'w': habW(e, h); break;
    case 'e': habE(e, h, c.x, c.z); break;
    default:
  }
}

function maisProximo(e, h, maxD) {
  let m = null, md = maxD;
  for (const b of e.ents) {
    if (!atacavel(e, h, b)) continue;
    const d = distBorda(h, b);
    if (d < md || (d === md && m && b.id < m.id)) { md = d; m = b; }
  }
  return m;
}

function golpe(e, h, alvoFixo = null) {
  if (h.cdA > 0 || h.atordoado > 0 || h.dash) return false;
  const a = alvoFixo ?? maisProximo(e, h, SACI.atk.alcance);
  h.cdA = SACI.atk.cd;
  h.atkT = seg(0.26);
  e.eventos.push({ k: 'golpe', id: h.id, alvo: a ? a.id : 0 });
  if (!a) return false;
  // um passinho até encostar no alvo
  const d = distBorda(h, a) - h.raio;
  if (d > 100) { const [px, pz] = vetor(a.x - h.x, a.z - h.z, d); mover(e, h, px, pz); }
  ferir(e, a, SACI.atk.base + sorteioAte(e, SACI.atk.extra), h, { empurra: a.tipo === 'tropa' ? un(0.3) : 0 });
  return true;
}

function direcaoHab(e, h, x, z) {
  if (ehInt(x) && ehInt(z) && (x !== 0 || z !== 0)) return vetor(x, z);
  const a = maisProximo(e, h, un(11));
  if (a) return vetor(a.x - h.x, a.z - h.z);
  return h.fx || h.fz ? [h.fx, h.fz] : [U, 0];
}
function habQ(e, h, x, z) {
  if (h.cdQ > 0 || h.atordoado > 0 || h.dash) return;
  h.cdQ = SACI.q.cd;
  const [dx, dz] = direcaoHab(e, h, x, z);
  h.dash = { dx, dz, t: SACI.q.passos, hit: [] };
  h.cam = []; h.alvo = 0;
  e.eventos.push({ k: 'q', id: h.id, x: h.x, z: h.z, dx, dz });
}
function habW(e, h) {
  if (h.cdW > 0 || h.atordoado > 0) return;
  h.cdW = SACI.w.cd;
  h.atkT = seg(0.26);
  e.eventos.push({ k: 'w', id: h.id, x: h.x, z: h.z });
  for (const a of e.ents) {
    if (!atacavel(e, h, a) || distBorda(h, a) >= SACI.w.raio) continue;
    if (a.tipo === 'tropa') a.atordoado = SACI.w.atordoa;
    if (a.tipo === 'heroi') a.atordoado = SACI.w.atordoaHeroi;
    ferir(e, a, SACI.w.dano, h);
  }
}
function habE(e, h, x, z) {
  if (h.cdE > 0 || h.atordoado > 0) return;
  h.cdE = SACI.e.cd;
  const [dx, dz] = direcaoHab(e, h, x, z);
  const ax = h.x + divi(dx * SACI.e.dist, U), az = h.z + divi(dz * SACI.e.dist, U);
  e.areas.push({ x: ax, z: az, t: SACI.e.dura, cada: 0, lado: h.lado, de: h.id });
  e.eventos.push({ k: 'e', id: h.id, x: ax, z: az });
}

// ---------- Passo do herói ----------
function passoHeroi(e, h) {
  if (h.morto) {
    if (--h.renasce <= 0) {
      const [fx, fz] = FONTES[h.lado];
      h.morto = 0; h.vida = h.vidaMax; h.x = un(fx); h.z = un(fz); h.invul = seg(2); h.cam = []; h.alvo = 0;
      e.eventos.push({ k: 'renasce', id: h.id, x: h.x, z: h.z });
    }
    return;
  }
  for (const k of ['cdA', 'cdQ', 'cdW', 'cdE', 'invul', 'atkT']) if (h[k] > 0) h[k]--;
  // regeneração e cura na fonte
  if (h.vida < h.vidaMax) {
    if (e.tick % SACI.regenCada === 0) h.vida++;
    const [fx, fz] = FONTES[h.lado];
    if (dist2(h.x, h.z, un(fx), un(fz)) < un(RAIO_FONTE) * un(RAIO_FONTE)) h.vida = Math.min(h.vidaMax, h.vida + CURA_FONTE);
  }
  if (h.atordoado > 0) { h.atordoado--; h.vx = 0; h.vz = 0; return; }
  const ax = h.x, az = h.z;
  if (h.dash) {
    const d = h.dash;
    d.t--;
    mover(e, h, divi(d.dx * SACI.q.passo, U), divi(d.dz * SACI.q.passo, U));
    for (const b of e.ents) {
      if (!atacavel(e, h, b) || d.hit.includes(b.id) || distBorda(h, b) >= SACI.q.raioHit) continue;
      d.hit.push(b.id);
      ferir(e, b, SACI.q.dano, h, { forte: true, empurra: b.tipo === 'tropa' ? un(1.1) : 0 });
    }
    if (d.t <= 0) h.dash = null;
  } else if (h.dx || h.dz) {
    mover(e, h, divi(h.dx * h.vel, U), divi(h.dz * h.vel, U));
  } else if (h.alvo) {
    const a = pegar(e, h.alvo);
    if (!a || !atacavel(e, h, a)) h.alvo = 0;
    else if (distBorda(h, a) - h.raio <= SACI.atk.alcance - un(1)) golpe(e, h, a);
    else {
      if (h.cam.length === 0 || e.tick % 10 === h.pensa % 10) h.cam = caminho(h.x, h.z, a.x, a.z);
      seguirCaminho(e, h);
    }
  } else if (h.cam.length) {
    seguirCaminho(e, h);
  }
  h.vx = h.x - ax; h.vz = h.z - az;
  if (h.vx || h.vz) { const [fx, fz] = vetor(h.vx, h.vz); h.fx = fx; h.fz = fz; }
}
function seguirCaminho(e, h) {
  let resta = h.vel;
  while (resta > 0 && h.cam.length) {
    const tx = h.cam[0], tz = h.cam[1], dx = tx - h.x, dz = tz - h.z, d = isqrt(dx * dx + dz * dz);
    if (d <= resta) {
      h.cam.splice(0, 2);
      mover(e, h, dx, dz);
      resta -= d;
      if (d === 0) continue;
    } else {
      mover(e, h, divi(dx * resta, d), divi(dz * resta, d));
      resta = 0;
    }
  }
}

// ---------- Tropas ----------
function novaOnda(e) {
  e.onda++;
  let vivas = 0;
  for (const a of e.ents) if (a.tipo === 'tropa') vivas++;
  if (vivas >= LIMITE_TROPAS) return;
  const reforco = 100 + 4 * (e.onda - 1); // cada onda fica 4% mais forte
  for (const lado of LADOS) {
    for (const rota of NOMES_ROTA) {
      const pontos = lado === 'mata' ? ROTAS[rota] : [...ROTAS[rota]].reverse();
      const [ox, oz] = pontos[1];
      const [bx, bz] = pontos[0];
      const [ux, uz] = vetor(ox - bx, oz - bz);
      // torre interna inimiga caída nesta rota: as tropas saem bem mais fortes
      let rompeu = false;
      for (const t of e.ents) if (t.tipo === 'torre' && t.lado !== lado && t.nivel === 'interna' && t.morto && t.rota === rota) rompeu = true;
      for (let i = 0; i < POR_ONDA; i++) {
        const faixa = (i - 1) * 1300;
        // sai da frente da base, em fila
        const x = un(bx) + divi(ux * 9, 1) + divi(-uz * faixa, U) - divi(ux * i * 16, 10);
        const z = un(bz) + divi(uz * 9, 1) + divi(ux * faixa, U) - divi(uz * i * 16, 10);
        const forca = rompeu ? divi(reforco * REFORCO_ROTA, 100) : reforco;
        const vida = divi(TROPA.vida[lado] * forca, 100);
        const t = novaEnt(e, 'tropa', lado, x, z, vida, TROPA.raio);
        Object.assign(t, { rota, wp: 1, faixa, vel: TROPA.vel, cd: 0, alvo: 0, atkT: 0, bateu: 0, atordoado: 0, dano: divi(TROPA.dano * forca, 100), reforcada: rompeu ? 1 : 0, preso: 0, cam: [] });
      }
    }
  }
  e.eventos.push({ k: 'onda', n: e.onda });
}

function pontoDaRota(t) {
  const p = t.lado === 'mata' ? ROTAS[t.rota] : [...ROTAS[t.rota]].reverse();
  return p[Math.min(t.wp, p.length - 1)];
}

function passoTropa(e, a) {
  if (a.cd > 0) a.cd--;
  if (a.atkT > 0) a.atkT--;
  a.vx = 0; a.vz = 0;
  if (a.atordoado > 0) { a.atordoado--; return; }
  // Procura alvo em passos alternados: é o que mais custa.
  if ((e.tick + a.id) % 4 === 0 || a.alvo) {
    const atual = a.alvo ? pegar(e, a.alvo) : null;
    if ((e.tick + a.id) % 4 === 0 || !atual || !atacavel(e, a, atual)) {
      let m = null, md = TROPA.visao;
      for (const b of e.ents) {
        if (b.tipo === 'heroi' && b.invul > 0) continue;
        if (!atacavel(e, a, b)) continue;
        // herói só atrai quando está bem perto
        const d = distBorda(a, b) + (b.tipo === 'heroi' ? un(3) : 0);
        if (d < md) { md = d; m = b; }
      }
      a.alvo = m ? m.id : 0;
    }
  }
  const alvo = a.alvo ? pegar(e, a.alvo) : null;
  if (alvo && alvo.morto) a.alvo = 0;
  if (alvo && !alvo.morto) {
    const d = distBorda(a, alvo) - a.raio;
    if (d <= TROPA.alcance) {
      if (a.cd <= 0) { a.cd = TROPA.cd; a.atkT = TROPA.golpe * 2; a.bateu = 0; e.eventos.push({ k: 'golpeTropa', id: a.id, alvo: alvo.id }); }
      if (a.atkT > 0 && a.atkT <= TROPA.golpe && !a.bateu) { a.bateu = 1; ferir(e, alvo, a.dano, a); }
      a.fx = alvo.x - a.x; a.fz = alvo.z - a.z;
      return;
    }
  }
  // Anda: até o alvo ou até o próximo ponto da rota.
  let tx, tz;
  if (alvo && !alvo.morto) { tx = alvo.x; tz = alvo.z; }
  else if (a.cam.length) { tx = a.cam[0]; tz = a.cam[1]; if (dist2(a.x, a.z, tx, tz) < un(1.5) * un(1.5)) { a.cam.splice(0, 2); return; } }
  else {
    const [px, pz] = pontoDaRota(a);
    tx = un(px); tz = un(pz);
    if (dist2(a.x, a.z, tx, tz) < un(4) * un(4)) { a.wp++; return; }
  }
  let [vx, vz] = vetor(tx - a.x, tz - a.z, a.vel);
  // afastamento leve entre tropas do mesmo lado
  for (const b of e.ents) {
    if (b === a || b.tipo !== 'tropa' || b.lado !== a.lado || b.morto) continue;
    const ex = a.x - b.x, ez = a.z - b.z;
    if (Math.abs(ex) > 1300 || Math.abs(ez) > 1300) continue;
    const q = ex * ex + ez * ez;
    if (q < 1690000 && q > 0) { const [px, pz] = vetor(ex, ez, divi(a.vel, 2)); vx += px; vz += pz; }
  }
  const ax = a.x, az = a.z;
  mover(e, a, vx, vz);
  a.vx = a.x - ax; a.vz = a.z - az;
  a.fx = a.vx; a.fz = a.vz;
  // Preso num canto: pede um caminho de verdade.
  if (Math.abs(a.vx) + Math.abs(a.vz) < divi(a.vel, 3)) {
    if (++a.preso > 15) {
      a.preso = 0;
      const [px, pz] = pontoDaRota(a);
      a.cam = caminho(a.x, a.z, un(px), un(pz));
    }
  } else a.preso = 0;
}

// ---------- Torres, bases e pedras ----------
function passoTorre(e, t) {
  if (t.morto) return;
  const cfg = TORRE[t.nivel];
  if (t.cd > 0) t.cd--;
  if (t.atkT > 0) t.atkT--;
  // Prioridade: herói que acabou de atacar um herói aliado no alcance, depois tropas, depois heróis.
  let alvo = null, md = cfg.alcance + 1;
  let peso = 9;
  for (const a of e.ents) {
    if (a.lado === t.lado || a.morto) continue;
    if (a.tipo !== 'tropa' && a.tipo !== 'heroi') continue;
    if (a.tipo === 'heroi' && a.invul > 0) continue;
    const d = isqrt(dist2(a.x, a.z, t.x, t.z));
    if (d > cfg.alcance) continue;
    const p = a.tipo === 'heroi' ? (a.agro > e.tick ? 0 : 2) : 1;
    if (p < peso || (p === peso && d < md)) { peso = p; md = d; alvo = a; }
  }
  t.ativo = alvo ? 1 : 0;
  t.acorda = alvo ? Math.min(ACORDAR, t.acorda + 1) : Math.max(0, t.acorda - 1);
  t.alvo = alvo ? alvo.id : 0;
  if (!alvo || t.cd > 0 || t.acorda < ACORDAR) return;
  t.cd = cfg.cd;
  t.atkT = seg(1);
  const dur = seg(0.7) + divi(isqrt(dist2(t.x, t.z, alvo.x, alvo.z)), 900); // 1 passo a cada 0,9 unidade de distância
  const lidera = seg(0.45);
  const px = alvo.x + (alvo.vx ?? 0) * lidera, pz = alvo.z + (alvo.vz ?? 0) * lidera;
  e.pedras.push({ x: px, z: pz, t: dur, de: t.id, lado: t.lado, dano: cfg.dano, danoTropa: cfg.danoTropa });
  e.eventos.push({ k: 'pedra', de: t.id, x: px, z: pz, dur, lado: t.lado });
}

function passoPedras(e) {
  for (let i = 0; i < e.pedras.length; i++) {
    const p = e.pedras[i];
    if (--p.t > 0) continue;
    e.eventos.push({ k: 'pedraCai', x: p.x, z: p.z, lado: p.lado });
    const fonte = pegar(e, p.de);
    for (const a of e.ents) {
      if (a.lado === p.lado || a.morto || (a.tipo !== 'heroi' && a.tipo !== 'tropa')) continue;
      const m = RAIO_PEDRA + divi(a.raio, 2);
      if (dist2(a.x, a.z, p.x, p.z) < m * m) ferir(e, a, a.tipo === 'heroi' ? p.dano : p.danoTropa, fonte, { empurra: un(0.4) });
    }
    e.pedras.splice(i--, 1);
  }
}

function passoAreas(e) {
  for (let i = 0; i < e.areas.length; i++) {
    const v = e.areas[i];
    v.t--; v.cada--;
    const fonte = pegar(e, v.de);
    for (const a of e.ents) {
      if (a.lado === v.lado || a.morto || (a.tipo !== 'heroi' && a.tipo !== 'tropa')) continue;
      if (a.tipo === 'heroi' && a.invul > 0) continue;
      const d2 = dist2(a.x, a.z, v.x, v.z);
      if (d2 > 360000 && d2 < SACI.e.raioPuxa * SACI.e.raioPuxa) {
        const [px, pz] = vetor(v.x - a.x, v.z - a.z, SACI.e.puxa);
        mover(e, a, px, pz);
      }
    }
    if (v.cada <= 0) {
      v.cada = SACI.e.cada;
      for (const a of e.ents) {
        if (a.lado === v.lado || a.morto || (a.tipo !== 'heroi' && a.tipo !== 'tropa')) continue;
        if (distBorda(a, { x: v.x, z: v.z, raio: 0 }) - a.raio < SACI.e.raioDano) ferir(e, a, SACI.e.dano, fonte);
      }
    }
    if (v.t <= 0) e.areas.splice(i--, 1);
  }
}

// ---------- O passo da partida ----------
// comandos: lista de { j, c, ... }. Vale a ordem por jogador, para qualquer ordem de chegada dar o mesmo resultado.
export function passo(e, comandos = []) {
  e.eventos = [];
  if (e.fim) return e;
  e.tick++;
  if (e.ondas && e.tick >= e.proxOnda) { e.proxOnda += INTERVALO_ONDA; novaOnda(e); }
  const ordem = comandos.map((c, i) => [c, i]).sort((a, b) => (a[0].j - b[0].j) || (a[1] - b[1]));
  for (const [c] of ordem) aplicar(e, c);
  for (const a of e.ents) if (a.tipo === 'heroi' && a.bot && !a.morto) for (const c of decidirBot(e, a)) aplicar(e, c);
  for (const a of e.ents) {
    if (e.fim) break;
    if (a.tipo === 'heroi') passoHeroi(e, a);
    else if (a.tipo === 'tropa' && !a.morto) passoTropa(e, a);
    else if (a.tipo === 'torre' || a.tipo === 'base') passoTorre(e, a);
  }
  passoPedras(e);
  passoAreas(e);
  // Tropas mortas saem da lista no fim do passo, para ninguém mudar a lista durante a varredura.
  let alguem = false;
  for (const a of e.ents) if (a.morto && a.tipo === 'tropa') { alguem = true; break; }
  if (alguem) e.ents = e.ents.filter((a) => !(a.morto && a.tipo === 'tropa'));
  return e;
}

// ---------- Impressão digital da partida ----------
export function hashEstado(e) {
  let h = 0x811c9dc5 | 0;
  const num = (n) => {
    h = Math.imul(h ^ (n & 0xffff), 16777619);
    h = Math.imul(h ^ ((n / 65536) | 0) & 0xffff, 16777619);
  };
  const txt = (s) => { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); };
  const anda = (v) => {
    if (v === null || v === undefined) { num(-1); return; }
    if (typeof v === 'number') { num(v); return; }
    if (typeof v === 'string') { txt(v); return; }
    if (Array.isArray(v)) { num(v.length); for (const x of v) anda(x); return; }
    for (const k of Object.keys(v).sort()) { txt(k); anda(v[k]); }
  };
  const { eventos: _ignora, ...resto } = e;
  anda(resto);
  return h >>> 0;
}


