import { interpolate } from "remotion";
import rawLyrics from "../data/lyrics.json";

export type Word = { t: string; s: number; e: number };
export type Section = "verse" | "hook" | "bridge";
export type Line = {
  text: string;
  section: Section;
  start: number;
  end: number;
  words: Word[];
};

export const LYRICS = rawLyrics as Line[];
export const VOCALS_START = LYRICS[0].start;
export const VOCALS_END = LYRICS[LYRICS.length - 1].end;

// Contiguous hook lines merged into [start, end] ranges, used to crossfade
// the "facade" (verse) look into the "light" (hook) look.
const HOOK_RANGES: [number, number][] = [];
for (const l of LYRICS) {
  const last = HOOK_RANGES[HOOK_RANGES.length - 1];
  if (l.section !== "hook") continue;
  if (last && l.start - last[1] < 1.5) last[1] = l.end;
  else HOOK_RANGES.push([l.start, l.end]);
}

export const lightAmount = (t: number) => {
  let v = 0;
  for (const [s, e] of HOOK_RANGES) {
    v = Math.max(
      v,
      interpolate(t, [s - 0.5, s, e, e + 1], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    );
  }
  return v;
};

export const activeLine = (t: number): Line | null => {
  for (const l of LYRICS) if (t >= l.start - 0.25 && t < l.end) return l;
  return null;
};

const DARK =
  /devil|demon|pentagram|horns|occult|chains|leash|collar|fraud|facade|pimps|zombies|lies|slop|smear|enslave|puppet|strings|vultures|carcass|graveyard|guap/i;
const HOLY =
  /god|light|flame|love|grace|divine|infinite|peace|belief|elevate|truth|raw|big|summit|mountain/i;

export const wordTone = (w: string): "dark" | "holy" | "plain" =>
  HOLY.test(w) ? "holy" : DARK.test(w) ? "dark" : "plain";
