// A continuous mesh moves the original sprite without cutting holes at joints.
// Artwork remains static if WebGL is unavailable; gameplay never depends on it.
const images = new Map();
const vertex = `
precision mediump float;
attribute vec2 position;
uniform float headAngle;
uniform float headCut;
uniform vec2 headPivot;
uniform vec4 joint;
uniform vec2 shift;
varying vec2 uv;
void main(){
 uv=position;
 vec2 p=position;
 float weight=1.0-smoothstep(headCut,headCut+.13,p.y);
 float a=headAngle*weight;
 vec2 d=p-headPivot;
 p=headPivot+mat2(cos(a),sin(a),-sin(a),cos(a))*d;
 vec2 local=(position-joint.xy)/max(joint.zw,vec2(.001));
 float falloff=pow(max(0.0,1.0-dot(local,local)),2.0);
 p+=shift*falloff;
 gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0,1);
}`;
const fragment = `
precision mediump float;
uniform sampler2D atlas;
uniform vec4 cell;
uniform float headCut;
uniform vec3 finish;
uniform float cropTop;
varying vec2 uv;
void main(){
 if(uv.y<cropTop)discard;
 vec2 local=clamp(uv,vec2(.001),vec2(.999));
 vec4 c=texture2D(atlas,cell.xy+local*cell.zw);
 float mask=1.0-smoothstep(headCut-.015,headCut+.015,uv.y);
 float gray=dot(c.rgb,vec3(.299,.587,.114));
 vec3 tv=mix(c.rgb,gray*finish,.68)*.78;
 gl_FragColor=vec4(mix(c.rgb,tv,mask),c.a);
}`;
const load = (src) => {
  if (!images.has(src))
    images.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }),
    );
  return images.get(src);
};
export function createCharacterRig(node, design) {
  const canvas = node.querySelector(".character-canvas"),
    head = node.querySelector(".head-motion"),
    tip = node.querySelector(".cigarette-tip");
  let gl,
    program,
    texture,
    buffer,
    locations = {},
    ready = false,
    disposed = false,
    motion = null,
    lastPaint = -1,
    reason = null;
  const cut = (design.cut || 25) / 100,
    pivot = [(design.screen[0] + design.screen[2] / 2) / 100, cut];
  const shades = {
    walnut: [1.08, 0.83, 0.65],
    charcoal: [0.67, 0.74, 0.79],
    olive: [0.83, 0.88, 0.65],
  };
  const shader = (type, source) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(s));
    return s;
  };
  function draw(angle = 0, region = [0, 0, 1, 1], delta = [0, 0]) {
    if (!ready || disposed) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(locations.headAngle, angle);
    gl.uniform4fv(locations.joint, region);
    gl.uniform2fv(locations.shift, delta);
    gl.drawArrays(gl.TRIANGLES, 0, 32 * 40 * 6);
    head.style.transformOrigin = `${pivot[0] * 100}% ${pivot[1] * 100}%`;
    head.style.transform = `rotate(${(angle * 180) / Math.PI}deg)`;
    if (tip) {
      const dx = (design.tip[0] / 100 - region[0]) / region[2],
        dy = (design.tip[1] / 100 - region[1]) / region[3],
        w = Math.max(0, 1 - dx * dx - dy * dy) ** 2;
      tip.style.transform = `translate(${delta[0] * node.clientWidth * w}px,${delta[1] * node.clientHeight * w}px)`;
    }
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2),
      size = Math.round(node.clientWidth * dpr);
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
      draw();
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(node);
  function stop() {
    if (!motion) return;
    motion = null;
    draw();
  }
  function lost(event) {
    event.preventDefault();
    ready = false;
    motion = null;
    reason = "context-lost";
    node.classList.remove("rig-ready");
    head.style.transform = "none";
    if (tip) tip.style.transform = "none";
  }
  canvas.addEventListener("webglcontextlost", lost);
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      depth: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw Error("WebGL unavailable");
    program = gl.createProgram();
    const vs = shader(gl.VERTEX_SHADER, vertex),
      fs = shader(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const points = [];
    for (let y = 0; y < 40; y++)
      for (let x = 0; x < 32; x++) {
        const l = x / 32,
          r = (x + 1) / 32,
          t = y / 40,
          b = (y + 1) / 40;
        points.push(l, t, r, t, l, b, r, t, r, b, l, b);
      }
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const name of [
      "headAngle",
      "headCut",
      "headPivot",
      "joint",
      "shift",
      "cell",
      "finish",
      "cropTop",
    ])
      locations[name] = gl.getUniformLocation(program, name);
    gl.uniform1f(locations.headCut, cut);
    gl.uniform1f(
      locations.cropTop,
      design.rows === 3 && design.row > 0 ? 0.018 : 0.004,
    );
    gl.uniform2fv(locations.headPivot, pivot);
    gl.uniform4fv(locations.cell, [
      design.col / 2,
      design.row / design.rows,
      1 / 2,
      1 / design.rows,
    ]);
    gl.uniform3fv(locations.finish, shades[node.dataset.tv] || shades.walnut);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    load(design.art)
      .then((img) => {
        if (disposed || reason) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img,
        );
        ready = true;
        resize();
        draw();
        node.classList.add("rig-ready");
      })
      .catch(() => {
        reason = "image-load";
      });
  } catch (error) {
    reason = error.message;
  }
  const region = (rect) => [
    (rect[0] + rect[2] / 2) / 100,
    (rect[1] + rect[3] / 2) / 100,
    rect[2] / 100,
    rect[3] / 100,
  ];
  const pulse = (t, center, width) => {
    const x = Math.abs(t - center) / width;
    return x < 1 ? (1 + Math.cos(x * Math.PI)) / 2 : 0;
  };
  return {
    play(kind, duration, now) {
      if (ready)
        motion = {
          kind,
          duration,
          start: now,
          sign: Math.random() < 0.5 ? -1 : 1,
        };
    },
    update(now) {
      if (!motion || now - lastPaint < 30) return;
      lastPaint = now;
      const { kind, duration, start, sign } = motion,
        t = (now - start) / duration;
      if (t >= 1) {
        stop();
        return;
      }
      let angle = 0,
        delta = [0, 0],
        r = [0, 0, 1, 1];
      if (kind === "neck-stretch")
        angle = (pulse(t, 0.3, 0.3) - pulse(t, 0.7, 0.3)) * 0.021 * sign;
      else if (kind === "glance")
        angle = Math.sin(Math.PI * t) ** 2 * 0.015 * sign;
      else if (kind === "foot-tap") {
        r = region(design.foot);
        delta = [
          0,
          -0.006 *
            (pulse(t, 0.2, 0.14) + pulse(t, 0.52, 0.14) + pulse(t, 0.8, 0.14)),
        ];
      } else if (kind === "tv-repair" && design.repair) {
        r = region(design.repair);
        const tap = pulse(t, 0.47, 0.1) + pulse(t, 0.73, 0.1);
        delta = [0.008 * tap, -0.001 * tap];
        angle = -0.005 * tap;
      } else {
        r = region(design.hand);
        const taps = pulse(t, 0.25, 0.18) + pulse(t, 0.6, 0.18);
        delta =
          kind === "scratch"
            ? [-0.004 * taps, 0.001 * taps]
            : [0.001 * taps, -(kind === "ash-flick" ? 0.005 : 0.0025) * taps];
      }
      draw(angle, r, delta);
    },
    stop,
    destroy() {
      disposed = true;
      motion = null;
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      if (gl) {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    },
    status() {
      return { ready, active: motion?.kind || null, fallback: reason };
    },
  };
}
