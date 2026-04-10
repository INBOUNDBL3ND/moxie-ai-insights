import { AbsoluteFill, Audio, Img, Sequence, useCurrentFrame, interpolate, staticFile } from "remotion";

const FPS = 30;

const Scene = ({ src, caption }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, FPS * 12], [1, 1.06], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 60, overflow: "hidden" }}>
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
        background: "linear-gradient(135deg, #1D80DE 0%, #1565c0 100%)",
        display: "flex", alignItems: "center", paddingLeft: 20,
      }}>
        <img src={staticFile("mascot.png")} style={{ width: 36, height: 36, marginRight: 12, borderRadius: "50%" }} />
        <div style={{ color: "white", fontSize: 18, fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif" }}>{caption}</div>
      </div>
    </AbsoluteFill>
  );
};

const TitleCard = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 15], [0.6, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const textOp = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(135deg, #1D80DE 0%, #0d5bb5 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <img src={staticFile("mascot.png")} style={{ width: 130, height: 130, opacity, transform: `scale(${scale})` }} />
      <div style={{ color: "white", fontSize: 38, fontWeight: 800, marginTop: 16, fontFamily: "Helvetica, Arial, sans-serif", opacity: textOp }}>{title}</div>
      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 18, marginTop: 8, fontFamily: "Helvetica, Arial, sans-serif", opacity: textOp }}>{subtitle}</div>
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{
      background: "linear-gradient(135deg, #1D80DE 0%, #0d5bb5 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity,
    }}>
      <img src={staticFile("mascot.png")} style={{ width: 100, height: 100 }} />
      <div style={{ color: "white", fontSize: 32, fontWeight: 800, marginTop: 16, fontFamily: "Helvetica, Arial, sans-serif" }}>That's MOXIE AI Insights!</div>
      <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 18, marginTop: 10, fontFamily: "Helvetica, Arial, sans-serif" }}>Ask MOXIE or Meet w/ Meg anytime</div>
      <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 10 }}>
        <img src={staticFile("logo.png")} style={{ height: 24 }} />
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Helvetica, Arial, sans-serif" }}>Powered by Inbound Blend</span>
      </div>
    </AbsoluteFill>
  );
};

const S = (n) => staticFile(`screenshots/${n}`);
const A = (n) => staticFile(`audio/short/${n}`);

export const ExplainerShort = () => {
  const scenes = [];
  const vo = [];
  let f = 0;

  const add = (dur, el, audio) => {
    scenes.push(<Sequence from={f} durationInFrames={dur} key={"v"+f}>{el}</Sequence>);
    if (audio) vo.push(<Sequence from={f} durationInFrames={dur} key={"a"+f}><Audio src={A(audio)} volume={0.9} /></Sequence>);
    f += dur;
  };

  // 6 scenes — 41 seconds total
  add(211, <TitleCard title="MOXIE AI Insights" subtitle="Your AI Marketing Assistant" />, "s00.mp3");
  add(112, <Scene src={S("02_login_filled.png")} caption="Log in with your client number" />, "s01.mp3");
  add(262, <Scene src={S("03_dashboard.png")} caption="Your Dashboard — Key Trends & Quick Actions" />, "s02.mp3");
  add(206, <Scene src={S("06_performance.png")} caption="Reports — Analysis, Metrics & Platform Data" />, "s03.mp3");
  add(165, <Scene src={S("11_services_recommends.png")} caption="Activities, Services & Growth Ideas" />, "s04.mp3");
  add(265, <EndCard />, "s05.mp3");

  return (
    <AbsoluteFill style={{ background: "#111" }}>
      <Audio src={staticFile("audio/bg_music.wav")} volume={0.05} loop />
      {scenes}
      {vo}
    </AbsoluteFill>
  );
};
