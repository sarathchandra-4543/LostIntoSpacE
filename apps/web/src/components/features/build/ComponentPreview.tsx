import { useMemo } from 'react';

import type {
  ComponentDef,
  EngineDef,
  FinDef,
  NoseConeDef,
} from '@lostintospace/simulation-engine/core/component-types';

import { cn } from '@/lib/utils';

/**
 * What a part actually looks like.
 *
 * The parts bin used to be a list of names, so choosing between four nose cones
 * meant reading four descriptions and hoping. A nose cone is a *shape* — that
 * is the entire reason there are four of them, and the reason the drag model
 * treats them differently — and a list of names is the one presentation that
 * hides it.
 *
 * ## Drawn from the definition, never from a picture
 *
 * Every silhouette here is generated from the same numbers the physics reads:
 * the ogive curve from `shape` and `finenessRatio`, the fin planform from
 * `rootChord_m`, `tipChord_m`, `span_m` and `sweepAngle_rad`, the nozzle from
 * the engine's exit area. So a part cannot look one way and fly another, and
 * adding a component to the catalogue gives it a preview for free — there is no
 * asset to draw and nothing to keep in sync.
 *
 * Each part is drawn to its own aspect ratio inside a fixed box, so a stubby
 * coupler and a long body tube look stubby and long relative to each other.
 */

/** The box every preview is drawn into, in SVG user units. */
const W = 72;
const H = 96;

/** Nose cone profiles, as a half-silhouette from tip to base. */
function noseProfile(shape: string, radius: number, length: number, steps = 24): string {
  const points: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * length;
    let x: number;

    switch (shape) {
      case 'conical':
        x = radius * t;
        break;
      case 'elliptical':
        // A quarter ellipse: blunt, and the cheapest shape to make.
        x = radius * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
        break;
      case 'parabolic':
        x = radius * (2 * t - t * t);
        break;
      case 'power_series':
        x = radius * Math.pow(t, 0.5);
        break;
      case 'haack':
      case 'von_karman': {
        // The Sears–Haack / von Kármán body: minimum wave drag for its volume,
        // which is why it is what a supersonic vehicle actually flies.
        const theta = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * t)));
        x =
          (radius / Math.sqrt(Math.PI)) *
          Math.sqrt(Math.max(0, theta - Math.sin(2 * theta) / 2));
        break;
      }
      case 'ogive':
      default: {
        // Tangent ogive: a circular arc meeting the body without a slope break.
        const rho = (radius * radius + length * length) / (2 * radius);
        const inner = rho * rho - (length - y) * (length - y);
        x = Math.max(0, Math.sqrt(Math.max(0, inner)) - (rho - radius));
        break;
      }
    }
    points.push([x, y]);
  }

  // Mirror to a closed silhouette.
  const right = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ');
  const left = [...points]
    .reverse()
    .map(([x, y]) => `${(-x).toFixed(2)},${y.toFixed(2)}`)
    .join(' L ');
  return `M ${right} L ${left} Z`;
}

/** Fit a part's real dimensions into the preview box, keeping its aspect. */
function fit(length_m: number, diameter_m: number) {
  const pad = 8;
  const boxW = W - pad * 2;
  const boxH = H - pad * 2;
  const aspect = diameter_m > 0 ? length_m / diameter_m : 1;

  let drawH = boxH;
  let drawW = drawH / Math.max(aspect, 0.0001);
  if (drawW > boxW) {
    drawW = boxW;
    drawH = drawW * aspect;
  }
  return { width: drawW, height: drawH, cx: W / 2, cy: H / 2 };
}

export interface ComponentPreviewProps {
  component: ComponentDef;
  className?: string;
}

/**
 * A scale silhouette of one component.
 *
 * Decorative to a screen reader: every fact it conveys is also written out in
 * the specification beside it, so announcing the drawing would only repeat it.
 */
export function ComponentPreview({ component, className }: ComponentPreviewProps) {
  const body = useMemo(() => draw(component), [component]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('block h-full w-full', className)}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id="lis-part-hull" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4A453C" />
          <stop offset="0.35" stopColor="#CAC3B7" />
          <stop offset="0.72" stopColor="#847D6F" />
          <stop offset="1" stopColor="#302C27" />
        </linearGradient>
        <linearGradient id="lis-part-hot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E4682E" />
          <stop offset="1" stopColor="#8A3F1C" />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
}

