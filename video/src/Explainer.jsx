import { AbsoluteFill, Audio, Img, Sequence, useCurrentFrame, interpolate, staticFile } from "remotion";

const FPS = 30;

// Scene component with screenshot + animated caption
const Scene = ({ src, caption, subcaption, zoomTo }) => {
  const frame = useCurrentFrame();

  // Fade in
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  // Subtle zoom (Ken Burns effect)
  const scale = zoomTo
    ? interpolate(frame, [0, FPS * 8], [1, 1.08], { extrapolateRight: "clamp" })
    : interpolate(frame, [0, FPS * 8], [1, 1.03], { extrapolateRight: "clamp" });

  // Caption slide up
  const captionY = interpolate(frame, [5, 25], [40, 0], { extrapolateRight: "clamp" });
  const captionOpacity = interpolate(frame, [5, 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Screenshot */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 80,
        overflow: "hidden",
      }}>
        <Img src={src} style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: zoomTo || "center center",
        }} />
      </div>

      {/* Caption bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
        background: "linear-gradient(135deg, #1D80DE 0%, #1565c0 100%)",
        display: "flex", alignItems: "center", paddingLeft: 30, paddingRight: 30,
        opacity: captionOpacity,
        transform: `translateY(${captionY}px)`,
      }}>
        <img src={staticFile("mascot.png")} style={{ width: 45, height: 45, marginRight: 15, borderRadius: "50%" }} />
        <div>
          <div style={{ color: "white", fontSize: 22, fontWeight: 700, fontFamily: "Helvetica, Arial, sans-serif" }}>
            {caption}
          </div>
          {subcaption && (
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, fontFamily: "Helvetica, Arial, sans-serif", marginTop: 2 }}>
              {subcaption}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Title card
const TitleCard = ({ title, subtitle, bg }) => {
  const frame = useCurrentFrame();
  const logoScale = interpolate(frame, [0, 20], [0.5, 1], { extrapolateRight: "clamp" });
  const logoOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: "clamp" });
  const textY = interpolate(frame, [10, 30], [20, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: bg || "linear-gradient(135deg, #1D80DE 0%, #0d5bb5 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    }}>
      <img src={staticFile("mascot.png")} style={{
        width: 160, height: 160, opacity: logoOpacity,
        transform: `scale(${logoScale})`,
      }} />
      <div style={{
        color: "white", fontSize: 42, fontWeight: 800, marginTop: 20,
        fontFamily: "Helvetica, Arial, sans-serif",
        opacity: textOpacity, transform: `translateY(${textY}px)`,
      }}>
        {title}
      </div>
      <div style={{
        color: "rgba(255,255,255,0.7)", fontSize: 20, marginTop: 10,
        fontFamily: "Helvetica, Arial, sans-serif",
        opacity: textOpacity, transform: `translateY(${textY}px)`,
      }}>
        {subtitle}
      </div>
    </AbsoluteFill>
  );
};

// End card
const EndCard = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(135deg, #1D80DE 0%, #0d5bb5 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity,
    }}>
      <img src={staticFile("mascot.png")} style={{ width: 120, height: 120 }} />
      <div style={{
        color: "white", fontSize: 36, fontWeight: 800, marginTop: 20,
        fontFamily: "Helvetica, Arial, sans-serif",
      }}>
        Questions? Ask MOXIE!
      </div>
      <div style={{
        color: "rgba(255,255,255,0.8)", fontSize: 20, marginTop: 15,
        fontFamily: "Helvetica, Arial, sans-serif", textAlign: "center",
      }}>
        Click "Meet w/ Meg" to schedule a call<br />
        or Ask MOXIE anytime from your dashboard
      </div>
      <div style={{
        marginTop: 40, display: "flex", alignItems: "center", gap: 12,
      }}>
        <img src={staticFile("logo.png")} style={{ height: 30 }} />
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, fontFamily: "Helvetica, Arial, sans-serif" }}>
          Powered by Inbound Blend
        </span>
      </div>
    </AbsoluteFill>
  );
};

const S = (name) => staticFile(`screenshots/${name}`);
const A = (name) => staticFile(`audio/${name}`);

export const Explainer = () => {
  const scenes = [];
  const voiceovers = [];
  let f = 0;

  const addScene = (dur, el, audioFile) => {
    scenes.push(<Sequence from={f} durationInFrames={dur} key={"v" + f}>{el}</Sequence>);
    if (audioFile) {
      voiceovers.push(<Sequence from={f} durationInFrames={dur} key={"a" + f}><Audio src={A(audioFile)} volume={0.9} /></Sequence>);
    }
    f += dur;
  };

  // Intro — 8.7s + 9.0s
  addScene(306, <TitleCard title="MOXIE AI Insights" subtitle="Your AI Marketing Assistant" />, "00_title.mp3");
  addScene(315, <TitleCard title="How to Use Your Dashboard" subtitle="A quick walkthrough from MOXIE" bg="linear-gradient(135deg, #0d5bb5 0%, #1D80DE 100%)" />, "01_intro.mp3");

  // Login — 13.1s + 6.6s
  addScene(438, <Scene src={S("01_login_empty.png")} caption="Step 1: Log In" subcaption="Enter your Client Number and Access Code" />, "02_login.mp3");
  addScene(241, <Scene src={S("02_login_filled.png")} caption="Step 1: Log In" subcaption='Click "View My Dashboard" to continue' />, "03_login_filled.mp3");

  // Dashboard — 26.3s split across 2 screenshots, audio on first only
  addScene(833, <Scene src={S("03_dashboard.png")} caption="Your Dashboard" subcaption="Key Trends, Meet w/ Meg, Dropbox & Legacy Reports" zoomTo="top right" />, "04_dashboard.mp3");

  // Report cards — 10.3s
  addScene(353, <Scene src={S("04_report_cards.png")} caption="Monthly Reports" subcaption="Click any month to view your full report" zoomTo="center center" />, "05_reports.mp3");

  // Report — 14.1s + 12.8s
  addScene(467, <Scene src={S("05_report_top.png")} caption="MOXIE's Analysis" subcaption="I break down your month in plain English" zoomTo="center bottom" />, "06_analysis.mp3");
  addScene(428, <Scene src={S("06_performance.png")} caption="Performance Overview" subcaption="Key metrics with visual gauges" />, "07_performance.mp3");

  // Platforms — 14.5s + 10.4s
  addScene(479, <Scene src={S("07_platforms_top.png")} caption="Platform Breakdown" subcaption="Every channel, budget to clicks" zoomTo="center top" />, "08_platforms.mp3");
  addScene(356, <Scene src={S("09_platforms_bottom.png")} caption="Platform Breakdown" subcaption="TikTok, Email, Social & more" />, "09_platforms2.mp3");

  // Activities — 14.4s + 16.2s
  addScene(478, <Scene src={S("10_activities.png")} caption="What We Did This Month" subcaption="Real tasks from your Inbound Blend team" />, "10_activities.mp3");
  addScene(530, <Scene src={S("11_services_recommends.png")} caption="Services & MOXIE Recommends" subcaption="Your active blocks + growth ideas" zoomTo="center bottom" />, "11_services.mp3");

  // Chat — 11.5s + 13.5s
  addScene(389, <Scene src={S("12_chat_open.png")} caption="Ask MOXIE" subcaption="Click to chat with me about your data" zoomTo="bottom right" />, "12_chat.mp3");
  addScene(450, <Scene src={S("13_chat_answer.png")} caption="Ask MOXIE" subcaption="I answer from your actual reports" zoomTo="bottom right" />, "13_chat_answer.mp3");

  // End — 20.0s
  addScene(644, <EndCard />, "14_ending.mp3");

  return (
    <AbsoluteFill style={{ background: "#111" }}>
      {/* Background music - full duration, low volume */}
      <Audio src={A("bg_music.wav")} volume={0.06} loop />

      {/* Visual scenes */}
      {scenes}

      {/* Voiceovers */}
      {voiceovers}
    </AbsoluteFill>
  );
};
