import React from "react";
import {
  AbsoluteFill,
  Img,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const TEAL = "#3fd6b4";

// The "facade": grimy teal room from the cover art, puppet strings, grain.
export const FacadeLayer: React.FC<{ bass: number; t: number }> = ({
  bass,
  t,
}) => {
  const { width, height } = useVideoConfig();
  const zoom = 1.25 + 0.08 * Math.sin(t / 9) + bass * 0.04;
  const strings = 9;
  return (
    <AbsoluteFill style={{ backgroundColor: "#040b0a" }}>
      <Img
        src={staticFile("cover.jpg")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom}) translate(${Math.sin(t / 7) * 1.5}%, ${Math.cos(t / 11) * 1.5}%)`,
          filter: `blur(${width > height ? 6 : 8}px) saturate(1.3) brightness(${0.45 + bass * 0.25}) contrast(1.15)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 60%, transparent 20%, rgba(2,10,9,0.9) 85%)`,
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {new Array(strings).fill(0).map((_, i) => {
          const x = ((i + 0.5) / strings) * width;
          const sway =
            Math.sin(t * 1.3 + i * 1.7) * 40 + bass * 30 * (i % 2 ? 1 : -1);
          const len = height * (0.25 + 0.5 * random(`s${i}`));
          return (
            <g key={i} opacity={0.35}>
              <path
                d={`M ${x} 0 Q ${x + sway} ${len / 2} ${x + sway * 0.6} ${len}`}
                stroke={TEAL}
                strokeWidth={1.5}
                fill="none"
              />
              <circle cx={x + sway * 0.6} cy={len} r={4} fill={TEAL} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// The "light": candle-gold burst, rotating rays and rising embers.
export const LightLayer: React.FC<{ bass: number; t: number }> = ({
  bass,
  t,
}) => {
  const { width, height } = useVideoConfig();
  const embers = 70;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 55%, #fff4d6 0%, #ffb347 ${10 + bass * 12}%, #b3380f ${38 + bass * 10}%, #1a0602 80%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${t * 12}deg at 50% 55%, rgba(255,240,200,0.18) 0deg 6deg, transparent 6deg 18deg)`,
          mixBlendMode: "screen",
          opacity: 0.5 + bass * 0.5,
        }}
      />
      <svg width={width} height={height} style={{ position: "absolute" }}>
        {new Array(embers).fill(0).map((_, i) => {
          const speed = 60 + random(`v${i}`) * 180;
          const y =
            height - ((t * speed + random(`y${i}`) * height) % (height + 40));
          const x = random(`x${i}`) * width + Math.sin(t * 2 + i) * 20;
          const r = 1.5 + random(`r${i}`) * 3.5 + bass * 2;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill="#ffd27a"
              opacity={0.4 + random(`o${i}`) * 0.6}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

// Film grain + scanlines + vignette, always on top of the backgrounds.
export const Grain: React.FC<{ strength: number }> = ({ strength }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", opacity: strength }}
      >
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={Math.floor(frame / 2)}
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 220px 60px rgba(0,0,0,0.85)",
        }}
      />
    </AbsoluteFill>
  );
};
