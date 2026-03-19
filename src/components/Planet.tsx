import { useEffect, useRef, useState, useCallback, type MouseEvent } from 'react';
import type { GameState } from '../game/types';
import { computeStats } from '../game/stats';
import { getPlanet, calcDamage } from '../game/planets';

interface FloatText { id: number; x: number; y: number; value: number }
interface Props { state: GameState; onClickPlanet: () => void }

let nextId = 0;

// ── Layout constants ────────────────────────────────────────────────────────
const W = 420, H = 420;
const CX = 210, CY = 222, R = 148;   // Planet (420×420 canvas, centred with ship room at top)
const SHIP_X = 375, SHIP_Y = 32;      // Player spaceship (top-right, low orbit)
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

// ── 3D hemisphere shadow (light from top-left) ─────────────────────────────
function draw3DShadow(ctx: CanvasRenderingContext2D) {
  ctx.save(); clipToCircle(ctx);
  const g = ctx.createRadialGradient(
    CX + R * 0.30, CY + R * 0.34, R * 0.05,
    CX - R * 0.06, CY - R * 0.04, R * 1.05,
  );
  g.addColorStop(0,    'rgba(0,0,0,0)');
  g.addColorStop(0.40, 'rgba(0,0,0,0)');
  g.addColorStop(0.66, 'rgba(0,0,0,0.25)');
  g.addColorStop(0.82, 'rgba(0,0,0,0.58)');
  g.addColorStop(1,    'rgba(0,0,0,0.90)');
  ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  ctx.restore();
}

// ── Pre-generated data ─────────────────────────────────────────────────────

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

const CRATERS = (() => {
  const rng = seeded(0xfe1234ab);
  return Array.from({ length: 25 }, () => ({
    nx: (rng() - 0.5) * 1.6, ny: (rng() - 0.5) * 1.6,
    nr: 0.04 + rng() * 0.10, rimW: 0.4 + rng() * 1.2,
  }));
})();

const ICE_CRACKS = (() => {
  const rng = seeded(0x1ce1ce);
  return Array.from({ length: 14 }, () => ({
    sx: (rng() - 0.5) * 1.8, sy: (rng() - 0.5) * 1.8,
    pts: Array.from({ length: 6 }, () => ({ dx: (rng() - 0.5) * 0.4, dy: (rng() - 0.5) * 0.4 })),
  }));
})();

const VOID_CRACKS = (() => {
  const rng = seeded(0x001d9999);
  return Array.from({ length: 10 }, () => ({
    startA: rng() * TWO_PI,
    pts: Array.from({ length: 7 }, () => ({ da: (rng() - 0.5) * 0.7, dr: 0.1 + rng() * 0.3 })),
  }));
})();

// ── Starfield ──────────────────────────────────────────────────────────────
const STARS = (() => {
  const rng = seeded(0x5a1f9b3c);
  return Array.from({ length: 90 }, () => ({
    x:  rng() * 300, y: rng() * 300,
    r:  0.4 + rng() * 1.2,
    a:  0.35 + rng() * 0.65,
    tw: 0.0008 + rng() * 0.003,
  }));
})();

function drawStars(ctx: CanvasRenderingContext2D, t: number) {
  for (const s of STARS) {
    const a = s.a * (0.55 + 0.45 * Math.sin(t * s.tw));
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TWO_PI);
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PLANET 0 — EARTH
// ══════════════════════════════════════════════════════════════════════════
function drawEarth(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  const oceanH = 215 - d * 160;
  const oceanS = Math.round(75 - d * 45);
  const oceanL = Math.round(35 + (1 - d) * 10);
  const ocean = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, 0, CX, CY, R);
  ocean.addColorStop(0,   `hsl(${oceanH}, ${oceanS}%, ${oceanL + 15}%)`);
  ocean.addColorStop(0.5, `hsl(${oceanH}, ${oceanS}%, ${oceanL}%)`);
  ocean.addColorStop(1,   `hsl(${oceanH - 10}, ${oceanS + 5}%, ${Math.max(8, oceanL - 12)}%)`);
  ctx.fillStyle = ocean; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  if (d < 0.7) {
    const iceA = Math.max(0, (0.7 - d) / 0.5) * 0.9;
    ctx.fillStyle = `rgba(230, 245, 255, ${iceA})`;
    ctx.beginPath(); ctx.ellipse(CX, CY - R * 0.82, R * 0.48, R * 0.22, 0, 0, TWO_PI); ctx.fill();
    ctx.beginPath(); ctx.ellipse(CX, CY + R * 0.86, R * 0.36, R * 0.16, 0, 0, TWO_PI); ctx.fill();
  }

  if (d < 0.92) {
    const greenMix = Math.max(0, 1 - d / 0.6);
    CONTINENTS.forEach((cont, ci) => {
      if (cont.pts.length < 3) return;
      const distFromCenter = Math.sqrt(cont.cx ** 2 + cont.cy ** 2);
      if (distFromCenter > 1.05) return;
      const landH = greenMix > 0.5 ? 100 + ci * 15 : d < 0.75 ? 30 + ci * 8 : 20 + ci * 5;
      const landS = Math.round(35 + greenMix * 40);
      const landL = Math.round(22 + greenMix * 20 - d * 8);
      ctx.beginPath();
      const first = cont.pts[0];
      ctx.moveTo(CX + (cont.cx + Math.cos(first.a) * first.r) * R, CY + (cont.cy + Math.sin(first.a) * first.r) * R);
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
      if (greenMix > 0.2) {
        ctx.strokeStyle = `hsla(${landH + 10}, ${landS - 10}%, ${landL + 18}%, 0.4)`;
        ctx.lineWidth = 0.8; ctx.stroke();
      }
    });

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
        ctx.shadowBlur  = 6; ctx.stroke(); ctx.shadowBlur = 0;
      });
    }
  }

  if (d < 0.65) {
    const cloudA = Math.max(0, (0.65 - d) / 0.55) * 0.85;
    CLOUDS.forEach(cl => {
      const angle = cl.a + t * cl.speed;
      const x = CX + Math.cos(angle) * R * 0.6;
      const y = CY + Math.sin(angle) * R * 0.35 + cl.lat * R * 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, cl.w);
      g.addColorStop(0, `rgba(255,255,255,${cloudA * 0.9})`);
      g.addColorStop(0.6, `rgba(240,248,255,${cloudA * 0.4})`);
      g.addColorStop(1, 'transparent');
      ctx.save(); ctx.scale(1, cl.h / cl.w); ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y * (cl.w / cl.h), cl.w, 0, TWO_PI);
      ctx.fill(); ctx.restore();
    });
  }

  specularHighlight(ctx, 0.12 - d * 0.08);
  ctx.restore();

  const atmA = Math.max(0, 1 - d * 1.3) * 0.45;
  const atm = ctx.createRadialGradient(CX, CY, R * 0.88, CX, CY, R * 1.28);
  atm.addColorStop(0, `rgba(130, 200, 255, ${atmA})`);
  atm.addColorStop(0.6, `rgba(80, 160, 255, ${atmA * 0.4})`);
  atm.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.28, 0, TWO_PI);
  ctx.fillStyle = atm; ctx.fill();
}

