// O mapa da partida: rotas, torres, bases, obstáculos e caminhos. Só inteiros.
// Coordenadas em unidades; x cresce para a direita da tela e z para baixo. A Mata fica embaixo à esquerda.
// O lado Sertão é a Mata girada 180 graus em torno do centro: as duas metades são iguais.
import { U, un, divi } from './fixo.js';

export const MEIO_MAPA = 100; // o mapa vai de -100 a 100
const LIMITE = 92; // borda até onde dá para andar
const CEL = 2; // tamanho da célula da grade, em unidades
export const N = MEIO_MAPA; // células por lado (200 / 2)

const girar = ([x, z]) => [-x, -z];

export const BASES = { mata: [-76, 76], sertao: [76, -76] };
export const FONTES = { mata: [-86, 86], sertao: [86, -86] };
export const RAIO_FONTE = 15;

// Rotas sempre descritas da Mata para o Sertão.
const SERRA = [[-76, 76], [-82, 34], [-82, -50], [-74, -74], [-50, -82], [34, -82], [76, -76]];
const RIO = [[-76, 76], [-40, 40], [0, 0], [40, -40], [76, -76]];
const MANGUE = SERRA.map(girar).reverse();
export const ROTAS = { serra: SERRA, rio: RIO, mangue: MANGUE };
export const NOMES_ROTA = ['serra', 'rio', 'mangue'];

// Torres da Mata por rota, da externa para a interna. As do Sertão são giradas, e a rota muda de lado.
const TORRES_MATA = { serra: [[-82, -22], [-82, 34]], rio: [[-20, 20], [-42, 42]], mangue: [[22, 82], [-34, 82]] };
const ESPELHO = { serra: 'mangue', rio: 'rio', mangue: 'serra' };
export const TORRES = {
  mata: TORRES_MATA,
  sertao: { serra: TORRES_MATA.mangue.map(girar), rio: TORRES_MATA.rio.map(girar), mangue: TORRES_MATA.serra.map(girar) },
};
export { ESPELHO };

// Mata fechada: elipses [x, z, raio x, raio z] no lado da Mata, parte de cima.
// Cada uma vale em quatro lugares: original, espelhada na diagonal entre as bases e as duas giradas.
const MOITAS = [[-64, 16, 8, 17], [-40, 18, 12, 8], [-60, -20, 8, 10], [-36, -8, 10, 7], [-52, -40, 7, 6], [-26, -38, 6, 7]];
const espelhoDiag = ([x, z, rx, rz]) => [-z, -x, rz, rx];
const girarM = ([x, z, rx, rz]) => [-x, -z, rx, rz];
export const OBSTACULOS = MOITAS.flatMap((m) => {
  const d = espelhoDiag(m);
  return [m, d, girarM(m), girarM(d)];
});

const dSeg2 = (px, pz, a, b) => {
  const vx = b[0] - a[0], vz = b[1] - a[1], wx = px - a[0], wz = pz - a[1];
  const c = vx * wx + vz * wz, l = vx * vx + vz * vz;
  const t = Math.max(0, Math.min(l, c));
  const qx = wx - (vx * t) / l, qz = wz - (vz * t) / l;
  return qx * qx + qz * qz;
};
export const LARGURA_ROTA = 5;

// ---------- Grade de passagem ----------
const grade = new Uint8Array(N * N);
const indice = (i, j) => j * N + i;
for (let j = 0; j < N; j++) {
  for (let i = 0; i < N; i++) {
    const x = -MEIO_MAPA + CEL * i + 1, z = -MEIO_MAPA + CEL * j + 1;
    let bloq = Math.abs(x) > LIMITE || Math.abs(z) > LIMITE;
    for (const [cx, cz, rx, rz] of OBSTACULOS) {
      const dx = x - cx, dz = z - cz;
      if (dx * dx * rz * rz + dz * dz * rx * rx <= rx * rx * rz * rz) bloq = true;
    }
    if (bloq && Math.abs(x) <= LIMITE && Math.abs(z) <= LIMITE) {
      // as rotas nunca ficam bloqueadas
      for (const nome of NOMES_ROTA) {
        const r = ROTAS[nome];
        for (let k = 0; k + 1 < r.length; k++) if (dSeg2(x, z, r[k], r[k + 1]) <= LARGURA_ROTA * LARGURA_ROTA) bloq = false;
      }
    }
    grade[indice(i, j)] = bloq ? 1 : 0;
  }
}

const celula = (v) => Math.floor((v + MEIO_MAPA * U) / (CEL * U));
const celLivre = (i, j) => i >= 0 && j >= 0 && i < N && j < N && grade[indice(i, j)] === 0;
export const livre = (x, z) => celLivre(celula(x), celula(z)); // x e z em milésimos
const centro = (i) => (-MEIO_MAPA + CEL * i + 1) * U;

