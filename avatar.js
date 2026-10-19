// Holographic talking face. S is shared state: {mode, speaking, wordPulse}.
export function startAvatar(cv, S) {
  const cx = cv.getContext("2d");
  let W = 0, DPR = 1;
  function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = Math.max(10, r.width); cv.width = W * DPR; cv.height = W * DPR; }
  new ResizeObserver(resize).observe(cv); resize();
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mouth = 0, blink = 0, nextBlink = 2, gx = 0, gy = 0, tgx = 0, tgy = 0, nextGaze = 1, ringA = 0, energy = 0, faceAmt = 0, last = performance.now();
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

    // Look: "auto" shows the rings, and the face appears only while Jarvis is talking.
    const faceTarget = S.style === "face" ? 1 : S.style === "rings" ? 0 : (talking ? 1 : 0);
    faceAmt = lerp(faceAmt, faceTarget, Math.min(1, dt * (faceTarget ? 6 : 3)));
    if (faceAmt < 0.98) { cx.save(); cx.globalAlpha = 1 - faceAmt; cx.scale(1 - faceAmt * 0.25, 1 - faceAmt * 0.25); drawRings(); cx.restore(); }
    if (faceAmt > 0.02) {
      cx.save(); cx.globalAlpha = faceAmt; const k = 0.82 + faceAmt * 0.18; cx.scale(k, k); drawFace();
      cx.restore();
      if (faceAmt < 0.95) { // materialize: a bright scan line sweeping down the face
        const y = (-1 + faceAmt * 2.2) * R; cx.save(); cx.globalAlpha = (1 - faceAmt) * 0.9;
        cx.fillStyle = `rgba(${col},0.8)`; cx.fillRect(-R * 0.9, y, R * 1.8, 2); cx.restore();
      }
    }
    cx.restore();

    function drawFace() {
      // A holographic gentleman in a suit: combed hair, clean-shaven, shirt, tie and jacket.
      const bob = reduce ? 0 : Math.sin(t * 1.4) * R * 0.015 + (talking ? Math.sin(t * 9) * R * 0.008 * mouth : 0);
      cx.translate(0, -R * 0.28); cx.scale(0.86, 0.86);
      const line = (a, w) => { cx.strokeStyle = `rgba(${col},${a})`; cx.lineWidth = w; };
      const fillA = (a) => { cx.fillStyle = `rgba(${col},${a})`; };

      // ---- suit (drawn first, under the head) ----
      cx.save(); cx.translate(gx * R * 0.01, bob * 0.4);
      const suit = new Path2D();
      suit.moveTo(-R * 0.3, R * 0.98); suit.quadraticCurveTo(-R * 0.95, R * 1.08, -R * 1.45, R * 1.5);
      suit.lineTo(-R * 1.6, R * 2.3); suit.lineTo(R * 1.6, R * 2.3); suit.lineTo(R * 1.45, R * 1.5);
      suit.quadraticCurveTo(R * 0.95, R * 1.08, R * 0.3, R * 0.98); suit.closePath();
      const sg = cx.createLinearGradient(0, R * 1.0, 0, R * 2.2);
      sg.addColorStop(0, `rgba(${col},0.16)`); sg.addColorStop(1, `rgba(${col},0.02)`);
      cx.fillStyle = sg; cx.fill(suit);
      cx.shadowColor = `rgba(${col},1)`; cx.shadowBlur = 10; line(0.75, 2); cx.stroke(suit);
      // shirt: a white V between the lapels
      const shirt = new Path2D();
      shirt.moveTo(-R * 0.3, R * 0.98); shirt.lineTo(0, R * 1.75); shirt.lineTo(R * 0.3, R * 0.98); shirt.closePath();
      cx.shadowBlur = 0; cx.fillStyle = "rgba(225,248,255,0.22)"; cx.fill(shirt);
      // shirt collar points
      line(0.85, 1.6);
      for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(s * R * 0.3, R * 0.96); cx.lineTo(s * R * 0.08, R * 1.2); cx.lineTo(0, R * 1.04); cx.stroke(); }
      // tie: knot and blade
      fillA(0.55); line(0.95, 1.4);
      cx.beginPath(); cx.moveTo(-R * 0.07, R * 1.07); cx.lineTo(R * 0.07, R * 1.07); cx.lineTo(R * 0.05, R * 1.19); cx.lineTo(-R * 0.05, R * 1.19); cx.closePath(); cx.fill(); cx.stroke();
      fillA(0.35);
      cx.beginPath(); cx.moveTo(-R * 0.05, R * 1.19); cx.lineTo(R * 0.05, R * 1.19); cx.lineTo(R * 0.11, R * 1.62); cx.lineTo(0, R * 1.74); cx.lineTo(-R * 0.11, R * 1.62); cx.closePath(); cx.fill(); cx.stroke();
      // tie stripes
      cx.save(); cx.clip(); line(0.35, 1); for (let y = R * 1.22; y < R * 1.75; y += R * 0.09) { cx.beginPath(); cx.moveTo(-R * 0.15, y); cx.lineTo(R * 0.15, y + R * 0.08); cx.stroke(); } cx.restore();
      // jacket lapels (notched)
      cx.shadowBlur = 8; line(0.9, 2);
      for (const s of [-1, 1]) {
        cx.beginPath(); cx.moveTo(s * R * 0.3, R * 0.98); cx.lineTo(s * R * 0.52, R * 1.22); cx.lineTo(s * R * 0.42, R * 1.3);
        cx.lineTo(s * R * 0.55, R * 1.42); cx.lineTo(s * R * 0.02, R * 2.05); cx.stroke();
      }
      // buttons, pocket square, shoulder seams
      cx.shadowBlur = 0; fillA(0.8);
      for (const y of [R * 2.12]) { cx.beginPath(); cx.arc(0, y, R * 0.025, 0, Math.PI * 2); cx.fill(); }
      line(0.6, 1.4); cx.beginPath(); cx.moveTo(R * 0.72, R * 1.68); cx.lineTo(R * 1.08, R * 1.64); cx.stroke();
      fillA(0.45); cx.beginPath(); cx.moveTo(R * 0.78, R * 1.68); cx.lineTo(R * 0.86, R * 1.56); cx.lineTo(R * 0.92, R * 1.64); cx.lineTo(R * 1.0, R * 1.55); cx.lineTo(R * 1.02, R * 1.66); cx.closePath(); cx.fill();
      line(0.3, 1); for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(s * R * 1.0, R * 1.18); cx.quadraticCurveTo(s * R * 1.18, R * 1.6, s * R * 1.12, R * 2.2); cx.stroke(); }
      cx.restore();

      // ---- neck ----
      cx.save(); cx.translate(gx * R * 0.02, bob * 0.7);
      line(0.45, 1.5); for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(s * R * 0.26, R * 0.72); cx.lineTo(s * R * 0.28, R * 1.0); cx.stroke(); }
      cx.restore();

      // ---- head ----
      cx.translate(gx * R * 0.03, bob + gy * R * 0.02);
      const head = new Path2D();
      head.moveTo(0, -R * 1.0);
      head.bezierCurveTo(R * 0.6, -R * 1.0, R * 0.74, -R * 0.55, R * 0.72, -R * 0.1);
      head.bezierCurveTo(R * 0.71, R * 0.3, R * 0.6, R * 0.62, R * 0.36, R * 0.84);
      head.quadraticCurveTo(R * 0.18, R * 0.98, 0, R * 0.98);
      head.quadraticCurveTo(-R * 0.18, R * 0.98, -R * 0.36, R * 0.84);
      head.bezierCurveTo(-R * 0.6, R * 0.62, -R * 0.71, R * 0.3, -R * 0.72, -R * 0.1);
      head.bezierCurveTo(-R * 0.74, -R * 0.55, -R * 0.6, -R * 1.0, 0, -R * 1.0);
      const g = cx.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R * 1.1);
      g.addColorStop(0, `rgba(${col},${0.16 + energy * 0.08})`); g.addColorStop(1, `rgba(${col},0.03)`);
      cx.fillStyle = g; cx.fill(head);
      cx.save(); cx.clip(head);
      const scroll = (t * 14) % 6; fillA(0.06);
      for (let y = -R * 1.1 + scroll; y < R * 1.1; y += 6) cx.fillRect(-R, y, R * 2, 1);
      line(0.16, 1);
      for (const s of [-1, 1]) {
        cx.beginPath(); cx.moveTo(s * R * 0.66, -R * 0.05); cx.quadraticCurveTo(s * R * 0.44, R * 0.12, s * R * 0.2, R * 0.1); cx.stroke(); // cheekbone
        cx.beginPath(); cx.moveTo(s * R * 0.5, R * 0.45); cx.quadraticCurveTo(s * R * 0.32, R * 0.62, s * R * 0.16, R * 0.8); cx.stroke();  // jaw shade
        cx.beginPath(); cx.moveTo(s * R * 0.14, R * 0.28); cx.quadraticCurveTo(s * R * 0.24, R * 0.42, s * R * 0.28, R * 0.52); cx.stroke(); // smile line
      }
      cx.restore();
      cx.shadowColor = `rgba(${col},1)`; cx.shadowBlur = 14; line(0.85, 2); cx.stroke(head);
      // ears
      cx.shadowBlur = 6; line(0.6, 1.6);
      for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(s * R * 0.72, -R * 0.22); cx.quadraticCurveTo(s * R * 0.88, -R * 0.2, s * R * 0.84, R * 0.02); cx.quadraticCurveTo(s * R * 0.8, R * 0.18, s * R * 0.7, R * 0.16); cx.stroke(); }
      // hair: neatly combed with a side parting
      const hair = new Path2D();
      hair.moveTo(-R * 0.74, -R * 0.2);
      hair.bezierCurveTo(-R * 0.86, -R * 0.82, -R * 0.42, -R * 1.18, R * 0.08, -R * 1.14);
      hair.bezierCurveTo(R * 0.6, -R * 1.12, R * 0.86, -R * 0.8, R * 0.74, -R * 0.22);
      hair.quadraticCurveTo(R * 0.7, -R * 0.55, R * 0.48, -R * 0.66);
      hair.quadraticCurveTo(R * 0.05, -R * 0.82, -R * 0.3, -R * 0.62); // parting sweep
      hair.quadraticCurveTo(-R * 0.6, -R * 0.55, -R * 0.74, -R * 0.2); hair.closePath();
      cx.shadowBlur = 8; fillA(0.28); cx.fill(hair); line(0.8, 1.8); cx.stroke(hair);
      cx.shadowBlur = 0; line(0.45, 1);
      for (let i = 0; i < 6; i++) { const k = i / 5; cx.beginPath(); cx.moveTo(-R * 0.3 + k * R * 0.05, -R * 0.66 - k * R * 0.4); cx.quadraticCurveTo(R * 0.15, -R * (0.86 + k * 0.22), R * (0.62 - k * 0.1), -R * (0.6 + k * 0.38)); cx.stroke(); }
      line(0.8, 1.6); cx.beginPath(); cx.moveTo(-R * 0.3, -R * 0.62); cx.quadraticCurveTo(-R * 0.36, -R * 0.9, -R * 0.28, -R * 1.1); cx.stroke(); // parting
      // nose
      line(0.55, 1.5); cx.beginPath(); cx.moveTo(-R * 0.02, -R * 0.08); cx.lineTo(-R * 0.07, R * 0.25); cx.quadraticCurveTo(0, R * 0.3, R * 0.06, R * 0.26); cx.stroke();

      // eyes and brows
      const open = Math.max(0.06, 1 - blink) * (S.mode === "listening" ? 1.1 : 1);
      for (const s of [-1, 1]) {
        const ex = s * R * 0.29, ey = -R * 0.17, ew = R * 0.15, eh = R * 0.065 * open;
        line(0.95, 2); cx.beginPath();
        cx.moveTo(ex - ew, ey); cx.quadraticCurveTo(ex, ey - eh * 2, ex + ew, ey); cx.quadraticCurveTo(ex, ey + eh * 2, ex - ew, ey); cx.closePath(); cx.stroke();
        cx.save(); cx.clip();
        fillA(0.6 + energy * 0.4); cx.beginPath(); cx.arc(ex + gx * ew * 0.45, ey + gy * eh * 0.6, R * 0.05, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = "rgba(3,7,12,0.85)"; cx.beginPath(); cx.arc(ex + gx * ew * 0.45, ey + gy * eh * 0.6, R * 0.02, 0, Math.PI * 2); cx.fill();
        cx.restore();
        const lift = S.mode === "thinking" ? (s < 0 ? R * 0.05 : 0) : talking ? mouth * R * 0.025 : 0;
        line(0.8, 3); cx.beginPath(); // straight, composed brows
        cx.moveTo(ex - s * ew * 1.0 * -1 - ew * 0, ey - R * 0.13 - lift * 0.5);
        cx.moveTo(ex - ew * 1.05, ey - R * 0.12 - lift * (s < 0 ? 0.4 : 0.8)); cx.quadraticCurveTo(ex, ey - R * 0.17 - lift, ex + ew * 1.05, ey - R * 0.12 - lift * (s < 0 ? 0.8 : 0.4)); cx.stroke();
      }

      // mouth (lip-synced)
      const my = R * 0.52, mw = R * (0.19 + mouth * 0.02), mh = R * 0.15 * mouth;
      const smile = talking ? R * 0.01 : R * 0.03;
      cx.lineWidth = 2; cx.strokeStyle = `rgba(${col},0.95)`; cx.shadowBlur = 6;
      cx.beginPath();
      cx.moveTo(-mw, my - smile); cx.quadraticCurveTo(0, my - mh * 0.3 + smile, mw, my - smile);
      cx.quadraticCurveTo(0, my + mh + smile * 1.5, -mw, my - smile); cx.closePath();
      cx.fillStyle = `rgba(3,7,12,${0.35 + mouth * 0.55})`; cx.fill(); cx.stroke();
      if (mouth > 0.15) { cx.shadowBlur = 0; fillA(mouth * 0.35); cx.fillRect(-mw * 0.55, my + mh * 0.05, mw * 1.1, Math.max(1, mh * 0.12)); }
      // chin dimple line
      cx.shadowBlur = 0; line(0.25, 1); cx.beginPath(); cx.moveTo(-R * 0.06, R * 0.8); cx.quadraticCurveTo(0, R * 0.84, R * 0.06, R * 0.8); cx.stroke();
    }
    function drawRings() {
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
