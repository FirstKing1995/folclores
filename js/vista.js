// A partida na tela: cria e move os visuais a partir do estado da simulação.
// Nada aqui muda a partida; pode usar número quebrado e sorteio à vontade.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { alturaChao, TOCHAS } from './mundo.js';
import { criarGuardiao, criarBaseVis, geoRocha } from './atores.js';
import { criarSaciFinal, criarTropaFinal } from './ativos.js';
import { U, MS_TICK } from './sim/fixo.js';
import { protegida } from './sim/partida.js';

const MS = 1 / U;
const VISTA = 54; // além disso, nada é desenhado nem animado
const COR_IMPACTO = { tropa: { sertao: '#ff9a2b', mata: '#b7a489' }, torre: { mata: '#d9d6c4', sertao: '#d99c6c' }, base: { mata: '#d9d6c4', sertao: '#d99c6c' } };

export class Vista {
  constructor({ cena, camera, ativos, mundo, fx, jogadorJ, aoFalar }) {
    Object.assign(this, { cena, camera, ativos, mundo, fx, jogadorJ, aoFalar });
    this.reg = new Map(); // id da entidade -> registro visual
    this.pool = { mata: [], sertao: [] };
    this.alvoCam = new THREE.Vector3();
    this.tremor = 0;
    this.tochaAcum = 0;
    this.tempo = 0;
    this.criarBarras();
    this.criarPedras();
    this.criarAneis();
    for (const lado of ['mata', 'sertao']) for (let i = 0; i < 8; i++) this.pool[lado].push(this.novaTropaVis(lado));
  }

