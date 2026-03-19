import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState } from '../game/types';
import { computeStats } from '../game/stats';
import { getPlanet, calcDamage } from '../game/planets';

interface FloatText { id: number; x: number; y: number; value: number }
interface Props { state: GameState; onClickPlanet: () => void }

let nextId = 0;
const CX = 150, CY = 150, R = 110;
const TWO_PI = Math.PI * 2;

// ── Seeded RNG ─────────────────────────────────────────────────────────────
function seeded(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff;
  };
}

// ── Shared helpers ─────────────────────────────────────────────────────────
function clipToCircle(ctx: CanvasRenderingContext2D) {
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, TWO_PI); ctx.clip();
}

function specularHighlight(ctx: CanvasRenderingContext2D, alpha: number) {
  const g = ctx.createRadialGradient(CX - R * 0.38, CY - R * 0.42, 0, CX - R * 0.1, CY - R * 0.1, R * 0.65);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
}

// ── Pre-generated data ─────────────────────────────────────────────────────

// Continent polygons (normalized, relative to planet center in [-1,1])
interface ContPoly { cx: number; cy: number; pts: { a: number; r: number }[] }
const CONTINENTS: ContPoly[] = (() => {
  const rng = seeded(0xc0fe1234);
  return Array.from({ length: 6 }, () => {
    const cx_ = (rng() - 0.5) * 1.3;
    const cy_ = (rng() - 0.5) * 1.3;
    const n   = 8 + Math.floor(rng() * 5);
    return {
      cx: cx_, cy: cy_,
      pts: Array.from({ length: n }, (_, i) => ({
        a: (i / n) * TWO_PI + (rng() - 0.5) * 0.5,
        r: 0.1 + rng() * 0.22,
      })),
    };
  });
})();

// Clouds (angle, elevation, width, height)
interface Cloud { a: number; lat: number; w: number; h: number; speed: number }
const CLOUDS: Cloud[] = (() => {
  const rng = seeded(0xbadf00d);
  return Array.from({ length: 9 }, () => ({
    a:     rng() * TWO_PI,
    lat:   (rng() - 0.5) * 0.7,
    w:     R * (0.12 + rng() * 0.18),
    h:     R * (0.04 + rng() * 0.06),
    speed: 0.00008 + rng() * 0.00012,
  }));
})();

// Craters (shared across all planets)
const CRATERS = (() => {
  const rng = seeded(0xfe1234ab);
  return Array.from({ length: 25 }, () => ({
    nx: (rng() - 0.5) * 1.6, ny: (rng() - 0.5) * 1.6,
    nr: 0.04 + rng() * 0.10, rimW: 0.4 + rng() * 1.2,
  }));
})();

// Ice cracks for frozen planet
const ICE_CRACKS = (() => {
  const rng = seeded(0x1ce1ce);
  return Array.from({ length: 14 }, () => ({
    sx: (rng() - 0.5) * 1.8, sy: (rng() - 0.5) * 1.8,
    pts: Array.from({ length: 6 }, () => ({ dx: (rng() - 0.5) * 0.4, dy: (rng() - 0.5) * 0.4 })),
  }));
})();

// Void energy cracks
const VOID_CRACKS = (() => {
  const rng = seeded(0xv01d9999);
  return Array.from({ length: 10 }, () => ({
    startA: rng() * TWO_PI,
    pts: Array.from({ length: 7 }, () => ({ da: (rng() - 0.5) * 0.7, dr: 0.1 + rng() * 0.3 })),
  }));
})();

