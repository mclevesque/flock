/* ============================================
   POST-PROCESSING & VISUAL EFFECTS
   CRT, bloom, chromatic aberration, etc.
   ============================================ */

class PostProcessing {
    constructor(engine) {
        this.engine = engine;
        this.effects = [];
        this._buffer = document.createElement('canvas');
        this._bufferCtx = this._buffer.getContext('2d');
    }

    add(effect) {
        this.effects.push(effect);
        return effect;
    }

    remove(effect) {
        const idx = this.effects.indexOf(effect);
        if (idx !== -1) this.effects.splice(idx, 1);
    }

    apply(ctx) {
        if (this.effects.length === 0) return;

        this._buffer.width = this.engine.width;
        this._buffer.height = this.engine.height;

        for (const effect of this.effects) {
            if (!effect.enabled) continue;
            effect.apply(ctx, this._buffer, this._bufferCtx, this.engine);
        }
    }
}


/* ---- CRT Effect ---- */
class CRTEffect {
    constructor(options = {}) {
        this.enabled = true;
        this.scanlineOpacity = options.scanlineOpacity || 0.08;
        this.scanlineWidth = options.scanlineWidth || 2;
        this.vignetteIntensity = options.vignetteIntensity || 0.3;
        this.curvature = options.curvature || 0; // 0 = flat, higher = more curved
        this.noise = options.noise || 0.02;
        this.flickerAmount = options.flickerAmount || 0.01;
    }

    apply(ctx, buffer, bufCtx, engine) {
        const w = engine.width;
        const h = engine.height;

        // Scanlines
        ctx.fillStyle = `rgba(0, 0, 0, ${this.scanlineOpacity})`;
        for (let y = 0; y < h; y += this.scanlineWidth * 2) {
            ctx.fillRect(0, y, w, this.scanlineWidth);
        }

        // Vignette
        if (this.vignetteIntensity > 0) {
            const gradient = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, `rgba(0,0,0,${this.vignetteIntensity})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
        }

        // Noise
        if (this.noise > 0) {
            const imageData = ctx.getImageData(0, 0, w, h);
            const pixels = imageData.data;
            for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel for perf
                const n = (Math.random() - 0.5) * 255 * this.noise;
                pixels[i] += n;
                pixels[i + 1] += n;
                pixels[i + 2] += n;
            }
            ctx.putImageData(imageData, 0, 0);
        }

        // Flicker
        if (this.flickerAmount > 0) {
            const flicker = 1 - Math.random() * this.flickerAmount;
            ctx.fillStyle = `rgba(0, 0, 0, ${1 - flicker})`;
            ctx.fillRect(0, 0, w, h);
        }
    }
}


/* ---- Chromatic Aberration ---- */
class ChromaticAberration {
    constructor(offset = 2) {
        this.enabled = true;
        this.offset = offset;
    }

    apply(ctx, buffer, bufCtx, engine) {
        const w = engine.width;
        const h = engine.height;

        // Copy current frame
        bufCtx.drawImage(engine.canvas, 0, 0);

        // Red channel offset
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(255, 0, 255)'; // Remove green
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(buffer, this.offset, 0); // Offset red

        ctx.globalCompositeOperation = 'source-over';
    }
}


/* ---- Color Grading ---- */
class ColorGrading {
    constructor(options = {}) {
        this.enabled = true;
        this.brightness = options.brightness || 0;     // -1 to 1
        this.contrast = options.contrast || 0;         // -1 to 1
        this.saturation = options.saturation || 0;     // -1 to 1
        this.tint = options.tint || null;              // { r, g, b, intensity }
    }

    apply(ctx, buffer, bufCtx, engine) {
        const w = engine.width;
        const h = engine.height;

        if (this.tint) {
            ctx.fillStyle = `rgba(${this.tint.r}, ${this.tint.g}, ${this.tint.b}, ${this.tint.intensity || 0.1})`;
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
        }

        if (this.brightness !== 0) {
            const b = this.brightness > 0 ? this.brightness : 0;
            ctx.fillStyle = `rgba(255, 255, 255, ${b * 0.3})`;
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
        }
    }
}


/* ---- Flash Effect (full screen) ---- */
class FlashEffect {
    constructor() {
        this.enabled = true;
        this._flashing = false;
        this._alpha = 0;
        this._color = '#ffffff';
        this._decay = 5;
    }

    flash(color = '#ffffff', intensity = 0.8, decay = 5) {
        this._flashing = true;
        this._alpha = intensity;
        this._color = color;
        this._decay = decay;
    }

    apply(ctx, buffer, bufCtx, engine) {
        if (!this._flashing || this._alpha <= 0.01) {
            this._flashing = false;
            return;
        }

        ctx.fillStyle = this._color;
        ctx.globalAlpha = this._alpha;
        ctx.fillRect(0, 0, engine.width, engine.height);
        ctx.globalAlpha = 1;

        this._alpha *= 1 - this._decay * 0.016;
    }
}


/* ---- Underwater / Distortion ---- */
class WaveDistortion {
    constructor(options = {}) {
        this.enabled = true;
        this.amplitude = options.amplitude || 3;
        this.frequency = options.frequency || 0.05;
        this.speed = options.speed || 2;
        this._time = 0;
    }

    apply(ctx, buffer, bufCtx, engine) {
        this._time += 0.016;
        const w = engine.width;
        const h = engine.height;

        bufCtx.clearRect(0, 0, w, h);
        bufCtx.drawImage(engine.canvas, 0, 0);

        ctx.clearRect(0, 0, w, h);

        // Draw each row with horizontal offset
        for (let y = 0; y < h; y++) {
            const offset = Math.sin(y * this.frequency + this._time * this.speed) * this.amplitude;
            ctx.drawImage(buffer, 0, y, w, 1, offset, y, w, 1);
        }
    }
}


window.PostProcessing = PostProcessing;
window.CRTEffect = CRTEffect;
window.ChromaticAberration = ChromaticAberration;
window.ColorGrading = ColorGrading;
window.FlashEffect = FlashEffect;
window.WaveDistortion = WaveDistortion;
