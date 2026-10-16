import React, { useEffect, useRef } from 'react';

/**
 * RadialHeroNetwork
 * Full-bleed 3D point-cloud graph behind the hero copy, drawn with Canvas 2D
 * and a simple perspective camera.
 *
 * Phases (auto-cycling):
 *  - Constellation: monochrome cloud with hairline links, slowly rotating
 *  - Burst: every dot flies out along a spoke from a central hub and takes on
 *    a signal colour (ink / olive / mustard / orange); still rotating
 *
 * Interaction:
 *  - Drag (grab cursor) to spin the cloud; release keeps spinning with inertia
 *  - Click without dragging to jump to the next phase
 *  - Hovered dot grows slightly
 *
 * Stops when off-screen or the tab is hidden. Under reduced motion there is no
 * auto-rotation or auto-cycling, and morphs are instant; dragging still works.
 */

const HOLD_MS = { scatter: 6800, burst: 5000 };
const MORPH_MS = 1600;
const STAGGER_MS = 650;
const CAMERA = 3.2;
const AUTO_SPIN = 0.00011; // rad per ms
const BASE_TILT = 0.22;

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand) {
  const u = Math.max(rand(), 1e-6);
  const v = rand();
  return Math.max(-2.7, Math.min(2.7, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const lerp = (a, b, t) => a + (b - a) * t;

function parseColor(value, fallback) {
  const hex = (value || '').trim().replace('#', '');
  return /^[0-9a-f]{6}$/i.test(hex) ? [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) : fallback;
}

/** 3D constellation in world units: a tall gaussian cloud plus a few far outliers. */
function buildScatter(rand, count) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const far = rand() < 0.1;
    const k = far ? 1.5 : 1;
    let r = 3 + Math.pow(rand(), 1.6) * 4.6;
    if (rand() < 0.06) r = 1.1;
    items.push({
      x: gaussian(rand) * 0.36 * k,
      y: gaussian(rand) * 0.4 * k,
      z: gaussian(rand) * 0.36 * k,
      r,
    });
  }
  for (let h = 0; h < Math.round(count * 0.07); h += 1) {
    items[Math.floor(rand() * count)].r = 9 + rand() * 3;
  }

  const links = [];
  const seen = new Set();
  const addLink = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    links.push([a, b]);
  };
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  items.forEach((n, i) => {
    let best = -1;
    let bestD = Infinity;
    items.forEach((m, j) => {
      if (j === i) return;
      const d = dist2(n, m);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    if (rand() < 0.7) addLink(i, best);
    if (rand() < 0.38) {
      // Longer reach across the cloud
      for (let tries = 0; tries < 6; tries += 1) {
        const j = Math.floor(rand() * count);
        if (dist2(n, items[j]) < 0.42) {
          addLink(i, j);
          break;
        }
      }
    }
  });
  return { items, links };
}

/** 3D burst: dots on random directions from the hub, a few hugging the centre. */
function buildBurst(rand, count) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    let dx = gaussian(rand);
    let dy = gaussian(rand);
    let dz = gaussian(rand);
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len;
    dy /= len;
    dz /= len;
    const inner = rand() < 0.12;
    const dist = inner ? 0.05 + rand() * 0.16 : 0.34 + Math.pow(rand(), 0.75) * 0.92;
    let r = 2 + Math.pow(rand(), 1.6) * 6.4;
    if (rand() < 0.07) r = 0.9 + rand();
    const roll = rand();
    const tone = inner || roll < 0.44 ? 'ink' : roll < 0.62 ? 'olive' : roll < 0.81 ? 'mustard' : 'orange';
    items.push({ x: dx * dist, y: dy * dist * 1.08, z: dz * dist, r, tone, spoke: !inner || rand() < 0.5 });
  }
  for (let g = 0; g < 3; g += 1) {
    items[Math.floor(rand() * count)].r = 12 + rand() * 6;
  }
  return { items };
}

