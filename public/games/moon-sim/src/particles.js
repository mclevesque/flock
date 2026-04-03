/* ============================================
   PARTICLE SYSTEM — Dust, sparks, explosions, trails
   ============================================ */

class Particle {
    constructor() {
        this.x = 0; this.y = 0;
        this.vx = 0; this.vy = 0;
        this.ax = 0; this.ay = 0;
        this.life = 1; this.maxLife = 1;
        this.size = 4; this.endSize = 0;
        this.color = '#ffffff';
        this.endColor = null;
        this.opacity = 1;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.active = false;
        this.shape = 'circle'; // 'circle', 'square', 'line', 'image'
        this.imageFrame = 0;
    }
}

class ParticleEmitter {
    constructor(config = {}) {
        this.position = { x: 0, y: 0 };
        this.active = true;
        this.continuous = config.continuous || false;
        this.rate = config.rate || 10; // particles per second
        this._rateTimer = 0;

        // Pool
        this.maxParticles = config.maxParticles || 200;
        this.particles = [];
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(new Particle());
        }

        // Emission shape
        this.emitShape = config.emitShape || 'point'; // 'point', 'circle', 'rect', 'line'
        this.emitRadius = config.emitRadius || 0;
        this.emitWidth = config.emitWidth || 0;
        this.emitHeight = config.emitHeight || 0;

        // Particle properties (with variance)
        this.speed = config.speed || { min: 50, max: 150 };
        this.angle = config.angle || { min: 0, max: 360 };
        this.life = config.life || { min: 0.3, max: 1.0 };
        this.size = config.size || { min: 2, max: 6 };
        this.endSize = config.endSize ?? 0;
        this.gravity = config.gravity || 0;
        this.color = config.color || '#ffffff';
        this.endColor = config.endColor || null;
        this.shape = config.shape || 'circle';
        this.rotationSpeed = config.rotationSpeed || { min: 0, max: 0 };
        this.opacity = config.opacity ?? 1;
        this.blendMode = config.blendMode || 'source-over';

        // Image-based particles
        this.imageName = config.imageName || null;
        this.imageFrames = config.imageFrames || [0];
    }

    emit(count = 1) {
        for (let i = 0; i < count; i++) {
            const p = this._getInactive();
            if (!p) return;
            this._initParticle(p);
        }
    }

    burst(count, x, y) {
        const ox = this.position.x;
        const oy = this.position.y;
        if (x !== undefined) this.position.x = x;
        if (y !== undefined) this.position.y = y;
        this.emit(count);
        this.position.x = ox;
        this.position.y = oy;
    }

    _getInactive() {
        for (const p of this.particles) {
            if (!p.active) return p;
        }
        return null;
    }

    _rand(range) {
        if (typeof range === 'number') return range;
        return range.min + Math.random() * (range.max - range.min);
    }

    _initParticle(p) {
        p.active = true;

        // Position based on emit shape
        switch (this.emitShape) {
            case 'circle': {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * this.emitRadius;
                p.x = this.position.x + Math.cos(a) * r;
                p.y = this.position.y + Math.sin(a) * r;
                break;
            }
            case 'rect':
                p.x = this.position.x + (Math.random() - 0.5) * this.emitWidth;
                p.y = this.position.y + (Math.random() - 0.5) * this.emitHeight;
                break;
            default:
                p.x = this.position.x;
                p.y = this.position.y;
        }

        const speed = this._rand(this.speed);
        const angle = this._rand(this.angle) * Math.PI / 180;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.ax = 0;
        p.ay = this.gravity;
        p.maxLife = this._rand(this.life);
        p.life = p.maxLife;
        p.size = this._rand(this.size);
        p.endSize = this.endSize;
        p.color = Array.isArray(this.color) ? this.color[Math.floor(Math.random() * this.color.length)] : this.color;
        p.endColor = this.endColor;
        p.opacity = this.opacity;
        p.rotation = Math.random() * Math.PI * 2;
        p.rotationSpeed = this._rand(this.rotationSpeed);
        p.shape = this.shape;
        if (this.imageFrames.length > 0) {
            p.imageFrame = this.imageFrames[Math.floor(Math.random() * this.imageFrames.length)];
        }
    }

    update(dt) {
        // Continuous emission
        if (this.active && this.continuous) {
            this._rateTimer += dt;
            const interval = 1 / this.rate;
            while (this._rateTimer >= interval) {
                this._rateTimer -= interval;
                this.emit(1);
            }
        }

        // Update particles
        for (const p of this.particles) {
            if (!p.active) continue;
            p.life -= dt;
            if (p.life <= 0) { p.active = false; continue; }

            p.vx += p.ax * dt;
            p.vy += p.ay * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rotation += p.rotationSpeed * dt;
        }
    }

    render(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = this.blendMode;

        for (const p of this.particles) {
            if (!p.active) continue;
            const t = 1 - p.life / p.maxLife; // 0 = start, 1 = end
            const size = p.size + (p.endSize - p.size) * t;
            const alpha = p.opacity * (p.life / p.maxLife);

            ctx.globalAlpha = alpha;

            // Color interpolation
            let color = p.color;
            if (p.endColor) {
                color = this._lerpColor(p.color, p.endColor, t);
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            if (p.shape === 'circle') {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.shape === 'square') {
                ctx.fillStyle = color;
                ctx.fillRect(-size / 2, -size / 2, size, size);
            } else if (p.shape === 'line') {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-p.vx * 0.05, -p.vy * 0.05);
                ctx.stroke();
            }

            ctx.restore();
        }

        ctx.restore();
    }

    _lerpColor(a, b, t) {
        const ah = parseInt(a.replace('#', ''), 16);
        const bh = parseInt(b.replace('#', ''), 16);
        const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
        const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
        const r = Math.round(ar + (br - ar) * t);
        const g = Math.round(ag + (bg - ag) * t);
        const b2 = Math.round(ab + (bb - ab) * t);
        return `rgb(${r},${g},${b2})`;
    }

    get activeCount() {
        return this.particles.filter(p => p.active).length;
    }
}


