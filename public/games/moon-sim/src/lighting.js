/* ============================================
   2D LIGHTING & SHADOW SYSTEM
   Dynamic lights, ambient, shadow casting
   ============================================ */

class LightingSystem {
    constructor(engine) {
        this.engine = engine;
        this.lights = [];
        this.ambientColor = { r: 30, g: 30, b: 50 };
        this.ambientIntensity = 0.7; // 0 = full bright, 1 = pitch dark
        this.enabled = true;

        // Offscreen canvas for light compositing
        this._lightCanvas = document.createElement('canvas');
        this._lightCtx = this._lightCanvas.getContext('2d');
    }

    addLight(light) {
        this.lights.push(light);
        return light;
    }

    removeLight(light) {
        const idx = this.lights.indexOf(light);
        if (idx !== -1) this.lights.splice(idx, 1);
    }

    render(ctx) {
        if (!this.enabled || this.lights.length === 0) return;

        const w = this.engine.width;
        const h = this.engine.height;
        this._lightCanvas.width = w;
        this._lightCanvas.height = h;
        const lctx = this._lightCtx;

        // Fill with ambient darkness
        const { r, g, b } = this.ambientColor;
        lctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${this.ambientIntensity})`;
        lctx.fillRect(0, 0, w, h);

        // Cut out light areas using destination-out
        lctx.globalCompositeOperation = 'destination-out';

        const cam = this.engine.camera;

        for (const light of this.lights) {
            if (!light.active) continue;

            // Convert world position to screen position
            const screenPos = cam.worldToScreen(light.position.x, light.position.y);
            const scaledRadius = light.radius * cam.zoom;

            if (light.type === 'point') {
                const gradient = lctx.createRadialGradient(
                    screenPos.x, screenPos.y, 0,
                    screenPos.x, screenPos.y, scaledRadius
                );
                gradient.addColorStop(0, `rgba(255, 255, 255, ${light.intensity})`);
                gradient.addColorStop(0.4, `rgba(255, 255, 255, ${light.intensity * 0.6})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                lctx.fillStyle = gradient;
                lctx.beginPath();
                lctx.arc(screenPos.x, screenPos.y, scaledRadius, 0, Math.PI * 2);
                lctx.fill();
            } else if (light.type === 'cone') {
                const startAngle = light.angle - light.spread / 2;
                const endAngle = light.angle + light.spread / 2;

                const gradient = lctx.createRadialGradient(
                    screenPos.x, screenPos.y, 0,
                    screenPos.x, screenPos.y, scaledRadius
                );
                gradient.addColorStop(0, `rgba(255, 255, 255, ${light.intensity})`);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                lctx.fillStyle = gradient;
                lctx.beginPath();
                lctx.moveTo(screenPos.x, screenPos.y);
                lctx.arc(screenPos.x, screenPos.y, scaledRadius, startAngle, endAngle);
                lctx.closePath();
                lctx.fill();
            }
        }

        // Add colored light (additive)
        lctx.globalCompositeOperation = 'destination-over';
        for (const light of this.lights) {
            if (!light.active || !light.color) continue;
            const screenPos = cam.worldToScreen(light.position.x, light.position.y);
            const scaledRadius = light.radius * cam.zoom;

            const gradient = lctx.createRadialGradient(
                screenPos.x, screenPos.y, 0,
                screenPos.x, screenPos.y, scaledRadius
            );
            gradient.addColorStop(0, `rgba(${light.color.r}, ${light.color.g}, ${light.color.b}, ${light.intensity * 0.3})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            lctx.fillStyle = gradient;
            lctx.beginPath();
            lctx.arc(screenPos.x, screenPos.y, scaledRadius, 0, Math.PI * 2);
            lctx.fill();
        }

        lctx.globalCompositeOperation = 'source-over';

        // Composite onto main canvas
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(this._lightCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }

    update(dt) {
        for (const light of this.lights) {
            if (light.flicker) {
                light._flickerTimer = (light._flickerTimer || 0) + dt;
                light.intensity = light.baseIntensity +
                    Math.sin(light._flickerTimer * light.flicker.speed) * light.flicker.amount +
                    Math.random() * light.flicker.noise;
            }
            if (light.followNode) {
                const gp = light.followNode.globalPosition;
                light.position.x = gp.x + (light.offset?.x || 0);
                light.position.y = gp.y + (light.offset?.y || 0);
            }
        }
    }
}


class Light {
    constructor(type = 'point') {
        this.type = type; // 'point', 'cone'
        this.position = { x: 0, y: 0 };
        this.radius = 150;
        this.intensity = 1.0;
        this.baseIntensity = 1.0;
        this.color = null; // { r, g, b }
        this.active = true;

        // Cone specific
        this.angle = 0;
        this.spread = Math.PI / 3;

        // Flicker
        this.flicker = null; // { speed, amount, noise }

        // Follow a node
        this.followNode = null;
        this.offset = { x: 0, y: 0 };
    }

    static point(x, y, radius = 150, intensity = 1.0) {
        const l = new Light('point');
        l.position = { x, y };
        l.radius = radius;
        l.intensity = intensity;
        l.baseIntensity = intensity;
        return l;
    }

    static torch(x, y, radius = 120) {
        const l = Light.point(x, y, radius, 0.9);
        l.color = { r: 255, g: 180, b: 80 };
        l.flicker = { speed: 8, amount: 0.1, noise: 0.05 };
        return l;
    }

    static playerLight(node, radius = 200) {
        const l = Light.point(0, 0, radius, 1.0);
        l.followNode = node;
        l.offset = { x: 16, y: 16 };
        return l;
    }

    static cone(x, y, angle, radius = 200, spread = Math.PI / 4) {
        const l = new Light('cone');
        l.position = { x, y };
        l.angle = angle;
        l.spread = spread;
        l.radius = radius;
        return l;
    }
}

window.LightingSystem = LightingSystem;
window.Light = Light;