// Célula livre mais próxima, procurando em anéis.
function celulaLivrePerto(i, j) {
  if (celLivre(i, j)) return [i, j];
  for (let r = 1; r < N; r++) {
    for (let d = -r; d <= r; d++) {
      for (const [a, b] of [[i + d, j - r], [i + d, j + r], [i - r, j + d], [i + r, j + d]]) if (celLivre(a, b)) return [a, b];
    }
  }
  return [divi(N, 2), divi(N, 2)];
}

// Linha reta sem passar por célula bloqueada (milésimos).
export function retaLivre(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, m = Math.max(Math.abs(dx), Math.abs(dz));
  const passos = divi(m, CEL * U >> 1) + 1;
  for (let k = 0; k <= passos; k++) {
    if (!livre(ax + divi(dx * k, passos), az + divi(dz * k, passos))) return false;
  }
  return true;
}

// ---------- A* com desempate estável ----------
const custoG = new Int32Array(N * N), veioDe = new Int32Array(N * N), marca = new Int32Array(N * N);
let rodada = 0;
const VIZ = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];
const heapF = [], heapN = [];
function hPor(f, n) {
  let i = heapF.length;
  heapF.push(f); heapN.push(n);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapF[p] < f || (heapF[p] === f && heapN[p] <= n)) break;
    heapF[i] = heapF[p]; heapN[i] = heapN[p];
    i = p;
  }
  heapF[i] = f; heapN[i] = n;
}
function hTira() {
  const topo = heapN[0], f = heapF.pop(), n = heapN.pop();
  const t = heapF.length;
  if (t > 0) {
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= t) break;
      if (c + 1 < t && (heapF[c + 1] < heapF[c] || (heapF[c + 1] === heapF[c] && heapN[c + 1] < heapN[c]))) c++;
      if (f < heapF[c] || (f === heapF[c] && n <= heapN[c])) break;
      heapF[i] = heapF[c]; heapN[i] = heapN[c];
      i = c;
    }
    heapF[i] = f; heapN[i] = n;
  }
  return topo;
}

// Caminho em milésimos: lista plana [x1, z1, x2, z2...] até o destino; vazia quando já está lá.
export function caminho(ax, az, bx, bz) {
  if (retaLivre(ax, az, bx, bz)) return [bx, bz];
  const [ai, aj] = celulaLivrePerto(celula(ax), celula(az));
  const [bi, bj] = celulaLivrePerto(celula(bx), celula(bz));
  const ini = indice(ai, aj), fim = indice(bi, bj);
  rodada++;
  heapF.length = 0; heapN.length = 0;
  custoG[ini] = 0; veioDe[ini] = -1; marca[ini] = rodada;
  const h = (i, j) => { const dx = Math.abs(i - bi), dz = Math.abs(j - bj); return 10 * (dx + dz) - 6 * Math.min(dx, dz); };
  hPor(h(ai, aj), ini);
  let achou = ini === fim;
  while (heapF.length && !achou) {
    const n = hTira();
    if (n === fim) { achou = true; break; }
    const j = Math.floor(n / N), i = n - j * N, g = custoG[n];
    for (const [di, dj, c] of VIZ) {
      const a = i + di, b = j + dj;
      if (!celLivre(a, b)) continue;
      if (di && dj && (!celLivre(i + di, j) || !celLivre(i, j + dj))) continue;
      const v = indice(a, b), ng = g + c;
      if (marca[v] === rodada && custoG[v] <= ng) continue;
      marca[v] = rodada; custoG[v] = ng; veioDe[v] = n;
      hPor(ng + h(a, b), v);
    }
  }
  if (!achou) return [];
  const celulas = [];
  for (let n = fim; n !== -1; n = veioDe[n]) celulas.push(n);
  celulas.reverse();
  // puxa o fio: guarda só os pontos onde a reta deixa de ser livre
  const saida = [];
  let px = ax, pz = az;
  let ult = null;
  for (const n of celulas) {
    const j = Math.floor(n / N), i = n - j * N, x = centro(i), z = centro(j);
    if (retaLivre(px, pz, x, z)) { ult = [x, z]; continue; }
    if (ult) { saida.push(ult[0], ult[1]); px = ult[0]; pz = ult[1]; }
    ult = [x, z];
  }
  if (retaLivre(px, pz, bx, bz)) saida.push(bx, bz);
  else { if (ult) saida.push(ult[0], ult[1]); }
  return saida;
}

export const emMilesimos = (lista) => lista.map(([x, z]) => [un(x), un(z)]);