// ══════════════════════════════════════════════════════════════════════════
// PLANET 1 — ARID
// ══════════════════════════════════════════════════════════════════════════
function drawArid(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  const base = ctx.createRadialGradient(CX - R * 0.25, CY - R * 0.3, 0, CX, CY, R);
  base.addColorStop(0, `hsl(${18 - d * 8}, 72%, ${38 + d * 6}%)`);
  base.addColorStop(0.5, `hsl(${12 - d * 5}, 80%, 28%)`);
  base.addColorStop(1, 'hsl(8, 85%, 14%)');
  ctx.fillStyle = base; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  for (let i = 0; i < 5; i++) {
    const rng = seeded(i * 0x1234);
    const y   = CY - R * 0.6 + i * R * 0.28;
    const w   = R * (0.6 + rng() * 0.7);
    const h   = R * (0.03 + rng() * 0.05);
    ctx.beginPath(); ctx.ellipse(CX, y, w, h, rng() * 0.3, 0, TWO_PI);
    ctx.fillStyle = 'hsla(8, 90%, 18%, 0.5)'; ctx.fill();
  }

  const stormA = 0.15 + Math.sin(t * 0.0005) * 0.1;
  for (let i = 0; i < 4; i++) {
    const angle = t * 0.0003 * (i % 2 === 0 ? 1 : -1) + i * 1.5;
    const x = CX + Math.cos(angle) * R * 0.45;
    const y = CY + Math.sin(angle) * R * 0.3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.35);
    g.addColorStop(0, `rgba(210, 140, 80, ${stormA})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  }

  const capA = 0.7 - d * 0.4;
  if (capA > 0) {
    ctx.fillStyle = `rgba(245, 235, 235, ${capA})`;
    ctx.beginPath(); ctx.ellipse(CX, CY - R * 0.84, R * 0.28, R * 0.12, 0, 0, TWO_PI); ctx.fill();
  }

  const nCraters = Math.round(d * 18) + 4;
  CRATERS.slice(0, nCraters).forEach(c => {
    const cx_ = CX + c.nx * R * 0.9, cy_ = CY + c.ny * R * 0.9;
    const cr  = c.nr * R * (0.6 + d * 0.4);
    if (Math.sqrt((cx_ - CX) ** 2 + (cy_ - CY) ** 2) > R * 0.95) return;
    const shadow = ctx.createRadialGradient(cx_, cy_, 0, cx_, cy_, cr);
    shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
    shadow.addColorStop(0.7, 'rgba(0,0,0,0.2)');
    shadow.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(cx_, cy_, cr, 0, TWO_PI);
    ctx.fillStyle = shadow; ctx.fill();
    ctx.strokeStyle = 'hsla(20, 60%, 55%, 0.5)';
    ctx.lineWidth = c.rimW; ctx.stroke();
  });

  specularHighlight(ctx, 0.08);
  ctx.restore();

  const atm = ctx.createRadialGradient(CX, CY, R * 0.9, CX, CY, R * 1.22);
  atm.addColorStop(0, 'rgba(220, 140, 80, 0.30)');
  atm.addColorStop(0.7, 'rgba(200, 100, 60, 0.10)');
  atm.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.22, 0, TWO_PI);
  ctx.fillStyle = atm; ctx.fill();
}

// ══════════════════════════════════════════════════════════════════════════
// PLANET 2 — FROZEN
// ══════════════════════════════════════════════════════════════════════════
function drawFrozen(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  const base = ctx.createRadialGradient(CX - R * 0.2, CY - R * 0.25, 0, CX, CY, R);
  base.addColorStop(0, `hsl(195, 60%, ${72 - d * 20}%)`);
  base.addColorStop(0.5, `hsl(210, 70%, ${52 - d * 18}%)`);
  base.addColorStop(1, 'hsl(220, 80%, 20%)');
  ctx.fillStyle = base; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

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

  const nCracks = Math.round(d * 14) + 3;
  ICE_CRACKS.slice(0, nCracks).forEach((ck, i) => {
    const thresh = i / 14;
    const alpha  = Math.min(1, (d - thresh * 0.5) / 0.12);
    if (alpha <= 0) return;
    ctx.beginPath();
    let x = CX + ck.sx * R * 0.8, y = CY + ck.sy * R * 0.8;
    ctx.moveTo(x, y);
    for (const pt of ck.pts) { x += pt.dx * R; y += pt.dy * R; ctx.lineTo(x, y); }
    ctx.shadowColor = `rgba(0, 200, 255, ${alpha * 0.9})`; ctx.shadowBlur = 6;
    ctx.strokeStyle = `rgba(20, 180, 255, ${alpha * 0.85})`;
    ctx.lineWidth = 1 + d * 2; ctx.lineCap = 'round'; ctx.stroke(); ctx.shadowBlur = 0;
  });

  if (d > 0.3) {
    const glowA = (d - 0.3) / 0.7 * 0.4;
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 0.7);
    g.addColorStop(0, `rgba(0, 220, 255, ${glowA})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  }

  const auroraA = 0.15 + Math.sin(t * 0.0012) * 0.08;
  const auroraH = (t * 0.02) % 360;
  const aurora = ctx.createLinearGradient(CX - R, CY - R * 0.3, CX + R, CY + R * 0.3);
  aurora.addColorStop(0, 'transparent');
  aurora.addColorStop(0.35, `hsla(${auroraH}, 100%, 70%, ${auroraA})`);
  aurora.addColorStop(0.65, `hsla(${auroraH + 80}, 100%, 70%, ${auroraA})`);
  aurora.addColorStop(1, 'transparent');
  ctx.fillStyle = aurora; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  specularHighlight(ctx, 0.22 - d * 0.1);
  ctx.restore();

  const atm = ctx.createRadialGradient(CX, CY, R * 0.87, CX, CY, R * 1.25);
  atm.addColorStop(0, `hsla(${180 + Math.sin(t * 0.001) * 30}, 100%, 75%, 0.28)`);
  atm.addColorStop(0.5, 'rgba(80, 220, 255, 0.10)');
  atm.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.25, 0, TWO_PI);
  ctx.fillStyle = atm; ctx.fill();
}