// ══════════════════════════════════════════════════════════════════════════
// PLANET 0 — EARTH
// ══════════════════════════════════════════════════════════════════════════
function drawEarth(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  // Ocean base — shifts from deep blue to barren grey/brown as damage grows
  const oceanH = 215 - d * 160;
  const oceanS = Math.round(75 - d * 45);
  const oceanL = Math.round(35 + (1 - d) * 10);
  const ocean = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, 0, CX, CY, R);
  ocean.addColorStop(0,   `hsl(${oceanH}, ${oceanS}%, ${oceanL + 15}%)`);
  ocean.addColorStop(0.5, `hsl(${oceanH}, ${oceanS}%, ${oceanL}%)`);
  ocean.addColorStop(1,   `hsl(${oceanH - 10}, ${oceanS + 5}%, ${Math.max(8, oceanL - 12)}%)`);
  ctx.fillStyle = ocean; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  // Polar ice caps (fade at d > 0.55)
  if (d < 0.7) {
    const iceA = Math.max(0, (0.7 - d) / 0.5) * 0.9;
    ctx.fillStyle = `rgba(230, 245, 255, ${iceA})`;
    ctx.beginPath(); ctx.ellipse(CX, CY - R * 0.82, R * 0.48, R * 0.22, 0, 0, TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(CX, CY + R * 0.86, R * 0.36, R * 0.16, 0, 0, TWO_PI); ctx.fill();
  }

  // Continents
  if (d < 0.92) {
    const greenMix = Math.max(0, 1 - d / 0.6); // 1=lush, 0=scorched
    CONTINENTS.forEach((cont, ci) => {
      if (cont.pts.length < 3) return;
      const distFromCenter = Math.sqrt(cont.cx ** 2 + cont.cy ** 2);
      if (distFromCenter > 1.05) return; // skip if mostly off-planet

      // Continent fill
      const landH = greenMix > 0.5 ? 100 + ci * 15    // greens
                  : d < 0.75 ? 30 + ci * 8             // browns
                  : 20 + ci * 5;                        // charred
      const landS = Math.round(35 + greenMix * 40);
      const landL = Math.round(22 + greenMix * 20 - d * 8);
      ctx.beginPath();
      const first = cont.pts[0];
      ctx.moveTo(CX + (cont.cx + Math.cos(first.a) * first.r) * R,
                 CY + (cont.cy + Math.sin(first.a) * first.r) * R);
      for (let i = 1; i <= cont.pts.length; i++) {
        const p  = cont.pts[i % cont.pts.length];
        const pp = cont.pts[(i - 1) % cont.pts.length];
        const mx = CX + (cont.cx + Math.cos((pp.a + p.a) / 2) * ((pp.r + p.r) / 2)) * R;
        const my = CY + (cont.cy + Math.sin((pp.a + p.a) / 2) * ((pp.r + p.r) / 2)) * R;
        ctx.quadraticCurveTo(
          CX + (cont.cx + Math.cos(pp.a) * pp.r) * R,
          CY + (cont.cy + Math.sin(pp.a) * pp.r) * R,
          mx, my,
        );
      }
      ctx.closePath();
      ctx.fillStyle = `hsl(${landH}, ${landS}%, ${landL}%)`;
      ctx.fill();

      // Mountain ridges (thin lighter lines)
      if (greenMix > 0.2) {
        ctx.strokeStyle = `hsla(${landH + 10}, ${landS - 10}%, ${landL + 18}%, 0.4)`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });

    // Lava cracks at high damage
    if (d > 0.55) {
      const lavaA = (d - 0.55) / 0.45;
      VOID_CRACKS.slice(0, 6).forEach(ck => {
        ctx.beginPath();
        let a = ck.startA, dist = R * 0.05;
        ctx.moveTo(CX + Math.cos(a) * dist, CY + Math.sin(a) * dist);
        for (const pt of ck.pts) {
          a += pt.da; dist = Math.min(R * 0.95, dist + pt.dr * R * 0.5);
          ctx.lineTo(CX + Math.cos(a) * dist, CY + Math.sin(a) * dist);
        }
        ctx.strokeStyle = `hsla(25, 100%, 60%, ${lavaA * 0.8})`;
        ctx.lineWidth   = 1.5 + lavaA * 2;
        ctx.shadowColor = `rgba(255, 120, 0, ${lavaA})`;
        ctx.shadowBlur  = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
    }
  }

  // Cloud layer (rotates slowly, fades with damage)
  if (d < 0.65) {
    const cloudA = Math.max(0, (0.65 - d) / 0.55) * 0.85;
    CLOUDS.forEach(cl => {
      const angle = cl.a + t * cl.speed;
      const x = CX + Math.cos(angle) * R * 0.6;
      const y = CY + Math.sin(angle) * R * 0.35 + cl.lat * R * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, cl.w);
      g.addColorStop(0,   `rgba(255,255,255,${cloudA * 0.9})`);
      g.addColorStop(0.6, `rgba(240,248,255,${cloudA * 0.4})`);
      g.addColorStop(1,   'transparent');
      ctx.save();
      ctx.scale(1, cl.h / cl.w);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y * (cl.w / cl.h), cl.w, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    });
  }

  specularHighlight(ctx, 0.12 - d * 0.08);
  ctx.restore();

  // Atmosphere
  const atmA = Math.max(0, 1 - d * 1.3) * 0.45;
  const atm = ctx.createRadialGradient(CX, CY, R * 0.88, CX, CY, R * 1.28);
  atm.addColorStop(0,   `rgba(130, 200, 255, ${atmA})`);
  atm.addColorStop(0.6, `rgba(80, 160, 255, ${atmA * 0.4})`);
  atm.addColorStop(1,   'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.28, 0, TWO_PI);
  ctx.fillStyle = atm; ctx.fill();
}

// ══════════════════════════════════════════════════════════════════════════
// PLANET 1 — ARID (Mars-like)
// ══════════════════════════════════════════════════════════════════════════
function drawArid(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  // Base — dusty red
  const base = ctx.createRadialGradient(CX - R * 0.25, CY - R * 0.3, 0, CX, CY, R);
  base.addColorStop(0,   `hsl(${18 - d * 8}, 72%, ${38 + d * 6}%)`);
  base.addColorStop(0.5, `hsl(${12 - d * 5}, 80%, ${28}%)`);
  base.addColorStop(1,   `hsl(8, 85%, 14%)`);
  ctx.fillStyle = base; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  // Canyon stripes
  for (let i = 0; i < 5; i++) {
    const rng = seeded(i * 0x1234);
    const y   = CY - R * 0.6 + i * R * 0.28;
    const w   = R * (0.6 + rng() * 0.7);
    const h   = R * (0.03 + rng() * 0.05);
    ctx.beginPath(); ctx.ellipse(CX, y, w, h, rng() * 0.3, 0, TWO_PI);
    ctx.fillStyle = `hsla(8, 90%, 18%, 0.5)`; ctx.fill();
  }

  // Dust storm swirl (animated)
  const stormA = 0.15 + Math.sin(t * 0.0005) * 0.1;
  for (let i = 0; i < 4; i++) {
    const angle = t * 0.0003 * (i % 2 === 0 ? 1 : -1) + i * 1.5;
    const x = CX + Math.cos(angle) * R * 0.45;
    const y = CY + Math.sin(angle) * R * 0.3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.35);
    g.addColorStop(0,   `rgba(210, 140, 80, ${stormA})`);
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  }

  // Polar CO₂ cap (white/pink)
  const capA = 0.7 - d * 0.4;
  if (capA > 0) {
    ctx.fillStyle = `rgba(245, 235, 235, ${capA})`;
    ctx.beginPath(); ctx.ellipse(CX, CY - R * 0.84, R * 0.28, R * 0.12, 0, 0, TWO_PI); ctx.fill();
  }

  // Craters appear with damage
  const nCraters = Math.round(d * 18) + 4;
  CRATERS.slice(0, nCraters).forEach(c => {
    const cx_ = CX + c.nx * R * 0.9, cy_ = CY + c.ny * R * 0.9;
    const cr  = c.nr * R * (0.6 + d * 0.4);
    if (Math.sqrt((cx_ - CX) ** 2 + (cy_ - CY) ** 2) > R * 0.95) return;
    const shadow = ctx.createRadialGradient(cx_, cy_, 0, cx_, cy_, cr);
    shadow.addColorStop(0,   `rgba(0,0,0,0.55)`);
    shadow.addColorStop(0.7, `rgba(0,0,0,0.2)`);
    shadow.addColorStop(1,   'transparent');
    ctx.beginPath(); ctx.arc(cx_, cy_, cr, 0, TWO_PI);
    ctx.fillStyle = shadow; ctx.fill();
    ctx.strokeStyle = `hsla(20, 60%, 55%, 0.5)`;
    ctx.lineWidth = c.rimW; ctx.stroke();
  });

  specularHighlight(ctx, 0.08);
  ctx.restore();

  // Thin pink/orange atmosphere
  const atm = ctx.createRadialGradient(CX, CY, R * 0.9, CX, CY, R * 1.22);
  atm.addColorStop(0,   `rgba(220, 140, 80, 0.30)`);
  atm.addColorStop(0.7, `rgba(200, 100, 60, 0.10)`);
  atm.addColorStop(1,   'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.22, 0, TWO_PI);
  ctx.fillStyle = atm; ctx.fill();
}

// ══════════════════════════════════════════════════════════════════════════
// PLANET 2 — FROZEN
// ══════════════════════════════════════════════════════════════════════════
function drawFrozen(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  // Ice surface base
  const base = ctx.createRadialGradient(CX - R * 0.2, CY - R * 0.25, 0, CX, CY, R);
  base.addColorStop(0,   `hsl(195, 60%, ${72 - d * 20}%)`);
  base.addColorStop(0.5, `hsl(210, 70%, ${52 - d * 18}%)`);
  base.addColorStop(1,   `hsl(220, 80%, 20%)`);
  ctx.fillStyle = base; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  // Ice texture — light irregular patches
  for (let i = 0; i < 12; i++) {
    const rng = seeded(i * 0x5e3);
    const x   = CX + (rng() - 0.5) * R * 1.7;
    const y   = CY + (rng() - 0.5) * R * 1.7;
    const rx  = R * (0.08 + rng() * 0.2);
    const ry  = R * (0.05 + rng() * 0.12);
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rng() * Math.PI, 0, TWO_PI);
    ctx.fillStyle = `hsla(190, 50%, ${80 - d * 20}%, 0.35)`;
    ctx.fill();
  }

  // Deep ice cracks (blue glowing)
  const nCracks = Math.round(d * 14) + 3;
  ICE_CRACKS.slice(0, nCracks).forEach((ck, i) => {
    const thresh = i / 14;
    const alpha  = Math.min(1, (d - thresh * 0.5) / 0.12);
    if (alpha <= 0) return;
    ctx.beginPath();
    let x = CX + ck.sx * R * 0.8, y = CY + ck.sy * R * 0.8;
    ctx.moveTo(x, y);
    for (const pt of ck.pts) {
      x += pt.dx * R; y += pt.dy * R;
      ctx.lineTo(x, y);
    }
    ctx.shadowColor = `rgba(0, 200, 255, ${alpha * 0.9})`;
    ctx.shadowBlur  = 6;
    ctx.strokeStyle = `rgba(20, 180, 255, ${alpha * 0.85})`;
    ctx.lineWidth   = 1 + d * 2;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.shadowBlur  = 0;
  });

  // Sub-surface glow through cracks
  if (d > 0.3) {
    const glowA = (d - 0.3) / 0.7 * 0.4;
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 0.7);
    g.addColorStop(0,   `rgba(0, 220, 255, ${glowA})`);
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  }

  // Aurora shimmer on surface
  const auroraA = 0.15 + Math.sin(t * 0.0012) * 0.08;
  const auroraH = (t * 0.02) % 360;
  const aurora = ctx.createLinearGradient(CX - R, CY - R * 0.3, CX + R, CY + R * 0.3);
  aurora.addColorStop(0,    'transparent');
  aurora.addColorStop(0.35, `hsla(${auroraH}, 100%, 70%, ${auroraA})`);
  aurora.addColorStop(0.65, `hsla(${auroraH + 80}, 100%, 70%, ${auroraA})`);
  aurora.addColorStop(1,    'transparent');
  ctx.fillStyle = aurora; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  specularHighlight(ctx, 0.22 - d * 0.1);
  ctx.restore();

  // Thin icy atmosphere with aurora glow
  const atm = ctx.createRadialGradient(CX, CY, R * 0.87, CX, CY, R * 1.25);
  atm.addColorStop(0,   `hsla(${180 + Math.sin(t * 0.001) * 30}, 100%, 75%, 0.28)`);
  atm.addColorStop(0.5, `rgba(80, 220, 255, 0.10)`);
  atm.addColorStop(1,   'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.25, 0, TWO_PI);
  ctx.fillStyle = atm; ctx.fill();
}

// ══════════════════════════════════════════════════════════════════════════
// PLANET 3 — VOID
// ══════════════════════════════════════════════════════════════════════════
function drawVoid(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  // Dark base — shifting deep purple/black
  const hue  = (t * 0.01) % 360;
  const base = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, 0, CX, CY, R);
  base.addColorStop(0,   `hsl(${270 + Math.sin(t * 0.001) * 20}, 60%, 18%)`);
  base.addColorStop(0.5, `hsl(280, 80%, 8%)`);
  base.addColorStop(1,   `hsl(260, 100%, 4%)`);
  ctx.fillStyle = base; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  // Nebula swirls
  for (let i = 0; i < 5; i++) {
    const angle = t * 0.0002 * (i % 2 === 0 ? 1 : -1.3) + i * 1.26;
    const x = CX + Math.cos(angle) * R * 0.4;
    const y = CY + Math.sin(angle) * R * 0.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.5);
    g.addColorStop(0,   `hsla(${hue + i * 40}, 100%, 50%, 0.12)`);
    g.addColorStop(1,   'transparent');
    ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  }

  // Energy cracks (glowing, increase with damage)
  const nCracks = 4 + Math.round(d * 10);
  VOID_CRACKS.slice(0, nCracks).forEach((ck, i) => {
    const alpha = Math.min(1, 0.4 + d * 0.6);
    ctx.shadowColor = `hsla(${hue + i * 30}, 100%, 70%, ${alpha})`;
    ctx.shadowBlur  = 8 + d * 12;
    ctx.beginPath();
    let a = ck.startA, dist = R * 0.05;
    ctx.moveTo(CX + Math.cos(a) * dist, CY + Math.sin(a) * dist);
    for (const pt of ck.pts) {
      a += pt.da; dist = Math.min(R * 0.96, dist + pt.dr * R);
      ctx.lineTo(CX + Math.cos(a) * dist, CY + Math.sin(a) * dist);
    }
    ctx.strokeStyle = `hsla(${hue + i * 30}, 100%, 80%, ${alpha})`;
    ctx.lineWidth   = 1.5 + d * 2.5;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.shadowBlur  = 0;
  });

  // Central void core pulsing
  const pulse  = 1 + Math.sin(t * 0.003) * 0.15;
  const coreR  = R * (0.2 + d * 0.3) * pulse;
  const coreG  = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR);
  coreG.addColorStop(0,   `hsla(${hue}, 100%, 90%, 0.9)`);
  coreG.addColorStop(0.4, `hsla(${hue + 40}, 100%, 60%, 0.5)`);
  coreG.addColorStop(1,   'transparent');
  ctx.fillStyle = coreG; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  // Stars visible on surface
  for (let i = 0; i < 40; i++) {
    const rng = seeded(i * 0x77fa);
    const x   = CX + (rng() - 0.5) * R * 2;
    const y   = CY + (rng() - 0.5) * R * 2;
    const a   = (Math.sin(t * 0.0015 + i) * 0.5 + 0.5) * 0.7;
    ctx.beginPath(); ctx.arc(x, y, 0.8, 0, TWO_PI);
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
  }

  ctx.restore();

  // Pulsing outer void aura
  const auraA = 0.3 + Math.sin(t * 0.002) * 0.1;
  const aura  = ctx.createRadialGradient(CX, CY, R * 0.85, CX, CY, R * 1.4);
  aura.addColorStop(0,   `hsla(${hue}, 100%, 60%, ${auraA})`);
  aura.addColorStop(0.5, `hsla(${hue + 60}, 100%, 50%, ${auraA * 0.3})`);
  aura.addColorStop(1,   'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.4, 0, TWO_PI);
  ctx.fillStyle = aura; ctx.fill();
}

