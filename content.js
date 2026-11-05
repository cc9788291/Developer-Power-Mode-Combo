(function () {
  'use strict';

  const DEFAULTS = { enabled: true, petMode: 'all', combo: 0 };
  const PET_MODES = new Set(['all', 'corgis-kitties', 'corgis', 'kitties', 'octopus', 'off']);
  const MAX_PETS = 3;
  const MAX_BLOTS = 24;
  const MAX_PARTICLES = 150;
  const INACTIVITY_MS = 1500;
  const FRAME_MS = 1000 / 30;
  const supportsReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    settings: { ...DEFAULTS },
    combo: 0,
    lastHitAt: 0,
    lastEditor: null,
    pendingKeyboardEdit: false,
    composing: false,
    particles: [],
    pets: [],
    ink: [],
    lastFrame: 0,
    nextFrame: 0,
    running: false
  };

  const canvas = document.createElement('canvas');
  const counter = document.createElement('div');
  canvas.id = 'dpmc-canvas';
  counter.id = 'dpmc-counter';
  counter.setAttribute('aria-live', 'polite');
  counter.textContent = 'COMBO ×0';
  Object.assign(canvas.style, {
    position: 'fixed', top: '0', left: '0', width: '100vw', height: '60px',
    zIndex: '2147483646', pointerEvents: 'none'
  });
  document.documentElement.append(canvas, counter);
  const ctx = canvas.getContext('2d');

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * ratio));
    canvas.height = Math.max(1, Math.floor(60 * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function isEditor(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.matches('textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="number"]')) {
      return !element.disabled && !element.readOnly && element.type !== 'password';
    }
    return element.isContentEditable && !element.closest('[contenteditable="false"]');
  }

  function isShortcut(event) {
    return event.ctrlKey || event.metaKey || event.altKey || event.key === 'CapsLock' ||
      event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' ||
      event.key === 'Meta' || event.key === 'Tab' || event.key === 'Escape';
  }

  function editorAtCaret(editor) {
    if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
      const rect = editor.getBoundingClientRect();
      return { x: Math.min(rect.right - 12, window.innerWidth - 16), y: Math.min(Math.max(rect.top + 10, 8), 52) };
    }
    const selection = window.getSelection();
    if (selection && selection.rangeCount) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width || rect.height) return { x: rect.left, y: Math.min(Math.max(rect.top, 8), 52) };
    }
    const rect = editor.getBoundingClientRect();
    return { x: rect.left, y: Math.min(Math.max(rect.top, 8), 52) };
  }

  function updateCounter() {
    counter.textContent = `COMBO ×${state.combo}`;
    if (state.combo && state.combo % 10 === 0) {
      counter.classList.remove('dpmc-shake');
      void counter.offsetWidth;
      counter.classList.add('dpmc-shake');
    }
  }

  function addParticles(editor) {
    if (supportsReducedMotion.matches || state.particles.length >= MAX_PARTICLES) return;
    const origin = editorAtCaret(editor);
    for (let i = 0; i < 8 && state.particles.length < MAX_PARTICLES; i += 1) {
      state.particles.push({ x: origin.x, y: origin.y, vx: (Math.random() - .5) * 70, vy: -20 - Math.random() * 55, life: .45, color: i % 2 ? '#ff4fa3' : '#45ffd0' });
    }
  }

  function hit(editor) {
    const now = performance.now();
    if (state.lastEditor !== editor || now - state.lastHitAt > INACTIVITY_MS) state.combo = 0;
    state.combo += 1;
    state.lastEditor = editor;
    state.lastHitAt = now;
    updateCounter();
    addParticles(editor);
    if (state.combo % 10 === 0) state.nextFrame = 0;
    if (state.settings.enabled) ensureLoop();
    chrome.storage.local.set({ combo: state.combo });
  }

  function petTypes() {
    const mode = state.settings.petMode;
    if (mode === 'corgis') return ['corgi'];
    if (mode === 'kitties') return ['kitty'];
    if (mode === 'octopus') return ['octopus'];
    if (mode === 'corgis-kitties') return ['corgi', 'kitty'];
    if (mode === 'all') return ['corgi', 'kitty', 'octopus'];
    return [];
  }

  function respawnPets() {
    const types = petTypes();
    while (state.pets.length < Math.min(MAX_PETS, types.length || 0)) {
      const type = types[state.pets.length % types.length];
      state.pets.push({ type, x: Math.random() * Math.max(40, innerWidth - 40), y: 17 + Math.random() * 25, vx: (Math.random() < .5 ? -1 : 1) * (12 + Math.random() * 18), phase: Math.random() * 7 });
    }
    state.pets = state.pets.filter((pet, index) => index < MAX_PETS && types.includes(pet.type));
  }

  function drawPet(pet, dt) {
    pet.x += pet.vx * dt;
    pet.phase += dt * 2;
    if (pet.x < -24 || pet.x > innerWidth + 24) pet.vx *= -1;
    const bob = Math.sin(pet.phase) * 2;
    ctx.save();
    ctx.translate(pet.x, pet.y + bob);
    ctx.scale(pet.vx < 0 ? -1 : 1, 1);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10152d';
    ctx.fillStyle = pet.type === 'corgi' ? '#f29b55' : pet.type === 'kitty' ? '#c8c8dd' : '#ca63e8';
    if (pet.type === 'octopus') {
      ctx.beginPath();
      ctx.arc(0, 0, 10, Math.PI, 0);
      ctx.lineTo(10, 11); for (let i = 0; i < 4; i += 1) { ctx.quadraticCurveTo(6 - i * 5, 6 + (i % 2) * 5, 3 - i * 4, 12); }
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#10152d'; ctx.fillRect(-5, -2, 2, 2); ctx.fillRect(4, -2, 2, 2);
    } else {
      ctx.beginPath(); ctx.arc(0, 4, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-7, -2); ctx.lineTo(-8, -10); ctx.lineTo(-2, -6); ctx.moveTo(7, -2); ctx.lineTo(8, -10); ctx.lineTo(2, -6); ctx.stroke();
      ctx.fillStyle = '#10152d'; ctx.fillRect(-4, 1, 2, 2); ctx.fillRect(3, 1, 2, 2);
    }
    ctx.restore();
  }

  function drawInk(dt) {
    state.ink = state.ink.filter((blot) => {
      blot.age += dt;
      ctx.globalAlpha = Math.max(0, 1 - blot.age / 1.8);
      ctx.fillStyle = '#5b59c9';
      ctx.beginPath(); ctx.arc(blot.x, blot.y, blot.radius * (1 + blot.age), 0, Math.PI * 2); ctx.fill();
      return blot.age < 1.8;
    });
    ctx.globalAlpha = 1;
  }

  function render(now) {
    if (!state.running || document.hidden) { state.running = false; return; }
    if (now - state.lastFrame < FRAME_MS) { requestAnimationFrame(render); return; }
    const dt = Math.min((now - state.lastFrame) / 1000 || 0, .1);
    state.lastFrame = now;
    ctx.clearRect(0, 0, innerWidth, 60);
    const mode = state.settings.petMode;
    if (!supportsReducedMotion.matches && mode !== 'off') {
      if (mode === 'all' || mode === 'octopus') {
        ctx.fillStyle = '#244d8066'; ctx.fillRect(0, 0, innerWidth, 60);
        ctx.strokeStyle = '#67d6a866'; ctx.lineWidth = 2;
        for (let x = 12; x < innerWidth; x += 38) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.quadraticCurveTo(x - 5, 44, x + 3, 34); ctx.stroke(); }
      }
      respawnPets();
      state.pets.forEach((pet) => { drawPet(pet, dt); if (pet.type === 'octopus' && Math.random() < dt * .7 && state.ink.length < MAX_BLOTS) state.ink.push({ x: pet.x, y: pet.y + 13, radius: 2 + Math.random() * 3, age: 0 }); });
      drawInk(dt);
    }
    state.particles = state.particles.filter((particle) => { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 80 * dt; particle.life -= dt; ctx.globalAlpha = Math.max(0, particle.life / .45); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, 3, 3); return particle.life > 0; });
    ctx.globalAlpha = 1;
    if (state.lastHitAt && now - state.lastHitAt > INACTIVITY_MS && state.combo) { state.combo = 0; updateCounter(); chrome.storage.local.set({ combo: 0 }); }
    requestAnimationFrame(render);
  }

  function ensureLoop() {
    if (!state.running && !supportsReducedMotion.matches) { state.running = true; state.lastFrame = performance.now(); requestAnimationFrame(render); }
  }

  function applySettings(settings) {
    state.settings = { ...DEFAULTS, ...settings };
    state.combo = Number(state.settings.combo) || 0;
    updateCounter();
    if (!state.settings.enabled || state.settings.petMode === 'off') { state.pets = []; ctx.clearRect(0, 0, innerWidth, 60); }
    else ensureLoop();
  }

  document.addEventListener('keydown', (event) => {
    const editor = event.target;
    if (isEditor(editor) && !isShortcut(event) && !state.composing) state.pendingKeyboardEdit = true;
  }, true);
  document.addEventListener('compositionstart', () => { state.composing = true; state.pendingKeyboardEdit = false; }, true);
  document.addEventListener('compositionend', (event) => {
    state.composing = false;
    state.pendingKeyboardEdit = isEditor(event.target);
  }, true);
  document.addEventListener('input', (event) => {
    const editor = event.target;
    const keyboardInput = state.pendingKeyboardEdit;
    state.pendingKeyboardEdit = false;
    if (!state.settings.enabled || state.composing || !keyboardInput || !isEditor(editor)) return;
    if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop' || event.inputType === 'insertReplacementText') return;
    hit(editor);
  }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ensureLoop(); }, true);
  window.addEventListener('resize', resize, { passive: true });
  chrome.storage.local.get(DEFAULTS).then(applySettings);
  chrome.storage.onChanged.addListener((changes) => {
    const next = { ...state.settings };
    Object.keys(DEFAULTS).forEach((key) => { if (changes[key]) next[key] = changes[key].newValue; });
    applySettings(next);
  });
  resize();
}());
