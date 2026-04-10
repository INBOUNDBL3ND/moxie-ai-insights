import { Composition } from "remotion";
import { Explainer } from "./Explainer.jsx";
import { ExplainerShort } from "./ExplainerShort.jsx";
import { ExplainerMid } from "./ExplainerMid.jsx";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="MoxieExplainer"
        component={Explainer}
        durationInFrames={6707}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="MoxieExplainerShort"
        component={ExplainerShort}
        durationInFrames={1221}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="MoxieExplainerMid"
        component={ExplainerMid}
        durationInFrames={1882}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
