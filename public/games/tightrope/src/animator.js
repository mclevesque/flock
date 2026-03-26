/* ============================================
   PROCEDURAL ANIMATION ENGINE
   Understands sprite animation at its core
   Can generate, blend, and sequence animations
   ============================================ */

/* ---- ANIMATION STATE MACHINE ---- */
class AnimationStateMachine {
    constructor() {
        this.states = {};
        this.current = null;
        this.previous = null;
        this.transitions = [];
        this._sprite = null;
    }

    bind(animatedSprite) {
        this._sprite = animatedSprite;
        return this;
    }

    addState(name, animation, options = {}) {
        this.states[name] = {
            animation: name,
            speed: options.speed || 1,
            onEnter: options.onEnter || null,
            onExit: options.onExit || null,
            onFrame: options.onFrame || null, // callback per frame
            canInterrupt: options.canInterrupt !== false
        };
        return this;
    }

    addTransition(from, to, condition) {
        this.transitions.push({ from, to, condition });
        return this;
    }

    start(state) {
        this.current = state;
        if (this._sprite) {
            this._sprite.play(state);
            this._sprite.speed = this.states[state]?.speed || 1;
        }
        const s = this.states[state];
        if (s?.onEnter) s.onEnter();
        return this;
    }

    update(context = {}) {
        if (!this.current) return;

        const currentState = this.states[this.current];

        // Check transitions
        for (const t of this.transitions) {
            if (t.from !== this.current && t.from !== '*') continue;
            if (t.to === this.current) continue;
            if (!currentState?.canInterrupt && this._sprite?.isPlaying) continue;

            if (t.condition(context)) {
                this.previous = this.current;
                const exitState = this.states[this.current];
                if (exitState?.onExit) exitState.onExit();

                this.current = t.to;
                const enterState = this.states[this.current];
                if (this._sprite) {
                    this._sprite.play(this.current);
                    this._sprite.speed = enterState?.speed || 1;
                }
                if (enterState?.onEnter) enterState.onEnter();
                break;
            }
        }

        // Per-frame callback
        if (currentState?.onFrame && this._sprite) {
            currentState.onFrame(this._sprite.currentFrameIndex);
        }
    }

    is(state) { return this.current === state; }
    was(state) { return this.previous === state; }
}


/* ---- TWEEN ENGINE ---- */
class Tween {
    constructor(target) {
        this.target = target;
        this.steps = [];
        this._currentStep = 0;
        this._stepTimer = 0;
        this._active = false;
        this._loop = false;
        this._onComplete = null;
    }

    to(properties, duration, easing = 'easeInOut') {
        this.steps.push({
            type: 'tween',
            properties,
            duration,
            easing,
            startValues: null
        });
        return this;
    }

    wait(duration) {
        this.steps.push({ type: 'wait', duration });
        return this;
    }

    call(fn) {
        this.steps.push({ type: 'call', fn });
        return this;
    }

    loop() { this._loop = true; return this; }
    onComplete(fn) { this._onComplete = fn; return this; }

    start() {
        this._active = true;
        this._currentStep = 0;
        this._stepTimer = 0;
        this._initStep();
        TweenManager.add(this);
        return this;
    }

    stop() { this._active = false; }

    _initStep() {
        if (this._currentStep >= this.steps.length) return;
        const step = this.steps[this._currentStep];
        if (step.type === 'tween') {
            step.startValues = {};
            for (const key of Object.keys(step.properties)) {
                step.startValues[key] = this._getProp(key);
            }
        }
        this._stepTimer = 0;
    }

    _getProp(path) {
        const parts = path.split('.');
        let obj = this.target;
        for (const p of parts) obj = obj[p];
        return obj;
    }

    _setProp(path, value) {
        const parts = path.split('.');
        let obj = this.target;
        for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
        obj[parts[parts.length - 1]] = value;
    }

    update(dt) {
        if (!this._active) return false;
        if (this._currentStep >= this.steps.length) {
            if (this._loop) { this._currentStep = 0; this._initStep(); }
            else { this._active = false; if (this._onComplete) this._onComplete(); return false; }
        }

        const step = this.steps[this._currentStep];

        if (step.type === 'call') {
            step.fn();
            this._currentStep++;
            this._initStep();
            return true;
        }

        this._stepTimer += dt;
        const t = Math.min(this._stepTimer / step.duration, 1);
        const easedT = Easing[step.easing || 'linear'](t);

        if (step.type === 'tween') {
            for (const [key, end] of Object.entries(step.properties)) {
                const start = step.startValues[key];
                this._setProp(key, start + (end - start) * easedT);
            }
        }

        if (t >= 1) {
            this._currentStep++;
            this._initStep();
        }

        return true;
    }
}

