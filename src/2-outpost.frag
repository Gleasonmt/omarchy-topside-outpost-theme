// Topside: Outpost. Dusk over layered mesas. A lattice radio mast blinks red
// on the near ridge, a drone hovers and sweeps the valley with its light, a
// raider in a long coat watches from the rocks, and a convoy's lights crawl
// across the valley floor while the first stars come out.
// still: 37
// detail: .37 .03 .63 .29      the mast's warning light and its glow
// detail: -.5 -.34 .14 .24     the drone, its whole beam sweep, and the raider's coat below

const vec3 SIGNAL = vec3(.95, .55, .07);
const vec3 RED = vec3(1., .04, .02);
const float HORIZON = -.04;

float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float smin(float a, float b, float k) { float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
float fill(float d) { return clamp(.5 - d * resolution.y, 0., 1.); }

vec2 SUNSET = vec2(-.55, -.07);   // just below the horizon

vec3 skyCol(vec2 p) {
  float h = p.y - HORIZON;
  vec3 top = srgb(vec3(.06, .08, .16)), mid = srgb(vec3(.36, .22, .32)), low = srgb(vec3(.98, .55, .3));
  float glow = exp(-length((p - SUNSET) * vec2(.6, 1.6)) * 2.2);
  vec3 col = mix(mix(mid, low, glow), top, smoothstep(.02, .45, h));
  col += srgb(vec3(1., .5, .22)) * exp(-length((p - SUNSET) * vec2(.4, 2.5)) * 4.) * .6;
  // stars come out away from the glow
  vec2 sp = p * 220.;
  float st = hash21(floor(sp));
  if (st > .988) {
    float tw = .6 + .4 * sin(ST * (.8 + st * 3.) + st * 40.);
    col += vec3(.8, .85, 1.) * smoothstep(.3, 0., length(fract(sp) - .5)) * tw * smoothstep(.12, .4, h) * (st - .988) * 50.;
  }
  // thin high clouds catching the last light
  vec2 q = p * vec2(1.2, 9.) + vec2(ST * .02, 0.);
  float c = fbm(q + fbm(q * 2.1) * .6);
  float band = smoothstep(.08, .2, h) * smoothstep(.45, .25, h);
  col = mix(col, mix(srgb(vec3(.25, .14, .2)), srgb(vec3(1., .5, .4)), glow * 1.5 + .2), smoothstep(.5, .8, c) * band * .8);
  // now and then a shooting star (full motion only; it's never in the still)
  float shot = floor(ST / 23.), phase = fract(ST / 23.);
  if (hash11(shot) > .4 && phase < .05) {
    vec2 a = vec2(hash11(shot + .1) * 1.6 - .9, .38 + hash11(shot + .2) * .1);
    vec2 dir = normalize(vec2(1., -.35));
    vec2 head = a + dir * phase / .05 * .35;
    vec2 v = p - head;
    float along = dot(v, -dir), across = abs(dot(v, vec2(-dir.y, dir.x)));
    col += vec3(.9, .95, 1.) * smoothstep(.0015, 0., across) * smoothstep(.12, 0., along) * step(0., along) * (1. - phase / .05) * 1.5;
  }
  return col;
}

// Flat-topped mesas: a top height per segment and steep, slightly eroded sides.
float mesa(float x, float base, float height, float scale, float seed) {
  float i = floor(x / scale), f = fract(x / scale);
  float r = hash11(i + seed), r2 = hash11(i * 3.1 + seed);
  float on = step(.45, r2);
  float w0 = .1 + .2 * r, w1 = .7 + .25 * r2;
  float cliff = smoothstep(w0 - .06, w0 + .02, f) * smoothstep(w1 + .06, w1 - .02, f);
  float top = base + height * (.5 + .5 * r) * cliff * on;
  float slope = base + height * .25 * (1. - abs(f - .5) * 2.) * (1. - on);   // low buttes between
  return max(top, slope) + (fbm1(x * 30. + seed) - .5) * .012 * scale / .2;
}

// Lattice mast: tapering outline with cross bracing.
float mast(vec2 p, vec2 base, float h, out vec2 light) {
  vec2 q = p - base;
  light = base + vec2(0, h + .012);
  float y = q.y / h;
  if (y < -.01 || y > 1.04) return 1e9;
  float halfW = mix(.012, .002, clamp(y, 0., 1.));
  float d = min(abs(abs(q.x) - halfW), 1e9);
  float legs = d - .0012;
  // diagonal bracing between the legs
  float seg = h / 14.;
  float sy = mod(q.y, seg) / seg;
  float diag = abs(q.x - mix(-halfW, halfW, sy));
  float diag2 = abs(q.x - mix(halfW, -halfW, sy));
  float brace = (min(diag, diag2) - .0008) + step(halfW, abs(q.x)) * 1e3;
  d = min(legs, brace);
  d = min(d, sdSeg(q, vec2(0, h), vec2(0, h + .012)) - .0008);   // whip
  d = min(d, sdBox2(q - vec2(.006, h * .7), vec2(.004, .006)));   // dish
  // guy wires to the ground
  d = min(d, sdSeg(q, vec2(0, h * .8), vec2(-.09, 0)) - .0004);
  d = min(d, sdSeg(q, vec2(0, h * .8), vec2(.08, -.005)) - .0004);
  return d;
}

float drone(vec2 p, vec2 at, out vec2 lamp) {
  vec2 q = p - at;
  float tilt = .08 * sin(time * .5);
  q = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * q;
  float d = sdBox2(q, vec2(.012, .004)) - .002;
  d = min(d, sdSeg(q, vec2(-.022, .004), vec2(.022, .004)) - .001);           // arms
  float spin = abs(sin(time * 40.));
  d = min(d, sdBox2(q - vec2(-.022, .007), vec2(.008 * spin + .002, .0006)));   // rotors
  d = min(d, sdBox2(q - vec2(.022, .007), vec2(.008 * (1. - spin) + .002, .0006)));
  d = min(d, sdSeg(q, vec2(-.006, -.004), vec2(-.009, -.009)) - .0008);         // skids
  d = min(d, sdSeg(q, vec2(.006, -.004), vec2(.009, -.009)) - .0008);
  lamp = at + vec2(0, -.006);
  return d;
}

// Standing figure in a long coat, pack on the back, looking out to the left.
float raider(vec2 p, vec2 at, float s, out float coat) {
  vec2 q = (p - at) / s;
  float d = sdSeg(q, vec2(0, .45), vec2(.01, .78)) - .07;              // torso
  d = smin(d, length(q - vec2(-.01, .9)) - .06, .02);                    // head
  d = min(d, sdSeg(q, vec2(-.05, .93), vec2(-.09, .91)) - .015);         // cap brim
  d = min(d, sdBox2(q - vec2(.1, .68), vec2(.06, .12)) - .02);           // pack
  d = min(d, sdSeg(q, vec2(.02, .45), vec2(-.04, .0)) - .035);           // legs
  d = min(d, sdSeg(q, vec2(.02, .45), vec2(.08, .0)) - .035);
  d = min(d, sdSeg(q, vec2(-.02, .74), vec2(-.1, .55)) - .025);          // arm
  d = min(d, sdSeg(q, vec2(-.12, .5), vec2(.03, .98)) - .012);           // rifle slung upright
  // coat tails in the wind
  float w = sin(time * 3.1) * .03 + sin(time * 7.3) * .012;
  float cd = sdSeg(q, vec2(.02, .5), vec2(.16 + w, .22)) - .045;
  cd = min(cd, sdSeg(q, vec2(-.02, .5), vec2(.09 + w * .6, .2)) - .04);
  coat = cd * s;
  return min(d, cd) * s;
}

void main() {
  vec2 p = sceneP();
  vec3 col = skyCol(p);
  float glowX = exp(-abs(p.x - SUNSET.x) * 1.5);

  // three ranges of mesas, each darker and less hazy
  vec3 hazeCol = srgb(vec3(.62, .36, .36));
  float m1 = mesa(p.x + 2., HORIZON, .07, .32, 1.);
  col = mix(col, mix(hazeCol, srgb(vec3(.45, .26, .32)), .3), fill(p.y - m1));
  col += srgb(vec3(1., .5, .3)) * exp(-abs(p.y - m1) * 500.) * .25 * glowX;   // lit rims
  float m2 = mesa(p.x + 7., HORIZON - .05, .11, .45, 4.);
  col = mix(col, srgb(vec3(.22, .13, .17)), fill(p.y - m2));
  col += srgb(vec3(1., .45, .25)) * exp(-abs(p.y - m2) * 600.) * .35 * glowX;
  // haze pooled in the valley
  col = mix(col, hazeCol * .8, (1. - smoothstep(HORIZON - .14, HORIZON - .02, p.y)) * .25 * (1. - fill(p.y - m2)));

  // the convoy: a short string of headlights crawling along the valley
  float cx = mod(ST * .016, 2.6) - 1.3;
  for (int i = 0; i < 4; i++) {
    vec2 lp = vec2(cx - float(i) * .018, HORIZON - .115 + .004 * sin(cx * 9. + float(i)));
    float d = length((p - lp) * vec2(1., 1.6));
    col += srgb(vec3(1., .85, .6)) * (exp(-d * 1400.) * 2.2 + exp(-d * 200.) * .2);
  }

  float m3 = mesa(p.x - 3., HORIZON - .12, .12, .6, 9.);
  col = mix(col, srgb(vec3(.08, .05, .07)), fill(p.y - m3));

  // the near ridge the outpost stands on
  float ridge = -.27 + .06 * sin(p.x * 1.6 + .8) + .04 * (fbm1(p.x * 6. + 2.) - .5) + .012 * (noise1(p.x * 60.) - .5);
  float onRidge = fill(p.y - ridge);
  vec3 rock = mix(srgb(vec3(.05, .03, .035)), srgb(vec3(.09, .05, .05)), fbm(p * vec2(20., 40.)));
  rock += srgb(vec3(1., .45, .25)) * exp(-max(ridge - p.y, 0.) * 160.) * .07 * (1. - smoothstep(-.6, .3, p.x));
  col = mix(col, rock, onRidge);

  // the mast on the ridge, right of centre
  float mx = .5;
  vec2 light;
  float md = mast(p, vec2(mx, -.27 + .06 * sin(mx * 1.6 + .8) + .04 * (fbm1(mx * 6. + 2.) - .5) - .005), .36, light);
  col = mix(col, srgb(vec3(.03, .02, .025)), fill(md));
  float blink = step(.5, fract(time * .5)) * smoothstep(1., .9, fract(time * .5));
  float ld = length(p - light);
  // (its glow fades out well inside its Details patch, so blinking off
  // doesn't leave a square of glow in the still around it)
  col += RED * blink * (smoothstep(.004, .001, ld) * 4. + exp(-ld * 60.) * .5 + exp(-ld * 30.) * .07);
  col += RED * smoothstep(.003, .0, ld) * .6;

  // the drone, drifting about the mast and sweeping the valley with a beam
  // the drone ranges over the valley (full motion); in Lite it holds and bobs
  vec2 dpos = vec2(.18 + .26 * sin(ST * .13) + .03 * sin(ST * .41), .11 + .05 * sin(ST * .23)) + vec2(.003 * sin(time * .7), .006 * sin(time * 1.9));
  vec2 lamp;
  float dd = drone(p, dpos, lamp);
  col = mix(col, srgb(vec3(.02, .015, .02)), fill(dd));
  float scanning = smoothstep(.3, .5, sin(time * .11)) ;
  // the beam sweeps the valley; in Lite a narrower sweep that stays inside
  // its patch
  float ang = -1.85 + mix(.45, .24, detail) * sin(time * .4);
  vec2 v = p - lamp;
  float cone = smoothstep(.07, .0, abs(atan(v.y, v.x) - ang)) * smoothstep(.0, .02, length(v)) * exp(-length(v) * 2.6) * step(v.y, 0.);
  cone *= smoothstep(ridge - .03, ridge + .01, p.y);   // it ends where it meets the ground
  col += SIGNAL * cone * scanning * .35 * (.6 + .4 * fbm(p * 18. + time * .1));
  float dl = length(p - lamp - vec2(.0, -.001));
  col += vec3(.3, 1., .5) * (step(.85, fract(time * .8)) * exp(-dl * 300.) * 1.2 + exp(-dl * 900.) * .5);

  // the raider on the rocks, left of centre
  float rx = -.2;
  float coat;
  vec2 rAt = vec2(rx, -.27 + .06 * sin(rx * 1.6 + .8) + .04 * (fbm1(rx * 6. + 2.) - .5) - .006);
  float rr = raider(p, rAt, .16, coat);
  col = mix(col, srgb(vec3(.02, .012, .015)), fill(rr));
  // rim of warm light on the edge facing the sunset (left)
  float inner = raider(p - vec2(.0016, .0006), rAt, .16, coat);
  col += srgb(vec3(1., .5, .25)) * fill(rr) * (1. - fill(inner)) * .35;

  // dust drifting through the evening air
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 mp = p * (7. + fi * 4.) + vec2(ST * (.26 + fi * .1), sin(ST * .3 + fi) * .2);
    vec2 cell = floor(mp), f = fract(mp) - .5;
    float h = hash21(cell + fi * 17.);
    if (h > .96) col += srgb(vec3(1., .7, .5)) * smoothstep(.05, .0, length(f)) * (h - .96) * 5. * glowX;
  }
  fragColor = finish(col);
}
