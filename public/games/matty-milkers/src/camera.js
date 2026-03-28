/* ============================================
   CAMERA SYSTEM — Smooth follow, bounds, effects
   ============================================ */

class Camera {
    constructor(width, height) {
        this.position = { x: 0, y: 0 };
        this.width = width;
        this.height = height;
        this.zoom = 1;
        this.rotation = 0;

        // Follow
        this.target = null;
        this.followSpeed = 0.1;  // Lerp weight
        this.lookAhead = { x: 0, y: 0 };
        this.lookAheadDistance = 60;
        this.deadZone = { x: 20, y: 20 };

        // Bounds (null = no bounds)
        this.bounds = null; // { x, y, width, height }

        // Smooth zoom
        this._targetZoom = 1;
        this._zoomSpeed = 0.05;
    }

    follow(node, speed = 0.1) {
        this.target = node;
        this.followSpeed = speed;
        return this;
    }

    setBounds(x, y, width, height) {
        this.bounds = { x, y, width, height };
        return this;
    }

    setBoundsFromTilemap(tilemap) {
        const gp = tilemap.globalPosition;
        this.bounds = {
            x: gp.x,
            y: gp.y,
            width: tilemap.pixelWidth,
            height: tilemap.pixelHeight
        };
        return this;
    }

    setZoom(zoom, instant = false) {
        this._targetZoom = zoom;
        if (instant) this.zoom = zoom;
        return this;
    }

    update(dt) {
        // Follow target
        if (this.target) {
            const tp = this.target.globalPosition;
            let targetX = tp.x;
            let targetY = tp.y;

            // Look-ahead based on velocity
            if (this.target.velocity) {
                const vx = this.target.velocity.x;
                if (Math.abs(vx) > 10) {
                    this.lookAhead.x += (Math.sign(vx) * this.lookAheadDistance - this.lookAhead.x) * 0.05;
                }
                targetX += this.lookAhead.x;
            }

            // Dead zone
            const dx = targetX - this.position.x;
            const dy = targetY - this.position.y;

            if (Math.abs(dx) > this.deadZone.x) {
                this.position.x += (targetX - Math.sign(dx) * this.deadZone.x - this.position.x) * this.followSpeed;
            }
            if (Math.abs(dy) > this.deadZone.y) {
                this.position.y += (targetY - Math.sign(dy) * this.deadZone.y - this.position.y) * this.followSpeed;
            }
        }

        // Smooth zoom
        this.zoom += (this._targetZoom - this.zoom) * this._zoomSpeed;

        // Clamp to bounds
        if (this.bounds) {
            const halfW = (this.width / this.zoom) / 2;
            const halfH = (this.height / this.zoom) / 2;

            this.position.x = Math.max(this.bounds.x + halfW,
                Math.min(this.bounds.x + this.bounds.width - halfW, this.position.x));
            this.position.y = Math.max(this.bounds.y + halfH,
                Math.min(this.bounds.y + this.bounds.height - halfH, this.position.y));
        }
    }

    applyTransform(ctx) {
        ctx.translate(this.width / 2, this.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.rotate(this.rotation);
        ctx.translate(-this.position.x, -this.position.y);
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.width / 2) / this.zoom + this.position.x,
            y: (screenY - this.height / 2) / this.zoom + this.position.y
        };
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.position.x) * this.zoom + this.width / 2,
            y: (worldY - this.position.y) * this.zoom + this.height / 2
        };
    }

    // Check if a world-space rectangle is visible
    isVisible(x, y, w, h) {
        const halfW = (this.width / this.zoom) / 2;
        const halfH = (this.height / this.zoom) / 2;
        return x + w > this.position.x - halfW &&
               x < this.position.x + halfW &&
               y + h > this.position.y - halfH &&
               y < this.position.y + halfH;
    }
}

window.Camera = Camera;