export default function RadialHeroNetwork({ className = '' }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rand = mulberry32(2207);

    let width = 1;
    let height = 1;
    let dpr = 1;
    let isMobile = null;
    let count = 0;
    let palette = null;
    let view = { cx: 0, cy: 0, scale: 1, size: 1 };

    let dots = [];
    let scatter = null;
    let burst = null;
    let current = 'scatter';
    let morphStart = 0;
    let phaseClock = 0;

    // Camera rotation + drag inertia
    let rotY = 0.6;
    let rotX = BASE_TILT;
    let spinVel = 0;
    const drag = { active: false, moved: 0, lastX: 0, lastY: 0, lastT: 0, id: null };

    let frameId = 0;
    let running = false;
    let onScreen = true;
    let lastNow = performance.now();
    let projected = [];
    let hovered = -1;
    const pointer = { x: -9999, y: -9999, inside: false };

    function readPalette() {
      const cs = getComputedStyle(host);
      palette = {
        ink: parseColor(cs.getPropertyValue('--hero-ink'), [26, 22, 20]),
        olive: parseColor(cs.getPropertyValue('--hero-olive'), [168, 156, 58]),
        mustard: parseColor(cs.getPropertyValue('--hero-mustard'), [221, 168, 59]),
        orange: parseColor(cs.getPropertyValue('--hero-orange'), [238, 126, 74]),
      };
    }

    function layoutView() {
      view = isMobile
        ? { cx: width * 0.52, cy: height - Math.min(180, height * 0.25), scale: Math.min(width * 0.36, 150), size: 0.78 }
        : { cx: width * 0.735, cy: height * 0.5, scale: Math.min(height * 0.46, width * 0.3), size: Math.min(1.15, Math.max(0.75, width / 1440)) };
    }

    function worldTarget(i, phaseName, now) {
      const d = dots[i];
      const t = reducedMotion ? 0 : now;
      const wob = 0.018;
      const wx = Math.sin(t * d.fx + d.px) * wob;
      const wy = Math.cos(t * d.fy + d.py) * wob;
      if (phaseName === 'scatter') {
        const it = scatter.items[i];
        return { x: it.x + wx, y: it.y + wy, z: it.z, r: it.r, rgb: palette.ink, bw: 0 };
      }
      const it = burst.items[i];
      const breath = 1 + Math.sin(t * 0.0011) * 0.02;
      return { x: it.x * breath + wx * 0.4, y: it.y * breath + wy * 0.4, z: it.z * breath, r: it.r, rgb: palette[it.tone], bw: it.spoke ? 1 : 0 };
    }

    function project(x, y, z) {
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      const persp = CAMERA / Math.max(0.9, CAMERA + z2);
      return { sx: view.cx + x1 * view.scale * persp, sy: view.cy + y2 * view.scale * persp, persp, depth: z2 };
    }

    function goTo(nextPhase, now) {
      dots.forEach((d, i) => {
        const p = projected[i];
        if (p) d.from = { x: p.wx, y: p.wy, z: p.wz, r: p.wr, rgb: p.rgb, bw: p.bw, lv: p.lv };
        d.delay = rand() * STAGGER_MS;
      });
      if (nextPhase === 'scatter') {
        scatter = buildScatter(rand, count);
      } else {
        burst = buildBurst(rand, count);
        // Dots nearest the centre leave first so the burst radiates outward
        dots.forEach((d) => {
          d.delay = Math.min(1, Math.hypot(d.from.x, d.from.y, d.from.z) / 1.4) * STAGGER_MS + rand() * 120;
        });
      }
      current = nextPhase;
      morphStart = now;
      phaseClock = 0;
    }

    function init(now) {
      count = isMobile ? 70 : 110;
      scatter = buildScatter(rand, count);
      burst = buildBurst(rand, count);
      dots = Array.from({ length: count }, () => ({
        px: rand() * Math.PI * 2,
        py: rand() * Math.PI * 2,
        fx: 0.0004 + rand() * 0.0005,
        fy: 0.0004 + rand() * 0.0005,
        delay: 0,
        from: null,
      }));
      // Intro: everything unfolds from the centre
      dots.forEach((d, i) => {
        const it = scatter.items[i];
        d.from = { x: it.x * 0.15, y: it.y * 0.15, z: it.z * 0.15, r: 0, rgb: palette.ink, bw: 0, lv: 0 };
        d.delay = 120 + Math.min(1, Math.hypot(it.x, it.y, it.z) / 1.3) * 1100 + rand() * 350;
      });
      current = 'scatter';
      morphStart = now;
      phaseClock = 0;
    }

    function resize() {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      readPalette();
      const mobile = width < 768;
      if (mobile !== isMobile) {
        isMobile = mobile;
        layoutView();
        init(performance.now());
      } else {
        layoutView();
      }
      if (!running) draw(performance.now());
    }

    function draw(now) {
      const dt = Math.min(50, Math.max(0, now - lastNow));
      lastNow = now;

      if (!reducedMotion) {
        phaseClock += drag.active ? dt * 0.3 : dt;
        if (phaseClock > HOLD_MS[current] + MORPH_MS + STAGGER_MS) goTo(current === 'scatter' ? 'burst' : 'scatter', now);
      }

      // Rotation: auto-spin plus decaying drag inertia; tilt eases back to baseline
      if (!drag.active) {
        rotY += (reducedMotion ? 0 : AUTO_SPIN * dt) + spinVel * dt;
        spinVel *= Math.pow(0.94, dt / 16.7);
        rotX += (BASE_TILT - rotX) * Math.min(1, dt * 0.002);
      }

      const s = view.size;
      projected = dots.map((d, i) => {
        const tgt = worldTarget(i, current, now);
        const raw = reducedMotion ? 1 : clamp01((now - morphStart - d.delay) / MORPH_MS);
        const e = easeInOutCubic(raw);
        const grow = d.from.r === 0 ? easeOutBack(raw) : e;
        const wx = lerp(d.from.x, tgt.x, e);
        const wy = lerp(d.from.y, tgt.y, e);
        const wz = lerp(d.from.z, tgt.z, e);
        const wr = Math.max(0, lerp(d.from.r, tgt.r, grow));
        const rgb = [0, 1, 2].map((k) => Math.round(lerp(d.from.rgb[k], tgt.rgb[k], e)));
        const bw = lerp(d.from.bw, tgt.bw, e);
        const lv = current === 'scatter' ? clamp01((raw - 0.55) / 0.45) : lerp(d.from.lv, 0, clamp01(raw * 2.5));
        const p = project(wx, wy, wz);
        return { ...p, r: wr * s * p.persp, wx, wy, wz, wr, rgb, bw, lv };
      });

      hovered = -1;
      if (pointer.inside && !drag.active) {
        let best = Infinity;
        projected.forEach((p, i) => {
          const dd = Math.hypot(p.sx - pointer.x, p.sy - pointer.y);
          if (p.r > 0.5 && dd < Math.max(10, p.r + 6) && dd < best) {
            best = dd;
            hovered = i;
          }
        });
      }

      const ink = palette.ink.join(',');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = `rgb(${ink})`;

      // Links (fainter when far from the camera)
      ctx.lineWidth = 0.7;
      scatter.links.forEach(([a, b]) => {
        const pa = projected[a];
        const pb = projected[b];
        const vis = Math.min(pa.lv, pb.lv);
        if (vis <= 0.02) return;
        const depthFade = clamp01(0.55 + (pa.persp + pb.persp - 2) * 0.6);
        ctx.globalAlpha = vis * 0.16 * depthFade;
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      });

      // Spokes from the hub
      const hub = project(0, 0, 0);
      projected.forEach((p) => {
        if (p.bw <= 0.02 || p.r <= 0.3) return;
        ctx.globalAlpha = p.bw * 0.28 * clamp01(0.5 + (p.persp - 1) * 0.8);
        ctx.beginPath();
        ctx.moveTo(hub.sx, hub.sy);
        ctx.lineTo(p.sx, p.sy);
        ctx.stroke();
      });

      // Dots, far to near
      ctx.globalAlpha = 1;
      projected
        .map((p, i) => [p, i])
        .sort((a, b) => b[0].depth - a[0].depth)
        .forEach(([p, i]) => {
          if (p.r <= 0.05) return;
          ctx.fillStyle = `rgb(${p.rgb.join(',')})`;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, hovered === i ? p.r * 1.35 + 1 : p.r, 0, Math.PI * 2);
          ctx.fill();
        });
    }

    function loop(now) {
      draw(now);
      frameId = window.requestAnimationFrame(loop);
    }

    function start() {
      if (running || !onScreen || document.hidden) return;
      running = true;
      lastNow = performance.now();
      frameId = window.requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      window.cancelAnimationFrame(frameId);
    }

    function localPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function onPointerDown(event) {
      if (event.button !== 0) return;
      const pt = localPoint(event);
      drag.active = true;
      drag.moved = 0;
      drag.lastX = pt.x;
      drag.lastY = pt.y;
      drag.lastT = performance.now();
      drag.id = event.pointerId;
      spinVel = 0;
      host.classList.add('is-dragging');
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer no longer active (e.g. synthetic or cancelled); drag still works without capture
      }
      start();
    }

    function onPointerMove(event) {
      const pt = localPoint(event);
      pointer.x = pt.x;
      pointer.y = pt.y;
      pointer.inside = true;
      if (!drag.active || event.pointerId !== drag.id) {
        if (!running) draw(performance.now());
        return;
      }
      const now = performance.now();
      const dx = pt.x - drag.lastX;
      const dy = pt.y - drag.lastY;
      const dtm = Math.max(1, now - drag.lastT);
      drag.moved += Math.abs(dx) + Math.abs(dy);
      rotY += dx * 0.006;
      rotX = Math.max(-0.9, Math.min(0.9, rotX + dy * 0.004));
      spinVel = (dx * 0.006) / dtm;
      drag.lastX = pt.x;
      drag.lastY = pt.y;
      drag.lastT = now;
      if (!running) draw(now);
    }

    function endDrag(event) {
      if (!drag.active || (event && event.pointerId !== drag.id)) return;
      drag.active = false;
      host.classList.remove('is-dragging');
      try {
        canvas.releasePointerCapture(drag.id);
      } catch {
        // Capture was never taken or already released
      }
      // A click without a drag advances the phase
      if (event && event.type === 'pointerup' && drag.moved < 4) {
        spinVel = 0;
        goTo(current === 'scatter' ? 'burst' : 'scatter', performance.now());
      }
      if (reducedMotion) spinVel = 0;
    }

    function onPointerLeave() {
      pointer.inside = false;
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    intersection.observe(host);

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div ref={hostRef} className={`bb-hero-network ${className}`.trim()} aria-hidden="true">
      <canvas ref={canvasRef} className="bb-hero-network__canvas" />
    </div>
  );
}
