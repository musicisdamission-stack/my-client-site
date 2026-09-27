import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Self-hosted so renders never depend on reaching Google Fonts.
export const ANTON = "Anton";
export const VT323 = "VT323";

loadFont({ family: ANTON, url: staticFile("fonts/Anton.woff2") });
loadFont({ family: VT323, url: staticFile("fonts/VT323.woff2") });
