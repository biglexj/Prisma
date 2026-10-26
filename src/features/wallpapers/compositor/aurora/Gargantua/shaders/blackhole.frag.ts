// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import { ambientSkyFunctions } from '../../Backgrounds/sky.frag';

export const fragmentShader = /* glsl */`
precision highp float;

varying vec2 vUv;

uniform vec2  resolution;
uniform float time;
uniform vec3  cameraPos;
uniform vec3  cameraDir;
uniform vec3  cameraUp;
uniform vec3  cameraRight;
uniform float fov;
uniform int   quality;
uniform int   debugView;
uniform int ambientTheme;
uniform bool overlay;
uniform float ambientTime;
uniform float ambientEnergy;
uniform float ambientClick;
uniform float p_accretionDiskInner;
uniform float p_accretionDiskOuter;
uniform float p_accretionDiskTemperature;
uniform float p_spin;
uniform float p_dopplerIntensity;
uniform float p_bloomIntensity;
uniform float p_filmGrain;
uniform float p_chromaticAberration;

#define uRes resolution
#define uTime time
#define uCamPos cameraPos
#define uFov fov
#define uDebug debugView
#define uDin p_accretionDiskInner
#define uDout p_accretionDiskOuter
#define uDopMax p_dopplerIntensity

// Constants & Defaults
#define RS 1.0
#define uRotSign 1.0
#define uRotSpeed 1.0
#define uStarBright 1.0
#define uSkyFloor 0.04
#define uOpNear 0.90
#define uOpFar 0.80
#define uDiskBright p_bloomIntensity

// Steps based on quality profile
#define uSteps (quality == 0 ? 180 : (quality == 1 ? 300 : 440))

// ---------------------------------------------------------------- noise -----
float hash1(vec3 p){
  p = fract(p*0.3183099 + vec3(0.10,0.17,0.13));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
vec3 hash3(vec3 p){
  p = fract(p*vec3(0.1031,0.1030,0.0973));
  p += dot(p, p.yxz+33.33);
  return fract((p.xxy+p.yxx)*p.zyx);
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  float n000 = hash1(i);
  float n100 = hash1(i+vec3(1.0,0.0,0.0));
  float n010 = hash1(i+vec3(0.0,1.0,0.0));
  float n110 = hash1(i+vec3(1.0,1.0,0.0));
  float n001 = hash1(i+vec3(0.0,0.0,1.0));
  float n101 = hash1(i+vec3(1.0,0.0,1.0));
  float n011 = hash1(i+vec3(0.0,1.0,1.0));
  float n111 = hash1(i+vec3(1.0,1.0,1.0));
  return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
             mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float fbm(vec3 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<5;i++){
    v += a*vnoise(p);
    p = p*2.03 + 11.3;
    a *= 0.5;
  }
  return v;
}

// ------------------------------------------------------ pseudo-blackbody ----
vec3 blackbody(float t){
  vec3 c = mix(vec3(0.55,0.06,0.01), vec3(1.00,0.42,0.10), smoothstep(0.00,0.55,t));
  c = mix(c, vec3(1.00,0.86,0.55), smoothstep(0.50,1.05,t));
  c = mix(c, vec3(0.85,0.92,1.25), smoothstep(1.05,1.90,t));
  return c;
}

// ------------------------------------------------------------ star field ----
mat3 layerRot(float ay, float ax){
  float cy = cos(ay), sy = sin(ay), cx = cos(ax), sx = sin(ax);
  return mat3(cy,0.0,-sy,  sy*sx,cx,cy*sx,  sy*cx,-sx,cy*cx);
}
vec3 starLayer(vec3 d, float scale, float thresh, mat3 rot, float sharp){
  vec3 p = rot*d*scale;
  vec3 id = floor(p);
  vec3 f = fract(p);
  float h = hash1(id);
  if(h < thresh) return vec3(0.0);
  vec3 sp = 0.15 + 0.70*hash3(id + 4.7);
  float dist = length(f - sp);
  float star = exp(-dist*dist*sharp);
  float bright = (h - thresh)/(1.0 - thresh);
  bright *= bright;
  vec3 tint = mix(vec3(0.72,0.84,1.0), vec3(1.0,0.86,0.70), hash1(id + 13.1));
  return star*bright*tint*4.0;
}
vec3 heroStars(vec3 d){
  vec3 p = d*14.0;
  vec3 id = floor(p);
  vec3 f = fract(p);
  float h = hash1(id + 91.7);
  if(h < 0.9975) return vec3(0.0);
  vec3 sp = 0.20 + 0.60*hash3(id + 3.3);
  float dist = length(f - sp);
  float glow = exp(-dist*dist*22.0)*0.85 + exp(-dist*dist*240.0)*1.5;
  vec3 tint = mix(vec3(0.70,0.82,1.0), vec3(1.0,0.80,0.60), step(0.5, hash1(id + 5.5)));
  return glow*tint;
}
vec3 milkyway(vec3 d){
  vec3 n = normalize(vec3(0.25,1.0,0.15));
  float w = dot(d,n);
  float band = exp(-w*w*7.0);
  vec3 p = d*2.6;
  float cloud = fbm(p*1.4 + 5.2);
  float dust  = fbm(p*2.3 + 9.1);
  vec3 col = mix(vec3(0.04,0.07,0.20), vec3(0.42,0.24,0.52), smoothstep(0.25,0.85,cloud));
  col *= band;
  col *= 1.0 - 0.62*smoothstep(0.45,0.85,dust);
  col *= 1.15;
  return col;
}
${ambientSkyFunctions}

vec3 background(vec3 d){
  if (ambientTheme >= 0) return sampleAmbientSky(normalize(d), cameraDir, cameraRight, cameraUp,
    ambientTime, 0.85, ambientEnergy, ambientClick, ambientTheme);
  vec3 col = uSkyFloor*vec3(0.10,0.13,0.28);
  col += milkyway(d);
  col += starLayer(d,  26.0, 0.952, layerRot(0.7,0.4), 120.0);
  col += starLayer(d,  47.0, 0.952, layerRot(2.1,1.1), 200.0);
  col += starLayer(d,  83.0, 0.952, layerRot(4.0,2.3), 320.0);
  col += starLayer(d, 150.0, 0.968, layerRot(5.3,0.9), 480.0);
  col += heroStars(d);
  return col*uStarBright;
}

// Schwarzschild null-geodesic acceleration (c = G = 1, RS = 1)
vec3 accAt(vec3 p, vec3 v){
  vec3 h = cross(p, v);
  float r2 = dot(p, p);
  return -1.5*RS*dot(h, h)/(r2*r2*sqrt(r2))*p;
}

// Accretion-disk plane crossing
bool diskCross(vec3 a, vec3 b, vec3 rayDir,
               inout vec3 col, inout float trans,
               inout float crossCount, inout float validCross,
               inout float firstAng, inout float crossRad, inout float turbDbg){
  if(a.y*b.y > 0.0) return false;
  float t = abs(a.y)/(abs(a.y) + abs(b.y) + 1e-5);
  vec3 q = mix(a, b, t);
  float qr = length(q.xz);
  crossCount += 1.0;
  if(qr <= uDin || qr >= uDout) return false;
  validCross += 1.0;
  float ang = atan(q.z, q.x);
  if(validCross < 1.5){ firstAng = ang; crossRad = qr; }

  // Novikov–Thorne style flux, ISCO = 3 RS
  float x = max(qr, 3.001);
  float flux = max(pow(x/3.0, -3.0)*(1.0 - sqrt(3.0/x)), 0.0);
  float temp = pow(flux*10.0, 0.25) * p_accretionDiskTemperature;

  // seamless rotating pattern coords
  float omega = uRotSign*1.1*uRotSpeed*pow(3.0/qr, 1.5);
  float rot = omega*uTime;
  float ca = cos(rot), sa = sin(rot);
  vec3 qp = vec3(ca*q.x + sa*q.z, 0.0, -sa*q.x + ca*q.z);
  vec2 rp = qp.xz/qr;

  // turbulence
  vec3 pc = vec3(rp.x*3.0, rp.y*3.0, qr*0.85);
  vec3 warp = vec3(
    fbm(pc*1.5),
    fbm(pc*1.5 + vec3(5.2,1.3,2.8)),
    fbm(pc*1.5 + vec3(9.7,4.1,7.3)));
  float turb = fbm(pc*2.0 + warp*1.5);
  float innerDetail = 1.0 - smoothstep(4.0, 18.0, qr);
  turb = mix(0.50, turb*1.7, innerDetail);
  float streakN = fbm(vec3(rp.x*22.0, rp.y*22.0, qr*1.4));
  float streak = mix(0.95, mix(0.55, 1.15, smoothstep(0.25, 0.85, streakN)), innerDetail);
  float lane = fbm(vec3(rp.x*5.0, rp.y*5.0, qr*0.55) + warp*0.8);
  float laneMask = mix(0.85, mix(0.50, 1.30, smoothstep(0.15, 0.80, lane)), innerDetail);
  float radialGain = mix(0.38, 1.0, innerDetail);
  turbDbg = turb;

  float I = flux*11.0*turb*streak*laneMask*radialGain;
  I += exp(-pow((qr-3.1)*3.0, 2.0))*2.8;              // inner glow
  float outerFade = 1.0 - smoothstep(uDout-14.0, uDout, qr);
  I *= outerFade;

  // relativistic beaming + gravitational redshift
  float beta = sqrt(0.5/qr);
  float gamma = 1.0/sqrt(max(1.0 - beta*beta, 1e-4));
  vec3 tdir = normalize(vec3(-sin(ang), 0.0, cos(ang)))*uRotSign;
  float dop = 1.0/(gamma*(1.0 - dot(tdir*beta, rayDir)));
  dop = clamp(dop, 0.50, uDopMax);
  float g = sqrt(max(1.0 - RS/qr, 0.0));

  vec3 dcol = blackbody(temp*dop*g) * I * (dop*dop*dop) * g * uDiskBright;
  float alpha = mix(uOpFar, uOpNear, 1.0 - smoothstep(4.0, 13.0, qr)) * outerFade;
  col += trans * alpha * dcol;
  trans *= 1.0 - alpha;
  if(trans < 0.02){ trans = 0.0; return true; }
  return false;
}

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;
  vec3 ro = uCamPos;
  // Misma escala de rayo y encuadre que la referencia normal del prototipo.
  vec3 rd = normalize(p.x * cameraRight + p.y * cameraUp + (1.0 / max(fov, 0.1)) * cameraDir);

  vec3 pos = ro;
  vec3 vel = rd;
  vec3 col = vec3(0.0);
  vec3 haloCol = vec3(0.0);
  float trans = 1.0;
  float minR = 1e5;
  float lastR = length(ro);
  int   stepsUsed = 0;
  float crossCount = 0.0;
  float validCross = 0.0;
  float firstAng = 0.0;
  float crossRad = 0.0;
  float turbDbg = 0.0;

  for(int i=0;i<600;i++){
    if(i >= uSteps) break;
    float r = length(pos);
    lastR = r;
    if(r < 1.03*RS){ trans = 0.0; break; }
    if(r > 45.0 && dot(pos,vel) > 0.0){ break; }
    stepsUsed = i + 1;
    minR = min(minR, r);

    float dt = max(0.012, r*mix(0.02, 0.06, smoothstep(6.0, 20.0, r)));

    // thin volumetric halo hugging the disk plane
    float absY = abs(pos.y);
    if(absY < 0.45 && r > uDin && r < uDout){
      float dens = exp(-absY*30.0)*0.03*(1.0 - smoothstep(10.0, uDout-1.0, r));
      float xh = max(r, 3.001);
      float fluxh = max(pow(xh/3.0, -3.0)*(1.0 - sqrt(3.0/xh)), 0.0);
      vec3 glowc = blackbody(pow(fluxh*10.0, 0.25)*0.9 * p_accretionDiskTemperature);
      haloCol += trans * glowc * (fluxh*3.5) * dens * dt * uDiskBright;
    }

    if(r < 4.4){
      float hdt = dt*0.5;
      bool absorbed = false;
      for(int s = 0; s < 2; s++){
        vec3 k1 = accAt(pos, vel);
        vec3 pm = pos + vel*(hdt*0.5);
        vec3 vm = normalize(vel + k1*(hdt*0.5));
        vec3 k2 = accAt(pm, vm);
        vec3 pn = pos + vm*hdt;
        vel = normalize(vel + k2*hdt);
        if(diskCross(pos, pn, vel, col, trans, crossCount, validCross, firstAng, crossRad, turbDbg)){
          absorbed = true;
        }
        pos = pn;
        minR = min(minR, length(pos));
      }
      if(absorbed) break;
    }else{
      vel = normalize(vel + accAt(pos, vel)*dt);
      vec3 npos = pos + vel*dt;
      if(diskCross(pos, npos, vel, col, trans, crossCount, validCross, firstAng, crossRad, turbDbg)){
        pos = npos;
        break;
      }
      pos = npos;
    }
  }

  vec3 bgAdd = vec3(0.0);
  if(trans > 0.0){
    float deep = clamp((lastR-1.03)*0.45, 0.45, 1.0);
    col += haloCol * deep;
    // The compact raytracer framing belongs to the hole, not to the environment.
    // Keep the shared sky's 60° coverage and carry over the geodesic deflection.
    vec3 skyRay = normalize(cameraDir + 2.0 * 0.57735026919 * (p.x * cameraRight + p.y * cameraUp));
    vec3 skyDirection = ambientTheme >= 0 ? normalize(skyRay + vel - rd) : vel;
    if (!overlay) bgAdd = trans * background(skyDirection) * deep;
  }
  vec3 ringAdd = vec3(1.0,0.92,0.80) * exp(-pow((minR-1.55)*4.0, 2.0)) * 0.14 * uDiskBright;

  vec3 outCol;
  if(uDebug == 1){
    outCol = col;
  }else if(uDebug == 2){
    outCol = bgAdd;
  }else if(uDebug == 3){
    outCol = vec3(float(stepsUsed)/float(max(uSteps,1)));
  }else if(uDebug == 4){
    float v = clamp(crossRad/max(uDout,1e-3), 0.0, 1.0);
    outCol = (validCross > 0.5) ? vec3(v, v*(1.0-v)*2.4, 1.0-v) : vec3(0.0);
  }else if(uDebug == 5){
    outCol = vec3(clamp(turbDbg, 0.0, 1.0));
  }else if(uDebug == 6){
    outCol = vec3(clamp(minR/12.0,0.0,1.0), clamp(crossCount/4.0,0.0,1.0), 0.0);
  }else if(uDebug == 7){
    if(validCross < 0.5)      outCol = vec3(0.0);
    else if(validCross < 1.5) outCol = vec3(0.0,0.0,1.0);
    else if(validCross < 2.5) outCol = vec3(0.0,1.0,0.0);
    else                      outCol = vec3(1.0,0.0,0.0);
  }else if(uDebug == 8){
    outCol = (validCross > 0.5)
      ? 0.5 + 0.5*sin(firstAng + vec3(0.0, 2.0944, 4.1888))
      : vec3(0.0);
  }else if(uDebug == 9){
    float band = mod(floor(crossRad), 2.0);
    outCol = (validCross > 0.5)
      ? mix(vec3(0.05,0.15,0.45), vec3(0.95,0.55,0.15), band)
      : vec3(0.0);
  }else{
    outCol = col + bgAdd + ringAdd;
  }

  outCol = clamp(max(outCol, vec3(0.0)), vec3(0.0), vec3(64.0));

  // Apply post-processing settings directly in-shader if composite pass is bypassed or for simple inline tone mapping
  vec3 toneMapped = clamp((outCol*(2.51*outCol + 0.03))/(outCol*(2.43*outCol + 0.59) + 0.14), 0.0, 1.0);

  float coverage = max(1.0 - trans, max(toneMapped.r, max(toneMapped.g, toneMapped.b)));
  gl_FragColor = overlay
    ? vec4(toneMapped / max(coverage, 0.0001), coverage)
    : vec4(toneMapped, 1.0);
}
`;
