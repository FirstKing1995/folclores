// Carrega os modelos CC0 e monta o kit de natureza e os personagens animados.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { lisa, fundir, F, tronco, matPintado } from './util.js';

const leitor = new GLTFLoader();
leitor.setMeshoptDecoder(MeshoptDecoder);
// Os GLB vêm quantizados; as partes do kit precisam de números reais para receber a matriz do modelo.
function emFloat(geo) {
  for (const nome of ['position', 'normal', 'uv']) {
    const a = geo.attributes[nome];
    if (!a) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) f[i * a.itemSize + k] = a.getComponent(i, k);
    geo.setAttribute(nome, new THREE.BufferAttribute(f, a.itemSize));
  }
  return geo;
}
const carregar = (n) => leitor.loadAsync(`modelos/${n}.glb`);

export async function carregarAtivos() {
  const [natureza, saci, tropaM, tropaF, anim] = await Promise.all(['natureza', 'saci_corpo', 'tropa_m', 'tropa_f', 'animacoes'].map(carregar));

  // natureza: cada cena vira uma lista de partes já na posição do modelo
  const kit = {};
  for (const cena of natureza.scenes) {
    cena.updateMatrixWorld(true);
    const partes = [];
    const caixa = new THREE.Box3();
    cena.traverse((o) => {
      if (!o.isMesh) return;
      const geo = emFloat(o.geometry.clone()).applyMatrix4(o.matrixWorld);
      geo.computeBoundingBox();
      caixa.union(geo.boundingBox);
      partes.push({ geo, mat: o.material });
    });
    kit[cena.name] = { partes, altura: Math.max(0.01, caixa.max.y - caixa.min.y), raio: Math.max(caixa.max.x - caixa.min.x, caixa.max.z - caixa.min.z) / 2 };
  }

  // animações: sem deslocamento de ossos, para servirem em qualquer proporção de corpo
  const clipes = {};
  for (const c of anim.animations) {
    const k = c.clone();
    k.tracks = k.tracks.filter((t) => !t.name.endsWith('.scale') && (!t.name.endsWith('.position') || t.name.startsWith('pelvis')));
    clipes[c.name] = k;
  }
  return { kit, clipes, saci, tropaM, tropaF };
}