// ══════════════════════════════════════════════════════════════════════════
// PLANET 3 — VOID
// ══════════════════════════════════════════════════════════════════════════
function drawVoid(ctx: CanvasRenderingContext2D, t: number, d: number) {
  ctx.save(); clipToCircle(ctx);

  const hue  = (t * 0.01) % 360;
  const base = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.3, 0, CX, CY, R);
  base.addColorStop(0, `hsl(${270 + Math.sin(t * 0.001) * 20}, 60%, 18%)`);
  base.addColorStop(0.5, 'hsl(280, 80%, 8%)');
  base.addColorStop(1, 'hsl(260, 100%, 4%)');
  ctx.fillStyle = base; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  for (let i = 0; i < 5; i++) {
    const angle = t * 0.0002 * (i % 2 === 0 ? 1 : -1.3) + i * 1.26;
    const x = CX + Math.cos(angle) * R * 0.4;
    const y = CY + Math.sin(angle) * R * 0.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.5);
    g.addColorStop(0, `hsla(${hue + i * 40}, 100%, 50%, 0.12)`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
  }

  const nCracks = 4 + Math.round(d * 10);
  VOID_CRACKS.slice(0, nCracks).forEach((ck, i) => {
    const alpha = Math.min(1, 0.4 + d * 0.6);
    ctx.shadowColor = `hsla(${hue + i * 30}, 100%, 70%, ${alpha})`; ctx.shadowBlur = 8 + d * 12;
    ctx.beginPath();
    let a = ck.startA, dist = R * 0.05;
    ctx.moveTo(CX + Math.cos(a) * dist, CY + Math.sin(a) * dist);
    for (const pt of ck.pts) {
      a += pt.da; dist = Math.min(R * 0.96, dist + pt.dr * R);
      ctx.lineTo(CX + Math.cos(a) * dist, CY + Math.sin(a) * dist);
    }
    ctx.strokeStyle = `hsla(${hue + i * 30}, 100%, 80%, ${alpha})`;
    ctx.lineWidth = 1.5 + d * 2.5; ctx.lineCap = 'round'; ctx.stroke(); ctx.shadowBlur = 0;
  });

  const pulse  = 1 + Math.sin(t * 0.003) * 0.15;
  const coreR  = R * (0.2 + d * 0.3) * pulse;
  const coreG  = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR);
  coreG.addColorStop(0, `hsla(${hue}, 100%, 90%, 0.9)`);
  coreG.addColorStop(0.4, `hsla(${hue + 40}, 100%, 60%, 0.5)`);
  coreG.addColorStop(1, 'transparent');
  ctx.fillStyle = coreG; ctx.fillRect(CX - R, CY - R, R * 2, R * 2);

  for (let i = 0; i < 40; i++) {
    const rng = seeded(i * 0x77fa);
    const x   = CX + (rng() - 0.5) * R * 2;
    const y   = CY + (rng() - 0.5) * R * 2;
    const a   = (Math.sin(t * 0.0015 + i) * 0.5 + 0.5) * 0.7;
    ctx.beginPath(); ctx.arc(x, y, 0.8, 0, TWO_PI);
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
  }

  ctx.restore();

  const auraA = 0.3 + Math.sin(t * 0.002) * 0.1;
  const aura  = ctx.createRadialGradient(CX, CY, R * 0.85, CX, CY, R * 1.4);
  aura.addColorStop(0, `hsla(${hue}, 100%, 60%, ${auraA})`);
  aura.addColorStop(0.5, `hsla(${hue + 60}, 100%, 50%, ${auraA * 0.3})`);
  aura.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R * 1.4, 0, TWO_PI);
  ctx.fillStyle = aura; ctx.fill();
}

// ── Stations in orbit ──────────────────────────────────────────────────────
// Each type orbits at its own radius; multiple stations spread around the ring

interface StationCounts { mining: number; research: number; market: number; fabricator: number }

function drawMiningStation(ctx: CanvasRenderingContext2D, t: number, idx: number) {
  // Orange industrial platform with drill arm
  const armAngle = Math.sin(t * 0.004 + idx) * 0.4;
  ctx.save();
  // Body — boxy platform
  ctx.beginPath(); ctx.rect(-9, -5, 18, 10);
  const hull = ctx.createLinearGradient(-9,-5,9,5);
  hull.addColorStop(0,'#3a2010'); hull.addColorStop(1,'#5a3518');
  ctx.fillStyle = hull; ctx.fill();
  ctx.strokeStyle='rgba(255,140,40,0.6)'; ctx.lineWidth=0.7; ctx.stroke();
  // Drill arm
  ctx.rotate(armAngle);
  ctx.strokeStyle='rgba(255,160,50,0.9)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(0,5); ctx.lineTo(0,12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3,12); ctx.lineTo(0,11); ctx.lineTo(3,12);
  ctx.strokeStyle='rgba(255,200,80,0.8)'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
  // Running lights
  const blink = Math.sin(t * 0.007 + idx) > 0;
  ctx.beginPath(); ctx.arc(9, 0, 1.5, 0, TWO_PI);
  ctx.fillStyle = blink ? 'rgba(255,120,30,0.9)' : 'rgba(255,120,30,0.2)'; ctx.fill();
}