class ParticleSystem {
    constructor() {
        this.emitters = [];
    }

    add(emitter) {
        this.emitters.push(emitter);
        return emitter;
    }

    remove(emitter) {
        const idx = this.emitters.indexOf(emitter);
        if (idx !== -1) this.emitters.splice(idx, 1);
    }

    update(dt) {
        for (const e of this.emitters) e.update(dt);
    }

    render(ctx) {
        for (const e of this.emitters) e.render(ctx);
    }

    // ---- Presets ----
    static dust(x, y) {
        return new ParticleEmitter({
            speed: { min: 20, max: 60 }, angle: { min: 200, max: 340 },
            life: { min: 0.2, max: 0.5 }, size: { min: 2, max: 4 }, endSize: 0,
            color: '#a89070', gravity: -30
        });
    }

    static sparks(x, y) {
        return new ParticleEmitter({
            speed: { min: 100, max: 300 }, angle: { min: 0, max: 360 },
            life: { min: 0.1, max: 0.3 }, size: { min: 1, max: 3 }, endSize: 0,
            color: ['#ffcc00', '#ff8800', '#ffffff'], shape: 'line',
            gravity: 400
        });
    }

    static explosion(x, y) {
        return new ParticleEmitter({
            speed: { min: 50, max: 200 }, angle: { min: 0, max: 360 },
            life: { min: 0.3, max: 0.8 }, size: { min: 3, max: 8 }, endSize: 0,
            color: ['#ff4400', '#ff8800', '#ffcc00'], endColor: '#333333',
            gravity: 100, maxParticles: 50
        });
    }

    static trail() {
        return new ParticleEmitter({
            continuous: true, rate: 30,
            speed: { min: 5, max: 20 }, angle: { min: 0, max: 360 },
            life: { min: 0.2, max: 0.5 }, size: { min: 2, max: 4 }, endSize: 0,
            color: '#88ccff', endColor: '#0044ff', blendMode: 'lighter'
        });
    }

    static rain() {
        return new ParticleEmitter({
            continuous: true, rate: 100, maxParticles: 500,
            emitShape: 'rect', emitWidth: 1400, emitHeight: 10,
            speed: { min: 400, max: 600 }, angle: { min: 85, max: 95 },
            life: { min: 0.5, max: 1.0 }, size: { min: 1, max: 2 },
            color: '#88aacc', shape: 'line', opacity: 0.5
        });
    }

    static snow() {
        return new ParticleEmitter({
            continuous: true, rate: 20, maxParticles: 300,
            emitShape: 'rect', emitWidth: 1400, emitHeight: 10,
            speed: { min: 30, max: 80 }, angle: { min: 80, max: 100 },
            life: { min: 3, max: 6 }, size: { min: 2, max: 5 },
            color: '#ffffff', opacity: 0.7, rotationSpeed: { min: -1, max: 1 }
        });
    }
}

window.ParticleEmitter = ParticleEmitter;
window.ParticleSystem = ParticleSystem;
