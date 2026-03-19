import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState } from '../game/types';
import { computeStats } from '../game/stats';

interface FloatText { id: number; x: number; y: number; value: number }
interface Props { state: GameState; onClickPlanet: () => void }

let nextId = 0;

const CX = 140, CY = 140, R = 100;
const TWO_PI = Math.PI * 2;

// ── Seeded RNG (deterministic crater placement) ───────────────────────────
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 0xffffffff;
  };
}

// Pre-generate 30 crater positions within planet disk
const MAX_CRATERS = 30;
interface CraterDef { nx: number; ny: number; nr: number; rimW: number }

const CRATERS: CraterDef[] = (() => {
  const rng = seeded(0xdeadbeef);
  const out: CraterDef[] = [];
  while (out.length < MAX_CRATERS) {
    const angle = rng() * TWO_PI;
    const dist  = rng() * 0.78; // keep within planet surface
    const nx    = Math.cos(angle) * dist;
    const ny    = Math.sin(angle) * dist;
    const nr    = 0.04 + rng() * 0.12; // crater radius as fraction of R
    const rimW  = 0.5 + rng() * 1.0;
    out.push({ nx, ny, nr, rimW });
  }
  return out;
})();

// Pre-generate crack paths
const MAX_CRACKS = 12;
interface CrackDef { startA: number; pts: { da: number; dr: number }[] }
const CRACKS: CrackDef[] = (() => {
  const rng = seeded(0xc0ffee);
  return Array.from({ length: MAX_CRACKS }, () => ({
    startA: rng() * TWO_PI,
    pts: Array.from({ length: 5 }, () => ({
      da: (rng() - 0.5) * 0.6,
      dr: 0.12 + rng() * 0.35,
    })),
  }));
})();

// ── Damage metric ─────────────────────────────────────────────────────────
// 0 = pristine, 1 = devastated
// Reaches ~0.5 at 10K ore, ~0.75 at 100K, 1.0 at 1M
function calcDamage(totalOre: number): number {
  return Math.min(1, Math.log10(Math.max(1, totalOre)) / 6);
}

// Damage label shown below planet
const DAMAGE_LABELS = [
  [0.00, 'Pristine surface'],
  [0.15, 'Surface erosion detected'],
  [0.30, 'Moderate extraction damage'],
  [0.50, 'Structural compromise'],
  [0.68, 'Core exposure imminent'],
  [0.82, 'Critical depletion'],
  [0.95, 'Planet shell only'],
] as const;

function damageLabel(d: number): string {
  for (let i = DAMAGE_LABELS.length - 1; i >= 0; i--) {
    if (d >= DAMAGE_LABELS[i][0]) return DAMAGE_LABELS[i][1];
  }
  return 'Pristine surface';
}

// ── Canvas drawing ────────────────────────────────────────────────────────

