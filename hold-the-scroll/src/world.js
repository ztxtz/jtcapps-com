// The Hold the Scroll world: a still lake at dawn, a storm of app tiles that the
// scroll whips up and the brake freezes, a phone with the real shield, rule
// screens for each rule, a glass dome and the sprout.
// Everything is a pure function of the chapter position `u` (0..7) plus idle
// time, so scrolling back up replays the film in reverse.
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function roundedSlab(w, h, r, depth, bevel = 0.03, seg = 6) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: seg });
  g.center();
  g.computeVertexNormals();
  return g;
}

function tintSlabEdges(geometry, sideTint) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = [];
  for (let i = 0; i < positions.count; i++) {
    const face = smooth(0.45, 0.96, Math.abs(normals.getZ(i)));
    const shade = 0.94 + 0.06 * smooth(-0.24, 0.24, positions.getY(i));
    colors.push(mix(sideTint.r, 1, face) * shade, mix(sideTint.g, 1, face) * shade, mix(sideTint.b, 1, face) * shade);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

// ---------------------------------------------------------------- shaders
const SKY_VERT = /* glsl */`
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = /* glsl */`
uniform vec3 uCenter, uSunDir, uZenith, uUpper, uMid, uHorizon, uGlow, uCloud;
uniform float uHalo, uZenithA, uZenithB, uTime, uClouds;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vWorld - uCenter);
  float y = d.y;
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.09, y));
  col = mix(col, uUpper, smoothstep(0.05, 0.24, y));
  col = mix(col, uZenith, smoothstep(uZenithA, uZenithB, y));
  col = mix(col, uHorizon * 0.97, smoothstep(0.0, -0.2, y));
  float c = max(dot(d, uSunDir), 0.0);
  // long, thin clouds in the lower sky, warm where the sun lights them from behind
  if (y > 0.0 && uClouds > 0.0) {
    vec2 q = d.xz / (y + 0.06);
    float n = fbm(vec2(q.x * 0.22 + uTime * 0.004, q.y * 1.4));
    float band = smoothstep(0.015, 0.07, y) * (1.0 - smoothstep(0.22, 0.42, y));
    float dens = smoothstep(0.52, 0.78, n) * band * uClouds;
    vec3 cloud = mix(uCloud, vec3(1.0, 0.95, 0.88), pow(c, 3.0));
    col = mix(col, cloud, dens * 0.55);
  }
  col += uGlow * (pow(c, 9.0) * 0.32 + pow(c, 90.0) * 0.55);
  col = mix(col, vec3(1.0, 0.97, 0.9) * 1.25, smoothstep(0.9993, 0.9997, c));
  // the arc from the app icon, a thin halo above the sun
  float ang = acos(clamp(dot(d, uSunDir), -1.0, 1.0));
  float ring = exp(-pow((ang - 0.38) / 0.0035, 2.0)) * smoothstep(-0.02, 0.06, d.y - uSunDir.y);
  col += vec3(1.0, 0.96, 0.9) * ring * uHalo;
  gl_FragColor = vec4(col, 1.0);
}`;

const DAWN = /* glsl */`
uniform sampler2D tDawn;
uniform vec3 uSunDir;
uniform float uHalo, uHaloWidth;
vec3 dawn(vec3 ray, float haloStrength) {
  float azimuth = atan(ray.x, -ray.z);
  float altitude = asin(clamp(ray.y, -1.0, 1.0));
  float sunAltitude = asin(uSunDir.y);
  vec2 uv = vec2(0.5 + azimuth * 0.64, 0.37 + (altitude - sunAltitude) * 1.23);
  vec3 col = texture2D(tDawn, uv).rgb;
  // The icon's warm arc has a defined core and a softer, much dimmer edge.
  vec2 ring = vec2(azimuth / uHaloWidth, (altitude - sunAltitude + 0.035) / 0.254);
  float radius = length(ring);
  float d = abs(radius - 1.0);
  float aa = max(fwidth(radius), 0.001);
  float arc = (1.0 - smoothstep(0.006, 0.006 + aa, d)) * 0.78 + exp(-d * 92.0) * 0.22;
  float lift = smoothstep(-0.01, 0.18, ring.y);
  return mix(col, vec3(1.0, 0.83, 0.59), arc * lift * uHalo * haloStrength);
}`;

const RIDGE_FRAG = /* glsl */`
uniform vec3 uColor, uHaze;
uniform float uSeed, uRough, uMist;
varying vec2 vUv;
float h1(float n) { return fract(sin(n) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
float fbm(float x) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n1(x); x *= 2.03; a *= uRough; } return s; }
void main() {
  float h = 0.18 + 0.82 * pow(fbm(vUv.x * 7.0 + uSeed), 1.6);
  if (vUv.y > h) discard;
  float t = vUv.y / h;
  vec3 col = mix(uHaze, uColor, 0.35 + 0.65 * t);
  col = mix(col, uHaze, (1.0 - smoothstep(0.0, 0.45, t)) * uMist);
  col += smoothstep(0.9, 1.0, t) * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

const WATER_VERT = /* glsl */`
uniform mat4 uTexMat;
varying vec4 vRefl;
varying vec3 vWorld;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vRefl = uTexMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FRAG = /* glsl */`
uniform sampler2D tRefl;
uniform float uTime, uFogNear, uFogFar, uCalm, uReflect;
uniform vec3 uCam, uBody, uBodyFar, uHorizon;
#ifdef ARTWORK
${DAWN}
#else
uniform vec3 uSunDir;
#endif
uniform vec4 uRipples[24];
varying vec4 vRefl;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float t = uTime;
  vec2 g = vec2(0.0);
  float amp = mix(0.06, 0.018, uCalm);
  g += amp * vec2(cos(p.x * 0.9 + t * 0.7 + p.y * 0.3), sin(p.y * 1.1 - t * 0.6));
  g += amp * 0.6 * vec2(sin(p.x * 2.3 - p.y * 1.7 + t * 1.3), cos(p.y * 2.6 + p.x * 0.8 + t * 1.1));
  g += amp * 0.35 * vec2(cos(p.x * 5.1 + p.y * 3.3 - t * 1.9), sin(p.y * 4.7 - p.x * 2.1 + t * 2.1));
  for (int i = 0; i < 24; i++) {
    vec4 r = uRipples[i];
    float age = t - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 7.0) continue;
    vec2 dv = p - r.xy;
    float dist = length(dv) + 1e-4;
    float k = dist - age * 1.7;
    float env = exp(-k * k * 0.9) * exp(-age * 0.55) * r.w / (1.0 + dist * 0.35);
    g += (dv / dist) * cos(k * 6.0) * env * 0.22;
  }
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(uCam - vWorld);
  float fres = 0.12 + 0.88 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec4 rc = vRefl;
  rc.xy += n.xz * 0.9 * rc.w * 0.06;
  float dist = length(vWorld.xz - uCam.xz);
  vec3 body = mix(uBody, uBodyFar, smoothstep(8.0, 160.0, dist));
  vec3 h = normalize(uSunDir + v);
  #ifdef ARTWORK
  vec4 silhouettes = texture2DProj(tRefl, rc);
  // Use the same distant view as the sky. The small reflection buffer only
  // carries silhouettes of moving objects, so it never pixelates the shore.
  vec3 ray = reflect(-v, normalize(vec3(-g.x * 0.10, 1.0, -g.y * 0.37)));
  vec3 distant = dawn(ray, 0.11);
  // Fine ripples break up the sun's image and keep the reflection predominantly horizontal.
  float phase = p.y * 14.0 + sin(p.x * 0.86 + t) * 0.45 + t * 1.55;
  float wave = 0.5 + 0.5 * sin(phase);
  float detail = 1.0 - smoothstep(0.20, 2.6, fwidth(phase));
  float glare = smoothstep(0.93, 0.996, dot(ray, uSunDir));
  distant *= 1.0 - (1.0 - wave) * detail * glare * 0.52;
  vec3 reflected = silhouettes.rgb + distant * (1.0 - silhouettes.a);
  vec3 col = mix(body, reflected, 0.24 + fres * 0.68);
  float sun = max(dot(n, h), 0.0);
  float sheen = pow(sun, 140.0) * 0.11 + pow(sun, 730.0) * 0.49;
  col += vec3(1.0, 0.68, 0.34) * sheen;
  float crest = pow(wave, 7.0) * detail;
  col += vec3(0.22, 0.39, 0.53) * crest * (0.11 + sheen * 0.33);
  col = mix(col, distant, smoothstep(160.0, 460.0, dist) * 0.74);
  #else
  vec3 refl = texture2DProj(tRefl, rc).rgb;
  vec3 col = mix(body, refl, clamp((0.38 + fres * 0.75) * uReflect, 0.0, 0.94));
  col += pow(max(dot(n, h), 0.0), 520.0) * vec3(1.0, 0.9, 0.75) * 2.2;
  col = mix(col, uHorizon, smoothstep(uFogNear, uFogFar, dist) * 0.9);
  #endif
  gl_FragColor = vec4(col, 1.0);
}`;

const SCREEN_VERT = /* glsl */`
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
void main() { vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const SCREEN_FRAG = /* glsl */`
#include <clipping_planes_pars_fragment>
uniform sampler2D tA, tB;
uniform float uMix, uGlow;
uniform vec2 uSize;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  #include <clipping_planes_fragment>
  vec2 p = (vUv - 0.5) * uSize;
  float d = sdRound(p, uSize * 0.5, 0.19);
  if (d > 0.0) discard;
  vec3 col = mix(texture2D(tA, vUv, -0.7).rgb, texture2D(tB, vUv, -0.7).rgb, uMix);
  // Dynamic Island
  float isl = sdRound(p - vec2(0.0, uSize.y * 0.5 - 0.085), vec2(0.2, 0.05), 0.05);
  col = mix(col, vec3(0.0), 1.0 - smoothstep(0.0, 0.004, isl));
  col *= 1.0 + uGlow * 0.05;
  gl_FragColor = vec4(col, 1.0);
}`;

const DOME_VERT = /* glsl */`
#include <clipping_planes_pars_vertex>
varying vec3 vN; varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const DOME_FRAG = /* glsl */`
#include <clipping_planes_pars_fragment>
uniform vec3 uCam, uSunDir, uRim;
uniform float uOpacity;
varying vec3 vN; varying vec3 vWorld;
void main() {
  #include <clipping_planes_fragment>
  vec3 v = normalize(uCam - vWorld);
  float f = pow(1.0 - abs(dot(normalize(vN), v)), 3.0);
  vec3 col = mix(uRim, vec3(1.0, 0.75, 0.46), f * 0.46);
  float spec = pow(max(dot(reflect(-v, normalize(vN)), uSunDir), 0.0), 60.0);
  col += spec;
  gl_FragColor = vec4(col, (f * 0.50 + spec * 0.62 + 0.018) * uOpacity);
}`;

const POST_VERT = /* glsl */`
varying vec2 vUv;
#ifdef ARTWORK
uniform mat4 uCameraToWorld;
varying vec3 vRay;
#endif
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
  #ifdef ARTWORK
  vRay = (uCameraToWorld * vec4(position.xy, 1.0, 1.0)).xyz;
  #endif
}`;
const POST_FRAG = /* glsl */`
uniform sampler2D tScene;
uniform float uAberr, uTime, uDesat;
varying vec2 vUv;
#ifdef ARTWORK
${DAWN}
varying vec3 vRay;
#endif
#ifdef MOBILE_FILM
uniform sampler2D tTitle;
uniform vec2 uTitleOrigin;
uniform float uTitleScale, uTitleHeight, uVeil;
#else
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
#endif
void main() {
  vec2 c = vUv - 0.5;
  float d = dot(c, c);
  #ifdef ARTWORK
  vec4 foreground = texture2D(tScene, vUv);
  vec3 col = foreground.rgb;
  if (foreground.a < 0.999) col += dawn(normalize(vRay), 1.0) * (1.0 - foreground.a);
  #elif defined(MOBILE_FILM)
  vec3 col = texture2D(tScene, vUv).rgb;
  #else
  vec2 off = c * uAberr * (0.35 + d * 2.5);
  vec3 col = vec3(texture2D(tScene, vUv + off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - off).b);
  #endif
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(l), uDesat);
  col *= 1.0 - d * 0.32;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef MOBILE_FILM
  if (uVeil > 0.001) {
    vec2 titleUv = uTitleOrigin + (vUv - uTitleOrigin) / uTitleScale;
    titleUv.y = (titleUv.y - 0.5) / uTitleHeight + 0.5;
    float cutout = texture2D(tTitle, titleUv).a;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(249.0, 246.0, 240.0) / 255.0, uVeil * (1.0 - cutout));
  }
  #else
  gl_FragColor.rgb += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  #endif
}`;

const DISPLAY_FRAG = /* glsl */`
uniform sampler2D tA, tDepth;
uniform vec2 uSize, uDrawingSize;
varying vec2 vUv;
void main() {
  // Keep tiles and other foreground objects in front of the screen.
  float sceneDepth = texture2D(tDepth, gl_FragCoord.xy / uDrawingSize).r;
  if (gl_FragCoord.z > sceneDepth + 0.000025) discard;
  vec2 corner = abs((vUv - 0.5) * uSize) - uSize * 0.5 + 0.19;
  if (length(max(corner, 0.0)) + min(max(corner.x, corner.y), 0.0) > 0.19) discard;
  gl_FragColor = vec4(texture2D(tA, vUv).rgb, 1.0);
  #include <colorspace_fragment>
}`;

// ---------------------------------------------------------------- camera path
export const RULES_SHOT_START = 3.18;
export const RULES_SHOT_END = 5;

// [u, position, target]; keys sit where the chapter copy needs them.
const KEYS = [
  [0.00, [0, 3.4, 30], [0, 2.6, 0]],
  [0.50, [0, 3.3, 21], [0, 2.6, 0]],
  [1.00, [-0.6, 3.1, 11.5], [-1.5, 2.65, 2]],
  [1.46, [2.1, 2.85, 7.3], [1.6, 2.7, 2]],
  [2.00, [2.0, 2.8, 7.6], [1.45, 2.6, 2]],
  [2.55, [-0.4, 2.5, 12.0], [-1.4, 2.0, 2]],
  [3.00, [3.5, 2.4, 8.5], [5.5, 2.3, -3]],
  [RULES_SHOT_START, [7.8, 2.5, 3.6], [7.8, 2.6, -4]],
  [5.55, [17, 15, 60], [14, 4, -2]],
  [6.05, [5, 7, 30], [0, 3, -10]],
  [6.50, [0, 1.6, 12.5], [0, 2.6, -20]],
  [7.00, [0, 1.3, 10.5], [0, 3.2, -20]],
];

const PORTRAIT_X = [[0.6, 0], [1.0, 1.5], [1.46, -1.75], [2.0, -1.6], [2.55, 1.0], [3.0, 0], [RULES_SHOT_START, 0.95], [RULES_SHOT_END, 0.95], [5.3, 0]];
function portraitShift(u) {
  if (u <= PORTRAIT_X[0][0] || u >= PORTRAIT_X[PORTRAIT_X.length - 1][0]) return 0;
  for (let i = 0; i < PORTRAIT_X.length - 1; i++) {
    const [a, va] = PORTRAIT_X[i], [b, vb] = PORTRAIT_X[i + 1];
    if (u <= b) { const t = (u - a) / (b - a); return va + (vb - va) * t * t * (3 - 2 * t); }
  }
  return 0;
}

export function rulesShotWeight(u) {
  return smooth(2.95, RULES_SHOT_START, u) * (1 - smooth(RULES_SHOT_END, 5.3, u));
}

// Scene palettes. 'app' matches the app's linen interior; 'logo' follows the app icon
// (teal sky and lake, apricot dawn, blue-grey ridges). 'logo' is the default; ?palette=app shows the other.
const PALETTES = {
  app: {
    horizon: '#F4E6D4', zenith: '#BFCFD9', mid: '#E7E6E1', glow: '#FFD9AE', below: '#D9D6CF',
    ridges: ['#D3DADB', '#C6CFD1', '#B8C4C7', '#AFBDC0', '#9BAEB0'], water: '#CCD5D2', waterFar: '#DDE2DE', hemiSky: '#FFF6EA', hemiGround: '#C5CFCB', sky: [0.12, 0.75], reflect: 1.0, upper: '#D6DDDF', cloud: '#F3EEE6', clouds: 0.5, mist: 0.5,
  },
  logo: {
    horizon: '#F4C8A4', zenith: '#4E7F97', mid: '#E6CDBA', glow: '#FFCF98', below: '#7E9FAE',
    water: '#315F75', waterFar: '#537E8E', hemiSky: '#F6F1EA', hemiGround: '#88A5B1', sky: [0.16, 0.55], reflect: 0.62, upper: '#86AAB7', cloud: '#E9D2C2', clouds: 0.8, mist: 0.75,
  },
};
const paletteName = new URLSearchParams(location.search).get('palette') === 'app' ? 'app' : 'logo';
const P = PALETTES[paletteName];

export async function createWorld(canvas, { mobile = false, title } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance', stencil: false });
  // Composite the landscape and the phone at display resolution. Only the
  // interactive geometry and its reflection use smaller buffers on iPhone.
  const displayRatio = Math.min(window.devicePixelRatio || 1, mobile ? 3 : 2);
  let pixelRatio = Math.min(displayRatio, mobile ? 1.25 : 2);
  renderer.setPixelRatio(displayRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const horizon = new THREE.Color(P.horizon);
  scene.fog = new THREE.Fog(horizon, 45, 300);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  const reflCam = new THREE.PerspectiveCamera();

  const camPos = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');
  const camTgt = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k[2])), false, 'centripetal');
  const keyU = KEYS.map((k) => k[0]);
  const heldKey = keyU.indexOf(RULES_SHOT_START);
  const curveT = (u) => {
    u = clamp(u, 0, keyU[keyU.length - 1]);
    let i = 0;
    while (i < keyU.length - 2 && u > keyU[i + 1]) i++;
    const start = i === heldKey ? RULES_SHOT_END : keyU[i];
    let f = clamp((u - start) / (keyU[i + 1] - start));
    // Ease to zero speed at both ends of the held camera shot.
    if (i === heldKey - 1) f = f + f * f * (1 - f);
    if (i === heldKey) f = f * f * (2 - f);
    return (i + f) / (keyU.length - 1);
  };

  // ---- sky
  const sunDir = new THREE.Vector3();
  const loader = new THREE.TextureLoader();
  const loadTex = async (url) => {
    const texture = await loader.loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  };
  const artwork = paletteName === 'logo';
  const dawnTexture = artwork ? loadTex('assets/dawn-panorama.webp') : Promise.resolve(null);
  const skyUniforms = {
    uCenter: { value: new THREE.Vector3() }, uSunDir: { value: sunDir },
    uZenith: { value: new THREE.Color(P.zenith) }, uMid: { value: new THREE.Color(P.mid) },
    uHorizon: { value: horizon.clone() }, uGlow: { value: new THREE.Color(P.glow) }, uHalo: { value: 0.35 }, uZenithA: { value: P.sky[0] }, uZenithB: { value: P.sky[1] }, uUpper: { value: new THREE.Color(P.upper) }, uCloud: { value: new THREE.Color(P.cloud) }, uClouds: { value: P.clouds }, uTime: { value: 0 },
  };
  const skyMat = new THREE.ShaderMaterial({ uniforms: skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  if (!artwork) scene.add(sky);

  const setSun = (elev) => sunDir.set(0, Math.sin(elev), -Math.cos(elev)).normalize();
  setSun(0.05);

  // ---- environment light from the same sky, so glossy objects reflect the dawn
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat.clone());
    envSky.material.uniforms = THREE.UniformsUtils.clone(skyUniforms);
    envSky.material.uniforms.uSunDir.value = new THREE.Vector3(0, 0.25, -1).normalize();
    envSky.material.uniforms.uHalo.value = 0;
    envScene.add(envSky);
    const below = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshBasicMaterial({ color: P.below }));
    below.rotation.x = -Math.PI / 2; below.position.y = -2;
    envScene.add(below);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 1200).texture;
    scene.environmentIntensity = 1.0;
    pmrem.dispose();
  }
  const hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#FFE9D2', 1.6);
  key.position.set(-8, 14, 12);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#FFD3A1', 1.4);
  rim.position.set(0, 4, -30);
  scene.add(rim);

  // ---- distant ridges, like the icon
  const ridges = artwork ? [] : [
    { z: -400, h: 86, seed: 3.1, rough: 0.5, w: 2600, mist: 0.2 },
    { z: -320, h: 66, seed: 11.7, rough: 0.52, w: 2200, mist: 0.35 },
    { z: -250, h: 46, seed: 27.3, rough: 0.48, w: 1800, mist: 0.5 },
    { z: -185, h: 30, seed: 41.9, rough: 0.5, w: 1400, mist: 0.65 },
    { z: -135, h: 17, seed: 58.2, rough: 0.55, w: 1100, mist: 0.8 },
  ].map((r, i) => ({ ...r, color: P.ridges[i], mist: r.mist * P.mist }));
  for (const r of ridges) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.h), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(r.color) }, uHaze: { value: horizon.clone() }, uSeed: { value: r.seed }, uRough: { value: r.rough }, uMist: { value: r.mist } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: RIDGE_FRAG,
    }));
    m.position.set(0, r.h / 2, r.z);
    scene.add(m);
  }

  // ---- render targets
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true };
  const mainRT = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, samples: mobile ? 0 : 4 });
  if (mobile) {
    mainRT.depthTexture = new THREE.DepthTexture(4, 4);
    mainRT.depthTexture.minFilter = mainRT.depthTexture.magFilter = THREE.NearestFilter;
  }
  const reflRT = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts });
  const texMat = new THREE.Matrix4();
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const waterClip = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.02)];

  // ---- water
  const ripples = Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, -99, 0));
  let rippleIdx = 0;
  const waterUniforms = {
    tRefl: { value: reflRT.texture }, uTexMat: { value: texMat }, uTime: { value: 0 }, uCalm: { value: 0 },
    uFogNear: { value: 60 }, uFogFar: { value: 420 }, uCam: { value: new THREE.Vector3() }, uSunDir: { value: sunDir },
    uBody: { value: new THREE.Color(P.water) }, uBodyFar: { value: new THREE.Color(P.waterFar) }, uReflect: { value: P.reflect }, uHorizon: { value: horizon.clone() }, uRipples: { value: ripples },
  };
  const dawnUniforms = { tDawn: { value: null }, uSunDir: skyUniforms.uSunDir, uHalo: skyUniforms.uHalo, uHaloWidth: { value: 0.34 } };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.ShaderMaterial({
    uniforms: artwork ? { ...waterUniforms, ...dawnUniforms } : waterUniforms,
    defines: artwork ? { ARTWORK: 1 } : {}, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
  }));
  water.rotation.x = -Math.PI / 2;
  scene.add(water);
  // ---- low mist drifting over the lake (two layers, faded near the camera)
  const MIST_FRAG = /* glsl */`
  uniform vec3 uColor, uCam;
  uniform float uTime, uOpacity, uScale;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }
  void main() {
    vec2 p = vWorld.xz * uScale + vec2(uTime * 0.02, uTime * 0.006);
    float n = smoothstep(0.42, 0.85, fbm(vec2(p.x * 0.6, p.y * 1.6)));
    float d = length(vWorld.xz - uCam.xz);
    float a = n * smoothstep(4.0, 16.0, d) * (1.0 - smoothstep(180.0, 420.0, d)) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }`;
  // The painted valley already carries its own mist and atmospheric depth.
  const mists = (artwork ? [] : mobile ? [[0.5, 0.045, 0.5]] : [[0.35, 0.05, 0.42], [1.3, 0.03, 0.26]]).map(([y, scale, opacity]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(paletteName === 'logo' ? '#F4E8DE' : '#FBF7F1') }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uOpacity: { value: opacity }, uScale: { value: scale } },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: MIST_FRAG, transparent: true, depthWrite: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 2;
    scene.add(m);
    return m;
  });

  // ---- dust in the light: a field of motes that wraps around the camera, so the
  // foreground always has something moving at a different speed than the hills
  const MOTE_COUNT = mobile ? 160 : 360;
  const motePos = new Float32Array(MOTE_COUNT * 3);
  const moteSeed = new Float32Array(MOTE_COUNT);
  const mr = rng(91);
  for (let i = 0; i < MOTE_COUNT; i++) {
    motePos[i * 3] = (mr() - 0.5) * 36; motePos[i * 3 + 1] = 0.4 + mr() * 7; motePos[i * 3 + 2] = (mr() - 0.5) * 36;
    moteSeed[i] = mr();
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('seed', new THREE.BufferAttribute(moteSeed, 1));
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float seed;
      uniform vec3 uCam; uniform float uTime, uPx;
      varying float vA;
      void main() {
        vec2 hw = vec2(18.0);
        vec3 p = position;
        p.x += sin(uTime * 0.21 + seed * 40.0) * 0.6 + uTime * 0.08;
        p.y += sin(uTime * 0.33 + seed * 17.0) * 0.25;
        p.xz = mod(p.xz - uCam.xz + hw, 36.0) - hw + uCam.xz;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        vA = smoothstep(1.2, 3.0, dist) * (1.0 - smoothstep(14.0, 20.0, dist)) * (0.35 + 0.65 * fract(seed * 7.3 + uTime * 0.05));
        gl_PointSize = (2.0 + seed * 3.5) * uPx * 6.0 / max(dist, 0.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() { float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r) * vA; gl_FragColor = vec4(1.0, 0.96, 0.88, a * 0.85); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.renderOrder = 3;
  scene.add(motes);

  const addRipple = (x, z, strength = 1) => { ripples[rippleIdx].set(x, z, waterUniforms.uTime.value, strength); rippleIdx = (rippleIdx + 1) % ripples.length; };

  // ---- tiles
  const N = mobile ? 70 : 140;
  const tileGeo = roundedSlab(0.62, 0.62, 0.145, 0.065, 0.027, 6);
  const sideTint = new THREE.Color('#B5C8CB');
  tintSlabEdges(tileGeo, sideTint);
  const tileFinish = { roughness: 0.37, metalness: 0.16, envMapIntensity: 0.68, vertexColors: true };
  const tileMat = mobile
    ? new THREE.MeshStandardMaterial(tileFinish)
    : new THREE.MeshPhysicalMaterial({ ...tileFinish, clearcoat: 0.42, clearcoatRoughness: 0.24 });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, N);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tiles.frustumCulled = false;
  scene.add(tiles);
  const palette = ['#729196', '#6D8B9A', '#90A5A2', '#A9B2A2', '#B5AA91', '#466F76', '#778D79', '#506C7A', '#C2A57D', '#A57A57', '#476D62', '#2F505E'];
  const weights = [6, 5, 5, 4, 4, 3, 3, 2, 2, 1.4, 1.2, 0.6];
  const rand = rng(7);
  const pick = () => { const tot = weights.reduce((a, b) => a + b); let r = rand() * tot; for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return palette[i]; } return palette[0]; };
  const T = [];
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const r = 2.3 + Math.pow(rand(), 0.75) * 9.5;
    let rx, rz;
    do { rx = (rand() - 0.5) * 34; rz = -9 + rand() * 19; } while (Math.abs(rx) < 2.2 && rz > -1 && rz < 6);
    T.push({
      r, h: 0.4 + rand() * 6.8, phase: rand() * Math.PI * 2, speed: (0.55 + rand() * 0.7) * 2.6 / Math.sqrt(r),
      wob: 0.3 + rand() * 0.7, spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(4),
      rest: new THREE.Vector3(rx, 0.06, rz), yaw: rand() * Math.PI * 2, delay: rand() * 0.38, scale: 0.75 + rand() * 0.55,
      landed: false, ripple: i % 3 === 0,
    });
    tiles.setColorAt(i, col.set(pick()));
  }
  tiles.instanceColor.needsUpdate = true;
  const vortex = new THREE.Vector3(0, 0, 2);

  // ---- hero tile (the one that reaches for the feed)
  const heroGeometry = roundedSlab(0.74, 0.74, 0.18, 0.085, 0.031, 9);
  tintSlabEdges(heroGeometry, sideTint);
  const hero = new THREE.Mesh(heroGeometry, new THREE.MeshPhysicalMaterial({ ...tileFinish, color: '#3E7568', clearcoat: 0.58, clearcoatRoughness: 0.22, emissive: '#49746A', emissiveIntensity: 0 }));
  scene.add(hero);
  let heroLanded = false;

  // ---- phone
  // Review captures and the labeled Insights sample from the app design preview.
  const SCREEN_NAMES = ['today-before', 'shield', 'today-after', 'rule-schedule', 'rule-limits', 'rule-places', 'insights-heatmap'];
  const [panorama, ...screenTex] = await Promise.all([dawnTexture, ...SCREEN_NAMES.map((n) => loadTex(`assets/screens/phone-${n}.webp`))]);
  dawnUniforms.tDawn.value = panorama;
  // [start, end, to]: the screen cross-fades to `to` between start and end of the film
  const SCREEN_CUTS = [[1.40, 1.46, 1], [2.40, 2.55, 2], [3.10, 3.20, 3], [3.45, 3.50, 4], [3.72, 3.78, 5], [4.00, 4.12, 6]];
  const phone = new THREE.Group();
  const body = new THREE.Mesh(roundedSlab(1.42, 2.94, 0.24, 0.1, 0.04, 10), new THREE.MeshPhysicalMaterial({ color: '#DCD6CC', metalness: 0.65, roughness: 0.3, clearcoat: 0.6 }));
  phone.add(body);
  const glass = new THREE.Mesh(roundedSlab(1.36, 2.88, 0.21, 0.004, 0, 10), new THREE.MeshBasicMaterial({ color: '#0E1216' }));
  glass.position.z = 0.092;
  phone.add(glass);
  const screenSize = new THREE.Vector2(1.3, 2.82);
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { tA: { value: screenTex[0] }, tB: { value: screenTex[0] }, uMix: { value: 0 }, uGlow: { value: 0 }, uSize: { value: screenSize } },
    vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, clipping: true,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenSize.x, screenSize.y), screenMat);
  screen.position.z = 0.097;
  phone.add(screen);
  phone.position.set(0, -4, 2);
  scene.add(phone);

  // Draw the same screen plane at display resolution after compositing the lake.
  const drawingSize = new THREE.Vector2();
  const displayScene = mobile ? new THREE.Scene() : null;
  const display = mobile ? new THREE.Mesh(screen.geometry, new THREE.ShaderMaterial({
    uniforms: { tA: screenMat.uniforms.tA,
      uSize: screenMat.uniforms.uSize, tDepth: { value: mainRT.depthTexture }, uDrawingSize: { value: drawingSize } },
    vertexShader: SCREEN_VERT, fragmentShader: DISPLAY_FRAG, depthTest: false, depthWrite: false, toneMapped: false,
  })) : null;
  if (display) {
    display.matrixAutoUpdate = false;
    displayScene.add(display);
  }

  // ---- glass dome: the whole world stays inside
  const domeCenter = new THREE.Vector3(14, 0, -1);
  const domeMat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uSunDir: { value: sunDir }, uRim: { value: new THREE.Color('#8FA7A6') }, uOpacity: { value: 0 } },
    vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, transparent: true, depthWrite: false, clipping: true,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(31, mobile ? 64 : 96, mobile ? 32 : 48), domeMat);
  dome.position.copy(domeCenter);
  scene.add(dome);
  const domeRing = new THREE.Mesh(new THREE.RingGeometry(30.85, 31.03, 128), new THREE.MeshBasicMaterial({ color: '#E3BC8B', transparent: true, opacity: 0, depthWrite: false }));
  domeRing.rotation.x = -Math.PI / 2;
  domeRing.position.set(domeCenter.x, 0.03, domeCenter.z);
  scene.add(domeRing);

  // ---- the sprout from the logo
  const sprout = new THREE.Group();
  {
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.55, -0.04, 1.15, 0.28, 1.36, 1.07);
    leafShape.bezierCurveTo(0.73, 1.02, 0.15, 0.71, 0, 0);
    const lg = new THREE.ExtrudeGeometry(leafShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 3, curveSegments: 32 });
    // A warm edge and a light-to-honey gradient, like backlit leaves in the icon.
    const colors = [];
    const positions = lg.getAttribute('position');
    const ivory = new THREE.Color('#FFECC6');
    const honey = new THREE.Color('#C88F51');
    const edge = new THREE.Color('#FFF3CC');
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const vein = Math.exp(-Math.abs(y - (x * 0.57 + x * x * 0.16)) * 88);
      const shade = smooth(0.08, 0.85, y * 0.67 + x * 0.24);
      const color = honey.clone().lerp(ivory, 0.3 + shade * 0.63)
        .lerp(edge, Math.max(vein * 0.5, smooth(0.04, 0.057, z) * 0.65));
      colors.push(color.r, color.g, color.b);
    }
    lg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const lm = new THREE.MeshBasicMaterial({ vertexColors: true });
    const L = new THREE.Mesh(lg, lm);
    const R = new THREE.Mesh(lg, lm);
    R.scale.set(-0.85, 0.77, 1);
    L.rotation.y = 0.12; R.rotation.y = -0.16;
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -1.55, 0), new THREE.Vector3(-0.037, -0.8, 0), new THREE.Vector3(0, 0.08, 0.005),
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 22, 0.038, 10, false), new THREE.MeshBasicMaterial({ color: '#FFF0CA' }));
    sprout.add(L, R, stem);
  }
  sprout.position.set(0, -2, -3);
  scene.add(sprout);

  // ---- post
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const cameraToWorld = new THREE.Matrix4();
  const postMat = new THREE.ShaderMaterial({
    uniforms: { tScene: { value: mainRT.texture }, uAberr: { value: 0 }, uTime: { value: 0 }, uDesat: { value: 0 },
      uCameraToWorld: { value: cameraToWorld }, ...dawnUniforms },
    defines: { ...(mobile ? { MOBILE_FILM: 1 } : {}), ...(artwork ? { ARTWORK: 1 } : {}) },
    vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false, toneMapped: true,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  if (title) {
    const texture = new THREE.CanvasTexture(title.canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    Object.assign(postMat.uniforms, {
      tTitle: { value: texture }, uTitleOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      uTitleScale: { value: 1 }, uTitleHeight: { value: 1 }, uVeil: { value: 0 },
    });
  }

  // ---- sizing
  let width = 1, height = 1;
  function refreshTitle() {
    const { originX, heightFraction } = title.resize(width, height);
    postMat.uniforms.uTitleOrigin.value.x = originX;
    postMat.uniforms.uTitleHeight.value = heightFraction;
    postMat.uniforms.tTitle.value.needsUpdate = true;
  }
  function resizeTargets() {
    mainRT.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
    const reflectionScale = artwork ? (mobile ? 0.54 : 0.66) : (mobile ? 0.3 : 0.5);
    reflRT.setSize(Math.round(width * pixelRatio * reflectionScale), Math.round(height * pixelRatio * reflectionScale));
  }
  function resize() {
    width = canvas.clientWidth || window.innerWidth; height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    renderer.getDrawingBufferSize(drawingSize);
    resizeTargets();
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.8 ? 62 : camera.aspect < 1.2 ? 48 : 38;
    camera.updateProjectionMatrix();
    dawnUniforms.uHaloWidth.value = Math.min(0.34, Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect) * 0.91);
    if (title) refreshTitle();
  }
  resize();

  // ---- per-frame
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qRest = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), pos = new THREE.Vector3();
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  if (!mobile) window.addEventListener('pointermove', (ev) => { pointer.x = ev.clientX / width - 0.5; pointer.y = ev.clientY / height - 0.5; }, { passive: true });
  let swirl = 0, lastU = 0, time = 0, slowAvg = 0;
  const portraitCenter = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const heroStart = new THREE.Vector3(), heroStop = new THREE.Vector3(-1.05, 2.95, 3.25), heroRest = new THREE.Vector3(-2.6, 0.07, 5.2);

  function swirlPos(t, A, out) {
    const a = t.phase + A * t.speed;
    return out.set(vortex.x + Math.cos(a) * t.r, t.h + Math.sin(a * 1.7 + t.phase) * t.wob, vortex.z + Math.sin(a) * t.r);
  }

  function frame(u, dt, speed, screenSpace, titleScale, veil) {
    // On phones, keep buffer sizes stable during a gesture. The Retina plane does not use this scale.
    if (!mobile) {
      slowAvg += ((dt > 0.0195 ? 1 : 0) - slowAvg) * 0.02;
      if (slowAvg > 0.3 && pixelRatio > 1.35) {
        pixelRatio = Math.max(1.35, pixelRatio - 0.25);
        resizeTargets();
        slowAvg = 0;
      }
    }
    time = mobile ? u * 2 : time + dt;
    const forward = u >= lastU;

    // chapter events
    const freeze = smooth(1.28, 1.46, u);
    const settleStart = 2.02;
    if (mobile) swirl = Math.min(u, 1.46) * 1.8;
    else swirl += dt * (0.55 + Math.min(Math.abs(speed) / 2500, 1.4)) * (1 - freeze) * (u < settleStart + 0.4 ? 1 : 0);

    // sun climbs through the film
    const elev = artwork ? mix(0.115, 0.13, smooth(0, 3, u)) + smooth(6.0, 7.0, u) * 0.035
      : mix(0.045, 0.07, smooth(0, 3, u)) + smooth(6.0, 7.0, u) * 0.07;
    setSun(elev);
    skyUniforms.uHalo.value = artwork ? 0.13 + smooth(6.05, 6.75, u) * 0.8 : 0.25 + smooth(6.2, 6.9, u) * 0.9;
    rim.position.copy(sunDir).multiplyScalar(30);
    waterUniforms.uCalm.value = smooth(1.3, 2.6, u);
    waterUniforms.uTime.value = time;
    skyUniforms.uTime.value = time;
    for (const m of mists) { m.material.uniforms.uTime.value = time; m.material.uniforms.uCam.value.copy(camera.position); }
    moteMat.uniforms.uTime.value = time;
    moteMat.uniforms.uCam.value.copy(camera.position);
    moteMat.uniforms.uPx.value = pixelRatio;

    // The phone settles in one position while the rule screens change.
    const rise = easeOut(smooth(0.42, 1.02, u));
    const sink = smooth(5.3, 5.9, u);
    const arrive = smooth(2.62, RULES_SHOT_START, u);
    const cameraDrift = 1 - rulesShotWeight(u);
    phone.position.set(8.6 * arrive, mix(-3.6, mix(2.7, 2.45, arrive), rise) - sink * 7, mix(2, -1.4, arrive));
    phone.rotation.set(Math.sin(time * 0.5) * 0.015 * cameraDrift,
      -0.12 * (1 - smooth(1.0, 1.4, u)) + Math.sin(time * 0.35) * 0.03 * cameraDrift, 0);
    phone.visible = phone.position.y > -3.5;
    let shown = 0;
    let fromTex = 0, toTex = 0, m = 0;
    for (const [a, b, to] of SCREEN_CUTS) {
      if (u >= b) shown = to;
      else if (u > a) {
        if (mobile) shown = u >= (a + b) / 2 ? to : shown;
        else { fromTex = shown; toTex = to; m = smooth(a, b, u); }
        break;
      }
    }
    if (m === 0) { fromTex = toTex = shown; }
    screenMat.uniforms.tA.value = screenTex[fromTex];
    screenMat.uniforms.tB.value = screenTex[toTex];
    screenMat.uniforms.uMix.value = m;
    screenMat.uniforms.uGlow.value = smooth(1.4, 1.46, u) * (1 - smooth(2.1, 2.4, u));

    // hero tile: swirl, reach, stop a breath away, then return to the water
    swirlPos({ phase: 0.4, speed: 0.95, r: 4.2, h: 3.2, wob: 0.4 }, swirl, heroStart);
    const reach = easeOut(smooth(0.95, 1.46, u));
    const back = smooth(2.02, 2.5, u);
    pos.lerpVectors(heroStart, heroStop, reach);
    if (back > 0) {
      pos.set(mix(heroStop.x, heroRest.x, easeOut(back)), mix(heroStop.y, heroRest.y, easeIn(back)), mix(heroStop.z, heroRest.z, easeOut(back)));
    }
    hero.position.copy(pos);
    hero.position.y -= 0.18 * smooth(5.3, 6.5, u);
    e.set(mix(swirl * 1.3, 0.15, reach), mix(swirl * 0.8, 0.5, reach), 0);
    q.setFromEuler(e);
    if (back > 0) { qRest.setFromEuler(e.set(-Math.PI / 2, 0, 0.6)); q.slerp(qRest, easeOut(back)); }
    hero.quaternion.copy(q);
    hero.material.emissiveIntensity = smooth(1.3, 1.46, u) * (1 - back) * 0.35;
    if (forward && back > 0.97 && !heroLanded) { heroLanded = true; addRipple(heroRest.x, heroRest.z, 2.2); }
    if (back < 0.5) heroLanded = false;

    // dome
    const domeO = smooth(5.05, 5.45, u) * (1 - smooth(5.75, 6.05, u));
    domeMat.uniforms.uOpacity.value = domeO;
    dome.visible = domeRing.visible = domeO > 0.002;
    domeRing.material.opacity = domeO * 0.59;

    // sprout
    const grow = easeOut(smooth(6.02, 6.4, u));
    sprout.position.y = mix(-2.2, 1.9, grow) + Math.sin(time * 0.8) * 0.04 * grow;
    sprout.rotation.y = Math.sin(time * 0.3) * 0.15;
    sprout.scale.setScalar(1.25);
    sprout.visible = grow > 0.001;
    if (forward && grow > 0.5 && lastU < 6.2 && u >= 6.2) addRipple(0, -3, 2.4);

    // camera
    const ct = curveT(u);
    camPos.getPoint(ct, tmpP);
    camTgt.getPoint(ct, tmpT);
    pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 3);
    pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 3);
    // portrait: copy sits at the bottom, so lift the subject and re-center the phone
    if (camera.aspect < 0.8) {
      const dx = portraitShift(u);
      tmpT.x += dx; tmpP.x += dx * 0.6;
      // pull the camera back a little so the whole phone fits above the copy
      const back = 1 + 0.32 * smooth(0.8, 1.1, u) * (1 - smooth(2.7, 3.15, u))
        + 0.1 * smooth(3.0, RULES_SHOT_START, u) * (1 - smooth(RULES_SHOT_END, 5.3, u));
      tmpP.sub(tmpT).multiplyScalar(back).add(tmpT);
      tmpT.y -= 0.9 * smooth(0.3, 0.8, u) * (1 - smooth(5.1, 5.4, u));
    }
    const breathe = Math.sin(time * 0.4) * 0.06;
    camera.position.set(tmpP.x + pointer.sx * 0.9 * cameraDrift, tmpP.y + (breathe - pointer.sy * 0.5) * cameraDrift, tmpP.z);
    camera.lookAt(tmpT);
    camera.updateMatrixWorld();
    if (artwork) cameraToWorld.extractRotation(camera.matrixWorld).multiply(camera.projectionMatrixInverse);

    if (mobile && camera.aspect < 0.8 && screenSpace && phone.visible) {
      const focus = smooth(0.65, 1.03, u) * (1 - smooth(RULES_SHOT_END, 5.3, u));
      if (focus > 0) {
        camera.getWorldDirection(cameraForward);
        cameraUp.setFromMatrixColumn(camera.matrixWorld, 1);
        const distance = Math.max(1.2, portraitCenter.subVectors(phone.position, camera.position).dot(cameraForward));
        const unitsPerPixel = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height;
        const displayHeight = Math.min(screenSpace.height, width * 0.78 * (2.94 / 1.42));
        const scale = displayHeight * unitsPerPixel / 2.94;
        portraitCenter.copy(camera.position).addScaledVector(cameraForward, distance)
          .addScaledVector(cameraUp, (height / 2 - screenSpace.center) * unitsPerPixel);
        phone.position.lerp(portraitCenter, focus);
        phone.scale.setScalar(mix(1, scale, focus));
        phone.quaternion.slerp(camera.quaternion, focus);
      } else {
        phone.scale.setScalar(1);
      }
    } else if (mobile) {
      phone.scale.setScalar(1);
    }

    // tiles
    for (let i = 0; i < N; i++) {
      const t = T[i];
      const s = smooth(settleStart + t.delay, settleStart + t.delay + 0.42, u);
      swirlPos(t, swirl, tmpP);
      pos.set(mix(tmpP.x, t.rest.x, easeOut(s)), mix(tmpP.y, t.rest.y, easeIn(s)), mix(tmpP.z, t.rest.z, easeOut(s)));
      const bob = Math.sin(time * 0.9 + t.phase) * 0.018 * s;
      const clearCenter = (1 - smooth(2.8, 8.0, Math.abs(t.rest.x))) * smooth(4.8 + t.delay, 6.22 + t.delay, u);
      pos.y += bob - 0.027 * s - 0.21 * clearCenter;
      e.set(t.phase + swirl * t.spin.x, t.phase * 2 + swirl * t.spin.y, swirl * t.spin.z);
      q.setFromEuler(e);
      e.set(-Math.PI / 2 + Math.sin(time * 0.7 + t.phase) * 0.04 * s, 0, t.yaw);
      qRest.setFromEuler(e);
      q.slerp(qRest, easeOut(s));
      const sc = t.scale * (1 - smooth(1.28, 1.46, u) * 0.04);
      // Keep close tiles from turning into a wall across the viewport.
      const distance = Math.sqrt(pos.distanceToSquared(camera.position));
      const perspectiveScale = sc * smooth(0.45, 4.0, distance);
      m4.compose(pos, q, s3.setScalar(perspectiveScale));
      tiles.setMatrixAt(i, m4);
      if (forward && s > 0.96 && !t.landed) { t.landed = true; if (t.ripple) addRipple(t.rest.x, t.rest.z, 0.8); }
      if (s < 0.5) t.landed = false;
    }
    tiles.instanceMatrix.needsUpdate = true;

    // reflection pass
    reflCam.copy(camera);
    reflCam.position.set(camera.position.x, -camera.position.y, camera.position.z);
    reflCam.up.set(0, -1, 0);
    reflCam.lookAt(tmpT.x, -tmpT.y, tmpT.z);
    reflCam.updateMatrixWorld();
    reflCam.matrixWorldInverse.copy(reflCam.matrixWorld).invert();
    texMat.copy(bias).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
    water.visible = false;
    motes.visible = false;
    for (const m of mists) m.visible = false;
    const clouds = skyUniforms.uClouds.value;
    skyUniforms.uClouds.value = 0;
    skyUniforms.uCenter.value.copy(reflCam.position);
    sky.position.copy(reflCam.position);
    renderer.clippingPlanes = waterClip;
    renderer.setRenderTarget(reflRT);
    renderer.render(scene, reflCam);
    renderer.clippingPlanes = [];

    // main pass
    water.visible = true;
    motes.visible = true;
    for (const m of mists) m.visible = true;
    skyUniforms.uClouds.value = clouds;
    waterUniforms.uCam.value.copy(camera.position);
    domeMat.uniforms.uCam.value.copy(camera.position);
    skyUniforms.uCenter.value.copy(camera.position);
    sky.position.copy(camera.position);
    renderer.setRenderTarget(mainRT);
    renderer.render(scene, camera);

    // composite: chromatic aberration rides scroll speed and the moment of the brake
    const stopPulse = Math.exp(-Math.pow((u - 1.46) / 0.03, 2));
    // no fringing at rest, so the phone screen stays crisp; a little only while scrolling fast
    postMat.uniforms.uAberr.value = smooth(800, 4000, Math.abs(speed)) * 0.006 + stopPulse * 0.003;
    postMat.uniforms.uDesat.value = freeze * (1 - smooth(1.9, 2.2, u)) * (artwork ? 0.08 : 0.22);
    postMat.uniforms.uTime.value = time;
    if (title) {
      postMat.uniforms.uTitleScale.value = titleScale;
      postMat.uniforms.uVeil.value = veil;
    }
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);

    if (display && phone.visible) {
      display.matrix.copy(screen.matrixWorld);
      display.matrixWorldNeedsUpdate = true;
      renderer.autoClear = false;
      try {
        renderer.render(displayScene, camera);
      } finally {
        renderer.autoClear = true;
      }
    }

    lastU = u;
  }

  // warm-up: compile every shader program for both passes and upload every
  // texture now, so the phone, dome and sprout do not hitch on first sight
  camera.position.set(0, 3.4, 30); camera.lookAt(0, 2.6, 0); camera.updateMatrixWorld();
  renderer.setRenderTarget(mainRT);
  renderer.compile(scene, camera);
  renderer.setRenderTarget(reflRT);
  renderer.clippingPlanes = waterClip;
  renderer.compile(scene, camera);
  renderer.setRenderTarget(null);
  renderer.clippingPlanes = [];
  renderer.compile(postScene, postCam);
  if (displayScene) renderer.compile(displayScene, camera);
  if (panorama) renderer.initTexture(panorama);
  screenTex.forEach((t) => renderer.initTexture(t));
  // Safari can defer pipeline creation until the first actual draw. Make the
  // phone draw into the same buffers before the visitor scrolls to its reveal.
  if (mobile) frame(0.83, 1 / 60, 0, null, 1, 1);

  return { frame, resize, refreshTitle, renderer };
}
