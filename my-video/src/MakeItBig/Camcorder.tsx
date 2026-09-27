import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { VT323 as fontFamily } from "./fonts";

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

// Camcorder HUD echoing the cover art's viewfinder frame.
export const Camcorder: React.FC<{ t: number; opacity: number }> = ({
  t,
  opacity,
}) => {
  const { width, height } = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const inset = 48 * u;
  const arm = 70 * u;
  const stroke = `${4 * u}px solid rgba(235,245,240,0.85)`;
  const text: React.CSSProperties = {
    position: "absolute",
    fontFamily,
    fontSize: 44 * u,
    color: "rgba(235,245,240,0.9)",
    letterSpacing: 2 * u,
    textShadow: "0 0 8px rgba(0,0,0,0.8)",
  };
  const corner = (pos: React.CSSProperties, b: React.CSSProperties) => (
    <div
      style={{ position: "absolute", width: arm, height: arm, ...pos, ...b }}
    />
  );
  const recOn = Math.floor(t * 1.2) % 2 === 0;
  return (
    <AbsoluteFill style={{ opacity }}>
      {corner(
        { left: inset, top: inset },
        { borderLeft: stroke, borderTop: stroke },
      )}
      {corner(
        { right: inset, top: inset },
        { borderRight: stroke, borderTop: stroke },
      )}
      {corner(
        { left: inset, bottom: inset },
        { borderLeft: stroke, borderBottom: stroke },
      )}
      {corner(
        { right: inset, bottom: inset },
        { borderRight: stroke, borderBottom: stroke },
      )}
      <div style={{ ...text, left: inset + 30 * u, top: inset + 20 * u }}>
        <span style={{ color: "#ff3b30", opacity: recOn ? 1 : 0.15 }}>●</span>{" "}
        REC
      </div>
      <div style={{ ...text, right: inset + 30 * u, top: inset + 20 * u }}>
        {pad(t / 60)}:{pad(t % 60)}:{pad((t % 1) * 30)}
      </div>
      <div style={{ ...text, left: inset + 30 * u, bottom: inset + 20 * u }}>
        ▶ PLAY
      </div>
      <div style={{ ...text, right: inset + 30 * u, bottom: inset + 20 * u }}>
        SP 1080
      </div>
    </AbsoluteFill>
  );
};
