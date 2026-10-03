import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { ANTON as fontFamily } from "./fonts";
import { FacadeLayer, Grain, LightLayer } from "./Background";
import { Camcorder } from "./Camcorder";
import { Lyrics } from "./Lyrics";
import { SONG, useAudioEnergy } from "./useAudioEnergy";
import { activeLine, lightAmount, VOCALS_END, VOCALS_START } from "./timing";

export const FPS = 30;
export const SONG_SECONDS = 271.99;
export const DURATION_IN_FRAMES = Math.ceil(SONG_SECONDS * FPS);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Neon title card (intro + outro) with the cover art as a floating tape still.
const TitleCard: React.FC<{ t: number; local: number; bass: number }> = ({
  t,
  local,
  bass,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const landscape = width > height;
  const u = Math.min(width, height) / 1080;
  // Neon sign stutters on, then holds steady with a faint hum.
  const flicker =
    local < 1.2
      ? random(`f${frame}`) > 0.55
        ? 1
        : 0.15
      : 0.92 + 0.08 * Math.sin(t * 40);
  const coverSize = (landscape ? 520 : 640) * u;
  return (
    <AbsoluteFill
      style={{
        flexDirection: landscape ? "row" : "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 80 * u,
      }}
    >
      <Img
        src={staticFile("cover.jpg")}
        style={{
          width: coverSize,
          height: coverSize,
          transform: `rotate(${-3 + Math.sin(t / 3)}deg) scale(${1 + bass * 0.03})`,
          boxShadow: `0 30px 80px rgba(0,0,0,0.8), 0 0 ${60 + bass * 80}px rgba(255,170,60,${0.25 + bass * 0.3})`,
          border: `${10 * u}px solid #e9efe9`,
        }}
      />
      <div
        style={{
          fontFamily,
          fontSize: (landscape ? 190 : 170) * u,
          lineHeight: 0.95,
          color: "#fff6e8",
          textAlign: landscape ? "left" : "center",
          opacity: flicker,
          textShadow: `0 0 10px #fff, 0 0 30px #ffb347, 0 0 70px #ff7a1a, 0 0 120px #ff7a1a`,
        }}
      >
        MAKE
        <br />
        IT BIG
      </div>
    </AbsoluteFill>
  );
};

export const MakeItBig: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const { bass } = useAudioEnergy();

  const light = lightAmount(t);
  const line = activeLine(t);

  const introOpacity = interpolate(
    t,
    [0.5, 2.5, VOCALS_START - 1.5, VOCALS_START - 0.2],
    [0, 1, 1, 0],
    clamp,
  );
  const outroOpacity = interpolate(
    t,
    [VOCALS_END + 0.5, VOCALS_END + 2, SONG_SECONDS - 3, SONG_SECONDS - 0.5],
    [0, 1, 1, 0],
    clamp,
  );
  const fadeFromBlack = interpolate(t, [0, 1.5], [1, 0], clamp);
  const fadeToBlack = interpolate(
    t,
    [SONG_SECONDS - 2, SONG_SECONDS],
    [0, 1],
    clamp,
  );
  // Hard white flash on heavy kicks, mostly during the hook.
  const flash = Math.pow(bass, 4) * (0.08 + 0.3 * light);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Audio src={SONG} />
      <FacadeLayer bass={bass} t={t} />
      {light > 0 ? (
        <AbsoluteFill style={{ opacity: light }}>
          <LightLayer bass={bass} t={t} />
        </AbsoluteFill>
      ) : null}
      {introOpacity > 0 ? (
        <AbsoluteFill
          style={{
            opacity: introOpacity,
            transform: `scale(${interpolate(t, [VOCALS_START - 1.5, VOCALS_START], [1, 1.25], clamp)})`,
          }}
        >
          <TitleCard t={t} local={t - 0.8} bass={bass} />
        </AbsoluteFill>
      ) : null}
      {outroOpacity > 0 ? (
        <AbsoluteFill style={{ opacity: outroOpacity }}>
          <TitleCard t={t} local={t - VOCALS_END - 0.5} bass={bass} />
        </AbsoluteFill>
      ) : null}
      {line ? <Lyrics key={line.start} line={line} t={t} bass={bass} /> : null}
      <Grain strength={0.1 + 0.05 * (1 - light)} />
      <Camcorder t={t} opacity={0.85 * (1 - light)} />
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
      <AbsoluteFill
        style={{
          backgroundColor: "#000",
          opacity: Math.max(fadeFromBlack, fadeToBlack),
        }}
      />
    </AbsoluteFill>
  );
};
