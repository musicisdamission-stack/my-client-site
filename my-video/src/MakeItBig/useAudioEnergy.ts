import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { staticFile, useCurrentFrame, useVideoConfig } from "remotion";

export const SONG = staticFile("make-it-big.mp3");

// Low / mid / high energy for the current frame, each roughly 0..1.
export const useAudioEnergy = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(SONG);
  if (!audioData) return { bass: 0, mid: 0, high: 0 };

  const bins = visualizeAudio({
    audioData,
    frame,
    fps,
    numberOfSamples: 32,
    optimizeFor: "speed",
  });
  const avg = (a: number, b: number) =>
    bins.slice(a, b).reduce((x, y) => x + y, 0) / (b - a);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    bass: clamp(avg(0, 3) * 2.2),
    mid: clamp(avg(3, 12) * 4),
    high: clamp(avg(12, 32) * 10),
  };
};
