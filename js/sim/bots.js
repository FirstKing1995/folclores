// Bots simples: usam os mesmos comandos de um jogador e só leem o estado da partida.
import { un, isqrt, dist2, vetor, sorteioAte } from './fixo.js';
import { BASES, FONTES, ROTAS } from './mapa.js';

const PENSA_CADA = 5;
const VIDA_RECUA = 30, VIDA_VOLTA = 80, VIDA_BRIGA = 45;
const ALCANCE_TORRE = un(15);

const d = (a, b) => isqrt(dist2(a.x, a.z, b.x, b.z));
const borda = (a, b) => d(a, b) - b.raio;

function irPara(a, x, z, cmds) {
  // só repete o pedido de caminho quando o destino mudou de verdade
  if (dist2(a.destBot[0], a.destBot[1], x, z) < un(4) * un(4) && (a.cam.length || dist2(a.x, a.z, x, z) < un(5) * un(5))) return;
  a.destBot = [x, z];
  cmds.push({ j: a.j, c: 'ir', x, z });
}

export function decidirBot(e, a) {
  if ((e.tick + a.pensa) % PENSA_CADA !== 0) return [];
  const cmds = [];
  const pct = Math.trunc((a.vida * 100) / a.vidaMax);
  const lado = a.lado;
  const [fx, fz] = FONTES[lado];

  if (pct < VIDA_RECUA) a.recua = 1;
  if (a.recua && pct >= VIDA_VOLTA) a.recua = 0;

  // Olha em volta uma vez só.
  let heroiPerto = null, dHeroi = un(10);
  let tropaPerto = null, vidaTropa = 1e9;
  let estrutura = null, dEst = un(10);
  let torreVizinha = null;
  let aliadasPerto = 0, inimigasPerto = 0;
  let frente = null, frenteMede = -1;
  const [bx, bz] = BASES[lado];
  for (const b of e.ents) {
    if (b.morto || b === a) continue;
    if (b.lado === lado) {
      if (b.tipo === 'tropa') {
        if (b.rota === a.rota) {
          const m = dist2(b.x, b.z, un(bx), un(bz));
          if (m > frenteMede) { frenteMede = m; frente = b; }
        }
        if (d(a, b) < un(14)) aliadasPerto++;
      }
      continue;
    }
    const q = d(a, b);
    if (b.tipo === 'heroi') {
      if (b.invul === 0 && q < dHeroi) { dHeroi = q; heroiPerto = b; }
    } else if (b.tipo === 'tropa') {
      if (q < un(12)) inimigasPerto++;
      if (q < un(9) && b.vida < vidaTropa) { vidaTropa = b.vida; tropaPerto = b; }
    } else {
      if (q < ALCANCE_TORRE) torreVizinha = b;
      const protegido = estruturaProtegida(e, b);
      if (!protegido && borda(a, b) < dEst) { dEst = borda(a, b); estrutura = b; }
    }
  }

  // Volta para a fonte quando apanhou demais.
  if (a.recua) {
    if (heroiPerto && a.cdQ === 0 && dHeroi < un(7)) {
      const [ux, uz] = vetor(un(fx) - a.x, un(fz) - a.z);
      cmds.push({ j: a.j, c: 'q', x: ux, z: uz });
    }
    irPara(a, un(fx), un(fz), cmds);
    return cmds;
  }

  // Sem tropa aliada segurando a torre, não fica no alcance dela.
  if (torreVizinha) {
    const tanque = aliadasPerto > 0 || torreVizinha.alvo !== a.id;
    if (!tanque || (torreVizinha.alvo === a.id && pct < 70)) {
      const [ux, uz] = vetor(a.x - torreVizinha.x, a.z - torreVizinha.z, un(20));
      irPara(a, torreVizinha.x + ux, torreVizinha.z + uz, cmds);
      return cmds;
    }
  }

  // Briga com herói se estiver em condição.
  if (heroiPerto && (pct >= VIDA_BRIGA || heroiPerto.vida < a.vida)) {
    const acerta = sorteioAte(e, 100) < 70; // erra de propósito às vezes: é bot, não máquina
    if (acerta && a.cdE === 0 && dHeroi < un(5)) cmds.push({ j: a.j, c: 'e', x: heroiPerto.x - a.x, z: heroiPerto.z - a.z });
    if (acerta && a.cdW === 0 && dHeroi < un(6)) cmds.push({ j: a.j, c: 'w' });
    if (acerta && a.cdQ === 0 && dHeroi > un(3) && dHeroi < un(8.5)) cmds.push({ j: a.j, c: 'q', x: heroiPerto.x - a.x, z: heroiPerto.z - a.z });
    if (a.alvo !== heroiPerto.id) cmds.push({ j: a.j, c: 'alvo', id: heroiPerto.id });
    return cmds;
  }

  if (a.cdW === 0 && inimigasPerto >= 3 && tropaPerto && d(a, tropaPerto) < un(5)) cmds.push({ j: a.j, c: 'w' });
  if (tropaPerto) {
    if (a.alvo !== tropaPerto.id) cmds.push({ j: a.j, c: 'alvo', id: tropaPerto.id });
    return cmds;
  }
  if (estrutura && dEst < un(8) && aliadasPerto > 0) {
    if (a.alvo !== estrutura.id) cmds.push({ j: a.j, c: 'alvo', id: estrutura.id });
    return cmds;
  }

  // Sem nada por perto: acompanha a frente das tropas da rota, um pouco atrás.
  if (frente) {
    const [ux, uz] = vetor(un(bx) - frente.x, un(bz) - frente.z, un(3));
    irPara(a, frente.x + ux, frente.z + uz, cmds);
  } else {
    // ninguém na rota ainda: espera no primeiro ponto dela
    const p = lado === 'mata' ? ROTAS[a.rota] : [...ROTAS[a.rota]].reverse();
    const [px, pz] = p[1];
    irPara(a, un(px), un(pz), cmds);
  }
  return cmds;
}

function estruturaProtegida(e, b) {
  if (b.tipo === 'base') {
    for (const t of e.ents) if (t.tipo === 'torre' && t.lado === b.lado && t.nivel === 'interna' && t.morto) return false;
    return true;
  }
  if (b.nivel === 'interna') {
    for (const t of e.ents) if (t.tipo === 'torre' && t.lado === b.lado && t.rota === b.rota && t.nivel === 'externa' && !t.morto) return true;
  }
  return false;
}


