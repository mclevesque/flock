/* ============================================
   SPRITE SYSTEM — Animation engine
   Consistent, powerful sprite rendering
   ============================================ */

class Sprite extends Node {
    constructor(name = 'Sprite') {
        super(name);
        this.imageName = null;
        this.spritesheet = null;
        this.frame = 0;
        this.flipH = false;
        this.flipV = false;
        this.opacity = 1;
        this.tint = null; // { r, g, b }
        this.blendMode = 'source-over';

        // Source rect for single images (null = full image)
        this.sourceRect = null; // { x, y, w, h }

        // Offset from position
        this.offset = { x: 0, y: 0 };

        // For flash effects (damage, etc)
        this._flashTimer = 0;
        this._flashColor = 'white';
        this._flashDuration = 0;
    }

    setImage(imageName) {
        this.imageName = imageName;
        this.spritesheet = null;
        return this;
    }

    setSpritesheet(sheetName) {
        this.spritesheet = sheetName;
        return this;
    }

    flash(color = 'white', duration = 0.1) {
        this._flashColor = color;
        this._flashDuration = duration;
        this._flashTimer = duration;
    }

    update(dt) {
        if (this._flashTimer > 0) this._flashTimer -= dt;
    }

    draw(ctx) {
        const engine = this.engine;
        if (!engine) return;

        let img, sx, sy, sw, sh;

        if (this.spritesheet) {
            const sheet = engine.assets.getSpritesheet(this.spritesheet);
            if (!sheet) return;
            img = engine.assets.getImage(sheet.image);
            if (!img) return;
            const col = this.frame % sheet.columns;
            const row = Math.floor(this.frame / sheet.columns);
            sx = col * sheet.frameWidth;
            sy = row * sheet.frameHeight;
            sw = sheet.frameWidth;
            sh = sheet.frameHeight;
        } else if (this.imageName) {
            img = engine.assets.getImage(this.imageName);
            if (!img) return;
            if (this.sourceRect) {
                sx = this.sourceRect.x;
                sy = this.sourceRect.y;
                sw = this.sourceRect.w;
                sh = this.sourceRect.h;
            } else {
                sx = 0; sy = 0; sw = img.width; sh = img.height;
            }
        } else return;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.globalCompositeOperation = this.blendMode;

        const drawX = this.offset.x - this.origin.x * sw;
        const drawY = this.offset.y - this.origin.y * sh;

        // Flip
        if (this.flipH || this.flipV) {
            ctx.scale(this.flipH ? -1 : 1, this.flipV ? -1 : 1);
        }

        const fx = this.flipH ? -(drawX + sw) : drawX;
        const fy = this.flipV ? -(drawY + sh) : drawY;

        // Flash effect (draw white silhouette)
        if (this._flashTimer > 0) {
            ctx.drawImage(img, sx, sy, sw, sh, fx, fy, sw, sh);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = this._flashColor;
            ctx.fillRect(fx, fy, sw, sh);
        } else if (this.tint) {
            ctx.drawImage(img, sx, sy, sw, sh, fx, fy, sw, sh);
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `rgb(${this.tint.r},${this.tint.g},${this.tint.b})`;
            ctx.fillRect(fx, fy, sw, sh);
            ctx.globalCompositeOperation = 'destination-atop';
            ctx.drawImage(img, sx, sy, sw, sh, fx, fy, sw, sh);
        } else {
            ctx.drawImage(img, sx, sy, sw, sh, fx, fy, sw, sh);
        }

        ctx.restore();
    }

    // Get bounding box in local space
    get bounds() {
        let w, h;
        if (this.spritesheet && this.engine) {
            const sheet = this.engine.assets.getSpritesheet(this.spritesheet);
            w = sheet ? sheet.frameWidth : 0;
            h = sheet ? sheet.frameHeight : 0;
        } else if (this.imageName && this.engine) {
            const img = this.engine.assets.getImage(this.imageName);
            w = this.sourceRect ? this.sourceRect.w : (img ? img.width : 0);
            h = this.sourceRect ? this.sourceRect.h : (img ? img.height : 0);
        } else { w = 0; h = 0; }

        return {
            x: this.offset.x - this.origin.x * w,
            y: this.offset.y - this.origin.y * h,
            width: w,
            height: h
        };
    }

    _serializeData() {
        return {
            imageName: this.imageName,
            spritesheet: this.spritesheet,
            frame: this.frame,
            flipH: this.flipH,
            flipV: this.flipV,
            opacity: this.opacity,
            offset: { ...this.offset }
        };
    }

    _deserializeData(data) {
        Object.assign(this, data);
    }
}


/* ============================================
   ANIMATED SPRITE — Spritesheet animation player
   ============================================ */
class AnimatedSprite extends Sprite {
    constructor(name = 'AnimatedSprite') {
        super(name);
        this.animations = {};
        this.currentAnimation = null;
        this.playing = false;
        this.speed = 1;

        this._frameTimer = 0;
        this._frameIndex = 0;
        this._onAnimationEnd = null;

        // Squash & stretch
        this.squashStretch = { enabled: false, amount: 0, target: { x: 1, y: 1 }, speed: 8 };
    }

