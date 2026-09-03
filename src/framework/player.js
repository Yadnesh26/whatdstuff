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
