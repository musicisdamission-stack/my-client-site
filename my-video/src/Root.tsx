import "./index.css";
import { Composition } from "remotion";
import { MakeItBig, DURATION_IN_FRAMES, FPS } from "./MakeItBig/MakeItBig";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MakeItBig"
        component={MakeItBig}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="MakeItBigVertical"
        component={MakeItBig}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
