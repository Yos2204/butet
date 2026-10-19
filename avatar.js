// Holographic talking face. S is shared state: {mode, speaking, wordPulse}.
export function startAvatar(cv, S) {
  const cx = cv.getContext("2d");
  let W = 0, DPR = 1;
  function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = Math.max(10, r.width); cv.width = W * DPR; cv.height = W * DPR; }
  new ResizeObserver(resize).observe(cv); resize();
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mouth = 0, blink = 0, nextBlink = 2, gx = 0, gy = 0, tgx = 0, tgy = 0, nextGaze = 1, ringA = 0, energy = 0, last = performance.now();
  const lerp = (a, b, k) => a + (b - a) * k;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, W, W);
    const C = W / 2, R = W * 0.3;
    const col = S.mode === "error" ? "255,90,90" : S.mode === "listening" ? "255,181,71" : "95,227,255";
    const talking = S.speaking;

    // mouth target: word pulses plus a natural jitter while speaking
    S.wordPulse = Math.max(0, S.wordPulse - dt * 3.2);
    const jitter = (0.45 + 0.55 * Math.abs(Math.sin(t * 13.7))) * (0.6 + 0.4 * Math.sin(t * 5.1 + 1.3));
    const mTarget = talking ? Math.min(1, 0.18 + 0.62 * jitter + 0.35 * S.wordPulse) : 0;
    mouth = lerp(mouth, mTarget, Math.min(1, dt * 22));
    energy = lerp(energy, talking ? 0.6 + mouth * 0.4 : S.mode === "listening" ? 0.55 : S.mode === "thinking" ? 0.45 : 0.15, dt * 4);

    // blink + gaze
    nextBlink -= dt; if (nextBlink <= 0) { blink = 1; nextBlink = 2.5 + Math.random() * 4; }
    blink = Math.max(0, blink - dt * 7);
    nextGaze -= dt;
    if (nextGaze <= 0) {
      nextGaze = 1.2 + Math.random() * 2.8;
      if (S.mode === "thinking") { tgx = -0.5 + Math.random() * 0.2; tgy = -0.6; }
      else if (S.mode === "listening") { tgx = 0; tgy = 0; }
      else { tgx = (Math.random() - 0.5) * 1.2; tgy = (Math.random() - 0.5) * 0.6; }
    }
    gx = lerp(gx, tgx, dt * 8); gy = lerp(gy, tgy, dt * 8);

    // HUD rings
    ringA += dt * (S.mode === "thinking" ? 2.4 : 0.35 + energy * 0.6) * (reduce ? 0.2 : 1);
    cx.lineCap = "round";
    cx.save(); cx.translate(C, C);
    cx.shadowColor = `rgba(${col},0.9)`; cx.shadowBlur = 10;
    cx.strokeStyle = `rgba(${col},0.55)`; cx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const a = ringA + i * (Math.PI * 2 / 3); cx.beginPath(); cx.arc(0, 0, W * 0.46, a, a + 1.4); cx.stroke(); }
    cx.strokeStyle = `rgba(${col},0.3)`; cx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const a = -ringA * 1.6 + i * (Math.PI / 3); cx.beginPath(); cx.arc(0, 0, W * 0.42, a, a + 0.6); cx.stroke(); }
    cx.shadowBlur = 0;
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2 + ringA * 0.2, long = i % 6 === 0;
      const r1 = W * 0.485, r2 = r1 - (long ? W * 0.025 : W * 0.012);
      cx.strokeStyle = `rgba(${col},${long ? 0.5 : 0.22})`; cx.beginPath();
      cx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); cx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); cx.stroke();
    }
    // voice ring: bumps around the head that follow the mouth
    if (energy > 0.2) {
      cx.strokeStyle = `rgba(${col},${0.25 + energy * 0.4})`; cx.lineWidth = 1.5; cx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = i / 120 * Math.PI * 2;
        const amp = (talking ? mouth : energy * 0.3) * W * 0.03 * (0.5 + 0.5 * Math.sin(a * 9 + t * 7)) * (0.6 + 0.4 * Math.sin(a * 4 - t * 3));
        const r = W * 0.385 + amp;
        i ? cx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : cx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      cx.stroke();
    }

    if (S.style === "face") {
    // head
    const bob = reduce ? 0 : Math.sin(t * 1.4) * R * 0.015 + (talking ? Math.sin(t * 9) * R * 0.01 * mouth : 0);
    cx.translate(gx * R * 0.03, bob + gy * R * 0.02);
    const head = new Path2D();
    head.moveTo(0, -R * 1.02);
    head.bezierCurveTo(R * 0.62, -R * 1.02, R * 0.8, -R * 0.55, R * 0.78, -R * 0.08);
    head.bezierCurveTo(R * 0.76, R * 0.42, R * 0.5, R * 0.86, 0, R * 1.0);
    head.bezierCurveTo(-R * 0.5, R * 0.86, -R * 0.76, R * 0.42, -R * 0.78, -R * 0.08);
    head.bezierCurveTo(-R * 0.8, -R * 0.55, -R * 0.62, -R * 1.02, 0, -R * 1.02);
    const g = cx.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R * 1.1);
    g.addColorStop(0, `rgba(${col},${0.16 + energy * 0.08})`); g.addColorStop(1, `rgba(${col},0.02)`);
    cx.fillStyle = g; cx.fill(head);
    // scanlines inside the head
    cx.save(); cx.clip(head);
    const scroll = (t * 14) % 6;
    cx.fillStyle = `rgba(${col},0.07)`;
    for (let y = -R * 1.1 + scroll; y < R * 1.1; y += 6) cx.fillRect(-R, y, R * 2, 1);
    // contour lines (cheekbones, temples)
    cx.strokeStyle = `rgba(${col},0.18)`; cx.lineWidth = 1;
    for (const s of [-1, 1]) {
      cx.beginPath(); cx.moveTo(s * R * 0.7, -R * 0.15); cx.quadraticCurveTo(s * R * 0.42, R * 0.15, s * R * 0.18, R * 0.12); cx.stroke();
      cx.beginPath(); cx.moveTo(s * R * 0.62, R * 0.4); cx.quadraticCurveTo(s * R * 0.4, R * 0.62, s * R * 0.2, R * 0.78); cx.stroke();
    }
    cx.restore();
    cx.shadowColor = `rgba(${col},1)`; cx.shadowBlur = 14;
    cx.strokeStyle = `rgba(${col},0.85)`; cx.lineWidth = 2; cx.stroke(head);
    // nose
    cx.lineWidth = 1.5; cx.strokeStyle = `rgba(${col},0.55)`; cx.beginPath();
    cx.moveTo(0, -R * 0.05); cx.lineTo(-R * 0.06, R * 0.24); cx.lineTo(R * 0.04, R * 0.27); cx.stroke();

    // eyes and brows
    const open = Math.max(0.06, 1 - blink * 1.0) * (S.mode === "listening" ? 1.15 : 1);
    for (const s of [-1, 1]) {
      const ex = s * R * 0.3, ey = -R * 0.16, ew = R * 0.16, eh = R * 0.075 * open;
      cx.strokeStyle = `rgba(${col},0.95)`; cx.lineWidth = 2; cx.beginPath();
      cx.moveTo(ex - ew, ey); cx.quadraticCurveTo(ex, ey - eh * 2, ex + ew, ey); cx.quadraticCurveTo(ex, ey + eh * 2, ex - ew, ey); cx.closePath(); cx.stroke();
      cx.save(); cx.clip();
      cx.fillStyle = `rgba(${col},${0.6 + energy * 0.4})`; cx.beginPath();
      cx.arc(ex + gx * ew * 0.45, ey + gy * eh * 0.6, R * 0.055, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = "rgba(3,7,12,0.85)"; cx.beginPath(); cx.arc(ex + gx * ew * 0.45, ey + gy * eh * 0.6, R * 0.022, 0, Math.PI * 2); cx.fill();
      cx.restore();
      const lift = S.mode === "listening" ? R * 0.05 : S.mode === "thinking" ? (s < 0 ? R * 0.05 : 0) : talking ? mouth * R * 0.02 : 0;
      cx.strokeStyle = `rgba(${col},0.7)`; cx.lineWidth = 2.5; cx.beginPath();
      cx.moveTo(ex - ew * 1.05, ey - R * 0.12 - lift * 0.6); cx.quadraticCurveTo(ex + s * ew * 0.1, ey - R * 0.19 - lift, ex + ew * 1.05, ey - R * 0.13 - lift * 0.4); cx.stroke();
    }

    // mouth
    const mx = 0, my = R * 0.5, mw = R * (0.2 + mouth * 0.03), mh = R * 0.17 * mouth;
    const smile = S.mode === "idle" ? R * 0.025 : 0;
    cx.lineWidth = 2; cx.strokeStyle = `rgba(${col},0.95)`;
    cx.beginPath();
    cx.moveTo(mx - mw, my); cx.quadraticCurveTo(mx, my - mh * 0.35 + smile * 0.3, mx + mw, my);
    cx.quadraticCurveTo(mx, my + mh + smile * 2, mx - mw, my); cx.closePath();
    cx.fillStyle = `rgba(3,7,12,${0.4 + mouth * 0.5})`; cx.fill(); cx.stroke();
    if (mouth > 0.15) { cx.shadowBlur = 0; cx.fillStyle = `rgba(${col},${mouth * 0.35})`; cx.fillRect(mx - mw * 0.55, my + mh * 0.1, mw * 1.1, Math.max(1, mh * 0.12)); }
    cx.restore();
    } else {
      // Jarvis holographic rings: a glowing core that swells with the voice, layered rotating rings,
      // and a ring of spectrum bars that dance while Jarvis talks.
      const pulse = talking ? mouth : energy * 0.25;
      const coreR = W * (0.085 + pulse * 0.035 + Math.sin(t * 2) * 0.004);
      cx.shadowBlur = 0;
      const glow = cx.createRadialGradient(0, 0, 0, 0, 0, coreR * 3.2);
      glow.addColorStop(0, `rgba(${col},${0.55 + pulse * 0.4})`);
      glow.addColorStop(0.35, `rgba(${col},${0.18 + pulse * 0.2})`);
      glow.addColorStop(1, `rgba(${col},0)`);
      cx.fillStyle = glow; cx.beginPath(); cx.arc(0, 0, coreR * 3.2, 0, Math.PI * 2); cx.fill();
      const core = cx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      core.addColorStop(0, "rgba(235,252,255,0.95)"); core.addColorStop(0.6, `rgba(${col},0.85)`); core.addColorStop(1, `rgba(${col},0.15)`);
      cx.fillStyle = core; cx.beginPath(); cx.arc(0, 0, coreR, 0, Math.PI * 2); cx.fill();
      cx.shadowColor = `rgba(${col},0.9)`; cx.shadowBlur = 8;
      // thin inner ring
      cx.strokeStyle = `rgba(${col},0.7)`; cx.lineWidth = 1.5;
      cx.beginPath(); cx.arc(0, 0, W * 0.15, 0, Math.PI * 2); cx.stroke();
      // segmented ring, counter-rotating
      const segs = 24;
      for (let i = 0; i < segs; i++) {
        const a = -ringA * 1.3 + i * (Math.PI * 2 / segs);
        cx.strokeStyle = `rgba(${col},${0.25 + 0.5 * ((i % 3) === 0) + pulse * 0.2})`; cx.lineWidth = W * 0.012;
        cx.beginPath(); cx.arc(0, 0, W * 0.19, a, a + (Math.PI * 2 / segs) * 0.62); cx.stroke();
      }
      // thick sweeping arcs
      const arcs = [[0.0, 1.9, 1], [2.3, 0.9, 1], [3.6, 2.1, 1], [5.9, 0.25, 1]];
      cx.lineWidth = W * 0.022;
      for (const [off, len] of arcs) {
        const a = ringA * 0.8 + off;
        cx.strokeStyle = `rgba(${col},${0.35 + energy * 0.25})`;
        cx.beginPath(); cx.arc(0, 0, W * 0.245, a, a + len); cx.stroke();
      }
      cx.lineWidth = 1; cx.strokeStyle = `rgba(${col},0.35)`;
      cx.beginPath(); cx.arc(0, 0, W * 0.275, 0, Math.PI * 2); cx.stroke();
      // spectrum ring
      const bars = 96;
      for (let i = 0; i < bars; i++) {
        const a = i / bars * Math.PI * 2 + ringA * 0.15;
        const wave = 0.5 + 0.5 * Math.sin(a * 7 + t * 9) * Math.sin(a * 3 - t * 4);
        const len = W * (0.012 + (talking ? mouth * 0.05 * wave : energy * 0.012 * wave));
        const r1 = W * 0.295;
        cx.strokeStyle = `rgba(${col},${0.3 + wave * 0.5})`; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); cx.lineTo(Math.cos(a) * (r1 + len), Math.sin(a) * (r1 + len)); cx.stroke();
      }
      // faint crosshair
      cx.shadowBlur = 0; cx.strokeStyle = `rgba(${col},0.12)`; cx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const a = ringA * 0.3 + i * Math.PI / 2; cx.beginPath(); cx.moveTo(Math.cos(a) * W * 0.16, Math.sin(a) * W * 0.16); cx.lineTo(Math.cos(a) * W * 0.235, Math.sin(a) * W * 0.235); cx.stroke(); }
      cx.restore();
    }

    // thinking dots orbiting
    if (S.mode === "thinking") {
      for (let i = 0; i < 3; i++) {
        const a = t * 3 + i * 0.5, r = W * 0.42;
        cx.fillStyle = `rgba(${col},${0.9 - i * 0.25})`; cx.beginPath(); cx.arc(C + Math.cos(a) * r, C + Math.sin(a) * r, 3, 0, Math.PI * 2); cx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
