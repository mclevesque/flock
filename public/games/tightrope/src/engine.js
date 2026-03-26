/* ============================================
   VIBE ENGINE — Core Engine
   The AI-native 2D game engine
   ============================================ */

class VibeEngine {
    constructor(canvasId, width = 1280, height = 720) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId || 'vibe-canvas';
            document.body.appendChild(this.canvas);
        }
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = width;
        this.height = height;

        // Core systems
        this.scene = null;
        this.scenes = {};
        this.assets = new AssetManager();
        this.input = new InputManager(this.canvas);
        this.audio = new AudioEngine();
        this.time = new TimeManager();
        this.camera = new Camera(width, height);
        this.physics = new PhysicsEngine();
        this.particles = new ParticleSystem();
        this.ui = new UISystem(this);
        this.events = new EventBus();
        this.debug = false;

        // Game juice
        this.screenShake = { intensity: 0, decay: 0.9, offsetX: 0, offsetY: 0 };
        this.hitFreeze = { active: false, duration: 0, timer: 0 };
        this.transitions = new TransitionManager(this);

        // State
        this._running = false;
        this._lastTime = 0;
        this._accumulator = 0;
        this._fixedStep = 1 / 60;

        // Pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;
        this.canvas.style.imageRendering = 'pixelated';
    }

    // ---- Scene Management ----
    addScene(name, scene) {
        scene.engine = this;
        scene.name = name;
        this.scenes[name] = scene;
        return this;
    }

    switchScene(name, transition = null) {
        const next = this.scenes[name];
        if (!next) { console.error(`Scene "${name}" not found`); return; }

        if (transition) {
            this.transitions.play(transition, () => {
                if (this.scene) this.scene._exit();
                this.scene = next;
                this.scene._enter();
            });
        } else {
            if (this.scene) this.scene._exit();
            this.scene = next;
            this.scene._enter();
        }
    }

    // ---- Game Loop ----
    start(sceneName) {
        if (sceneName) this.switchScene(sceneName);
        this._running = true;
        this._lastTime = performance.now();
        this._loop(this._lastTime);
    }

    stop() { this._running = false; }

    _loop(now) {
        if (!this._running) return;
        requestAnimationFrame((t) => this._loop(t));

        const rawDt = (now - this._lastTime) / 1000;
        this._lastTime = now;
        const dt = Math.min(rawDt, 0.1); // Cap delta to prevent spiral

        this.time._update(dt, now);

        // Hit freeze
        if (this.hitFreeze.active) {
            this.hitFreeze.timer -= dt;
            if (this.hitFreeze.timer <= 0) this.hitFreeze.active = false;
            else return; // Freeze everything
        }

        // Fixed timestep for physics
        this._accumulator += dt;
        while (this._accumulator >= this._fixedStep) {
            if (this.scene) {
                this.scene._fixedUpdate(this._fixedStep);
                this.physics.update(this.scene, this._fixedStep);
            }
            this._accumulator -= this._fixedStep;
        }

        // Update
        this.input._update();
        if (this.scene) this.scene._update(dt);
        this.camera.update(dt);
        this.particles.update(dt);
        this.transitions.update(dt);

        // Render
        this._render();

        // Late update
        this.input._lateUpdate();
    }

    _render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        ctx.save();

        // Screen shake
        if (this.screenShake.intensity > 0.5) {
            this.screenShake.offsetX = (Math.random() - 0.5) * this.screenShake.intensity * 2;
            this.screenShake.offsetY = (Math.random() - 0.5) * this.screenShake.intensity * 2;
            this.screenShake.intensity *= this.screenShake.decay;
            ctx.translate(this.screenShake.offsetX, this.screenShake.offsetY);
        }

        // Camera transform
        this.camera.applyTransform(ctx);

        // Render scene (world space)
        if (this.scene) this.scene._render(ctx);

        // Particles (world space)
        this.particles.render(ctx);

        ctx.restore();

        // UI renders in screen space (no camera transform)
        if (this.scene) this.scene._renderUI(ctx);
        this.ui.render(ctx);

        // Transitions render on top of everything
        this.transitions.render(ctx);

        // Debug overlay
        if (this.debug && this.scene) this.scene._renderDebug(ctx);
    }

    // ---- Game Juice ----
    shake(intensity = 6, decay = 0.85) {
        this.screenShake.intensity = intensity;
        this.screenShake.decay = decay;
    }

    freeze(durationMs = 60) {
        this.hitFreeze.active = true;
        this.hitFreeze.duration = durationMs / 1000;
        this.hitFreeze.timer = durationMs / 1000;
    }

    // ---- Export ----
    toJSON() {
        const data = { scenes: {}, assets: this.assets.toJSON() };
        for (const [name, scene] of Object.entries(this.scenes)) {
            data.scenes[name] = scene.toJSON();
        }
        return data;
    }

    static fromJSON(canvasId, data) {
        const engine = new VibeEngine(canvasId);
        // Reconstruct from serialized data
        for (const [name, sceneData] of Object.entries(data.scenes)) {
            const scene = Scene.fromJSON(sceneData);
            engine.addScene(name, scene);
        }
        return engine;
    }
}