/** Pick the silhouette for a category. */
function draw(component: ComponentDef) {
  const { length_m, outerDiameter_m } = component;
  const box = fit(length_m, outerDiameter_m);
  const radius = box.width / 2;
  const top = box.cy - box.height / 2;
  const hull = 'url(#lis-part-hull)';
  const seam = '#1C1A18';

  switch (component.category) {
    case 'nose_cone':
    case 'fairing': {
      const def = component as NoseConeDef;
      return (
        <g transform={`translate(${box.cx} ${top})`}>
          <path d={noseProfile(def.shape ?? 'ogive', radius, box.height)} fill={hull} />
          <path
            d={`M ${-radius} ${box.height} L ${radius} ${box.height}`}
            stroke={seam}
            strokeWidth="1"
          />
          {component.category === 'fairing' && (
            // A fairing splits. That is its whole function, so it is drawn split.
            <path d={`M 0 ${box.height * 0.12} L 0 ${box.height}`} stroke={seam} strokeWidth="0.8" strokeDasharray="2 2" />
          )}
        </g>
      );
    }

    case 'fin': {
      const def = component as FinDef;
      const scale = Math.min((W - 16) / Math.max(def.span_m, 1e-6), (H - 16) / Math.max(def.rootChord_m, 1e-6)) * 0.8;
      const span = def.span_m * scale;
      const root = def.rootChord_m * scale;
      const tip = def.tipChord_m * scale;
      const sweep = Math.tan(def.sweepAngle_rad ?? 0) * span;
      return (
        <g transform={`translate(${(W - span) / 2} ${(H - root) / 2})`}>
          <path
            d={`M 0 0 L 0 ${root} L ${span} ${root - sweep} L ${span} ${root - sweep - tip} Z`}
            fill={hull}
            stroke={seam}
            strokeWidth="0.7"
          />
          {/* The body it mounts to, so the span reads as a span. */}
          <path d={`M 0 ${-4} L 0 ${root + 4}`} stroke="#4A453C" strokeWidth="3" />
          <text x={span / 2} y={root + 12} fill="#625C51" fontSize="7" textAnchor="middle" fontFamily="monospace">
            ×{def.finCount}
          </text>
        </g>
      );
    }

    case 'engine': {
      const def = component as EngineDef;
      // Exit radius from the real exit area, so a vacuum engine's enormous bell
      // is enormous here too.
      const exit = Math.min(
        radius * 1.5,
        Math.sqrt(Math.max(def.nozzleExitArea_m2 ?? 0, 1e-6) / Math.PI) * (box.width / Math.max(outerDiameter_m, 1e-6)),
      );
      const throat = Math.max(1.5, exit * 0.28);
      const chamberH = box.height * 0.3;
      const bellH = box.height * 0.7;
      return (
        <g transform={`translate(${box.cx} ${top})`}>
          {/* Combustion chamber and injector head. */}
          <rect x={-throat * 1.9} y={0} width={throat * 3.8} height={chamberH} fill={hull} rx="1" />
          {/* Bell: a parabolic expansion, drawn as one. */}
          <path
            d={`M ${-throat} ${chamberH}
                Q ${-exit * 0.72} ${chamberH + bellH * 0.55} ${-exit} ${chamberH + bellH}
                L ${exit} ${chamberH + bellH}
                Q ${exit * 0.72} ${chamberH + bellH * 0.55} ${throat} ${chamberH} Z`}
            fill={hull}
          />
          <ellipse cx="0" cy={chamberH + bellH} rx={exit} ry={exit * 0.22} fill="#17150F" />
          {/* Regenerative cooling channels — the tell of a real bell. */}
          {[-0.55, 0, 0.55].map((f) => (
            <path
              key={f}
              d={`M ${throat * f} ${chamberH} Q ${exit * f * 0.8} ${chamberH + bellH * 0.55} ${exit * f} ${chamberH + bellH}`}
              stroke={seam}
              strokeWidth="0.5"
              fill="none"
              opacity="0.7"
            />
          ))}
        </g>
      );
    }

    case 'fuel_tank':
    case 'oxidizer_tank': {
      const dome = radius * 0.42;
      const isOx = component.category === 'oxidizer_tank';
      return (
        <g transform={`translate(${box.cx} ${top})`}>
          <rect x={-radius} y={dome} width={radius * 2} height={box.height - dome * 2} fill={hull} />
          <ellipse cx="0" cy={dome} rx={radius} ry={dome} fill={hull} />
          <ellipse cx="0" cy={box.height - dome} rx={radius} ry={dome} fill={hull} />
          {/* Propellant level, and the band that says which propellant. */}
          <rect
            x={-radius * 0.82}
            y={dome + 3}
            width={radius * 1.64}
            height={box.height - dome * 2 - 6}
            fill={isOx ? '#7FA8B8' : '#E4682E'}
            opacity="0.22"
          />
          <rect
            x={-radius}
            y={box.height * 0.62}
            width={radius * 2}
            height={Math.max(2, box.height * 0.05)}
            fill={isOx ? '#7FA8B8' : '#E4682E'}
            opacity="0.8"
          />
        </g>
      );
    }

    case 'body':
    case 'coupler':
    case 'interstage':
    case 'motor_mount': {
      return (
        <g transform={`translate(${box.cx} ${top})`}>
          <rect x={-radius} y={0} width={radius * 2} height={box.height} fill={hull} />
          <ellipse cx="0" cy={0} rx={radius} ry={radius * 0.2} fill="#302C27" />
          <ellipse cx="0" cy={box.height} rx={radius} ry={radius * 0.2} fill="#1C1A18" />
          {component.category === 'interstage' &&
            [0.25, 0.5, 0.75].map((f) => (
              // Vent ports: an interstage has to breathe, or it bursts on ascent.
              <circle key={f} cx={0} cy={box.height * f} r={Math.max(1, radius * 0.12)} fill={seam} />
            ))}
        </g>
      );
    }

    case 'decoupler':
    case 'bulkhead':
    case 'centering_ring': {
      return (
        <g transform={`translate(${box.cx} ${box.cy})`}>
          <rect
            x={-radius * 1.06}
            y={-Math.max(3, box.height / 2)}
            width={radius * 2.12}
            height={Math.max(6, box.height)}
            fill={hull}
          />
          {component.category === 'decoupler' && (
            <path
              d={`M ${-radius * 1.3} 0 L ${radius * 1.3} 0`}
              stroke="#E4682E"
              strokeWidth="1.2"
              strokeDasharray="3 2"
            />
          )}
        </g>
      );
    }

    case 'parachute': {
      const canopy = W * 0.38;
      return (
        <g transform={`translate(${W / 2} ${H * 0.3})`}>
          <path d={`M ${-canopy} 0 A ${canopy} ${canopy * 0.86} 0 0 1 ${canopy} 0 Z`} fill="#E4682E" opacity="0.85" />
          <path d={`M ${-canopy} 0 A ${canopy} ${canopy * 0.86} 0 0 1 ${canopy} 0`} fill="none" stroke="#8A3F1C" strokeWidth="0.8" />
          {[-0.72, -0.3, 0.3, 0.72].map((f) => (
            <path key={f} d={`M ${canopy * f} 0 L 0 ${H * 0.42}`} stroke="#847D6F" strokeWidth="0.6" />
          ))}
          <rect x={-5} y={H * 0.42} width={10} height={9} fill={hull} rx="1" />
        </g>
      );
    }

    case 'heat_shield': {
      // A blunt body. Blunt on purpose: it holds the shock wave off the surface
      // so the heat goes into the air rather than into the vehicle.
      return (
        <g transform={`translate(${box.cx} ${box.cy})`}>
          <path
            d={`M ${-radius * 1.25} ${-box.height * 0.4}
                Q 0 ${box.height * 0.85} ${radius * 1.25} ${-box.height * 0.4} Z`}
            fill="url(#lis-part-hot)"
          />
          <path
            d={`M ${-radius * 1.25} ${-box.height * 0.4} L ${radius * 1.25} ${-box.height * 0.4}`}
            stroke={seam}
            strokeWidth="1"
          />
        </g>
      );
    }

    case 'landing_leg': {
      return (
        <g transform={`translate(${W / 2} ${H * 0.2})`}>
          <rect x={-2.5} y={0} width={5} height={H * 0.28} fill={hull} />
          <path d={`M 0 ${H * 0.28} L ${-W * 0.26} ${H * 0.66}`} stroke="#847D6F" strokeWidth="3.4" strokeLinecap="round" />
          <path d={`M 0 ${H * 0.2} L ${-W * 0.2} ${H * 0.6}`} stroke="#4A453C" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx={-W * 0.26} cy={H * 0.68} rx="9" ry="3" fill="#302C27" />
        </g>
      );
    }

    case 'payload': {
      return (
        <g transform={`translate(${box.cx} ${top})`}>
          <rect x={-radius} y={0} width={radius * 2} height={box.height} fill={hull} rx="1.5" />
          {/* Solar wings, since almost every payload has them. */}
          <rect x={-radius - 12} y={box.height * 0.32} width={11} height={box.height * 0.3} fill="#3E5B67" />
          <rect x={radius + 1} y={box.height * 0.32} width={11} height={box.height * 0.3} fill="#3E5B67" />
          <circle cx="0" cy={box.height * 0.22} r={Math.max(2, radius * 0.28)} fill="#7FA8B8" />
        </g>
      );
    }

    case 'avionics':
    case 'guidance':
    case 'sensor':
    case 'battery': {
      const accent =
        component.category === 'battery'
          ? '#8FB573'
          : component.category === 'sensor'
            ? '#7FA8B8'
            : '#8E7CA8';
      return (
        <g transform={`translate(${box.cx} ${top})`}>
          <rect x={-radius} y={0} width={radius * 2} height={box.height} fill={hull} rx="1" />
          {/* A board, and the indicator that says it is powered. */}
          <rect
            x={-radius * 0.66}
            y={box.height * 0.24}
            width={radius * 1.32}
            height={box.height * 0.52}
            fill="#17150F"
            rx="1"
          />
          {[0.36, 0.5, 0.64].map((f) => (
            <rect key={f} x={-radius * 0.5} y={box.height * f} width={radius} height="1.2" fill={accent} opacity="0.75" />
          ))}
        </g>
      );
    }

    default:
      return (
        <g transform={`translate(${box.cx} ${top})`}>
          <rect x={-radius} y={0} width={radius * 2} height={box.height} fill={hull} rx="1" />
        </g>
      );
  }
}