  // ---------- Barras de vida: um único desenho para todas ----------
  criarBarras() {
    const MAX = 96;
    const geo = new THREE.PlaneGeometry(1, 1);
    const fundo = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#16110d', depthTest: false, transparent: true }), MAX);
    const valor = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true }), MAX);
    fundo.frustumCulled = valor.frustumCulled = false;
    fundo.renderOrder = 10; valor.renderOrder = 11;
    fundo.count = valor.count = 0;
    valor.setColorAt(0, new THREE.Color('#ffffff'));
    this.cena.add(fundo, valor);
    this.barras = { fundo, valor, MAX, n: 0 };
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._dir = new THREE.Vector3(); this._c = new THREE.Color();
  }
  barra(x, y, z, lg, alt, f, cor) {
    const b = this.barras;
    if (b.n >= b.MAX) return;
    const borda = 0.12;
    this._p.set(x, y, z);
    this._s.set(lg + borda, alt + borda, 1);
    this._m.compose(this._p, this._q, this._s);
    b.fundo.setMatrixAt(b.n, this._m);
    // a parte cheia começa da esquerda, no eixo da câmera
    this._dir.set(1, 0, 0).applyQuaternion(this._q).multiplyScalar(-(lg * (1 - f)) / 2);
    this._p.add(this._dir);
    this._s.set(Math.max(0.001, lg * f), alt, 1);
    this._m.compose(this._p, this._q, this._s);
    b.valor.setMatrixAt(b.n, this._m);
    b.valor.setColorAt(b.n, this._c.set(cor));
    b.n++;
  }

  // ---------- Pedras arremessadas ----------
  criarPedras() {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.pedras = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(geoRocha, mat);
      m.visible = false; m.castShadow = true;
      this.cena.add(m);
      this.pedras.push({ m, ativa: false, t: 0, dur: 1, de: new THREE.Vector3(), para: new THREE.Vector3() });
    }
  }

  // Anéis fixos sob os heróis: mostram o time de cada um, e o do jogador é dourado.
  criarAneis() {
    this.geoAnel = new THREE.RingGeometry(0.82, 1.08, 28).rotateX(-Math.PI / 2);
  }

  // ---------- Visuais ----------
  novaTropaVis(lado) {
    const vis = criarTropaFinal(this.ativos, lado);
    vis.raiz.visible = false;
    this.cena.add(vis.raiz);
    return vis;
  }
  registrar(ent) {
    let vis;
    if (ent.tipo === 'heroi') {
      vis = criarSaciFinal(this.ativos, ent.lado);
      this.cena.add(vis.raiz);
      const eu = ent.j === this.jogadorJ;
      const anel = new THREE.Mesh(this.geoAnel, new THREE.MeshBasicMaterial({ color: eu ? '#ffd23f' : ent.lado === 'mata' ? '#59d36b' : '#f0552e', transparent: true, opacity: 0.85, depthWrite: false }));
      anel.position.y = 0.08;
      vis.raiz.add(anel);
    } else if (ent.tipo === 'tropa') {
      vis = this.pool[ent.lado].pop() ?? this.novaTropaVis(ent.lado);
      vis.raiz.scale.setScalar(ent.reforcada ? 1.22 : 1);
    } else if (ent.tipo === 'torre') {
      vis = criarGuardiao(ent.lado);
      vis.raiz.scale.setScalar(ent.nivel === 'interna' ? 0.92 : 0.8);
      vis.altura *= vis.raiz.scale.x;
      this.cena.add(vis.raiz);
    } else {
      vis = criarBaseVis(ent.lado);
      this.cena.add(vis.raiz);
    }
    // o guardião olha para o lado inimigo
    const rotInicial = ent.lado === 'mata' ? 2.35 : -0.78;
    const r = {
      ent, vis, x: ent.x * MS, z: ent.z * MS, ax: ent.x * MS, az: ent.z * MS, y: alturaChao(ent.x * MS, ent.z * MS),
      est: {
        lado: ent.lado, fase: Math.random() * 6, andando: false, atkT: 0, atkDur: ent.tipo === 'heroi' ? 0.26 : ent.tipo === 'tropa' ? 0.45 : 1.1,
        girando: 0, atordoado: 0, ativo: false, acordado: 0, rot: ent.tipo === 'tropa' || ent.tipo === 'heroi' ? rotInicial : rotInicial, flash: 0,
      },
      visivel: true,
    };
    this.reg.set(ent.id, r);
    return r;
  }
  soltar(id) {
    const r = this.reg.get(id);
    if (!r) return;
    this.reg.delete(id);
    if (r.ent.tipo === 'tropa') {
      r.vis.raiz.visible = false;
      r.vis.mat.emissive.setRGB(0, 0, 0);
      this.pool[r.ent.lado].push(r.vis);
    }
  }

  // ---------- Depois de cada passo da simulação ----------
  aposPasso(e) {
    const ax = this.alvoCam.x, az = this.alvoCam.z;
    for (const ent of e.ents) {
      let r = this.reg.get(ent.id);
      const x = ent.x * MS, z = ent.z * MS;
      const perto = Math.abs(x - ax) < VISTA && Math.abs(z - az) < VISTA;
      if (!r) {
        // tropa longe nem existe na tela; o resto existe sempre
        if (ent.tipo === 'tropa' && !perto) continue;
        r = this.registrar(ent);
      } else if (ent.tipo === 'tropa' && !perto) { this.soltar(ent.id); continue; }
      r.ent = ent;
      r.ax = r.x; r.az = r.z;
      r.nx = x; r.nz = z;
      const est = r.est;
      est.andando = (ent.vx ?? 0) !== 0 || (ent.vz ?? 0) !== 0;
      est.atordoado = ent.atordoado ?? 0;
      est.ativo = !!ent.ativo;
      if (ent.fx || ent.fz) est.alvoRot = Math.atan2(ent.fx, ent.fz);
      if (ent.dash) est.girando = 0.1;
    }
    for (const ev of e.eventos) this.evento(e, ev);
  }

  evento(e, ev) {
    const fx = this.fx;
    const noMundo = (x, z) => Math.abs(x * MS - this.alvoCam.x) < VISTA && Math.abs(z * MS - this.alvoCam.z) < VISTA;
    switch (ev.k) {
      case 'dano': {
        const r = this.reg.get(ev.id);
        if (!r || !noMundo(r.ent.x, r.ent.z)) break;
        r.est.flash = 1;
        const eu = r.ent.j === this.jogadorJ && r.ent.tipo === 'heroi';
        fx.numero(r.x, r.y + r.vis.altura, r.z, ev.v, eu ? 'contra' : ev.forte ? 'forte' : '');
        fx.estilhacos(r.x, r.y + r.vis.altura * 0.45, r.z, COR_IMPACTO[r.ent.tipo]?.[r.ent.lado] ?? '#ffd23f', ev.forte ? 9 : 4, 5);
        break;
      }
      case 'golpe': {
        const r = this.reg.get(ev.id);
        if (!r) break;
        r.est.atkT = r.est.atkDur;
        const a = ev.alvo ? this.reg.get(ev.alvo) : null;
        if (a) r.est.alvoRot = Math.atan2(a.ent.x - r.ent.x, a.ent.z - r.ent.z);
        if (r.ent.j === this.jogadorJ && a) { this.tremor = Math.max(this.tremor, 0.09); fx.brilho(a.x, a.y + 1.1, a.z, '#fff2cf', 7, { vel: 4, vida: 0.22, tam: 1 }); }
        break;
      }
      case 'golpeTropa': {
        const r = this.reg.get(ev.id);
        if (r) r.est.atkT = r.est.atkDur;
        break;
      }
      case 'q': {
        const r = this.reg.get(ev.id);
        if (!r) break;
        r.est.girando = 0.32;
        r.est.alvoRot = Math.atan2(ev.dx, ev.dz);
        if (noMundo(ev.x, ev.z)) {
          fx.tornado(r.x, r.y, r.z, 0.75, 0.7);
          fx.anel(r.x, r.y, r.z, 2.8, '#d9fff0', 0.35);
        }
        break;
      }
      case 'w': {
        const r = this.reg.get(ev.id);
        if (!r) break;
        r.est.atkT = r.est.atkDur;
        if (noMundo(ev.x, ev.z)) {
          fx.anel(r.x, r.y, r.z, 6.5, '#ff5b3a', 0.55);
          fx.anel(r.x, r.y, r.z, 4, '#ffd23f', 0.42);
          fx.brilho(r.x, r.y + 1, r.z, '#ff5b3a', 26, { vel: 8, vida: 0.6, tam: 0.9, sobe: 0.7 });
          this.tremor = Math.max(this.tremor, 0.3);
        }
        break;
      }
      case 'e': {
        if (!noMundo(ev.x, ev.z)) break;
        const x = ev.x * MS, z = ev.z * MS, y = alturaChao(x, z);
        fx.tornado(x, y, z, 3.4, 2.1);
        fx.anel(x, y, z, 7, '#d9fff0', 0.7);
        this.tremor = Math.max(this.tremor, 0.55);
        break;
      }
      case 'pedra': {
        const g = this.reg.get(ev.de);
        if (!g) break;
        g.est.atkT = g.est.atkDur;
        if (!noMundo(ev.x, ev.z)) break;
        const p = this.pedras.find((q) => !q.ativa);
        if (!p) break;
        const x = ev.x * MS, z = ev.z * MS, y = alturaChao(x, z);
        p.ativa = true; p.t = 0; p.dur = (ev.dur * MS_TICK) / 1000;
        p.de.set(g.x, g.y + g.vis.altura * 0.9, g.z);
        p.para.set(x, y, z);
        p.m.visible = true;
        fx.anel(x, y, z, 2.4, ev.lado === 'mata' ? '#7dffb0' : '#ff7a22', p.dur);
        break;
      }
      case 'pedraCai': {
        if (!noMundo(ev.x, ev.z)) break;
        const x = ev.x * MS, z = ev.z * MS, y = alturaChao(x, z);
        fx.estilhacos(x, y + 0.3, z, ev.lado === 'mata' ? '#d9d6c4' : '#d99c6c', 12, 8, 0.18);
        fx.brilho(x, y + 0.4, z, ev.lado === 'mata' ? '#7dffb0' : '#ff8a26', 10, { vel: 4, vida: 0.4, tam: 1.2 });
        this.tremor = Math.max(this.tremor, 0.22);
        break;
      }
      case 'morte': {
        const r = this.reg.get(ev.id);
        const longe = !noMundo(ev.x, ev.z);
        const x = ev.x * MS, z = ev.z * MS, y = alturaChao(x, z);
        if (ev.tipo === 'tropa') {
          if (!longe) {
            fx.estilhacos(x, y + 1, z, COR_IMPACTO.tropa[ev.lado], 12, 7, 0.17);
            fx.brilho(x, y + 1, z, ev.lado === 'sertao' ? '#ff8a26' : '#7dffb0', 10, { vel: 3, vida: 0.5, tam: 1 });
          }
          this.soltar(ev.id);
        } else if (ev.tipo === 'heroi') {
          if (r) r.vis.raiz.visible = false;
          if (!longe) fx.estilhacos(x, y + 1, z, '#e0271d', 20, 7);
        } else {
          if (!longe) {
            fx.estilhacos(x, y + 4, z, COR_IMPACTO.torre[ev.lado], 60, 13, 0.32);
            fx.brilho(x, y + 3, z, ev.lado === 'sertao' ? '#ff8a26' : '#7dffb0', 40, { vel: 6, vida: 1, tam: 2, disp: 2 });
            fx.anel(x, y, z, 10, '#fff2cf', 0.7);
            this.tremor = 1;
          }
          if (r) r.vis.raiz.visible = false;
          if (ev.tipo === 'base') for (const m of this.mundo.arvoresBase[ev.lado]) m.visible = false;
          this.aoFalar(ev);
        }
        if (ev.tipo === 'heroi') this.aoFalar(ev);
        break;
      }
      case 'renasce': {
        const r = this.reg.get(ev.id);
        if (r) { r.vis.raiz.visible = true; r.x = r.ax = r.nx = ev.x * MS; r.z = r.az = r.nz = ev.z * MS; }
        if (noMundo(ev.x, ev.z)) fx.anel(ev.x * MS, 0, ev.z * MS, 3.5, '#ffd23f');
        break;
      }
      default:
    }
  }

  // ---------- A cada quadro ----------
  quadro(dt, alfa, e, jogador) {
    this.tempo += dt;
    const fx = this.fx;
    // Interpola entre os dois últimos passos da simulação.
    for (const r of this.reg.values()) {
      if (r.nx === undefined) continue;
      r.x = lerp(r.ax, r.nx, alfa);
      r.z = lerp(r.az, r.nz, alfa);
    }
    // câmera
    const mx = this.reg.get(jogador.id);
    const cx = mx ? mx.x : jogador.x * MS, cz = mx ? mx.z : jogador.z * MS;
    this.alvoCam.x = lerp(this.alvoCam.x, cx, Math.min(1, dt * 4.5));
    this.alvoCam.z = lerp(this.alvoCam.z, cz, Math.min(1, dt * 4.5));

    this.camera.getWorldQuaternion(this._q);
    const b = this.barras;
    b.n = 0;
    for (const r of this.reg.values()) {
      const { ent, vis, est } = r;
      const dentro = Math.abs(r.x - this.alvoCam.x) < VISTA && Math.abs(r.z - this.alvoCam.z) < VISTA;
      vis.raiz.visible = dentro && !ent.morto;
      if (!vis.raiz.visible) continue;
      r.y = lerp(r.y, alturaChao(r.x, r.z), Math.min(1, dt * 14));
      vis.raiz.position.set(r.x, r.y, r.z);
      if (est.alvoRot !== undefined) {
        let d = est.alvoRot - est.rot;
        while (d > Math.PI) d -= 6.283;
        while (d < -Math.PI) d += 6.283;
        est.rot += d * Math.min(1, dt * 14);
      }
      if (ent.tipo === 'torre' || ent.tipo === 'heroi' || ent.tipo === 'tropa') vis.raiz.rotation.y = est.rot;
      if (ent.tipo === 'torre' && ent.alvo) {
        const a = this.reg.get(ent.alvo);
        if (a) est.alvoRot = Math.atan2(a.x - r.x, a.z - r.z);
      }
      if (est.atkT > 0) est.atkT = Math.max(0, est.atkT - dt);
      if (est.girando > 0) est.girando = Math.max(0, est.girando - dt);
      vis.atualizar(est, dt);
      if (est.flash > 0) {
        est.flash = Math.max(0, est.flash - dt * 7);
        const k = est.flash * (ent.tipo === 'torre' || ent.tipo === 'base' ? 0.3 : 0.75); // estrutura grande só pisca de leve
        vis.mat.emissive.setRGB(k, k * 0.85, k * 0.65);
      }
      // barra
      const f = clamp(ent.vida / ent.vidaMax, 0, 1);
      let cor;
      if (ent.tipo === 'heroi') cor = ent.j === this.jogadorJ ? '#ffd23f' : ent.lado === jogador.lado ? '#59d36b' : '#f0552e';
      else cor = ent.lado === jogador.lado ? '#59d36b' : '#f0552e';
      const estrutura = ent.tipo === 'torre' || ent.tipo === 'base';
      if (estrutura && ent.lado !== jogador.lado && protegida(e, ent)) cor = '#8e8e86';
      const lg = ent.tipo === 'heroi' ? 2.1 : ent.tipo === 'tropa' ? 1.25 : ent.tipo === 'torre' ? 4.2 : 7;
      const al = ent.tipo === 'heroi' ? 0.24 : ent.tipo === 'tropa' ? 0.15 : 0.3;
      this.barra(r.x, r.y + vis.altura + 0.3, r.z, lg, al, f, cor);
    }
    b.fundo.count = b.valor.count = b.n;
    b.fundo.instanceMatrix.needsUpdate = b.valor.instanceMatrix.needsUpdate = true;
    if (b.valor.instanceColor) b.valor.instanceColor.needsUpdate = true;

    // pedras no ar
    for (const p of this.pedras) {
      if (!p.ativa) continue;
      p.t += dt;
      const t = Math.min(1, p.t / p.dur);
      p.m.position.lerpVectors(p.de, p.para, t);
      p.m.position.y += Math.sin(t * Math.PI) * 4.5;
      p.m.rotation.x += dt * 7; p.m.rotation.z += dt * 5;
      if (t >= 1) { p.ativa = false; p.m.visible = false; }
    }

    // ventania em curso
    for (const v of e.areas) {
      if (Math.random() < dt * 30) {
        const x = v.x * MS, z = v.z * MS;
        fx.brilho(x, alturaChao(x, z) + Math.random() * 4, z, '#d9fff0', 1, { vel: 3.5, vida: 0.5, tam: 0.6, disp: 2.2 });
      }
    }

    // chama das lanternas perto do jogador
    this.tochaAcum += dt;
    const passo = this.mundo.nivel.mascara <= 512 ? 0.09 : 0.05;
    while (this.tochaAcum > passo) {
      this.tochaAcum -= passo;
      const [x, z] = TOCHAS[Math.floor(Math.random() * TOCHAS.length)];
      if (Math.abs(x - this.alvoCam.x) > 32 || Math.abs(z - this.alvoCam.z) > 28) continue;
      const y = alturaChao(x, z);
      fx.brilho(x + 0.62, y + 1.92, z, '#ff8f2c', 1, { vel: 0.1, vida: 0.5, tam: 1.05 * this.mundo.brilhoChama, sobe: 0.15, disp: 0.12 });
      fx.brilho(x + 0.62, y + 1.92, z, '#ffd98a', 1, { vel: 0.05, vida: 0.32, tam: 0.42, sobe: 0.1, disp: 0.08 });
    }
  }
}
