// Texturas pintadas por pinceladas em canvas, emendáveis nas bordas.
import * as THREE from 'three';
import { sorteio } from './util.js';

function tela(t) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = t;
  return [cv, cv.getContext('2d')];
}
function paraTextura(cv, srgb = true, repetir = true, aniso = 4) {
  const tx = new THREE.CanvasTexture(cv);
  if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
  if (repetir) tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  tx.anisotropy = aniso;
  return tx;
}
// Repete o desenho nas bordas para a textura emendar sem costura.
function emendado(t, x, y, margem, fn) {
  for (const ox of [-t, 0, t]) {
    if (x + ox < -margem || x + ox > t + margem) continue;
    for (const oy of [-t, 0, t]) {
      if (y + oy < -margem || y + oy > t + margem) continue;
      fn(x + ox, y + oy);
    }
  }
}
function pincel(ctx, t, x, y, rx, ry, rot, cor, alfa) {
  ctx.fillStyle = cor;
  ctx.globalAlpha = alfa;
  emendado(t, x, y, Math.max(rx, ry) + 2, (px, py) => {
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, rot, 0, 6.283);
    ctx.fill();
  });
}
const de = (r, lista) => lista[Math.floor(r() * lista.length)];

function grama(t) {
  const [cv, c] = tela(t), r = sorteio(11), k = t / 512;
  c.fillStyle = '#7f9a3a';
  c.fillRect(0, 0, t, t);
  for (let i = 0; i < 90; i++) pincel(c, t, r() * t, r() * t, (40 + r() * 80) * k, (24 + r() * 50) * k, r() * 3, de(r, ['#8ea343', '#76923a', '#a0ad48', '#7f9a3d', '#b0b84f']), 0.28);
  for (let i = 0; i < 2600; i++) {
    const e = (5 + r() * 12) * k;
    pincel(c, t, r() * t, r() * t, e, (1.1 + r() * 1.5) * k, -1.57 + (r() - 0.5) * 1.5, de(r, ['#94ab46', '#7d9a3c', '#6c8b36', '#a9b850', '#66863a', '#9aae48', '#bcc25c']), 0.42);
  }
  c.globalAlpha = 1;
  return paraTextura(cv);
}
function terra(t) {
  const [cv, c] = tela(t), r = sorteio(12), k = t / 512;
  c.fillStyle = '#8f6434';
  c.fillRect(0, 0, t, t);
  for (let i = 0; i < 130; i++) pincel(c, t, r() * t, r() * t, (25 + r() * 60) * k, (15 + r() * 36) * k, r() * 3, de(r, ['#a4763c', '#7a522b', '#b5853f', '#6c4726', '#98703a']), 0.34);
  for (let i = 0; i < 1500; i++) pincel(c, t, r() * t, r() * t, (2 + r() * 7) * k, (1 + r() * 2.5) * k, r() * 3, de(r, ['#c49a55', '#5e3f22', '#a57b43', '#7f5a30']), 0.5);
  for (let i = 0; i < 110; i++) {
    const x = r() * t, y = r() * t, q = (2.5 + r() * 5) * k;
    pincel(c, t, x + q * 0.3, y + q * 0.4, q, q * 0.75, 0, '#3f2a17', 0.55);
    pincel(c, t, x, y, q, q * 0.75, 0, de(r, ['#b9a68a', '#a08c72', '#c7b698']), 0.95);
  }
  c.globalAlpha = 1;
  return paraTextura(cv);
}
function calcamento(t) {
  const [cv, c] = tela(t), r = sorteio(13), k = t / 512;
  c.fillStyle = '#4d4438';
  c.fillRect(0, 0, t, t);
  const n = 11, passo = t / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5 + (j % 2) * 0.5) * passo + (r() - 0.5) * passo * 0.25, y = (j + 0.5) * passo + (r() - 0.5) * passo * 0.25;
    const q = passo * (0.42 + r() * 0.1), rot = r() * 3;
    const tom = de(r, ['#b0a48f', '#9e917b', '#c2b59d', '#8f8676', '#a89c8a', '#b5a38a']);
    pincel(c, t, x + 2 * k, y + 3 * k, q, q * 0.84, rot, '#2c261f', 0.75);
    pincel(c, t, x, y, q, q * 0.84, rot, tom, 1);
    pincel(c, t, x - q * 0.2, y - q * 0.24, q * 0.55, q * 0.38, rot, '#e0d6c0', 0.34);
    pincel(c, t, x + q * 0.24, y + q * 0.3, q * 0.5, q * 0.3, rot, '#675d4e', 0.3);
  }
  c.globalAlpha = 1;
  return paraTextura(cv);
}
function pedra(t) {
  const [cv, c] = tela(t), r = sorteio(14), k = t / 512;
  c.fillStyle = '#9da3a8';
  c.fillRect(0, 0, t, t);
  for (let i = 0; i < 240; i++) pincel(c, t, r() * t, r() * t, (14 + r() * 54) * k, (8 + r() * 26) * k, r() * 3, de(r, ['#b0b6ba', '#868c91', '#c2c6c8', '#7a8186', '#a4a8a0', '#cdcec8']), 0.33);
  c.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    let x = r() * t, y = r() * t, a = r() * 6.28;
    c.strokeStyle = '#34393d';
    c.globalAlpha = 0.5 + r() * 0.35;
    c.lineWidth = (1.2 + r() * 2.4) * k;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 6; s++) { a += (r() - 0.5) * 1.1; x += Math.cos(a) * 22 * k; y += Math.sin(a) * 22 * k; c.lineTo(x, y); }
    c.stroke();
  }
  c.globalAlpha = 1;
  return paraTextura(cv);
}
function casca(t) {
  const [cv, c] = tela(t), r = sorteio(15), k = t / 512;
  c.fillStyle = '#6d4520';
  c.fillRect(0, 0, t, t);
  c.lineCap = 'round';
  for (let i = 0; i < 420; i++) {
    const x0 = r() * t, y0 = r() * t, compr = (60 + r() * 150) * k;
    const cor = de(r, ['#9c6a2c', '#c8913e', '#4d2f16', '#2f1b0c', '#7f5425', '#dba84e', '#3a2412']);
    c.strokeStyle = cor;
    c.globalAlpha = 0.55;
    c.lineWidth = (2 + r() * 7) * k;
    for (const ox of [-t, 0, t]) for (const oy of [-t, 0, t]) {
      c.beginPath();
      c.moveTo(x0 + ox, y0 + oy);
      c.quadraticCurveTo(x0 + ox + (r() - 0.5) * 18 * k, y0 + oy + compr / 2, x0 + ox + (r() - 0.5) * 12 * k, y0 + oy + compr);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  return paraTextura(cv);
}
function madeira(t) {
  const [cv, c] = tela(t), r = sorteio(16), k = t / 512;
  c.fillStyle = '#c9975a';
  c.fillRect(0, 0, t, t);
  c.lineCap = 'round';
  for (let i = 0; i < 300; i++) {
    const y = r() * t, x = r() * t, compr = (60 + r() * 180) * k;
    c.strokeStyle = de(r, ['#e0b06c', '#a97a44', '#ecc27f', '#8a6134', '#d3a05c']);
    c.globalAlpha = 0.5;
    c.lineWidth = (1 + r() * 4.5) * k;
    for (const ox of [-t, 0, t]) {
      c.beginPath();
      c.moveTo(x + ox, y);
      c.quadraticCurveTo(x + ox + compr / 2, y + (r() - 0.5) * 8 * k, x + ox + compr, y);
      c.stroke();
    }
  }
  c.globalAlpha = 1;
  return paraTextura(cv);
}
// Folhagem em tons de cinza: a cor vem de cada espécie. Os furos recortam a silhueta.
function folhas(t) {
  const [cv, c] = tela(t), r = sorteio(17), k = t / 512;
  c.clearRect(0, 0, t, t);
  c.fillStyle = 'rgba(190,190,180,0.02)';
  c.fillRect(0, 0, t, t);
  for (let i = 0; i < 26; i++) pincel(c, t, r() * t, r() * t, (28 + r() * 34) * k, (22 + r() * 26) * k, r() * 3, r() < 0.5 ? '#8e8e88' : '#d8d8c8', 1);
  for (let i = 0; i < 1500; i++) {
    const x = r() * t, y = r() * t, l = (9 + r() * 14) * k, rot = r() * 6.28;
    const v = 146 + Math.floor(r() * 109);
    pincel(c, t, x, y, l, l * 0.46, rot, `rgb(${v},${v},${Math.floor(v * 0.94)})`, 1);
    pincel(c, t, x - l * 0.2, y - l * 0.14, l * 0.46, l * 0.16, rot, `rgb(${Math.min(255, v + 45)},${Math.min(255, v + 45)},${v})`, 0.8);
  }
  c.globalAlpha = 1;
  return paraTextura(cv);
}
// Moita de capim: lâminas nascendo na base do quadro.
function capim(t) {
  const [cv, c] = tela(t), r = sorteio(18), k = t / 256;
  c.fillStyle = 'rgba(205,205,180,0.02)';
  c.fillRect(0, 0, t, t);
  c.lineCap = 'round';
  for (let i = 0; i < 74; i++) {
    const x = t * 0.12 + r() * t * 0.76, alto = t * (0.42 + r() * 0.54), curva = (r() - 0.5) * t * 0.34;
    const v = 150 + Math.floor(r() * 105);
    c.strokeStyle = `rgb(${v},${v},${Math.floor(v * 0.85)})`;
    c.lineWidth = (2.6 + r() * 3.4) * k;
    c.beginPath();
    c.moveTo(x, t);
    c.quadraticCurveTo(x + curva * 0.2, t - alto * 0.6, x + curva, t - alto);
    c.stroke();
  }
  return paraTextura(cv, true, false);
}

export function criarTexturas(qualidade) {
  const t = qualidade === 'baixa' ? 256 : 512;
  return {
    grama: grama(t), terra: terra(t), calcamento: calcamento(t), pedra: pedra(t),
    casca: casca(t), madeira: madeira(t), folhas: folhas(t), capim: capim(256),
  };
}
