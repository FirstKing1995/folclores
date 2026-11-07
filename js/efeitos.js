// Partículas, anéis no chão, tornados e números de dano, todos reaproveitados em pool.
import * as THREE from 'three';

const _o = new THREE.Object3D(), _c = new THREE.Color(), _v = new THREE.Vector3();

export class Efeitos {
  constructor(cena, camada, nivel) {
    this.camada = camada;
    this.t = 0;

    // estilhaços facetados
    const N = nivel === 'baixa' ? 90 : 200;
    this.nE = N;
    const geo = new THREE.TetrahedronGeometry(1, 0);
    this.est = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), N);
    this.est.frustumCulled = false;
    this.est.setColorAt(0, _c.set('#ffffff'));
    cena.add(this.est);
    this.pE = [];
    for (let i = 0; i < N; i++) {
      this.pE.push({ vida: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0, rot: 0, vr: 0, chao: 0 });
      _o.scale.setScalar(0); _o.updateMatrix(); this.est.setMatrixAt(i, _o.matrix);
    }
    this.iE = 0;

    // brilhos aditivos
    const M = nivel === 'baixa' ? 220 : 480;
    this.nB = M;
    this.posB = new Float32Array(M * 3);
    this.corB = new Float32Array(M * 3);
    this.tamB = new Float32Array(M);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.posB, 3));
    g.setAttribute('aCor', new THREE.BufferAttribute(this.corB, 3));
    g.setAttribute('aTam', new THREE.BufferAttribute(this.tamB, 1));
    this.uEsc = { value: 700 };
    this.brilhos = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uEsc: this.uEsc },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aCor; attribute float aTam; varying vec3 vC; uniform float uEsc;
        void main(){ vC=aCor; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aTam*uEsc/-mv.z; }`,
      fragmentShader: `varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=pow(max(0.,1.-d),1.8); if(a<.01) discard; gl_FragColor=vec4(vC*a,a); }`,
    }));
    this.brilhos.frustumCulled = false;
    cena.add(this.brilhos);
    this.pB = [];
    for (let i = 0; i < M; i++) this.pB.push({ vida: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, r: 1, g: 1, b: 1 });
    this.iB = 0;

    // anéis no chão
    this.aneis = [];
    const geoAnel = new THREE.RingGeometry(0.86, 1, 40);
    geoAnel.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geoAnel, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false;
      cena.add(m);
      this.aneis.push({ m, vida: 0, max: 1, raio: 1 });
    }

    // tornados
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const c2 = cv.getContext('2d');
    c2.fillStyle = '#000'; c2.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      c2.strokeStyle = `rgba(255,255,255,${0.2 + (i % 4) * 0.2})`;
      c2.lineWidth = 2 + (i % 5) * 2;
      const y = (i / 26) * 256 - 64;
      for (const ox of [-128, 0, 128]) { c2.beginPath(); c2.moveTo(ox, y); c2.bezierCurveTo(ox + 40, y - 18, ox + 90, y - 26, ox + 128, y - 62); c2.stroke(); }
    }
    const texT = new THREE.CanvasTexture(cv);
    texT.wrapS = texT.wrapT = THREE.RepeatWrapping;
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.22 + Math.pow(t, 1.7) * 1.25, t * 3.4)); }
    const geoT = new THREE.LatheGeometry(pts, 16);
    this.tornados = [];
    for (let i = 0; i < 3; i++) {
      const tx = texT.clone();
      tx.repeat.set(2, 1);
      const mat = new THREE.MeshBasicMaterial({ map: tx, color: '#d9fff0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(geoT, mat);
      m.visible = false;
      cena.add(m);
      this.tornados.push({ m, mat, tx, vida: 0, max: 1, esc: 1, x: 0, z: 0, y: 0 });
    }

    // números flutuantes
    this.nums = [];
    for (let i = 0; i < 18; i++) {
      const e = document.createElement('div');
      e.className = 'num';
      camada.appendChild(e);
      this.nums.push({ e, vida: 0, x: 0, y: 0, z: 0 });
    }
    this.iN = 0;
  }

  estilhacos(x, y, z, cor, n = 10, forca = 6, tam = 0.14) {
    for (let k = 0; k < n; k++) {
      const p = this.pE[this.iE];
      const a = Math.random() * 6.283, h = forca * (0.35 + Math.random() * 0.75);
      p.vida = 0.55 + Math.random() * 0.7;
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * h; p.vz = Math.sin(a) * h; p.vy = forca * (0.5 + Math.random() * 0.8);
      p.s = tam * (0.5 + Math.random() * 1.1); p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 16;
      p.chao = y - 3;
      this.est.setColorAt(this.iE, _c.set(cor));
      this.iE = (this.iE + 1) % this.nE;
    }
    this.est.instanceColor.needsUpdate = true;
  }

  brilho(x, y, z, cor, n = 8, o = {}) {
    _c.set(cor);
    const r = _c.r, g = _c.g, b = _c.b;
    for (let k = 0; k < n; k++) {
      const p = this.pB[this.iB];
      const a = Math.random() * 6.283, h = (o.vel ?? 2) * Math.random();
      p.max = p.vida = (o.vida ?? 0.6) * (0.65 + Math.random() * 0.7);
      p.x = x + (o.disp ?? 0) * (Math.random() - 0.5);
      p.y = y + (o.disp ?? 0) * 0.4 * (Math.random() - 0.5);
      p.z = z + (o.disp ?? 0) * (Math.random() - 0.5);
      p.vx = Math.cos(a) * h; p.vz = Math.sin(a) * h; p.vy = (o.sobe ?? 1) * (0.5 + Math.random());
      p.s = (o.tam ?? 0.8) * (0.6 + Math.random() * 0.8);
      p.r = r * (o.forca ?? 1); p.g = g * (o.forca ?? 1); p.b = b * (o.forca ?? 1);
      this.iB = (this.iB + 1) % this.nB;
    }
  }

  anel(x, y, z, raio, cor, dur = 0.45) {
    const a = this.aneis.find((q) => q.vida <= 0) ?? this.aneis[0];
    a.vida = a.max = dur; a.raio = raio;
    a.m.position.set(x, y + 0.08, z);
    a.m.material.color.set(cor);
    a.m.visible = true;
  }

  tornado(x, y, z, dur, esc, cor = '#d9fff0') {
    const t = this.tornados.find((q) => q.vida <= 0) ?? this.tornados[0];
    t.vida = t.max = dur; t.esc = esc; t.x = x; t.z = z; t.y = y;
    t.mat.color.set(cor);
    t.m.visible = true;
    return t;
  }

  numero(x, y, z, txt, classe = '') {
    const n = this.nums[this.iN];
    this.iN = (this.iN + 1) % this.nums.length;
    n.vida = 0.85; n.x = x; n.y = y; n.z = z;
    n.e.textContent = txt;
    n.e.className = 'num ' + classe;
    n.e.style.opacity = 1;
    n.e.style.display = 'block';
  }

  atualizar(dt, camera, largura, altura) {
    this.t += dt;
    // estilhaços
    let mudou = false;
    for (let i = 0; i < this.nE; i++) {
      const p = this.pE[i];
      if (p.vida <= 0) continue;
      p.vida -= dt;
      p.vy -= 22 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
      if (p.y < p.chao) { p.y = p.chao; p.vy *= -0.3; p.vx *= 0.5; p.vz *= 0.5; }
      _o.position.set(p.x, p.y, p.z);
      _o.rotation.set(p.rot, p.rot * 0.7, 0);
      _o.scale.setScalar(p.vida <= 0 ? 0 : p.s * Math.min(1, p.vida * 3));
      _o.updateMatrix();
      this.est.setMatrixAt(i, _o.matrix);
      mudou = true;
    }
    if (mudou) this.est.instanceMatrix.needsUpdate = true;

    // brilhos
    for (let i = 0; i < this.nB; i++) {
      const p = this.pB[i], o = i * 3;
      if (p.vida <= 0) { this.tamB[i] = 0; continue; }
      p.vida -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const f = Math.max(0, p.vida / p.max);
      this.posB[o] = p.x; this.posB[o + 1] = p.y; this.posB[o + 2] = p.z;
      this.corB[o] = p.r * f; this.corB[o + 1] = p.g * f; this.corB[o + 2] = p.b * f;
      this.tamB[i] = p.s * (0.5 + f * 0.5);
    }
    const a = this.brilhos.geometry.attributes;
    a.position.needsUpdate = a.aCor.needsUpdate = a.aTam.needsUpdate = true;
    this.uEsc.value = altura * 1.9;

    for (const q of this.aneis) {
      if (q.vida <= 0) continue;
      q.vida -= dt;
      const t = 1 - Math.max(0, q.vida) / q.max;
      q.m.scale.setScalar(q.raio * (0.35 + t * 0.65));
      q.m.material.opacity = (1 - t) * 0.95;
      if (q.vida <= 0) q.m.visible = false;
    }
    for (const q of this.tornados) {
      if (q.vida <= 0) continue;
      q.vida -= dt;
      const t = 1 - Math.max(0, q.vida) / q.max;
      const abre = Math.min(1, t * 6) * Math.min(1, (1 - t) * 5);
      q.m.position.set(q.x, q.y, q.z);
      q.m.rotation.y += dt * 11;
      q.m.scale.set(q.esc * abre, q.esc * (0.6 + abre * 0.4), q.esc * abre);
      q.tx.offset.y -= dt * 1.6;
      q.mat.opacity = abre * 0.42;
      if (q.vida <= 0) q.m.visible = false;
    }
    for (const n of this.nums) {
      if (n.vida <= 0) continue;
      n.vida -= dt;
      n.y += dt * 2.2;
      _v.set(n.x, n.y, n.z).project(camera);
      n.e.style.transform = `translate(${((_v.x + 1) / 2 * largura).toFixed(1)}px,${((1 - _v.y) / 2 * altura).toFixed(1)}px) translate(-50%,-50%)`;
      n.e.style.opacity = Math.min(1, n.vida * 3);
      if (n.vida <= 0) n.e.style.display = 'none';
    }
  }
}