// ── Dispatch to correct planet renderer ────────────────────────────────────
function drawPlanet(ctx: CanvasRenderingContext2D, t: number, planetId: number, damage: number) {
  ctx.clearRect(0, 0, 300, 300);
  switch (planetId) {
    case 0: drawEarth(ctx, t, damage);  break;
    case 1: drawArid(ctx, t, damage);   break;
    case 2: drawFrozen(ctx, t, damage); break;
    case 3: drawVoid(ctx, t, damage);   break;
  }

  // Orbit ring of debris at high damage
  const debris = Math.floor(damage * 20);
  for (let i = 0; i < debris; i++) {
    const rng   = seeded(i * 0x777 + planetId);
    const speed = 0.0003 + rng() * 0.0007;
    const orbit = R * (1.08 + rng() * 0.45);
    const angle = rng() * TWO_PI + t * speed * (i % 2 === 0 ? 1 : -1);
    const x = CX + Math.cos(angle) * orbit;
    const y = CY + Math.sin(angle) * orbit;
    const dr = 0.8 + rng() * 2;
    ctx.beginPath(); ctx.arc(x, y, dr, 0, TWO_PI);
    ctx.fillStyle = `rgba(180,180,180,${0.3 + rng() * 0.5})`; ctx.fill();
  }
}