function drawResearchStation(ctx: CanvasRenderingContext2D, t: number, idx: number) {
  // Purple cross-shaped lab with rotating dish
  const dishA = t * 0.005 + idx * 1.2;
  // Solar panels (cross arms)
  ctx.fillStyle = '#1a1040';
  ctx.strokeStyle = 'rgba(160,80,255,0.5)'; ctx.lineWidth = 0.6;
  for (const [dx,dy,dw,dh] of [[-18,-3,36,6],[-3,-18,6,36]] as number[][]) {
    ctx.beginPath(); ctx.rect(dx,dy,dw,dh); ctx.fill(); ctx.stroke();
  }
  // Panel cells
  ctx.strokeStyle='rgba(120,60,220,0.4)'; ctx.lineWidth=0.4;
  for (let xi=-16; xi<=10; xi+=6) { ctx.beginPath(); ctx.moveTo(xi,-3); ctx.lineTo(xi,3); ctx.stroke(); }
  for (let yi=-16; yi<=10; yi+=6) { ctx.beginPath(); ctx.moveTo(-3,yi); ctx.lineTo(3,yi); ctx.stroke(); }
  // Central hub
  ctx.beginPath(); ctx.arc(0,0,5,0,TWO_PI);
  ctx.fillStyle='hsl(270,60%,22%)'; ctx.fill();
  ctx.strokeStyle='rgba(180,100,255,0.7)'; ctx.lineWidth=0.8; ctx.stroke();
  // Rotating dish
  ctx.save(); ctx.rotate(dishA);
  ctx.strokeStyle='rgba(200,140,255,0.85)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(0,-10); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,-10,3.5,0,Math.PI);
  ctx.strokeStyle='rgba(220,160,255,0.7)'; ctx.stroke();
  ctx.restore();
  // Pulse dot
  const p = 0.5+0.5*Math.sin(t*0.01+idx);
  ctx.beginPath(); ctx.arc(0,0,2,0,TWO_PI);
  ctx.fillStyle=`rgba(200,140,255,${p})`; ctx.fill();
}

function drawMarketStation(ctx: CanvasRenderingContext2D, t: number, idx: number) {
  // Gold round hub with docking spires
  // Outer ring
  ctx.beginPath(); ctx.arc(0,0,12,0,TWO_PI);
  ctx.strokeStyle='rgba(200,160,30,0.5)'; ctx.lineWidth=1.5; ctx.stroke();
  // Docking spires
  for (let i=0;i<4;i++) {
    const a = (i/4)*TWO_PI + t*0.001;
    ctx.save(); ctx.rotate(a);
    ctx.strokeStyle='rgba(220,180,50,0.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(18,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18,-2); ctx.lineTo(18,2);
    ctx.strokeStyle='rgba(255,220,80,0.9)'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.restore();
  }
  // Main hub body
  ctx.beginPath(); ctx.arc(0,0,8,0,TWO_PI);
  const gold=ctx.createRadialGradient(0,0,0,0,0,8);
  gold.addColorStop(0,'#4a3800'); gold.addColorStop(1,'#2a2000');
  ctx.fillStyle=gold; ctx.fill();
  ctx.strokeStyle='rgba(255,200,50,0.7)'; ctx.lineWidth=0.8; ctx.stroke();
  // Rotating beacon
  const beaconA = t*0.003+idx;
  ctx.save(); ctx.rotate(beaconA);
  ctx.fillStyle=`rgba(255,220,80,${0.5+0.4*Math.sin(t*0.008+idx)})`;
  ctx.beginPath(); ctx.arc(5,0,1.5,0,TWO_PI); ctx.fill();
  ctx.restore();
  // Centre
  ctx.beginPath(); ctx.arc(0,0,3,0,TWO_PI);
  ctx.fillStyle='rgba(255,200,60,0.8)'; ctx.fill();
}

function drawFabricatorStation(ctx: CanvasRenderingContext2D, t: number, idx: number) {
  // Teal hexagonal factory with rotating ring and arms
  const gearA = t*0.004+idx*0.7;
  // Outer gear ring
  ctx.strokeStyle='rgba(40,200,160,0.4)'; ctx.lineWidth=1;
  for(let i=0;i<8;i++){
    const a=gearA+(i/8)*TWO_PI;
    ctx.save(); ctx.rotate(a);
    ctx.beginPath(); ctx.rect(10,-1.5,5,3); ctx.fillStyle='rgba(40,180,140,0.4)'; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // Hex hull
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=(i/6)*TWO_PI-Math.PI/6;
    const hx=Math.cos(a)*9, hy=Math.sin(a)*9;
    if(i===0) ctx.moveTo(hx,hy); else ctx.lineTo(hx,hy);
  }
  ctx.closePath();
  ctx.fillStyle='#0e2820'; ctx.fill();
  ctx.strokeStyle='rgba(40,220,170,0.7)'; ctx.lineWidth=0.8; ctx.stroke();
  // Inner rotating detail
  ctx.save(); ctx.rotate(-gearA*1.5);
  ctx.strokeStyle='rgba(40,200,160,0.5)'; ctx.lineWidth=0.6;
  for(let i=0;i<6;i++){
    const a=(i/6)*TWO_PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*3,Math.sin(a)*3); ctx.lineTo(Math.cos(a)*7,Math.sin(a)*7); ctx.stroke();
  }
  ctx.restore();
  // Core
  ctx.beginPath(); ctx.arc(0,0,3,0,TWO_PI);
  ctx.fillStyle=`rgba(40,255,180,${0.6+0.3*Math.sin(t*0.01+idx)})`; ctx.fill();
}

function drawStations(ctx: CanvasRenderingContext2D, sm: StationCounts, t: number) {
  // Orbit radii for each station type
  const ORBITS: Record<string,number> = {
    mining:     R + 44,
    research:   R + 80,
    market:     R + 114,
    fabricator: R + 54,
  };
  const ANGLE_OFFSETS: Record<string,number> = {
    mining: 0, research: 0.8, market: 0, fabricator: 2.5,
  };
  const ORBIT_SPEEDS: Record<string,number> = {
    mining: 0.00018, research: 0.00013, market: 0.00009, fabricator: -0.00022,
  };

  const types = ['mining','research','market','fabricator'] as const;
  for (const type of types) {
    const count = Math.min(sm[type] ?? 0, 3);
    if (count === 0) continue;
    const orbitR = ORBITS[type];
    const speed  = ORBIT_SPEEDS[type];
    const baseA  = ANGLE_OFFSETS[type] + t * speed;

    // Faint orbit ring
    ctx.beginPath(); ctx.arc(CX, CY, orbitR, 0, TWO_PI);
    ctx.strokeStyle='rgba(255,255,255,0.04)'; ctx.lineWidth=0.6; ctx.stroke();

    for (let i = 0; i < count; i++) {
      const angle = baseA + (i / count) * TWO_PI;
      const sx = CX + Math.cos(angle) * orbitR;
      const sy = CY + Math.sin(angle) * orbitR;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle + Math.PI / 2); // face toward planet
      switch (type) {
        case 'mining':     drawMiningStation(ctx, t, i); break;
        case 'research':   drawResearchStation(ctx, t, i); break;
        case 'market':     drawMarketStation(ctx, t, i); break;
        case 'fabricator': drawFabricatorStation(ctx, t, i); break;
      }
      ctx.restore();
    }
  }
}

