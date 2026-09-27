import React from "react";
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ANTON as fontFamily } from "./fonts";
import { Line, wordTone } from "./timing";

const TONE_COLOR = { dark: "#ff4d4d", holy: "#ffc94d", plain: "#ffffff" };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Lyrics: React.FC<{ line: Line; t: number; bass: number }> = ({
  line,
  t,
  bass,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const landscape = width > height;
  const u = width / (landscape ? 1920 : 1080);

  const lineOpacity =
    interpolate(t, [line.start - 0.25, line.start], [0, 1], clamp) *
    interpolate(t, [line.end - 0.25, line.end], [1, 0], clamp);

  const isBig = /make it big/i.test(line.text);
  const isRaw = line.text === "RAW!";

  if (line.section === "verse") {
    const split = bass * 7 * u;
    return (
      <AbsoluteFill
        style={{
          justifyContent: landscape ? "flex-end" : "center",
          alignItems: "center",
          paddingBottom: landscape ? 170 * u : 0,
          opacity: lineOpacity,
        }}
      >
        <div
          style={{
            width: landscape ? "82%" : "86%",
            textAlign: "center",
            fontFamily,
            fontSize: (landscape ? 76 : 88) * u,
            lineHeight: 1.18,
            textTransform: "uppercase",
            letterSpacing: 1 * u,
          }}
        >
          {line.words.map((w, i) => {
            const sung = t >= w.s;
            const active = t >= w.s && t < Math.max(w.e, w.s + 0.25);
            const pop = spring({
              frame: frame - Math.round(w.s * fps),
              fps,
              config: { damping: 14, mass: 0.5 },
            });
            const tone = wordTone(w.t);
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  margin: "0 0.14em",
                  transformOrigin: "center bottom",
                  color: sung ? TONE_COLOR[tone] : "rgba(255,255,255,0.28)",
                  transform: `translateY(${(1 - pop) * 14 * u}px) scale(${active ? 1.05 : 1})`,
                  textShadow: sung
                    ? `${-split}px 0 rgba(255,0,70,0.75), ${split}px 0 rgba(0,255,220,0.75), 0 4px 18px rgba(0,0,0,0.9)${tone !== "plain" ? `, 0 0 24px ${TONE_COLOR[tone]}` : ""}`
                    : "0 4px 18px rgba(0,0,0,0.9)",
                }}
              >
                {w.t}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  // Hook + bridge: words slam in one by one, centered and huge.
  const size = isRaw
    ? (landscape ? 420 : 340) * u
    : isBig
      ? (landscape ? 250 : 210) * u
      : (landscape ? 140 : 130) * u;
  const shake = (isRaw || isBig ? 26 : 12) * u * bass * bass;
  const sx = (random(`sx${frame}`) - 0.5) * shake;
  const sy = (random(`sy${frame}`) - 0.5) * shake;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: lineOpacity,
        transform: `translate(${sx}px, ${sy}px) scale(${1 + (isBig ? bass * 0.08 : 0)})`,
      }}
    >
      <div
        style={{
          width: "90%",
          textAlign: "center",
          fontFamily,
          fontSize: size,
          lineHeight: 1.02,
          textTransform: "uppercase",
        }}
      >
        {line.words.map((w, i) => {
          const pop = spring({
            frame: frame - Math.round(w.s * fps),
            fps,
            config: { damping: 11, mass: 0.6 },
          });
          const visible = t >= w.s - 0.03;
          const bigFill: React.CSSProperties = {
            backgroundImage:
              "linear-gradient(180deg, #fffaf0 10%, #ffd166 55%, #ff8c1a 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextStroke: `${3 * u}px #2a0800`,
            filter: `drop-shadow(0 ${8 * u}px 0 #2a0800) drop-shadow(0 0 ${30 * u}px rgba(255,120,20,0.8))`,
          };
          const rawFill: React.CSSProperties = {
            color: "#ff2d2d",
            WebkitTextStroke: `${4 * u}px #120000`,
            textShadow: `${-10 * bass * u}px 0 #00ffe0, ${10 * bass * u}px 0 #ff00aa, 0 0 60px rgba(255,0,0,0.8)`,
          };
          const plainFill: React.CSSProperties = {
            color: wordTone(w.t) === "dark" ? "#ffe0d6" : "#ffffff",
            WebkitTextStroke: `${2 * u}px #2a0800`,
            textShadow: `0 ${6 * u}px 0 #2a0800, 0 0 ${28 * u}px rgba(40,8,0,0.9)`,
          };
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 0.12em",
                opacity: visible ? 1 : 0.15,
                transform: `scale(${visible ? interpolate(pop, [0, 1], [1.9, 1]) : 1})`,
                ...(isRaw ? rawFill : isBig ? bigFill : plainFill),
              }}
            >
              {w.t}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