    addAnimation(name, config) {
        // config: { frames: [0,1,2,3], speed: 0.15, loop: true, next: null }
        this.animations[name] = {
            frames: config.frames,
            speed: config.speed || 0.15,
            loop: config.loop !== false,
            next: config.next || null
        };
        return this;
    }

    // Load animations from spritesheet definition
    loadFromSpritesheet(sheetName) {
        if (!this.engine) return this;
        const sheet = this.engine.assets.getSpritesheet(sheetName);
        if (!sheet) return this;
        this.setSpritesheet(sheetName);
        for (const [name, anim] of Object.entries(sheet.animations)) {
            this.addAnimation(name, anim);
        }
        return this;
    }

    play(name, force = false) {
        if (this.currentAnimation === name && this.playing && !force) return this;
        const anim = this.animations[name];
        if (!anim) { console.warn(`Animation "${name}" not found`); return this; }
        this.currentAnimation = name;
        this.playing = true;
        this._frameIndex = 0;
        this._frameTimer = 0;
        this.frame = anim.frames[0];
        return this;
    }

    stop() {
        this.playing = false;
        return this;
    }

    onAnimationEnd(callback) {
        this._onAnimationEnd = callback;
        return this;
    }

    // Squash & stretch effects
    squash(amount = 0.3) {
        this.scale.x = 1 + amount;
        this.scale.y = 1 - amount;
    }

    stretch(amount = 0.2) {
        this.scale.x = 1 - amount;
        this.scale.y = 1 + amount;
    }

    update(dt) {
        super.update(dt);

        // Lerp scale back to 1,1 (squash/stretch recovery)
        this.scale.x += (1 - this.scale.x) * 8 * dt;
        this.scale.y += (1 - this.scale.y) * 8 * dt;

        if (!this.playing || !this.currentAnimation) return;

        const anim = this.animations[this.currentAnimation];
        if (!anim) return;

        this._frameTimer += dt * this.speed;
        if (this._frameTimer >= anim.speed) {
            this._frameTimer -= anim.speed;
            this._frameIndex++;

            if (this._frameIndex >= anim.frames.length) {
                if (anim.loop) {
                    this._frameIndex = 0;
                } else {
                    this._frameIndex = anim.frames.length - 1;
                    this.playing = false;
                    if (this._onAnimationEnd) this._onAnimationEnd(this.currentAnimation);
                    if (anim.next) this.play(anim.next);
                    return;
                }
            }

            this.frame = anim.frames[this._frameIndex];
        }
    }

    get currentFrameIndex() { return this._frameIndex; }
    get isPlaying() { return this.playing; }

    _serializeData() {
        return {
            ...super._serializeData(),
            animations: { ...this.animations },
            currentAnimation: this.currentAnimation,
            speed: this.speed
        };
    }
}


/* ============================================
   NINE-SLICE SPRITE — For UI panels, dialogue boxes
   ============================================ */
class NineSlice extends Node {
    constructor(name = 'NineSlice', imageName = null, border = 8) {
        super(name);
        this.imageName = imageName;
        this.border = border;
        this.width = 100;
        this.height = 50;
        this.opacity = 1;
    }

    draw(ctx) {
        if (!this.imageName || !this.engine) return;
        const img = this.engine.assets.getImage(this.imageName);
        if (!img) return;

        const b = this.border;
        const w = this.width;
        const h = this.height;
        const iw = img.width;
        const ih = img.height;

        ctx.globalAlpha = this.opacity;

        // Corners
        ctx.drawImage(img, 0, 0, b, b, 0, 0, b, b);
        ctx.drawImage(img, iw - b, 0, b, b, w - b, 0, b, b);
        ctx.drawImage(img, 0, ih - b, b, b, 0, h - b, b, b);
        ctx.drawImage(img, iw - b, ih - b, b, b, w - b, h - b, b, b);
        // Edges
        ctx.drawImage(img, b, 0, iw - 2 * b, b, b, 0, w - 2 * b, b);
        ctx.drawImage(img, b, ih - b, iw - 2 * b, b, b, h - b, w - 2 * b, b);
        ctx.drawImage(img, 0, b, b, ih - 2 * b, 0, b, b, h - 2 * b);
        ctx.drawImage(img, iw - b, b, b, ih - 2 * b, w - b, b, b, h - 2 * b);
        // Center
        ctx.drawImage(img, b, b, iw - 2 * b, ih - 2 * b, b, b, w - 2 * b, h - 2 * b);

        ctx.globalAlpha = 1;
    }
}


registerNodeType('Sprite', Sprite);
registerNodeType('AnimatedSprite', AnimatedSprite);
registerNodeType('NineSlice', NineSlice);
window.Sprite = Sprite;
window.AnimatedSprite = AnimatedSprite;
window.NineSlice = NineSlice;