/* ============================================
   TIME MANAGER
   ============================================ */
class TimeManager {
    constructor() {
        this.delta = 0;
        this.elapsed = 0;
        this.scale = 1.0;
        this.frame = 0;
        this._now = 0;
    }

    _update(dt, now) {
        this.delta = dt * this.scale;
        this.elapsed += this.delta;
        this.frame++;
        this._now = now;
    }

    // Slow-mo effect
    slowMotion(scale, duration) {
        this.scale = scale;
        setTimeout(() => { this.scale = 1.0; }, duration * 1000);
    }
}


/* ============================================
   EVENT BUS — Godot-style signals
   ============================================ */
class EventBus {
    constructor() {
        this._listeners = {};
    }

    on(event, callback, context = null) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push({ callback, context });
    }

    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(l => l.callback !== callback);
    }

    emit(event, ...args) {
        if (!this._listeners[event]) return;
        for (const listener of this._listeners[event]) {
            listener.callback.apply(listener.context, args);
        }
    }

    once(event, callback, context = null) {
        const wrapper = (...args) => {
            callback.apply(context, args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}


/* ============================================
   TRANSITION MANAGER
   ============================================ */
class TransitionManager {
    constructor(engine) {
        this.engine = engine;
        this.active = false;
        this.type = 'fade';
        this.progress = 0;
        this.duration = 0.3;
        this.phase = 'none'; // 'in', 'mid', 'out'
        this._onMid = null;
    }

    play(type = 'fade', onMid = null, duration = 0.3) {
        this.type = type;
        this.duration = duration;
        this.progress = 0;
        this.phase = 'in';
        this.active = true;
        this._onMid = onMid;
    }

    update(dt) {
        if (!this.active) return;
        this.progress += dt / this.duration;

        if (this.phase === 'in' && this.progress >= 1) {
            this.progress = 0;
            this.phase = 'out';
            if (this._onMid) this._onMid();
        }

        if (this.phase === 'out' && this.progress >= 1) {
            this.active = false;
            this.phase = 'none';
        }
    }

    render(ctx) {
        if (!this.active) return;
        const alpha = this.phase === 'in' ? this.progress : 1 - this.progress;

        if (this.type === 'fade') {
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillRect(0, 0, this.engine.width, this.engine.height);
        } else if (this.type === 'iris') {
            const maxR = Math.sqrt(this.engine.width ** 2 + this.engine.height ** 2) / 2;
            const r = maxR * (1 - alpha);
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.rect(0, 0, this.engine.width, this.engine.height);
            ctx.arc(this.engine.width / 2, this.engine.height / 2, r, 0, Math.PI * 2, true);
            ctx.fill('evenodd');
        } else if (this.type === 'pixelate') {
            const size = Math.max(1, Math.floor(alpha * 20));
            ctx.imageSmoothingEnabled = false;
            // Draw pixelated version
            const w = Math.ceil(this.engine.width / size);
            const h = Math.ceil(this.engine.height / size);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = w;
            tempCanvas.height = h;
            const tCtx = tempCanvas.getContext('2d');
            tCtx.drawImage(this.engine.canvas, 0, 0, w, h);
            ctx.drawImage(tempCanvas, 0, 0, w, h, 0, 0, this.engine.width, this.engine.height);
        }
    }
}


// Make globally available
window.VibeEngine = VibeEngine;
window.EventBus = EventBus;