// ── Planet renderer (no clearRect — caller handles background) ─────────────
function drawPlanet(ctx: CanvasRenderingContext2D, t: number, planetId: number, damage: number) {
  switch (planetId) {
    case 0: drawEarth(ctx, t, damage);  break;
    case 1: drawArid(ctx, t, damage);   break;
    case 2: drawFrozen(ctx, t, damage); break;
    case 3: drawVoid(ctx, t, damage);   break;
  }

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

// ── Spaceship ──────────────────────────────────────────────────────────────
function drawShip(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  ctx.translate(SHIP_X, SHIP_Y);

  // Engine exhaust plume
  const exhaustPulse = 0.7 + Math.sin(t * 0.009) * 0.25;
  for (let i = 0; i < 2; i++) {
    const ey = i === 0 ? -4 : 4;
    const eg = ctx.createRadialGradient(-22 + i * 2, ey, 0, -22, ey, 18);
    eg.addColorStop(0, `rgba(100,200,255,${exhaustPulse * 0.85})`);
    eg.addColorStop(0.4, `rgba(60,130,255,${exhaustPulse * 0.35})`);
    eg.addColorStop(1, 'transparent');
    ctx.fillStyle = eg; ctx.fillRect(-40, ey - 18, 30, 36);
  }

  // Engine nozzles
  ctx.fillStyle = '#142030';
  ctx.beginPath(); ctx.moveTo(-17,-3); ctx.lineTo(-25,-6); ctx.lineTo(-26,-2); ctx.lineTo(-17,-1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-17, 3); ctx.lineTo(-25, 6); ctx.lineTo(-26, 2); ctx.lineTo(-17, 1); ctx.closePath(); ctx.fill();
  // Nozzle rim glow
  for (const ey of [-4, 4]) {
    ctx.beginPath(); ctx.arc(-25, ey, 2.5, 0, TWO_PI);
    ctx.fillStyle = `rgba(80,180,255,${exhaustPulse * 0.9})`; ctx.fill();
  }

  // Main hull
  ctx.beginPath();
  ctx.moveTo(26,  0);
  ctx.lineTo(19, -6);
  ctx.lineTo( 6, -8);
  ctx.lineTo(-6, -7);
  ctx.lineTo(-17,-5);
  ctx.lineTo(-17, 5);
  ctx.lineTo(-6,  7);
  ctx.lineTo( 6,  8);
  ctx.lineTo(19,  6);
  ctx.closePath();
  const hull = ctx.createLinearGradient(-17, -8, 26, 8);
  hull.addColorStop(0,   '#162438');
  hull.addColorStop(0.35,'#223a58');
  hull.addColorStop(0.7, '#1c3250');
  hull.addColorStop(1,   '#10202e');
  ctx.fillStyle = hull; ctx.fill();
  ctx.strokeStyle = 'rgba(50,90,140,0.8)'; ctx.lineWidth = 0.8; ctx.stroke();

  // Top fin
  ctx.beginPath();
  ctx.moveTo(-4, -8); ctx.lineTo(3, -15); ctx.lineTo(10, -8);
  ctx.fillStyle = '#12202e'; ctx.fill();
  ctx.strokeStyle = 'rgba(40,80,120,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();

  // Bottom stabiliser
  ctx.beginPath();
  ctx.moveTo(-2, 8); ctx.lineTo(2, 12); ctx.lineTo(8, 8);
  ctx.fillStyle = '#12202e'; ctx.fill();
  ctx.strokeStyle = 'rgba(40,80,120,0.7)'; ctx.lineWidth = 0.5; ctx.stroke();

  // Hull panel lines
  ctx.strokeStyle = 'rgba(55,100,150,0.5)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(-5,-7); ctx.lineTo(-5,7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 5,-8); ctx.lineTo( 5,8); ctx.stroke();

  // Cockpit
  ctx.beginPath(); ctx.ellipse(14, -1, 8, 5, -0.12, 0, TWO_PI);
  const cockpit = ctx.createRadialGradient(14, -2, 0, 14, -1, 8);
  cockpit.addColorStop(0,   'rgba(180,235,255,0.75)');
  cockpit.addColorStop(0.5, 'rgba(90,190,255,0.45)');
  cockpit.addColorStop(1,   'rgba(40,130,210,0.15)');
  ctx.fillStyle = cockpit; ctx.fill();
  ctx.strokeStyle = 'rgba(200,235,255,0.55)'; ctx.lineWidth = 0.6; ctx.stroke();

  // Cockpit interior cross-hatch
  ctx.strokeStyle = 'rgba(120,200,255,0.2)'; ctx.lineWidth = 0.4;
  ctx.beginPath(); ctx.moveTo(10,-5); ctx.lineTo(18,3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(10, 3); ctx.lineTo(18,-4); ctx.stroke();

  // Docking bay strip (bottom hull – where drones land)
  const dockP = 0.45 + Math.sin(t * 0.0045) * 0.3;
  const dock = ctx.createLinearGradient(-3, 5, 16, 7);
  dock.addColorStop(0,   `rgba(60,210,255,${dockP})`);
  dock.addColorStop(0.5, `rgba(110,225,255,${dockP * 0.85})`);
  dock.addColorStop(1,   `rgba(60,200,255,${dockP * 0.4})`);
  ctx.beginPath(); ctx.rect(-3, 5, 19, 2);
  ctx.fillStyle = dock; ctx.fill();
  // Dock glow bloom
  const dockGlow = ctx.createRadialGradient(8, 6, 0, 8, 6, 14);
  dockGlow.addColorStop(0, `rgba(60,200,255,${dockP * 0.35})`);
  dockGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = dockGlow; ctx.fillRect(-6, -4, 30, 20);

  // Nav lights (alternating blink)
  const blink = (Math.floor(t * 0.004)) % 2 === 0;
  ctx.beginPath(); ctx.arc(24, 0, 2.2, 0, TWO_PI);
  const redA  = blink  ? 0.95 : 0.12;
  ctx.fillStyle = `rgba(255,70,70,${redA})`; ctx.fill();
  if (blink) { ctx.shadowColor='#ff4040'; ctx.shadowBlur=8; ctx.fill(); ctx.shadowBlur=0; }

  ctx.beginPath(); ctx.arc(-22, -4, 1.8, 0, TWO_PI);
  const greenA = !blink ? 0.90 : 0.12;
  ctx.fillStyle = `rgba(70,255,120,${greenA})`; ctx.fill();
  if (!blink) { ctx.shadowColor='#40ff80'; ctx.shadowBlur=6; ctx.fill(); ctx.shadowBlur=0; }

  ctx.restore();
}

// ── Drone animation ────────────────────────────────────────────────────────
type DroneKind = 'miner' | 'researcher' | 'trader' | 'fabricator';

interface DroneAnim {
  surfAngle: number;
  phase: number;
  speed: number;
  cpOutX: number; cpOutY: number;
  cpRetX: number; cpRetY: number;
  kind: DroneKind;
  seed: number;   // for per-drone randomness in draw
}

function makeDrone(idx: number, kind: DroneKind): DroneAnim {
  const rng       = seeded(0xd4ff0000 + idx * 97);
  const surfAngle = rng() * TWO_PI;
  const sx = CX + Math.cos(surfAngle) * R;
  const sy = CY + Math.sin(surfAngle) * R;
  const mx = (sx + SHIP_X) * 0.5;
  const my = (sy + SHIP_Y) * 0.5;
  const dx = SHIP_X - sx, dy = SHIP_Y - sy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len, perpY = dx / len;
  const offset = (rng() - 0.5) * 70;
  return {
    surfAngle, kind, seed: idx,
    phase:  rng(),
    speed:  0.00020 + rng() * 0.00014,
    cpOutX: mx + perpX * offset, cpOutY: my + perpY * offset,
    cpRetX: mx - perpX * offset, cpRetY: my - perpY * offset,
  };
}

// Build ordered list of drone types to animate (max 2 per type, max 8 total)
function buildTypeList(drones: Record<string, number>): DroneKind[] {
  const MAX = 2;
  const out: DroneKind[] = [];
  for (const k of ['miner','researcher','trader','fabricator'] as DroneKind[]) {
    const n = Math.min(drones[k] ?? 0, MAX);
    for (let i = 0; i < n; i++) out.push(k);
  }
  return out;
}

function quadBez(p: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const mt = 1 - p;
  return { x: mt*mt*x0 + 2*mt*p*cx + p*p*x1, y: mt*mt*y0 + 2*mt*p*cy + p*p*y1 };
}

function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

// ── Per-type drone shapes ──────────────────────────────────────────────────

// Miner: chunky orange hauler with front drill bit
function drawMinerShape(ctx: CanvasRenderingContext2D, returning: boolean, glowPulse: number) {
  // Thrust trail
  const trail = ctx.createLinearGradient(-5, 0, -15, 0);
  trail.addColorStop(0, `rgba(255,160,60,${glowPulse * 0.8})`);
  trail.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.moveTo(-5,-3); ctx.lineTo(-15,0); ctx.lineTo(-5,3);
  ctx.fillStyle = trail; ctx.fill();

  // Heavy hull — wide and squat
  ctx.beginPath();
  ctx.moveTo( 4,  0);   // nose tip
  ctx.lineTo( 2, -5);
  ctx.lineTo(-2, -6);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6,  5);
  ctx.lineTo(-2,  6);
  ctx.lineTo( 2,  5);
  ctx.closePath();
  ctx.fillStyle = returning ? 'hsl(28,100%,62%)' : 'hsl(28,85%,46%)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,100,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();

  // Drill bit at nose
  ctx.beginPath();
  ctx.moveTo( 4,  0);
  ctx.lineTo( 9, -1.5);
  ctx.lineTo(12,  0);
  ctx.lineTo( 9,  1.5);
  ctx.closePath();
  ctx.fillStyle = '#ffcc44'; ctx.fill();
  // Drill ridges
  ctx.strokeStyle = 'rgba(255,200,80,0.7)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(6,-1); ctx.lineTo(6,1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8.5,-1.2); ctx.lineTo(8.5,1.2); ctx.stroke();

  // Side vents
  ctx.strokeStyle = 'rgba(255,140,30,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-1,-6); ctx.lineTo(-4,-6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-4, 6); ctx.stroke();

  // Cockpit port
  ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, TWO_PI);
  ctx.fillStyle = returning ? 'rgba(255,220,120,0.9)' : 'rgba(255,180,80,0.7)';
  ctx.fill();
}

