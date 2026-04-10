import { AbsoluteFill, Audio, Img, Sequence, useCurrentFrame, interpolate, staticFile, spring, useVideoConfig } from "remotion";

const FPS = 30;
const BLUE = "#1D80DE";
const ORANGE = "#DF6229";

// Animated floating particles for title/end cards
const Particles = () => {
  const frame = useCurrentFrame();
  const dots = [];
  for (let i = 0; i < 12; i++) {
    const x = (i * 137.5) % 100;
    const baseY = (i * 73.1) % 100;
    const y = baseY + Math.sin((frame + i * 40) / 40) * 8;
    const size = 4 + (i % 3) * 3;
    const opacity = 0.06 + (i % 4) * 0.03;
    dots.push(
      <div key={i} style={{
        position: "absolute", left: `${x}%`, top: `${y}%`,
        width: size, height: size, borderRadius: "50%",
        background: BLUE, opacity,
      }} />
    );
  }
  return <>{dots}</>;
};

// Animated blue line that sweeps across
const SweepLine = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, 20], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(frame - delay, [0, 5, 15, 20], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 3,
      background: `linear-gradient(90deg, transparent 0%, ${BLUE} ${progress}%, transparent ${progress + 1}%)`,
      opacity,
    }} />
  );
};

const Scene = ({ src, caption, subcaption, zoomTo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  // Ken Burns zoom
  const scale = interpolate(frame, [0, fps * 12], [1, 1.07], { extrapolateRight: "clamp" });

  // Caption slide up with spring
  const captionSpring = spring({ frame: frame - 5, fps, config: { damping: 15, stiffness: 120 } });
  const captionY = interpolate(captionSpring, [0, 1], [50, 0]);

  // Screenshot border glow pulse
  const glowOpacity = interpolate(Math.sin(frame / 15), [-1, 1], [0.3, 0.7]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f8f9fa" }}>
      {/* Screenshot with rounded corners and shadow */}
      <div style={{
        position: "absolute", top: 12, left: 20, right: 20, bottom: 78,
        borderRadius: 12, overflow: "hidden",
        boxShadow: `0 4px 24px rgba(29,128,222,${glowOpacity})`,
        border: `2px solid rgba(29,128,222,0.15)`,
      }}>
        <Img src={src} style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${scale})`, transformOrigin: zoomTo || "center center",
        }} />
      </div>

      <SweepLine delay={3} />

      {/* Caption bar — white bg, blue text */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 70,
        background: "white",
        borderTop: `3px solid ${BLUE}`,
        display: "flex", alignItems: "center", paddingLeft: 24,
        transform: `translateY(${captionY}px)`,
      }}>
        <img src={staticFile("mascot.png")} style={{
          width: 42, height: 42, marginRight: 14,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
        }} />
        <div>
          <div style={{ color: BLUE, fontSize: 20, fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif" }}>{caption}</div>
          {subcaption && <div style={{ color: "#6B7280", fontSize: 13, fontFamily: "Helvetica, Arial, sans-serif", marginTop: 1 }}>{subcaption}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TitleCard = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mascot bounces in with spring
  const mascotSpring = spring({ frame, fps, config: { damping: 10, stiffness: 80 } });
  const mascotScale = interpolate(mascotSpring, [0, 1], [0.3, 1]);
  const mascotY = interpolate(mascotSpring, [0, 1], [-80, 0]);

  // Title slides in
  const titleSpring = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 100 } });
  const titleY = interpolate(titleSpring, [0, 1], [40, 0]);
  const titleOp = interpolate(titleSpring, [0, 1], [0, 1]);

  // Subtitle fades in
  const subOp = interpolate(frame, [18, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Pulsing glow behind mascot
  const glowScale = 1 + Math.sin(frame / 10) * 0.05;

  return (
    <AbsoluteFill style={{
      background: "white",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <Particles />

      {/* Glow circle behind mascot */}
      <div style={{
        position: "absolute", width: 200, height: 200, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(29,128,222,0.1) 0%, transparent 70%)`,
        transform: `scale(${glowScale})`,
        top: "calc(50% - 160px)", left: "calc(50% - 100px)",
      }} />

      <img src={staticFile("mascot.png")} style={{
        width: 150, height: 150,
        transform: `scale(${mascotScale}) translateY(${mascotY}px)`,
        filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.12))",
      }} />

      <div style={{
        color: BLUE, fontSize: 42, fontWeight: 800, marginTop: 16,
        fontFamily: "Helvetica, Arial, sans-serif",
        opacity: titleOp, transform: `translateY(${titleY}px)`,
      }}>
        {title}
      </div>

      <div style={{
        color: ORANGE, fontSize: 19, marginTop: 8, fontWeight: 600,
        fontFamily: "Helvetica, Arial, sans-serif", opacity: subOp,
      }}>
        {subtitle}
      </div>

      {/* Decorative blue line */}
      <div style={{
        width: interpolate(frame, [20, 40], [0, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 3, background: BLUE, borderRadius: 2, marginTop: 16,
      }} />
    </AbsoluteFill>
  );
};

const EndCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mainSpring = spring({ frame, fps, config: { damping: 12, stiffness: 90 } });
  const scale = interpolate(mainSpring, [0, 1], [0.8, 1]);
  const opacity = interpolate(mainSpring, [0, 1], [0, 1]);

  // Buttons animate in staggered
  const btn1Op = interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const btn2Op = interpolate(frame, [28, 43], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const btn1Y = interpolate(frame, [20, 35], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const btn2Y = interpolate(frame, [28, 43], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "white",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity, transform: `scale(${scale})`,
    }}>
      <Particles />

      <img src={staticFile("mascot.png")} style={{
        width: 110, height: 110,
        filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.1))",
      }} />

      <div style={{ color: BLUE, fontSize: 36, fontWeight: 800, marginTop: 16, fontFamily: "Helvetica, Arial, sans-serif" }}>
        That's MOXIE AI Insights!
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
        <div style={{
          background: BLUE, color: "white", padding: "12px 28px", borderRadius: 10,
          fontSize: 16, fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif",
          opacity: btn1Op, transform: `translateY(${btn1Y}px)`,
          boxShadow: "0 4px 12px rgba(29,128,222,0.3)",
        }}>
          Ask MOXIE
        </div>
        <div style={{
          background: "white", color: BLUE, padding: "12px 28px", borderRadius: 10,
          fontSize: 16, fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif",
          border: `2px solid ${BLUE}`,
          opacity: btn2Op, transform: `translateY(${btn2Y}px)`,
        }}>
          Meet w/ Meg
        </div>
      </div>

      <div style={{ marginTop: 30, display: "flex", alignItems: "center", gap: 10 }}>
        <img src={staticFile("logo.png")} style={{ height: 24 }} />
        <span style={{ color: "#9CA3AF", fontSize: 13, fontFamily: "Helvetica, Arial, sans-serif" }}>Powered by Inbound Blend</span>
      </div>
    </AbsoluteFill>
  );
};

const S = (n) => staticFile(`screenshots/${n}`);
const A = (n) => staticFile(`audio/mid/${n}`);

export const ExplainerMid = () => {
  const scenes = [];
  const vo = [];
  let f = 0;

  const add = (dur, el, audio) => {
    scenes.push(<Sequence from={f} durationInFrames={dur} key={"v"+f}>{el}</Sequence>);
    if (audio) vo.push(<Sequence from={f} durationInFrames={dur} key={"a"+f}><Audio src={A(audio)} volume={0.9} /></Sequence>);
    f += dur;
  };

  add(229, <TitleCard title="MOXIE AI Insights" subtitle="Your AI Marketing Assistant" />, "m00.mp3");
  add(166, <Scene src={S("02_login_filled.png")} caption="Log In" subcaption="Client number + access code" />, "m01.mp3");
  add(358, <Scene src={S("03_dashboard.png")} caption="Your Dashboard" subcaption="Key Trends, Meet w/ Meg, Dropbox & Legacy Reports" zoomTo="top right" />, "m02.mp3");
  add(107, <Scene src={S("04_report_cards.png")} caption="Monthly Reports" subcaption="Click any month for the full breakdown" />, "m03.mp3");
  add(247, <Scene src={S("05_report_top.png")} caption="MOXIE's Analysis" subcaption="Plain English — highlights and wins" zoomTo="center bottom" />, "m04.mp3");
  add(278, <Scene src={S("06_performance.png")} caption="Performance & Platform Breakdown" subcaption="Every metric, every channel" />, "m05.mp3");
  add(173, <Scene src={S("11_services_recommends.png")} caption="Activities, Services & Recommendations" zoomTo="center bottom" />, "m06.mp3");
  add(324, <EndCard />, "m07.mp3");

  return (
    <AbsoluteFill style={{ background: "white" }}>
      <Audio src={staticFile("audio/bg_music.wav")} volume={0.05} loop />
      {scenes}
      {vo}
    </AbsoluteFill>
  );
};