// ── Damage labels ──────────────────────────────────────────────────────────
const DAMAGE_STAGES = [
  [0.00, 'Pristine'],
  [0.15, 'Surface Erosion'],
  [0.35, 'Moderate Damage'],
  [0.55, 'Structural Damage'],
  [0.72, 'Critical Depletion'],
  [0.90, 'Nearly Exhausted'],
  [0.98, 'Depleted'],
] as const;

function damageLabel(d: number) {
  for (let i = DAMAGE_STAGES.length - 1; i >= 0; i--) {
    if (d >= DAMAGE_STAGES[i][0]) return DAMAGE_STAGES[i][1];
  }
  return 'Pristine';
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Planet({ state, onClickPlanet }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [floats, setFloats]   = useState<FloatText[]>([]);
  const [pressed, setPressed] = useState(false);
  const { orePerClick } = computeStats(state);

  const planet  = getPlanet(state.currentPlanet);
  const damage  = calcDamage(state.planetOreExtracted, planet);
  const label   = damageLabel(damage);
  const barColor = damage < 0.4 ? '#22d3a0' : damage < 0.72 ? '#f5a623' : '#ff4040';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const start = performance.now();
    function loop(now: number) {
      drawPlanet(ctx, now - start, state.currentPlanet, damage);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.currentPlanet, damage]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    onClickPlanet();
    const rect = e.currentTarget.getBoundingClientRect();
    const id   = nextId++;
    setFloats(f => [...f, { id, x: e.clientX - rect.left, y: e.clientY - rect.top, value: Math.round(orePerClick) }]);
    setTimeout(() => setFloats(f => f.filter(ft => ft.id !== id)), 900);
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
  }, [onClickPlanet, orePerClick]);

  const orbitDots = Math.min(Object.values(state.drones).reduce((a, b) => a + b, 0), 40);

  return (
    <div className="planet-area">
      <div
        className={`planet-wrapper${pressed ? ' pressed' : ''}`}
        onClick={handleClick}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <canvas ref={canvasRef} width={300} height={300} className="planet-canvas" />
        {orbitDots > 0 && (
          <div className="orbit-ring" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {Array.from({ length: orbitDots }).map((_, i) => (
              <div key={i} className="orbit-dot" style={{ '--i': i, '--total': orbitDots } as React.CSSProperties} />
            ))}
          </div>
        )}
        {floats.map(ft => (
          <div key={ft.id} className="float-text" style={{ left: ft.x, top: ft.y }}>
            +{ft.value} ore
          </div>
        ))}
      </div>

      <div className="planet-side-info">
        <div className="planet-name-badge">{planet.name}</div>
        <div className="damage-bar-wrap">
          <div className="damage-bar-label">
            <span>EXTRACTION DAMAGE</span>
            <span style={{ color: barColor }}>{Math.round(damage * 100)}%</span>
          </div>
          <div className="damage-bar-track">
            <div className="damage-bar-fill" style={{ width: `${damage * 100}%`, background: barColor, boxShadow: `0 0 8px ${barColor}80` }} />
          </div>
          <div className="damage-status" style={{ color: barColor }}>{label}</div>
        </div>
        <div className="planet-sublabel">+{Math.round(orePerClick)} ore/click · {planet.oreMultiplier}× yield</div>
      </div>
    </div>
  );
}
