// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
/** Shared directional sky: the standalone layer and Gargantúa sample the same palettes. */
export const ambientSkyFunctions = /* glsl */`
float ambientHash1(vec3 p){
    p = fract(p*0.3183099 + vec3(0.10,0.17,0.13));
    p *= 17.0;
    return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
vec3 ambientHash3(vec3 p){
    p = fract(p*vec3(0.1031,0.1030,0.0973));
    p += dot(p, p.yxz+33.33);
    return fract((p.xxy+p.yxx)*p.zyx);
}
float ambientVnoise(vec3 x){
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n000 = ambientHash1(i);
    float n100 = ambientHash1(i+vec3(1.0,0.0,0.0));
    float n010 = ambientHash1(i+vec3(0.0,1.0,0.0));
    float n110 = ambientHash1(i+vec3(1.0,1.0,0.0));
    float n001 = ambientHash1(i+vec3(0.0,0.0,1.0));
    float n101 = ambientHash1(i+vec3(1.0,0.0,1.0));
    float n011 = ambientHash1(i+vec3(0.0,1.0,1.0));
    float n111 = ambientHash1(i+vec3(1.0,1.0,1.0));
    return mix(mix(mix(n000,n100,f.x), mix(n010,n110,f.x), f.y),
               mix(mix(n001,n101,f.x), mix(n011,n111,f.x), f.y), f.z);
}
float ambientFbm(vec3 p){
    float v = 0.0;
    float a = 0.5;
    for(int i=0;i<5;i++){
        v += a*ambientVnoise(p);
        p = p*2.03 + 11.3;
        a *= 0.5;
    }
    return v;
}

mat3 ambientLayerRot(float ay, float ax){
    float cy = cos(ay), sy = sin(ay), cx = cos(ax), sx = sin(ax);
    return mat3(cy,0.0,-sy,  sy*sx,cx,cy*sx,  sy*cx,-sx,cy*cx);
}
vec3 ambientStarLayer(vec3 d, float scale, float thresh, mat3 rot, float sharp){
    vec3 p = rot*d*scale;
    vec3 id = floor(p);
    vec3 f = fract(p);
    float h = ambientHash1(id);
    if(h < thresh) return vec3(0.0);
    vec3 sp = 0.15 + 0.70*ambientHash3(id + 4.7);
    float dist = length(f - sp);
    float star = exp(-dist*dist*sharp);
    float bright = (h - thresh)/(1.0 - thresh);
    bright *= bright;
    vec3 tint = mix(vec3(0.72,0.84,1.0), vec3(1.0,0.86,0.70), ambientHash1(id + 13.1));
    return star*bright*tint*3.8;
}
vec3 ambientHeroStars(vec3 d){
    vec3 p = d*14.0;
    vec3 id = floor(p);
    vec3 f = fract(p);
    float h = ambientHash1(id + 91.7);
    if(h < 0.9972) return vec3(0.0);
    vec3 sp = 0.20 + 0.60*ambientHash3(id + 3.3);
    float dist = length(f - sp);
    float glow = exp(-dist*dist*22.0)*0.85 + exp(-dist*dist*240.0)*1.5;
    vec3 tint = mix(vec3(0.70,0.82,1.0), vec3(1.0,0.80,0.60), step(0.5, ambientHash1(id + 5.5)));
    return glow*tint;
}

vec3 ambientAces(vec3 x){
    return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 sampleAmbientStars(vec3 d, float energy) {
    vec3 stars = vec3(0.0);
    stars += ambientStarLayer(d, 26.0, 0.952, ambientLayerRot(0.7, 0.4), 120.0);
    stars += ambientStarLayer(d, 47.0, 0.952, ambientLayerRot(2.1, 1.1), 200.0);
    stars += ambientStarLayer(d, 83.0, 0.952, ambientLayerRot(4.0, 2.3), 320.0);
    stars += ambientStarLayer(d, 150.0, 0.968, ambientLayerRot(5.3, 0.9), 480.0);
    return stars + ambientHeroStars(d) * (1.0 + energy * 0.5);
}
vec3 sampleAmbientSky(vec3 d, vec3 uCamDir, vec3 uCamRight, vec3 uCamUp,
    float uTime, float uIntensity, float uEnergy, float uClick, int uTheme) {
    if (uTheme == 4) return sampleAmbientStars(d, uEnergy) * uIntensity;


    // View-space coordinates to create peripheral & side lensing nebula framing
    float viewCos = dot(d, uCamDir);
    float sideX = dot(d, uCamRight);
    float sideY = dot(d, uCamUp);
    float radialDist = length(vec2(sideX, sideY));

    // Gravitational lensing curve warping the background near the center and sides
    float lensRing = exp(-pow((radialDist - 0.52) * 3.1, 2.0));
    float peripheralMask = smoothstep(0.18, 0.88, radialDist);

    // Rotating cosmic flow for side clouds
    float slowT = uTime * 0.045;
    vec3 flowDir = normalize(d + vec3(sin(slowT)*0.12, cos(slowT*0.8)*0.08, sin(slowT*0.6)*0.12));

    // Milky Way band + 5-octave FBM clouds & dust lanes from shaders.ts
    vec3 mwNormal = normalize(vec3(0.25, 0.92, 0.18));
    float w = dot(flowDir, mwNormal);
    float band = exp(-w*w*5.5);

    vec3 p = flowDir * 2.6;
    float cloud = ambientFbm(p*1.4 + 5.2 + vec3(slowT*0.6, -slowT*0.4, 0.0));
    float dust  = ambientFbm(p*2.3 + 9.1 - vec3(0.0, slowT*0.5, slowT*0.3));
    float swirl = ambientFbm(p*3.1 + vec3(cloud*1.8) + slowT);

    vec3 baseSkyFloor = vec3(0.008, 0.010, 0.024);
    vec3 mwColorA = vec3(0.06, 0.08, 0.24);
    vec3 mwColorB = vec3(0.46, 0.22, 0.62);
    vec3 sideHaloCol1 = vec3(0.44, 0.18, 0.68); // Rich purple/violet peripheral nebula
    vec3 sideHaloCol2 = vec3(0.16, 0.62, 0.85); // Cyan/indigo outer accent

    if (uTheme == 1) {
        // Gargantúa Warm Gold & Deep Violet
        mwColorA = vec3(0.05, 0.07, 0.20);
        mwColorB = vec3(0.45, 0.25, 0.52);
        sideHaloCol1 = vec3(0.55, 0.28, 0.12);
        sideHaloCol2 = vec3(0.38, 0.20, 0.48);
    } else if (uTheme == 2) {
        // Abismo Cian / Esmeralda / Ámbar
        mwColorA = vec3(0.02, 0.14, 0.22);
        mwColorB = vec3(0.08, 0.52, 0.56);
        sideHaloCol1 = vec3(0.06, 0.48, 0.58);
        sideHaloCol2 = vec3(0.75, 0.42, 0.14);
    } else if (uTheme == 3) {
        // Deep contrast space
        mwColorA = vec3(0.02, 0.03, 0.08);
        mwColorB = vec3(0.14, 0.10, 0.24);
        sideHaloCol1 = vec3(0.12, 0.08, 0.22);
        sideHaloCol2 = vec3(0.06, 0.14, 0.25);
    }

    // Core Milky Way band
    vec3 mwCol = mix(mwColorA, mwColorB, smoothstep(0.22, 0.82, cloud));
    mwCol *= band;
    mwCol *= 1.0 - 0.62 * smoothstep(0.45, 0.85, dust);

    // Peripheral & Side Volumetric Nebula (the purple/cosmic clouds framing the sides & center)
    float sideCloudMask = smoothstep(0.28, 0.86, swirl) * (0.35 + 0.65 * peripheralMask + 0.55 * lensRing);
    float sideDust = 1.0 - 0.5 * smoothstep(0.48, 0.88, dust);
    vec3 sideNebula = mix(sideHaloCol1, sideHaloCol2, smoothstep(0.3, 0.8, cloud))
                    * sideCloudMask * sideDust * (0.95 + uEnergy * 0.45 + uClick * 0.35);

    // Subtle gravitational ring glow around the central phenomenon
    vec3 ringGlow = mix(sideHaloCol1, vec3(0.95, 0.65, 0.35), 0.35)
                  * lensRing * smoothstep(0.25, 0.85, cloud) * (0.55 + uEnergy * 0.4);

    // Multi-scale procedural star layers from shaders.ts
    vec3 stars = vec3(0.0);
    stars += ambientStarLayer(d,  26.0, 0.952, ambientLayerRot(0.7, 0.4), 120.0);
    stars += ambientStarLayer(d,  47.0, 0.952, ambientLayerRot(2.1, 1.1), 200.0);
    stars += ambientStarLayer(d,  83.0, 0.952, ambientLayerRot(4.0, 2.3), 320.0);
    stars += ambientStarLayer(d, 150.0, 0.968, ambientLayerRot(5.3, 0.9), 480.0);
    stars += ambientHeroStars(d) * (1.0 + uEnergy * 0.5);

    vec3 totalCol = baseSkyFloor + (mwCol * 1.15 + sideNebula * 0.85 + ringGlow + stars) * uIntensity;
    return totalCol;

    }
`;

export const skyFragmentShader = /* glsl */`
precision highp float;
varying vec3 vWorldDir;
uniform float uTime;
uniform float uIntensity;
uniform float uEnergy;
uniform float uClick;
uniform int uTheme;
uniform vec3 uCamDir;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
${ambientSkyFunctions}
void main() {
    vec3 color = sampleAmbientSky(normalize(vWorldDir), uCamDir, uCamRight, uCamUp, uTime, uIntensity, uEnergy, uClick, uTheme);
    gl_FragColor = vec4(ambientAces(color), 1.0);
}
`;