function drawFrame(ctx: CanvasRenderingContext2D, t: number, damage: number) {
  ctx.clearRect(0, 0, 280, 280);

  // Colour shift: blue (210) → orange-red (15) as damage increases
  const hue = 210 - damage * 195;
  const sat  = Math.round(70  - damage * 25);
  const lit  = Math.round(42  - damage * 18);

  // ── Atmosphere glow ──────────────────────────────────────────────────
  const atmSize = R * (1.55 - damage * 0.25);
  const atm = ctx.createRadialGradient(CX, CY, R * 0.85, CX, CY, atmSize);
  atm.addColorStop(0, `hsla(${hue}, ${sat + 20}%, 65%, ${0.25 - damage * 0.12})`);
  atm.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, atmSize, 0, TWO_PI);
  ctx.fillStyle = atm; ctx.fill();

  // ── Molten core (glows through as damage grows) ───────────────────
  if (damage > 0.25) {
    const coreAlpha = Math.min(1, (damage - 0.25) / 0.4);
    const pulse     = 1 + Math.sin(t * 0.002) * 0.06;
    const coreR     = R * (0.55 + damage * 0.25) * pulse;
    const core = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR);
    core.addColorStop(0,   `hsla(55,  100%, 90%, ${coreAlpha * 0.95})`);
    core.addColorStop(0.35,`hsla(35,  100%, 65%, ${coreAlpha * 0.80})`);
    core.addColorStop(0.7, `hsla(15,  100%, 45%, ${coreAlpha * 0.60})`);
    core.addColorStop(1,   'transparent');
    ctx.beginPath(); ctx.arc(CX, CY, coreR, 0, TWO_PI);
    ctx.fillStyle = core; ctx.fill();
  }

  // ── Planet base sphere ────────────────────────────────────────────
  // Clip all surface drawing to the planet disk
  ctx.save();
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, TWO_PI); ctx.clip();

  // Base fill
  const base = ctx.createRadialGradient(CX - R * 0.3, CY - R * 0.35, 0, CX, CY, R);
  base.addColorStop(0,   `hsl(${hue + 15}, ${sat - 10}%, ${lit + 28}%)`);
  base.addColorStop(0.45,`hsl(${hue},      ${sat}%,      ${lit}%)`);
  base.addColorStop(1,   `hsl(${hue - 15}, ${sat + 5}%,  ${Math.max(5, lit - 18)}%)`);
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, TWO_PI);
  ctx.fillStyle = base; ctx.fill();

  // Surface texture bands (fade out as damage increases)
  if (damage < 0.85) {
    const bandAlpha = (1 - damage / 0.85) * 0.18;
    for (let b = 0; b < 4; b++) {
      const by = CY - R * 0.6 + b * R * 0.45;
      ctx.beginPath();
      ctx.ellipse(CX, by, R * 0.95, R * 0.12, 0, 0, TWO_PI);
      ctx.fillStyle = `hsla(${hue - 10}, ${sat}%, ${lit + 10}%, ${bandAlpha})`;
      ctx.fill();
    }
  }

  // ── Craters (appear progressively) ───────────────────────────────
  const visibleCraters = Math.round(damage * MAX_CRATERS);
  for (let i = 0; i < visibleCraters; i++) {
    const c     = CRATERS[i];
    // Craters grow from 0 to full size as damage passes their threshold
    const thresh = i / MAX_CRATERS;
    const grown  = Math.min(1, (damage - thresh) / 0.05);
    const cx     = CX + c.nx * R;
    const cy_    = CY + c.ny * R;
    const cr     = c.nr * R * grown;
    if (cr < 1) continue;

    // Shadow inside crater
    const shadow = ctx.createRadialGradient(cx, cy_, 0, cx, cy_, cr);
    shadow.addColorStop(0,   `rgba(0,0,0,${0.55 * grown})`);
    shadow.addColorStop(0.7, `rgba(0,0,0,${0.30 * grown})`);
    shadow.addColorStop(1,   'transparent');
    ctx.beginPath(); ctx.arc(cx, cy_, cr, 0, TWO_PI);
    ctx.fillStyle = shadow; ctx.fill();

    // Rim highlight
    ctx.beginPath(); ctx.arc(cx, cy_, cr, 0, TWO_PI);
    ctx.strokeStyle = `hsla(${hue + 20}, 60%, ${lit + 25}%, ${0.5 * grown})`;
    ctx.lineWidth   = c.rimW * grown;
    ctx.stroke();
  }

  // ── Cracks (appear after moderate damage) ────────────────────────
  if (damage > 0.2) {
    const visibleCracks = Math.round(((damage - 0.2) / 0.8) * MAX_CRACKS);
    for (let i = 0; i < visibleCracks; i++) {
      const ck     = CRACKS[i];
      const thresh = 0.2 + (i / MAX_CRACKS) * 0.8;
      const alpha  = Math.min(1, (damage - thresh) / 0.06);
      if (alpha <= 0) continue;

      // Glow under crack
      ctx.shadowColor = `hsla(35, 100%, 60%, ${alpha * 0.8})`;
      ctx.shadowBlur  = 4 + damage * 8;

      ctx.beginPath();
      let a = ck.startA;
      let d = R * 0.1;
      ctx.moveTo(CX + Math.cos(a) * d, CY + Math.sin(a) * d);
      for (const pt of ck.pts) {
        a += pt.da;
        d += pt.dr * R;
        if (d > R * 0.98) break;
        ctx.lineTo(CX + Math.cos(a) * d, CY + Math.sin(a) * d);
      }
      ctx.strokeStyle = `hsla(30, 100%, 65%, ${alpha})`;
      ctx.lineWidth   = 1 + damage * 2;
      ctx.lineCap     = 'round';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // ── Specular highlight ────────────────────────────────────────────
  const spec = ctx.createRadialGradient(
    CX - R * 0.38, CY - R * 0.38, 0,
    CX - R * 0.2,  CY - R * 0.2,  R * 0.55
  );
  spec.addColorStop(0, `rgba(255,255,255,${0.18 - damage * 0.12})`);
  spec.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(CX, CY, R, 0, TWO_PI);
  ctx.fillStyle = spec; ctx.fill();

  ctx.restore(); // end clip

  // ── Floating dust/debris (increases with damage) ──────────────────
  const dustCount = Math.floor(damage * 24);
  for (let i = 0; i < dustCount; i++) {
    const rng   = seeded(i * 999 + 77);
    const speed = 0.0004 + rng() * 0.0008;
    const orbit = R * (1.05 + rng() * 0.55);
    const angle = rng() * TWO_PI + t * speed * (i % 2 === 0 ? 1 : -1);
    const dx    = CX + Math.cos(angle) * orbit;
    const dy    = CY + Math.sin(angle) * orbit;
    const dr    = 1 + rng() * 2;
    const alpha = (0.3 + rng() * 0.5) * damage;
    ctx.beginPath(); ctx.arc(dx, dy, dr, 0, TWO_PI);
    ctx.fillStyle = `hsla(${hue + 20}, 70%, 70%, ${alpha})`;
    ctx.fill();
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export default function Planet({ state, onClickPlanet }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [pressed, setPressed] = useState(false);
  const { orePerClick } = computeStats(state);

  const damage = calcDamage(state.totalOreExtracted);
  const label  = damageLabel(damage);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    const start = performance.now();
    function loop(now: number) {
      drawFrame(ctx, now - start, damage);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [damage]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    onClickPlanet();
    const rect = e.currentTarget.getBoundingClientRect();
    const id   = nextId++;
    setFloats(f => [...f, { id, x: e.clientX - rect.left, y: e.clientY - rect.top, value: orePerClick }]);
    setTimeout(() => setFloats(f => f.filter(ft => ft.id !== id)), 900);
    setPressed(true);
    setTimeout(() => setPressed(false), 120);
  }, [onClickPlanet, orePerClick]);

  // Drone orbit dots
  const orbitDots = Math.min(Object.values(state.drones).reduce((a, b) => a + b, 0), 40);

  // Damage bar colour
  const barColor = damage < 0.35 ? '#22d3a0'
                 : damage < 0.65 ? '#f5a623'
                 : '#ff4040';

  return (
    <div className="planet-area">
      <div
        className={`planet-wrapper${pressed ? ' pressed' : ''}`}
        onClick={handleClick}
        style={{ position: 'relative', display: 'inline-block' }}
      >
        {/* Canvas planet */}
        <canvas
          ref={canvasRef}
          width={280}
          height={280}
          style={{ display: 'block', cursor: 'crosshair' }}
        />

        {/* Orbit dots overlay */}
        {orbitDots > 0 && (
          <div className="orbit-ring" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {Array.from({ length: orbitDots }).map((_, i) => (
              <div
                key={i}
                className="orbit-dot"
                style={{ '--i': i, '--total': orbitDots } as React.CSSProperties}
              />
            ))}
          </div>
        )}

        {/* Floating ore text */}
        {floats.map(ft => (
          <div key={ft.id} className="float-text" style={{ left: ft.x, top: ft.y }}>
            +{ft.value} ore
          </div>
        ))}
      </div>

      {/* Extraction damage bar */}
      <div className="damage-bar-wrap">
        <div className="damage-bar-label">
          <span>EXTRACTION DAMAGE</span>
          <span style={{ color: barColor }}>{Math.round(damage * 100)}%</span>
        </div>
        <div className="damage-bar-track">
          <div
            className="damage-bar-fill"
            style={{ width: `${damage * 100}%`, background: barColor, boxShadow: `0 0 8px ${barColor}80` }}
          />
        </div>
        <div className="damage-status" style={{ color: barColor }}>{label}</div>
      </div>

      <div className="planet-sublabel">+{orePerClick} ore per click</div>
    </div>
  );
}
