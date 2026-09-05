import * as THREE from 'three';
import { animate, createTimeline, stagger } from 'animejs';
import { createStage, REF_ASPECT, FOV_REF, isExportRender } from './stage.js';
import { scrubTimeline, loopTimeline } from './scroll.js';
import * as parts from './parts.js';
import { setFocusCallouts } from './highlight.js';

// Mounts an explainer into `container` and returns a destroy() handle.
//
// Layout: a fixed full-screen canvas sits behind everything; the page keeps
// its normal document scroll, with one tall <section> per step scrolling
// over the canvas. Each section owns a scroll-scrubbed anime.js timeline;
// crossing the middle of the viewport "activates" the step (camera fly-to,
// progress rail, panel highlight).
export function mountExplainer(def, container) {
  // Series kicker above the title. Almost everything in the library is a
  // machine and reads "how it works", but subjects that aren't machines are
  // titled "What Is a Black Hole?" instead, and stamping "how it works" over
  // that reproduces the exact category error the title avoids. Keyed on the
  // title's own form so it stays a general rule, not a per-explainer special
  // case.
  const kicker = /^what\b/i.test(def.title ?? '') ? 'what it is' : 'how it works';

  container.innerHTML = `
    <div class="player" style="--accent:${def.accent ?? '#6ea8ff'}">
      <div class="canvas-holder"></div>
      <a class="back-link" href="/">← library</a>
      <div class="rail"></div>
      <div class="scroll-hint">scroll<span>▾</span></div>
      <header class="player-hero">
        <p class="hero-kicker">${kicker}</p>
        <h1>${def.title}</h1>
        <p class="hero-summary">${def.summary ?? ''}</p>
        ${
          def.youtubeUrl
            ? `<a class="hero-video-link" href="${def.youtubeUrl}" target="_blank" rel="noopener">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                   <path d="M8 5v14l11-7z" />
                 </svg>
                 <span class="hero-video-link-full">Watch on</span>YouTube
               </a>`
            : ''
        }
      </header>
      <main class="steps"></main>
    </div>
  `;

  const stage = createStage(container.querySelector('.canvas-holder'), def.stageOptions);
  const handles = def.buildScene({
    scene: stage.scene,
    stage,
    THREE,
    parts,
  });

  window.__hiw = { stage, handles, stepRuntimes: null }; // console/debug access

  const stepsEl = container.querySelector('.steps');
  const railEl = container.querySelector('.rail');
  const cleanups = [];
  const stepRuntimes = [];

  def.steps.forEach((step, i) => {
    const section = document.createElement('section');
    section.className = 'step';
    section.dataset.index = i;
    // .panel-head groups the always-visible row (number + heading + chevron)
    // so mobile can collapse the panel to just that line. On desktop the
    // wrapper is `display: contents`, so it generates no box and the panel
    // lays out exactly as it always has.
    section.innerHTML = `
      <div class="panel">
        <div class="panel-head" role="button" tabindex="0" aria-expanded="false">
          <span class="panel-num">${String(i + 1).padStart(2, '0')} / ${String(def.steps.length).padStart(2, '0')}</span>
          <h2>${step.heading}</h2>
        </div>
        <p>${step.body}</p>
        ${step.hint ? `<p class="panel-hint">${step.hint}</p>` : ''}
      </div>
    `;
    stepsEl.appendChild(section);

    // tap the caption bar to reveal the full copy (mobile only in effect — the
    // desktop panel is never collapsed, so the class does nothing there)
    const panelEl = section.querySelector('.panel');
    const headEl = section.querySelector('.panel-head');
    const toggle = () => {
      const open = panelEl.classList.toggle('expanded');
      headEl.setAttribute('aria-expanded', String(open));
    };
    headEl.addEventListener('click', toggle);
    headEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    const dot = document.createElement('button');
    dot.className = 'rail-dot';
    dot.title = step.heading;
    dot.addEventListener('click', () =>
      section.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
    railEl.appendChild(dot);

    // 'loop' is the default: each step's timeline runs continuously while
    // the step is active. 'scrub' remains available for scroll-driven steps.
    stepRuntimes.push({ section, dot, tl: null, mode: step.mode ?? 'loop' });
  });

  // Scroll-scrubbed timelines must be created only once the page has real
  // layout: anime's ScrollObserver resolves its scroll container from the
  // geometry it measures at creation, and a zero-sized viewport (background
  // tab, prerender) would leave every observer permanently broken.
  function wireTimelines() {
    stepRuntimes.forEach((rt, i) => {
      const step = def.steps[i];
      if (!step.timeline) return;
      rt.tl = rt.mode === 'loop' ? loopTimeline() : scrubTimeline(rt.section);
      step.timeline({ tl: rt.tl, handles, stage, animate, stagger });
      if (rt.mode === 'loop' && i === activeIndex) rt.tl.play();
    });
  }

  window.__hiw.stepRuntimes = stepRuntimes;
  window.__hiw.activate = (i) => activate(i); // deterministic driving for video export
  // exposes the SAME animate()-based camera move activate() itself uses (so a
  // second call here cleanly supersedes an in-flight one — anime.js replaces
  // a tween targeting the same object+properties rather than composing with
  // it) — lets export-video.mjs re-aim a shot's camera without duplicating
  // flyTo's dolly/frameForViewport logic
  window.__hiw.flyTo = (pose) => flyTo(pose);
  // Auto-framing for video export: solve a pose that centres and fills the
  // frame with the named parts, fly to it, and refocus DoF at the distance
  // actually used. Returns the solved pose so the exporter can log and gate on
  // it. See frameSubject() below for why `dolly` alone could never do this.
  window.__hiw.frameSubject = (opts) => frameSubject(opts);
  window.__hiw.frameTo = (opts = {}) => {
    const pose = frameSubject(opts);
    flyTo(pose);
    applyDof(pose, opts.aperture);
    return pose;
  };
  // Where the subject lands on screen for a given pose — the framing gate's
  // measurement, and what the storyboard sheet annotates each shot with.
  window.__hiw.projectSubject = (o) => projectSubject(o);
  // World-space bounds of the same subject, for tooling that wants the box
  // itself rather than its projection.
  window.__hiw.subjectBox = (keys) => {
    const box = subjectBoxFor(keys);
    return box ? { min: box.min.toArray(), max: box.max.toArray() } : null;
  };

  // --- step activation (camera, rail, panels, loop start/stop) -----------
  let activeIndex = -1;

  // Second half of the portrait correction (stage.js owns the first — it
  // widens the FOV as far as it can without fisheye). Whatever horizontal
  // extent that didn't recover is bought with camera distance, and the whole
  // rig is then dropped so the subject rides ABOVE the bottom sheet instead of
  // behind it.
  //
  // SUBJECT_W is the one empirical constant: the fraction of the desktop frame
  // width a subject actually occupies. It isn't 1.0 because the text panel owns
  // the left third, so a well-composed shot centres its subject in the
  // remainder. Too high and phones over-dolly until the model is a speck; too
  // low and it still runs off the edges. Tuned against mobile review-shots.
  // 0.50 framed four-stroke beautifully but put internet-request — the widest
  // scene in the library — exactly on the frame edge with no margin. Clipping
  // a subject is worse than a little dead space, and only 2 of 36 explainers
  // have been sampled, so this keeps ~8% in hand for the untested ones.
  const SUBJECT_W = 0.54;
  // Fraction of the viewport height the collapsed caption bar covers. Must stay
  // in step with .panel's collapsed max-height in the mobile CSS — if the bar
  // grows and this doesn't, models start hiding behind it again. The EXPANDED
  // panel is deliberately not accounted for: it's a transient, user-initiated
  // state, and reframing the camera on every tap would be worse than the
  // overlap it avoids.
  const SHEET_FRAC = 0.09;

  function frameForViewport({ position, target }) {
    const cam = stage.camera;
    const aspect = cam.aspect;
    if (isExportRender() || !aspect || aspect >= REF_ASPECT) return { position, target };

    const halfNow = Math.tan((cam.fov * Math.PI) / 360);
    const halfRef = Math.tan((FOV_REF * Math.PI) / 360);
    // how much wider the frame must be to still hold the subject...
    const need = Math.max(1, (REF_ASPECT / aspect) * SUBJECT_W);
    // ...minus what the FOV widening already bought us
    const dolly = Math.max(1, need / (halfNow / halfRef));

    const p = position.map((v, k) => target[k] + (v - target[k]) * dolly);
    const dist = Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]);
    // Lower camera AND target together: a pure vertical translation of the rig,
    // which slides the subject UP the frame without changing the viewing angle
    // the pose was composed at.
    const lift = SHEET_FRAC * dist * halfNow;
    return {
      position: [p[0], p[1] - lift, p[2]],
      target: [target[0], target[1] - lift, target[2]],
    };
  }

  function flyTo(pose) {
    const { position, target } = frameForViewport(pose);
    // video export sets __hiwCameraScale > 1 for portrait renders: dolly the
    // camera out along the view axis so landscape-framed shots still fit.
    // A bare global (not on __hiw) so the export can set it via addInitScript,
    // before boot's first fly-to runs.
    const s = window.__hiwCameraScale ?? 1;
    const p = s === 1 ? position : position.map((v, k) => target[k] + (v - target[k]) * s);
    animate(stage.camera.position, {
      x: p[0], y: p[1], z: p[2],
      duration: 1300,
      ease: 'inOutQuad',
    });
    animate(stage.controls.target, {
      x: target[0], y: target[1], z: target[2],
      duration: 1300,
      ease: 'inOutQuad',
    });
  }

  // --- subject framing (video export) --------------------------------------
  // Solves a camera pose that CENTRES and FILLS the frame with the parts a shot
  // is actually about, instead of leaning on a hand-guessed `dolly` scalar.
  //
  // Why it has to exist: `frameForViewport` above — the phone correction — is
  // switched off during a video export (stage.js's isExportRender() gate), so
  // exports had only `__hiwCameraScale`. That scales the camera away from
  // `target` along the view axis, and because `target` ALWAYS projects to frame
  // centre it shrinks the subject and its off-centre offset by the same factor:
  // it can zoom out until a crop stops hurting, but it can never recentre.
  // Hand-authored per-shot camera poses were the workaround; this is the fix.
  //
  // Export-only by construction — nothing on the interactive site calls it.

  // Union the world bounds of everything VISIBLE under `root`. Box3's own
  // setFromObject cannot be used here: it walks invisible descendants too, so a
  // cutaway step's hidden shell would still inflate the box and push the camera
  // back to fit geometry the viewer cannot see.
  function expandVisible(box, root) {
    if (!root?.visible) return;
    root.updateWorldMatrix(true, true);
    const p = new THREE.Vector3();
    const b = new THREE.Box3();
    root.traverseVisible((o) => {
      if (o.userData?.stageChrome) return; // floor + contact shadow, never subject
      if (o.isCSS2DObject) {
        box.expandByPoint(p.setFromMatrixPosition(o.matrixWorld));
        return;
      }
      const g = o.geometry;
      if (!g) return;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) return;
      box.union(b.copy(g.boundingBox).applyMatrix4(o.matrixWorld));
    });
  }

  // What a shot is "about": the named callouts' parent parts when keys are
  // given, else the whole model. A callout is added to the part it labels, so
  // its parent IS the subject — which means `focus: [...]`, already authored on
  // most steps, doubles as a framing target with no new authoring.
  function subjectRoots(keys) {
    const wanted = new Set(keys == null ? [] : Array.isArray(keys) ? keys : [keys]);
    const roots = [];
    if (wanted.size) {
      stage.scene.traverse((o) => {
        if (!o.isCSS2DObject || !o.element?.classList.contains('callout')) return;
        const text = o.element.querySelector('.callout-text')?.textContent ?? '';
        if (!wanted.has(o.element.dataset.key) && !wanted.has(text)) return;
        // A callout parented straight to the model root would frame the ENTIRE
        // model, which is never what naming one part means. Fall back to the
        // callout's own anchor point in that case.
        const parent = o.parent;
        roots.push(parent && parent !== stage.scene && parent !== handles.group ? parent : o);
      });
    }
    return roots.length ? roots : [handles.group ?? stage.scene];
  }

  // `keys === undefined` means "whatever the active step says it is about";
  // `null` means the whole model. Both callers below want the same rule.
  function subjectBoxFor(keys) {
    const wanted = keys === undefined ? def.steps[activeIndex]?.focus : keys;
    const box = new THREE.Box3().makeEmpty();
    for (const r of subjectRoots(wanted)) expandVisible(box, r);
    return box.isEmpty() ? null : box;
  }

  // Project a world box through a pose and return its screen rect in normalised
  // device coordinates (-1..1 on both axes). Measured on a CLONE of the camera,
  // so this can run mid-render without disturbing the frame being captured.
  const _pv = new THREE.Vector3();
  const _pw = new THREE.Vector3();
  function projectBoxThrough(box, { position, target }, scale = 1) {
    const cam = stage.camera;
    const t = new THREE.Vector3().fromArray(target);
    const p = new THREE.Vector3().fromArray(position).sub(t).multiplyScalar(scale).add(t);
    const probe = cam.clone();
    probe.position.copy(p);
    probe.up.copy(cam.up);
    probe.lookAt(t);
    probe.updateMatrixWorld(true);
    probe.updateProjectionMatrix();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let behind = false;
    for (let i = 0; i < 8; i++) {
      _pv.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      );
      // Camera-space z FIRST: a corner behind the lens gets mirrored by
      // project() and would silently produce nonsense bounds that read as a
      // perfectly framed shot.
      _pw.copy(_pv).applyMatrix4(probe.matrixWorldInverse);
      if (_pw.z > -1e-4) behind = true;
      _pv.project(probe);
      minX = Math.min(minX, _pv.x);
      maxX = Math.max(maxX, _pv.x);
      minY = Math.min(minY, _pv.y);
      maxY = Math.max(maxY, _pv.y);
    }
    return {
      min: [minX, minY],
      max: [maxX, maxY],
      coverW: (maxX - minX) / 2, // fraction of the FULL frame width
      coverH: (maxY - minY) / 2,
      centre: [(minX + maxX) / 2, (minY + maxY) / 2],
      cropped: behind || minX < -1 || maxX > 1 || minY < -1 || maxY > 1,
    };
  }

  // Returns { position, target } — never mutates anything.
  //   keys  parts to frame (callout keys/text). OMITTED falls back to the active
  //         step's own `focus` list — already authored on most steps, and already
  //         means "what this step is about". Pass null for the whole model.
  //   fill  fraction of the frame the subject should occupy: a number for both
  //         axes, or { w, h } to let them differ (see below)
  //   bias  slide the subject UP by this fraction of frame height, to clear a
  //         burned caption rail along the bottom
  //   pose  the pose whose VIEWING ANGLE to keep (defaults to the live camera)
  function frameSubject({ keys, fill, bias = 0, pose } = {}) {
    const cam = stage.camera;
    const base = pose ?? {
      position: cam.position.toArray(),
      target: stage.controls.target.toArray(),
    };
    const box = subjectBoxFor(keys);
    if (!box) return base;

    const centre = box.getCenter(new THREE.Vector3());
    const from = new THREE.Vector3().fromArray(base.position);
    const to = new THREE.Vector3().fromArray(base.target);
    const dir = new THREE.Vector3().subVectors(to, from);
    if (dir.lengthSq() < 1e-9) return base;
    dir.normalize();

    // Camera-space basis for the AUTHORED viewing angle. The solve changes only
    // distance and centring — never the angle the pose was composed at.
    // A pose looking straight down would make dir parallel to cam.up and
    // collapse the cross product, so pick a different reference axis there.
    const upRef =
      Math.abs(dir.dot(cam.up)) > 0.999 ? new THREE.Vector3(0, 0, 1) : cam.up;
    const right = new THREE.Vector3().crossVectors(dir, upRef).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();

    let halfW = 0;
    let halfH = 0;
    let halfD = 0;
    const c = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      c.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ).sub(centre);
      halfW = Math.max(halfW, Math.abs(c.dot(right)));
      halfH = Math.max(halfH, Math.abs(c.dot(up)));
      halfD = Math.max(halfD, Math.abs(c.dot(dir)));
    }

    // `fill` is the fraction of the frame the subject should occupy, per axis.
    // A single number means both axes; { w, h } lets them differ, which matters
    // in portrait: a long horizontal machine (a transmission is ~4.3 units wide
    // and ~2 tall) fitted to 82% of a 9:16 WIDTH ends up occupying 25% of the
    // height and reads as a speck. Allowing width close to the frame edge while
    // capping height is what a human composing the same shot does by hand.
    const clampF = (v) => Math.max(0.05, Math.min(2, v));
    const fw = clampF((typeof fill === 'object' && fill ? fill.w : fill) ?? 0.8);
    const fh = clampF((typeof fill === 'object' && fill ? fill.h : fill) ?? 0.8);
    const tanV = Math.tan((cam.fov * Math.PI) / 360);
    const tanH = tanV * (cam.aspect || REF_ASPECT);

    // Analytic first guess. The + halfD is why it is only a guess: the near face
    // of a deep subject projects larger than its centre plane, but adding the
    // whole half-depth over-corrects whenever the widest corner is not on that
    // near face — measured at ~12 points of lost fill on this library's models.
    let dist = Math.max(halfH / (tanV * fh), halfW / (tanH * fw)) + halfD;

    // ...so refine by MEASURING. Coverage falls off as ~1/distance, which makes
    // `dist *= worst-axis overshoot` a contraction that settles in 2-3 rounds;
    // the loop is capped and the step clamped so a pathological box can never
    // spin here or fling the camera into the model.
    const poseAt = (d) => {
      const t = centre.clone();
      return { position: t.clone().addScaledVector(dir, -d).toArray(), target: t.toArray() };
    };
    for (let iter = 0; iter < 6; iter++) {
      const pr = projectBoxThrough(box, poseAt(dist));
      if (pr.cropped && pr.coverW <= 0) break;
      const overshoot = Math.max(pr.coverW / fw, pr.coverH / fh);
      if (!Number.isFinite(overshoot) || overshoot <= 0) break;
      if (Math.abs(overshoot - 1) < 0.005) break;
      dist *= Math.max(0.5, Math.min(2, overshoot));
    }
    // never end up inside the subject
    dist = Math.max(dist, halfD * 1.05 + 0.01);

    // Translate position AND target together — the same trick the mobile `lift`
    // uses — so composition moves and the viewing angle does not.
    const lift = bias * dist * tanV * 2;
    const t = centre.clone().addScaledVector(up, -lift);
    const p = t.clone().addScaledVector(dir, -dist);
    return { position: p.toArray(), target: t.toArray() };
  }

  // Where a shot's subject lands on screen — the framing gate's measurement,
  // and what the storyboard sheet annotates each shot with.
  function projectSubject({ pose, keys } = {}) {
    const box = subjectBoxFor(keys);
    if (!box) return null;
    const cam = stage.camera;
    const base = pose ?? {
      position: cam.position.toArray(),
      target: stage.controls.target.toArray(),
    };
    // The export's dolly scalar has to be folded in by hand: flyTo applies it
    // after the pose is handed over, so the pose alone is not where the camera
    // actually ends up.
    return projectBoxThrough(box, base, window.__hiwCameraScale ?? 1);
  }

  // Focus the DoF pass at the distance of the pose actually flown to. activate()
  // does this for authored step poses; the export needs it again after a solved
  // pose, or the subject is focused at the wrong distance on every reframed shot.
  function applyDof({ position, target }, aperture) {
    if (!stage.bokehPass) return;
    const s = window.__hiwCameraScale ?? 1;
    const d = Math.hypot(
      (position[0] - target[0]) * s,
      (position[1] - target[1]) * s,
      (position[2] - target[2]) * s,
    );
    stage.bokehPass.uniforms.focus.value = d;
    if (aperture != null) stage.bokehPass.uniforms.aperture.value = aperture;
  }

  function activate(i) {
    if (i === activeIndex) return;
    const prev = stepRuntimes[activeIndex];
    activeIndex = i;
    const step = def.steps[i];
    const rt = stepRuntimes[i];

    if (prev) {
      const prevPanel = prev.section.querySelector('.panel');
      prevPanel.classList.remove('active');
      // leaving a step re-collapses its caption, so every step is entered in
      // the same state and an expanded panel never lingers over the next model
      prevPanel.classList.remove('expanded');
      prev.section.querySelector('.panel-head')?.setAttribute('aria-expanded', 'false');
      prev.dot.classList.remove('active');
      if (prev.mode === 'loop') prev.tl?.pause();
    }
    rt.section.querySelector('.panel').classList.add('active');
    rt.dot.classList.add('active');
    if (rt.mode === 'loop') rt.tl?.play();

    if (step.camera) flyTo(step.camera);
    // per-step depth of field (only when the explainer opted into
    // stageOptions.dof): focus at the step's own camera-to-target distance,
    // aperture from step.dofAperture (near-zero default keeps wides sharp)
    if (stage.bokehPass && step.camera) {
      // must use the SAME adjusted pose flyTo flies to — on portrait the rig is
      // dollied back, and focusing at the authored distance would throw the
      // whole subject out of focus
      const framed = frameForViewport(step.camera);
      const [px, py, pz] = framed.position;
      const [tx, ty, tz] = framed.target;
      stage.bokehPass.uniforms.focus.value = Math.hypot(px - tx, py - ty, pz - tz);
      stage.bokehPass.uniforms.aperture.value = step.dofAperture ?? 0.00002;
    }
    step.onEnter?.({ handles, stage });
    // pulse the step's focus part(s) so the viewer never hunts for what's being
    // explained — data-driven, cleared automatically on steps with no `focus`
    setFocusCallouts(stage.scene, step.focus);

    // NB: not '.panel > *' — that now matches .panel-head, which is
    // `display: contents` on desktop and so generates no box for opacity to
    // apply to; the number and heading would simply never fade in. Target the
    // leaf elements (same four nodes, same stagger as before).
    animate(rt.section.querySelectorAll('.panel-num, .panel h2, .panel p'), {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 550,
      ease: 'outExpo',
      delay: stagger(70),
    });
  }

  // --- scroll-aware caption: the mobile pill dims and drops while the page is
  // moving, then rises back once it settles (see .player.is-scrolling in the
  // CSS). Purely a class toggle — no layout work per scroll event — and it has
  // no effect on desktop, where that rule doesn't exist.
  const playerEl = container.querySelector('.player');
  let scrollIdle = 0;
  const onScroll = () => {
    playerEl.classList.add('is-scrolling');
    clearTimeout(scrollIdle);
    scrollIdle = setTimeout(() => playerEl.classList.remove('is-scrolling'), 420);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanups.push(() => {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(scrollIdle);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activate(Number(entry.target.dataset.index));
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  stepRuntimes.forEach((rt) => observer.observe(rt.section));
  cleanups.push(() => observer.disconnect());

  // --- hero levitation: a gentle bob on the FIRST slide, before any scroll, so
  // the stationary hero feels alive. Off the instant the user scrolls or moves
  // to another step, easing back to rest so nothing jumps. Never runs in video
  // export — the export's virtual clock exposes window.__vt, which we gate on,
  // so exported frames are byte-for-byte unaffected.
  if (handles.group) {
    const heroGroup = handles.group;
    const baseY = heroGroup.position.y;
    const AMP = 0.02; // world units — subtle float
    const SPEED = 2.0; // rad/s → ~3.1s cycle (half the original speed)
    let phase = 0;
    let bobY = 0;
    const stopBob = stage.onTick((dt) => {
      const active = activeIndex === 0 && window.scrollY < 4 && !window.__vt;
      phase += dt * SPEED;
      const target = active ? Math.sin(phase) * AMP : 0;
      bobY += (target - bobY) * Math.min(1, dt * 6); // ease toward target (settles on scroll)
      heroGroup.position.y = baseY + bobY;
    });
    cleanups.push(stopBob);
  }

  // --- boot: wire timelines now, or as soon as the container has layout ----
  let booted = false;
  let bootPoll = 0;
  function boot() {
    if (booted || !container.clientWidth || !container.clientHeight) return;
    booted = true;
    clearInterval(bootPoll);
    bootObserver.disconnect();
    wireTimelines();
    // Guarantee a running step from the very first frame. The scroll observer
    // only fires once a section crosses the viewport centre, so at the top of
    // the page (hero visible, no section centred) nothing would be active and
    // every loop would sit frozen. Start step 0 explicitly.
    if (activeIndex === -1) activate(0);
  }
  const bootObserver = new ResizeObserver(boot);
  bootObserver.observe(container);
  bootPoll = setInterval(boot, 300);
  boot();

  // --- entrance ------------------------------------------------------------
  window.scrollTo(0, 0);
  const intro = createTimeline({ defaults: { ease: 'outExpo' } });
  intro
    .add('.player-hero > *', {
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 900,
      delay: stagger(120),
    })
    .add('.back-link, .rail, .scroll-hint', { opacity: [0, 1], duration: 700 }, 400);

  const hint = container.querySelector('.scroll-hint span');
  const hintAnim = animate(hint, {
    translateY: [0, 6],
    duration: 700,
    alternate: true,
    loop: true,
    ease: 'inOutQuad',
  });

  return {
    destroy() {
      clearInterval(bootPoll);
      bootObserver.disconnect();
      cleanups.forEach((fn) => fn());
      stepRuntimes.forEach((rt) => rt.tl?.cancel());
      intro.cancel();
      hintAnim.cancel();
      handles.dispose?.();
      stage.dispose();
      container.innerHTML = '';
    },
  };
}