class TweenManager {
    static _tweens = [];

    static add(tween) { this._tweens.push(tween); }
    static remove(tween) {
        const idx = this._tweens.indexOf(tween);
        if (idx !== -1) this._tweens.splice(idx, 1);
    }

    static update(dt) {
        for (let i = this._tweens.length - 1; i >= 0; i--) {
            if (!this._tweens[i].update(dt)) {
                this._tweens.splice(i, 1);
            }
        }
    }
}

// Easing functions
const Easing = {
    linear: t => t,
    easeIn: t => t * t,
    easeOut: t => t * (2 - t),
    easeInOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: t => t * t * t,
    easeOutCubic: t => (--t) * t * t + 1,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    bounce: t => {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    },
    elastic: t => {
        if (t === 0 || t === 1) return t;
        return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    },
    back: t => t * t * (2.70158 * t - 1.70158)
};


/* ---- PROCEDURAL PIXEL ANIMATION GENERATOR ---- */
class PixelAnimator {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this._canvas = document.createElement('canvas');
        this._canvas.width = width;
        this._canvas.height = height;
        this._ctx = this._canvas.getContext('2d');
        this._ctx.imageSmoothingEnabled = false;
    }

    // Generate a spritesheet from a base sprite with procedural animations
    generateIdle(baseImage, frameCount = 4, breathAmount = 1) {
        // Subtle breathing motion — shift bottom half down by 1px on some frames
        const totalWidth = this.width * frameCount;
        const canvas = document.createElement('canvas');
        canvas.width = totalWidth;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        for (let i = 0; i < frameCount; i++) {
            const yOffset = Math.sin((i / frameCount) * Math.PI * 2) * breathAmount;
            const x = i * this.width;
            // Draw top half
            ctx.drawImage(baseImage, 0, 0, this.width, this.height / 2,
                x, 0, this.width, this.height / 2);
            // Draw bottom half with slight offset
            ctx.drawImage(baseImage, 0, this.height / 2, this.width, this.height / 2,
                x, this.height / 2 + yOffset, this.width, this.height / 2);
        }
        return canvas;
    }

    // Generate walk cycle from a standing sprite
    generateWalk(baseImage, frameCount = 6) {
        const totalWidth = this.width * frameCount;
        const canvas = document.createElement('canvas');
        canvas.width = totalWidth;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        for (let i = 0; i < frameCount; i++) {
            const t = i / frameCount;
            const x = i * this.width;
            const bobY = Math.abs(Math.sin(t * Math.PI * 2)) * 2;
            const lean = Math.sin(t * Math.PI * 2) * 1;

            ctx.save();
            ctx.translate(x + this.width / 2, 0);
            ctx.transform(1, 0, lean * 0.02, 1, 0, 0); // slight shear for lean
            ctx.drawImage(baseImage,
                -this.width / 2, -bobY,
                this.width, this.height);
            ctx.restore();
        }
        return canvas;
    }

    // Generate squash and stretch frames for jump
    generateJump(baseImage) {
        // 3 frames: anticipation (squash), jump (stretch), fall (neutral)
        const canvas = document.createElement('canvas');
        canvas.width = this.width * 3;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Frame 0: Squash (anticipation)
        ctx.save();
        ctx.translate(this.width / 2, this.height);
        ctx.scale(1.2, 0.8);
        ctx.drawImage(baseImage, -this.width / 2, -this.height, this.width, this.height);
        ctx.restore();

        // Frame 1: Stretch (ascending)
        ctx.save();
        ctx.translate(this.width + this.width / 2, this.height);
        ctx.scale(0.85, 1.15);
        ctx.drawImage(baseImage, -this.width / 2, -this.height, this.width, this.height);
        ctx.restore();

        // Frame 2: Normal (falling)
        ctx.drawImage(baseImage, this.width * 2, 0, this.width, this.height);

        return canvas;
    }

    // Generate hit/damage flash frames
    generateHitFrames(baseImage, flashColor = '#ffffff', frameCount = 2) {
        const canvas = document.createElement('canvas');
        canvas.width = this.width * frameCount;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        for (let i = 0; i < frameCount; i++) {
            const x = i * this.width;
            ctx.drawImage(baseImage, x, 0);
            if (i % 2 === 0) {
                ctx.globalCompositeOperation = 'source-atop';
                ctx.fillStyle = flashColor;
                ctx.fillRect(x, 0, this.width, this.height);
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        return canvas;
    }

    // Generate death/dissolve animation
    generateDissolve(baseImage, frameCount = 8) {
        const canvas = document.createElement('canvas');
        canvas.width = this.width * frameCount;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Get pixel data from base image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(baseImage, 0, 0);
        const imageData = tempCtx.getImageData(0, 0, this.width, this.height);
        const pixels = imageData.data;

        for (let f = 0; f < frameCount; f++) {
            const threshold = f / frameCount;
            const frameData = ctx.createImageData(this.width, this.height);

            for (let i = 0; i < pixels.length; i += 4) {
                if (pixels[i + 3] === 0) continue; // skip transparent
                if (Math.random() > threshold) {
                    frameData.data[i] = pixels[i];
                    frameData.data[i + 1] = pixels[i + 1];
                    frameData.data[i + 2] = pixels[i + 2];
                    frameData.data[i + 3] = pixels[i + 3];
                }
            }

            ctx.putImageData(frameData, f * this.width, 0);
        }
        return canvas;
    }

    // Color swap — change one palette color to another
    recolor(baseImage, colorMap) {
        // colorMap: { '#ff0000': '#00ff00', ... }
        const canvas = document.createElement('canvas');
        canvas.width = baseImage.width;
        canvas.height = baseImage.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(baseImage, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        const map = {};
        for (const [from, to] of Object.entries(colorMap)) {
            const f = this._hexToRgb(from);
            const t = this._hexToRgb(to);
            map[`${f.r},${f.g},${f.b}`] = t;
        }

        for (let i = 0; i < pixels.length; i += 4) {
            const key = `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`;
            if (map[key]) {
                pixels[i] = map[key].r;
                pixels[i + 1] = map[key].g;
                pixels[i + 2] = map[key].b;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    _hexToRgb(hex) {
        const h = parseInt(hex.replace('#', ''), 16);
        return { r: (h >> 16) & 0xff, g: (h >> 8) & 0xff, b: h & 0xff };
    }
}


/* ---- BEHAVIOR TREE (AI) ---- */
class BehaviorNode {
    tick(context) { return 'success'; } // 'success', 'failure', 'running'
}

class Sequence extends BehaviorNode {
    constructor(children) { super(); this.children = children; }
    tick(context) {
        for (const child of this.children) {
            const result = child.tick(context);
            if (result !== 'success') return result;
        }
        return 'success';
    }
}

class Selector extends BehaviorNode {
    constructor(children) { super(); this.children = children; }
    tick(context) {
        for (const child of this.children) {
            const result = child.tick(context);
            if (result !== 'failure') return result;
        }
        return 'failure';
    }
}

class Condition extends BehaviorNode {
    constructor(fn) { super(); this.fn = fn; }
    tick(context) { return this.fn(context) ? 'success' : 'failure'; }
}

class Action extends BehaviorNode {
    constructor(fn) { super(); this.fn = fn; }
    tick(context) { return this.fn(context) || 'success'; }
}

class Wait extends BehaviorNode {
    constructor(duration) { super(); this.duration = duration; this._timer = 0; }
    tick(context) {
        this._timer += context.dt || 0.016;
        if (this._timer >= this.duration) { this._timer = 0; return 'success'; }
        return 'running';
    }
}


/* ---- TIMER UTILITY ---- */
class Timer {
    constructor(duration, callback, repeat = false) {
        this.duration = duration;
        this.callback = callback;
        this.repeat = repeat;
        this._timer = 0;
        this.active = true;
    }

    update(dt) {
        if (!this.active) return;
        this._timer += dt;
        if (this._timer >= this.duration) {
            this.callback();
            if (this.repeat) this._timer -= this.duration;
            else this.active = false;
        }
    }

    reset() { this._timer = 0; this.active = true; }
}


window.AnimationStateMachine = AnimationStateMachine;
window.Tween = Tween;
window.TweenManager = TweenManager;
window.Easing = Easing;
window.PixelAnimator = PixelAnimator;
window.BehaviorNode = BehaviorNode;
window.Sequence = Sequence;
window.Selector = Selector;
window.Condition = Condition;
window.Action = Action;
window.Timer = Timer;