// Researcher: sleek purple craft with sensor antenna and dish
function drawResearcherShape(ctx: CanvasRenderingContext2D, returning: boolean, glowPulse: number, t: number, seed: number) {
  // Trail
  const trail = ctx.createLinearGradient(-3, 0, -14, 0);
  trail.addColorStop(0, `rgba(180,80,255,${glowPulse * 0.75})`);
  trail.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.moveTo(-3,-2); ctx.lineTo(-14,0); ctx.lineTo(-3,2);
  ctx.fillStyle = trail; ctx.fill();

  // Thin elongated hull
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo( 6, -2.5);
  ctx.lineTo(-2, -3);
  ctx.lineTo(-5, -2);
  ctx.lineTo(-5,  2);
  ctx.lineTo(-2,  3);
  ctx.lineTo( 6,  2.5);
  ctx.closePath();
  ctx.fillStyle = returning ? 'hsl(270,80%,68%)' : 'hsl(270,70%,48%)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,140,255,0.6)'; ctx.lineWidth = 0.5; ctx.stroke();

  // Top antenna mast
  ctx.strokeStyle = 'rgba(200,120,255,0.85)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(2,-3); ctx.lineTo(2,-8); ctx.stroke();
  // Antenna dish (rotating sensor sweep)
  const dishAngle = t * 0.006 + seed;
  ctx.beginPath();
  ctx.arc(2, -8, 2.5, dishAngle, dishAngle + Math.PI);
  ctx.strokeStyle = 'rgba(220,160,255,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
  // Antenna tip pulse
  const antPulse = 0.5 + 0.5 * Math.sin(t * 0.015 + seed);
  ctx.beginPath(); ctx.arc(2, -8, 1, 0, TWO_PI);
  ctx.fillStyle = `rgba(255,180,255,${antPulse * 0.9})`; ctx.fill();

  // Sensor nose orb
  ctx.beginPath(); ctx.arc(8, 0, 2, 0, TWO_PI);
  const orbPulse = 0.5 + 0.5 * Math.sin(t * 0.01 + seed + 1);
  ctx.fillStyle = returning ? `rgba(220,180,255,${0.7+orbPulse*0.3})` : `rgba(180,100,255,${0.6+orbPulse*0.3})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,160,255,0.5)'; ctx.lineWidth = 0.4; ctx.stroke();
}

// Trader: gold boxy hauler with cargo pods
function drawTraderShape(ctx: CanvasRenderingContext2D, returning: boolean, glowPulse: number) {
  // Trail (double engine)
  for (const ey of [-3.5, 3.5]) {
    const trail = ctx.createLinearGradient(-5, ey, -14, ey);
    trail.addColorStop(0, `rgba(255,210,30,${glowPulse * 0.7})`);
    trail.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.moveTo(-5,ey-2); ctx.lineTo(-14,ey); ctx.lineTo(-5,ey+2);
    ctx.fillStyle = trail; ctx.fill();
  }

  // Cargo pods (top & bottom, drawn first so hull overlaps)
  ctx.fillStyle = returning ? 'hsl(42,90%,38%)' : 'hsl(42,80%,28%)';
  ctx.strokeStyle = 'rgba(255,200,50,0.4)'; ctx.lineWidth = 0.5;
  // Top pod
  ctx.beginPath(); ctx.rect(-3,-8,10,5); ctx.fill(); ctx.stroke();
  // Bottom pod
  ctx.beginPath(); ctx.rect(-3, 3,10,5); ctx.fill(); ctx.stroke();
  // Pod rivets
  ctx.fillStyle = 'rgba(255,230,100,0.5)';
  for (const py of [-6, -4]) { ctx.beginPath(); ctx.arc(1,py,0.8,0,TWO_PI); ctx.fill(); }
  for (const py of [5, 7])   { ctx.beginPath(); ctx.arc(1,py,0.8,0,TWO_PI); ctx.fill(); }

  // Main hull — fat box
  ctx.beginPath();
  ctx.moveTo( 7,  0);
  ctx.lineTo( 5, -3);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-6, -1.5);
  ctx.lineTo(-6,  1.5);
  ctx.lineTo(-4,  3);
  ctx.lineTo( 5,  3);
  ctx.closePath();
  ctx.fillStyle = returning ? 'hsl(45,95%,55%)' : 'hsl(44,85%,42%)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,80,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();

  // Nose window
  ctx.beginPath(); ctx.ellipse(5, 0, 2, 1.5, 0, 0, TWO_PI);
  ctx.fillStyle = returning ? 'rgba(255,240,160,0.9)' : 'rgba(255,220,80,0.6)';
  ctx.fill();

  // Engine ports
  for (const ey of [-3.5, 3.5]) {
    ctx.beginPath(); ctx.arc(-5.5, ey, 1.8, 0, TWO_PI);
    ctx.fillStyle = `rgba(255,180,20,${glowPulse * 0.85})`; ctx.fill();
  }
}

// Fabricator: teal hexagonal with robotic arm
function drawFabricatorShape(ctx: CanvasRenderingContext2D, returning: boolean, glowPulse: number, t: number, seed: number) {
  // Trail
  const trail = ctx.createLinearGradient(-4, 0, -14, 0);
  trail.addColorStop(0, `rgba(20,255,180,${glowPulse * 0.75})`);
  trail.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.moveTo(-4,-2.5); ctx.lineTo(-14,0); ctx.lineTo(-4,2.5);
  ctx.fillStyle = trail; ctx.fill();

  // Robotic arm (extends from underside, animates)
  const armAngle = Math.sin(t * 0.007 + seed) * 0.5;
  ctx.save();
  ctx.translate(2, 4);
  ctx.rotate(armAngle);
  ctx.strokeStyle = 'rgba(40,255,180,0.8)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,6); ctx.stroke();
  // Claw
  ctx.beginPath(); ctx.moveTo(-2,6); ctx.lineTo(0,5); ctx.lineTo(2,6);
  ctx.strokeStyle = 'rgba(80,255,200,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.restore();

  // Hexagonal hull
  ctx.beginPath();
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TWO_PI - Math.PI / 6;
    const hx = Math.cos(a) * 6, hy = Math.sin(a) * 5;
    if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = returning ? 'hsl(162,90%,42%)' : 'hsl(162,80%,28%)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,255,180,0.7)'; ctx.lineWidth = 0.6; ctx.stroke();

  // Gear/cog detail overlay
  const gearAngle = t * 0.005 + seed;
  ctx.strokeStyle = 'rgba(40,220,160,0.5)'; ctx.lineWidth = 0.6;
  for (let i = 0; i < 6; i++) {
    const a = gearAngle + (i / 6) * TWO_PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*2, Math.sin(a)*2); ctx.lineTo(Math.cos(a)*4.5, Math.sin(a)*4); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, 2, 0, TWO_PI);
  ctx.fillStyle = 'rgba(0,200,140,0.9)'; ctx.fill();

  // Eye/sensor
  const eyePulse = 0.6 + 0.4 * Math.sin(t * 0.013 + seed);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, TWO_PI);
  ctx.fillStyle = `rgba(180,255,240,${eyePulse})`; ctx.fill();
}

// ── Engine glow (shared) ───────────────────────────────────────────────────
const ENGINE_HUE: Record<DroneKind, number> = { miner: 30, researcher: 270, trader: 45, fabricator: 162 };

function drawDrone(ctx: CanvasRenderingContext2D, drone: DroneAnim, t: number) {
  const surfX = CX + Math.cos(drone.surfAngle) * R;
  const surfY = CY + Math.sin(drone.surfAngle) * R;

  const DOCK_START = 0.42, DOCK_END = 0.58;
  let px: number, py: number, angle: number, returning: boolean;

  if (drone.phase < DOCK_START) {
    const p  = easeInOut(drone.phase / DOCK_START);
    const p2 = easeInOut(Math.min(1, drone.phase / DOCK_START + 0.01));
    const pos  = quadBez(p,  surfX, surfY, drone.cpOutX, drone.cpOutY, SHIP_X, SHIP_Y);
    const next = quadBez(p2, surfX, surfY, drone.cpOutX, drone.cpOutY, SHIP_X, SHIP_Y);
    px = pos.x; py = pos.y; angle = Math.atan2(next.y - pos.y, next.x - pos.x); returning = false;
  } else if (drone.phase < DOCK_END) {
    return;
  } else {
    const p  = easeInOut((drone.phase - DOCK_END) / (1 - DOCK_END));
    const p2 = easeInOut(Math.min(1, (drone.phase - DOCK_END) / (1 - DOCK_END) + 0.01));
    const pos  = quadBez(p,  SHIP_X, SHIP_Y, drone.cpRetX, drone.cpRetY, surfX, surfY);
    const next = quadBez(p2, SHIP_X, SHIP_Y, drone.cpRetX, drone.cpRetY, surfX, surfY);
    px = pos.x; py = pos.y; angle = Math.atan2(next.y - pos.y, next.x - pos.x); returning = true;
  }

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);

  const glowPulse = 0.55 + Math.sin(t * 0.012 + drone.surfAngle) * 0.22;
  const hue = ENGINE_HUE[drone.kind];
  const glow = ctx.createRadialGradient(-6, 0, 0, -6, 0, 10);
  glow.addColorStop(0, `hsla(${hue},100%,70%,${glowPulse})`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow; ctx.fillRect(-16, -10, 20, 20);

  switch (drone.kind) {
    case 'miner':      drawMinerShape(ctx, returning, glowPulse); break;
    case 'researcher': drawResearcherShape(ctx, returning, glowPulse, t, drone.seed); break;
    case 'trader':     drawTraderShape(ctx, returning, glowPulse); break;
    case 'fabricator': drawFabricatorShape(ctx, returning, glowPulse, t, drone.seed); break;
  }

  ctx.restore();
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
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const droneAnims    = useRef<DroneAnim[]>([]);
  const burstAnims    = useRef<DroneAnim[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const { orePerClick } = computeStats(state);

  const planet  = getPlanet(state.currentPlanet);
  const damage  = calcDamage(state.planetOreExtracted, planet);
  const label   = damageLabel(damage);
  const barColor = damage < 0.4 ? '#22d3a0' : damage < 0.72 ? '#f5a623' : '#ff4040';

  // Keep refs in sync so RAF loop reads current values without restarting
  const damageRef   = useRef(damage);
  const planetIdRef = useRef(state.currentPlanet);
  const dronesRef   = useRef(state.drones);
  const stationsRef = useRef<StationCounts>(state.stations as StationCounts ?? { mining: 0, research: 0, market: 0, fabricator: 0 });
  const typeSigRef  = useRef('');
  damageRef.current   = damage;
  planetIdRef.current = state.currentPlanet;
  dronesRef.current   = state.drones;
  stationsRef.current = state.stations ?? { mining: 0, research: 0, market: 0, fabricator: 0 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const start = performance.now();
    let lastNow = start;

    function loop(now: number) {
      const delta = Math.min(now - lastNow, 100); // clamp for tab switching
      lastNow = now;
      const t = now - start;
      const dmg = damageRef.current;
      const pid = planetIdRef.current;

      // Sync drone array type composition
      const typeList = buildTypeList(dronesRef.current);
      const sig = typeList.join(',');
      if (sig !== typeSigRef.current) {
        typeSigRef.current = sig;
        const prev = droneAnims.current;
        droneAnims.current = typeList.map((kind, i) => {
          const existing = prev[i];
          // Reuse existing if same type, else create fresh
          if (existing && existing.kind === kind) return existing;
          return makeDrone(i, kind);
        });
      }

      // Advance phases
      for (const d of droneAnims.current) {
        d.phase = (d.phase + d.speed * delta) % 1;
      }

      // ── Draw ──────────────────────────────────────────────────────────
      ctx.fillStyle = '#070c14';
      ctx.fillRect(0, 0, W, H);

      drawStars(ctx, t);
      drawPlanet(ctx, t, pid, dmg);
      draw3DShadow(ctx);
      drawStations(ctx, stationsRef.current, t);
      drawShip(ctx, t);
      for (const d of droneAnims.current) drawDrone(ctx, d, t);

      // Burst drones: one-shot planet→ship, vanish on dock
      for (const d of burstAnims.current) d.phase += d.speed * delta;
      burstAnims.current = burstAnims.current.filter(d => d.phase < 0.42);
      for (const d of burstAnims.current) drawDrone(ctx, d, t);

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // Only restart when planet changes — everything else reads from refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    onClickPlanet();
    const rect = e.currentTarget.getBoundingClientRect();
    const id   = nextId++;
    setFloats(f => [...f, { id, x: e.clientX - rect.left, y: e.clientY - rect.top, value: Math.round(orePerClick) }]);
    setTimeout(() => setFloats(f => f.filter(ft => ft.id !== id)), 900);
    // Spawn burst drones flying planet → ship on each click
    const kinds = buildTypeList(dronesRef.current);
    const burstCount = 3 + Math.floor(Math.random() * 3); // 3–5
    for (let i = 0; i < burstCount; i++) {
      const kind = kinds.length > 0 ? kinds[Math.floor(Math.random() * kinds.length)] : 'miner';
      const angle = Math.random() * TWO_PI;
      const sx = CX + Math.cos(angle) * R;
      const sy = CY + Math.sin(angle) * R;
      const mx = (sx + SHIP_X) * 0.5;
      const my = (sy + SHIP_Y) * 0.5;
      const dx = SHIP_X - sx, dy = SHIP_Y - sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len, perpY = dx / len;
      const off = (Math.random() - 0.5) * 80;
      burstAnims.current.push({
        surfAngle: angle, kind, seed: Math.random() * 1000,
        phase: 0,
        speed: 0.0009 + Math.random() * 0.0006,
        cpOutX: mx + perpX * off, cpOutY: my + perpY * off,
        cpRetX: mx - perpX * off, cpRetY: my - perpY * off,
      });
    }
  }, [onClickPlanet, orePerClick]);

  return (
    <div className="planet-area">
      <div
        className="planet-wrapper"
        onClick={handleClick}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        <canvas ref={canvasRef} width={W} height={H} className="planet-canvas" />
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