// Copia o personagem trocando o material por um mais leve e dividindo a cor do clarão de dano.
function montar(gltf, opc = {}) {
  const raizModelo = clonarEsqueleto(gltf.scene);
  const mats = [];
  const clarao = new THREE.Color(0, 0, 0);
  raizModelo.traverse((o) => {
    if (!o.isMesh) return;
    const nomeMat = o.material.name;
    const m = new THREE.MeshLambertMaterial({ map: o.material.map, alphaTest: o.material.alphaTest || 0, transparent: false, side: o.material.side });
    m.name = nomeMat;
    m.emissive = clarao;
    if (opc.tinta && /Ranger/.test(nomeMat)) m.color.set(opc.tinta);
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * .26;
        totalEmissiveRadiance += vec3(1.,.88,.68) * pow(1. - abs(normalize(vNormal).z), 3.) * .06;`);
    };
    m.customProgramCacheKey = () => 'personagem';
    o.material = m;
    o.castShadow = !!opc.sombra;
    o.frustumCulled = false;
    mats.push(m);
  });
  const osso = {};
  raizModelo.traverse((o) => { if (o.isBone) osso[o.name] = o; });
  return { raizModelo, mats, clarao, osso };
}

function controlador(raiz, clipes) {
  const mixer = new THREE.AnimationMixer(raiz);
  const acoes = {};
  let atual = null;
  const tocar = (nome, { uma = false, veloc = 1, fade = 0.14 } = {}) => {
    const c = clipes[nome];
    if (!c) return;
    const a = acoes[nome] ?? (acoes[nome] = mixer.clipAction(c));
    if (uma) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.reset(); }
    a.timeScale = veloc;
    if (atual === a && !uma) return;
    a.enabled = true;
    if (!uma) a.reset();
    a.setEffectiveWeight(1);
    a.play();
    if (atual && atual !== a) a.crossFadeFrom(atual, fade, false);
    atual = a;
  };
  return { mixer, tocar };
}

// Anexa um objeto a um osso mantendo os eixos do mundo na pose de repouso.
function presoAoOsso(osso, raiz, objeto, local = [0, 0, 0]) {
  raiz.updateMatrixWorld(true);
  const q = new THREE.Quaternion(), e = new THREE.Vector3();
  osso.getWorldQuaternion(q);
  osso.getWorldScale(e);
  const g = new THREE.Group();
  g.quaternion.copy(q).invert();
  const f = raiz.scale.x; // o objeto usa as medidas do modelo, em metros
  g.scale.set(f / e.x, f / e.y, f / e.z);
  objeto.position.set(...local);
  g.add(objeto);
  osso.add(g);
  return g;
}

// Gira um osso num eixo do personagem (X direita, Z frente), sem depender dos eixos locais do esqueleto.
const X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);
const _qPai = new THREE.Quaternion(), _qInv = new THREE.Quaternion(), _qRef = new THREE.Quaternion(), _qDelta = new THREE.Quaternion(), _eixo = new THREE.Vector3();
function girarNoCorpo(osso, eixo, ang, ref) {
  if (!osso) return;
  ref.getWorldQuaternion(_qRef);
  osso.parent.getWorldQuaternion(_qPai);
  _eixo.copy(eixo).applyQuaternion(_qRef);
  _qDelta.setFromAxisAngle(_eixo, ang);
  _qInv.copy(_qPai).invert();
  osso.quaternion.premultiply(_qDelta.premultiply(_qInv).multiply(_qPai));
}

// ---------- Saci ----------
export function criarSaciFinal(ativos, lado = 'mata') {
  const { raizModelo, mats, clarao, osso } = montar(ativos.saci, { sombra: true });
  const raiz = new THREE.Group(), corpo = new THREE.Group();
  raiz.add(corpo);
  corpo.add(raizModelo);
  raizModelo.scale.setScalar(2.05);

  // o gorro, tingido com a mesma família do calção
  const pintado = matPintado();
  pintado.emissive = clarao;
  // gorro vermelho para a Mata e gorro de brasa para o Sertão: identifica o time de longe
  const sertao = lado === 'sertao';
  const verm = sertao ? '#e88a1e' : '#d3271c', esc = sertao ? '#8c4a10' : '#7c1311', claro = sertao ? '#ffc04a' : '#f0482c', ouro = '#e0b34a';
  const gorro = new THREE.Mesh(fundir([
    lisa(tronco(0.1, 0.122, 0.09, 14), verm, { base: esc, topo: claro, p: [0, 0.025, -0.008] }),
    lisa(tronco(0.07, 0.1, 0.09, 12), verm, { topo: claro, p: [-0.006, 0.098, -0.03], r: [-0.42, 0, 0.14] }),
    lisa(tronco(0.04, 0.07, 0.1, 10), verm, { p: [-0.024, 0.145, -0.1], r: [-1.25, 0, 0.3] }),
    lisa(F.cone, claro, { base: verm, p: [-0.04, 0.125, -0.19], r: [-2.15, 0, 0.4], s: [0.04, 0.13, 0.04] }),
    lisa(new THREE.TorusGeometry(0.114, 0.015, 7, 18), ouro, { base: '#8f6d24', p: [0, -0.012, -0.004], r: [1.5, 0, 0] }),
  ]), pintado);
  gorro.castShadow = true;
  presoAoOsso(osso.Head, raizModelo, gorro, [0, 0.17, 0.005]);
  mats.push(pintado);

  // Perna única: a esquerda encurta só no comprimento e fica toda dentro do calção.
  if (osso.thigh_l && osso.calf_l) {
    const p = osso.calf_l.position;
    const m = [Math.abs(p.x), Math.abs(p.y), Math.abs(p.z)];
    const eixo = m.indexOf(Math.max(...m));
    osso.thigh_l.scale.setComponent(eixo, 0.28);
    osso.calf_l.scale.setScalar(0.02);
  }

  const { mixer, tocar } = controlador(raizModelo, ativos.clipes);
  tocar('Idle_Loop');
  // Traz o único pé para baixo do centro do corpo.
  raiz.updateMatrixWorld(true);
  raizModelo.position.x = -new THREE.Vector3().setFromMatrixPosition(osso.foot_r.matrixWorld).x;
  // Salto em uma perna, por cima da pose de repouso: agacha no chão, estica ao subir.
  let peso = 0; // 0 parado, 1 saltando: suaviza a entrada e a saída do salto
  const agir = (o, eixo, ang) => girarNoCorpo(o, eixo, ang, corpo);
  const atualizar = (a, dt) => {
    a.fase += dt * (a.andando ? 10.5 : 2.6);
    const pulo = Math.abs(Math.sin(a.fase));
    const atacando = a.atkT > 0;
    if (atacando) {
      if (!a.batendo) { a.batendo = true; a.lado2 = !a.lado2; tocar(a.lado2 ? 'Punch_Cross' : 'Punch_Jab', { uma: true, veloc: 2.2, fade: 0.06 }); }
    } else {
      a.batendo = false;
      if (a.girando > 0) tocar('Roll', { veloc: 1.5, fade: 0.05 });
      else tocar('Idle_Loop', { fade: 0.2 });
    }
    const alvoPeso = a.andando && !atacando && !(a.girando > 0) ? 1 : 0;
    peso += (alvoPeso - peso) * Math.min(1, dt * 12);
    const agacha = (1 - pulo) * (1 - pulo) * peso; // 1 no contato com o chão
    if (a.girando > 0) { corpo.rotation.y += dt * 26; corpo.position.y = 0.3; corpo.rotation.x = 0; corpo.scale.setScalar(1); }
    else {
      corpo.rotation.y *= Math.max(0, 1 - dt * 14);
      corpo.position.y = pulo * 0.62 * peso - agacha * 0.3;
      corpo.rotation.x += (0.12 * peso - corpo.rotation.x) * Math.min(1, dt * 12);
      corpo.scale.set(1 + agacha * 0.04, 1 + (pulo - 0.5) * 0.05 * peso, 1 + agacha * 0.04);
    }
    mixer.update(dt);
    if (peso > 0.01) {
      // joelho dobra no chão e estica no ar; o pé compensa para pousar plano
      const coxa = -(0.34 + agacha * 0.72) * peso;
      const canela = (0.16 + agacha * 1.35) * peso;
      agir(osso.thigh_r, X, coxa);
      agir(osso.calf_r, X, canela);
      agir(osso.foot_r, X, -(canela + coxa) * 0.8 - pulo * 0.35 * peso);
      // braços abrem para equilibrar e sobem com o impulso
      const abre = (0.5 + pulo * 0.5) * peso, vai = (pulo - 0.5) * 0.7 * peso;
      agir(osso.upperarm_l, Z, abre);
      agir(osso.upperarm_r, Z, -abre);
      agir(osso.upperarm_l, X, -vai);
      agir(osso.upperarm_r, X, -vai);
    }
  };
  return { raiz, mat: { emissive: clarao, dispose() {} }, atualizar, altura: 4.5, mats };
}

// ---------- Tropas ----------
// sombra barata das tropas: um disco escuro, sem passar pelo mapa de sombras
const geoManchinha = new THREE.CircleGeometry(0.85, 16).rotateX(-Math.PI / 2).translate(0, 0.05, 0);
const matManchinha = new THREE.MeshBasicMaterial({ color: '#16261c', transparent: true, opacity: 0.32, depthWrite: false });
const TINTA = { mata: '#b8e096', sertao: '#ffb27a' };
export function criarTropaFinal(ativos, lado) {
  const fogo = lado === 'sertao';
  const { raizModelo, clarao, mats, osso } = montar(fogo ? ativos.tropaM : ativos.tropaF, { tinta: TINTA[lado] });
  const raiz = new THREE.Group();
  raiz.add(raizModelo);
  raizModelo.scale.setScalar(1.42);
  raiz.add(new THREE.Mesh(geoManchinha, matManchinha));
  const cor1 = fogo ? '#ffb040' : '#7dffb0', cor2 = fogo ? '#ffe58e' : '#d8ffe6', cor0 = fogo ? '#ff7a1a' : '#2fbf72';
  const lamina = new THREE.Mesh(fundir([
    lisa(F.caixa, cor1, { base: cor0, topo: cor2, p: [0, 0.36, 0], s: [0.06, 0.68, 0.02], var: 0.05 }),
    lisa(F.caixa, '#a77422', { p: [0, 0.01, 0], s: [0.17, 0.03, 0.05] }),
  ]), new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (osso.hand_r) presoAoOsso(osso.hand_r, raizModelo, lamina, [0.02, -0.02, 0.03]);
  const { mixer, tocar } = controlador(raizModelo, ativos.clipes);
  tocar('Sword_Idle');
  mixer.update(Math.random());
  const atualizar = (a, dt) => {
    if (a.atkT > 0) {
      if (!a.batendo) { a.batendo = true; tocar('Sword_Attack', { uma: true, veloc: 1.6, fade: 0.08 }); }
    } else {
      a.batendo = false;
      if (a.atordoado > 0) tocar('Hit_Chest', { fade: 0.08 });
      else if (a.andando) tocar('Jog_Fwd_Loop', { veloc: 0.85 });
      else tocar('Sword_Idle', { fade: 0.2 });
    }
    mixer.update(dt);
  };
  return { raiz, mat: { emissive: clarao, dispose() { for (const m of mats) m.dispose(); } }, atualizar, altura: 3 };
}
