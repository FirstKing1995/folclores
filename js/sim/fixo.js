// Matemática da simulação: tudo inteiro, para qualquer aparelho calcular a mesma partida.
// Soma, multiplicação, divisão e raiz são exatas em todos os motores; seno e potência não, e ficam de fora.

export const U = 1000; // 1 unidade de mapa = 1000 milésimos
export const TICKS_S = 20;
export const MS_TICK = 50;

export const seg = (s) => Math.round(s * TICKS_S); // segundos para passos
export const un = (v) => Math.round(v * U); // unidades para milésimos, só para constantes de dados

export const divi = (a, b) => Math.trunc(a / b);
export const isqrt = (n) => Math.floor(Math.sqrt(n));
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => isqrt(dist2(ax, az, bx, bz));

// Vetor com o comprimento pedido, na direção (dx, dz). Vetor nulo devolve [0, 0].
export function vetor(dx, dz, comp = U) {
  const d = isqrt(dx * dx + dz * dz);
  if (d === 0) return [0, 0];
  return [divi(dx * comp, d), divi(dz * comp, d)];
}

// Sorteio com semente (mulberry32). O estado fica na própria partida, em e.rng.
export function sortear(e) {
  e.rng = (e.rng + 0x6D2B79F5) | 0;
  let t = e.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}
export const sorteioAte = (e, n) => sortear(e) % n; // de 0 até n - 1
