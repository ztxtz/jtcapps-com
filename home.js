// Silk hero: a dark, warm cloth shader. Pauses off-screen, renders one frame for reduced motion,
// and leaves the CSS gradient in place when WebGL is unavailable.
(() => {
  'use strict';
  const cv = document.querySelector('canvas.silk');
  if (!cv) return;
  const PAL = [[1.0, 0.66, 0.26], [1.0, 0.2, 0.47], [0.46, 0.1, 0.82]];
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `precision highp float;
uniform vec2 R;uniform float T;uniform vec2 M;uniform vec3 A,B,C;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float H(vec2 p){
  vec2 q=p;float t=T*.1;
  for(int i=1;i<6;i++){
    float k=float(i);
    q+=vec2(sin(q.y*k*1.2+t*1.25+k),cos(q.x*k*1.0-t+k*1.7))*(.8/k);
  }
  return sin(q.x*2.9+q.y*1.5)*.5+.5;
}
void main(){
  vec2 uv=gl_FragCoord.xy/R;
  float mn=min(R.x,R.y);
  vec2 p=(gl_FragCoord.xy-.5*R)/mn*1.55;
  vec2 mp=(M-.5)*R/mn*1.55;
  vec2 d=p-mp;
  p+=d*.34*exp(-dot(d,d)*4.5);
  p=mat2(.82,-.57,.57,.82)*p;
  float e=.003,h=H(p),hx=H(p+vec2(e,0.)),hy=H(p+vec2(0.,e));
  vec3 n=normalize(vec3((h-hx)/e*.1,(h-hy)/e*.1,1.));
  vec3 l=normalize(vec3(-.3,-.62,.7));
  float dif=max(dot(n,l),0.);
  float sp=pow(max(dot(reflect(-l,n),vec3(0.,0.,1.)),0.),38.);
  float lit=dif*dif*(.35+.65*h);
  vec3 col=mix(vec3(.035,.008,.06),C*.72,smoothstep(.02,.26,lit));
  col=mix(col,B,smoothstep(.2,.52,lit));
  col=mix(col,A,smoothstep(.5,.86,lit));
  col+=sp*(A*.6+vec3(.34))*.55;
  float sun=smoothstep(1.25,.05,length((uv-vec2(.76,.02))*vec2(R.x/mn,R.y/mn)));
  col*=.42+1.05*sun;
  col+=A*sun*sun*.1;
  col*=mix(.2,1.,smoothstep(.96,.56,uv.y));
  col+=(h21(gl_FragCoord.xy+fract(T)*17.)-.5)*.016;
  gl_FragColor=vec4(pow(max(col,0.),vec3(.96)),1.);
}`;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const m = [0.72, 0.42], tm = [0.72, 0.42], t0 = performance.now();
  let raf = 0;
  const boot = () => {
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = {};
    ['R', 'T', 'M', 'A', 'B', 'C'].forEach((n) => { u[n] = gl.getUniformLocation(pr, n); });
    gl.uniform3fv(u.A, PAL[0]); gl.uniform3fv(u.B, PAL[1]); gl.uniform3fv(u.C, PAL[2]);
    let q = 0.85, vis = true, slow = 0, last = 0;
    const fit = () => {
      const s = Math.min(window.devicePixelRatio || 1, 1.5) * q;
      cv.width = Math.max(1, Math.round(cv.clientWidth * s));
      cv.height = Math.max(1, Math.round(cv.clientHeight * s));
      gl.viewport(0, 0, cv.width, cv.height);
    };
    const draw = (now) => {
      m[0] += (tm[0] - m[0]) * 0.045; m[1] += (tm[1] - m[1]) * 0.045;
      gl.uniform2f(u.R, cv.width, cv.height);
      gl.uniform1f(u.T, still ? 26 : 26 + (now - t0) / 1000);
      gl.uniform2f(u.M, m[0], m[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!vis || document.hidden) { last = 0; return; }
      if (last && now - last > 30 && q > 0.5 && ++slow > 40) { q = 0.5; slow = 0; fit(); }
      last = now;
      draw(now);
    };
    new ResizeObserver(() => { fit(); draw(performance.now()); }).observe(cv);
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; }).observe(cv);
    fit();
    draw(performance.now());
    cv.style.opacity = '1';
    if (!still) raf = requestAnimationFrame(loop);
  };
  cv.parentElement.addEventListener('pointermove', (e) => {
    const b = cv.parentElement.getBoundingClientRect();
    tm[0] = (e.clientX - b.left) / b.width;
    tm[1] = 1 - (e.clientY - b.top) / b.height;
  }, { passive: true });
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); cv.style.opacity = '0'; });
  cv.addEventListener('webglcontextrestored', boot);
  boot();
})();
