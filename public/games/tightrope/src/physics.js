/* ============================================
   PHYSICS ENGINE — Collisions, gravity, bodies
   ============================================ */

class PhysicsBody extends Node {
    constructor(name = 'PhysicsBody') {
        super(name);
        this.velocity = { x: 0, y: 0 };
        this.acceleration = { x: 0, y: 0 };
        this.friction = 0.9;
        this.gravity = 0;
        this.maxSpeed = { x: 500, y: 1000 };
        this.mass = 1;
        this.bounce = 0;

        // Collider
        this.collider = { x: 0, y: 0, width: 32, height: 32 };
        this.collisionLayer = 1;
        this.collisionMask = 1;

        // State
        this.isOnFloor = false;
        this.isOnCeiling = false;
        this.isOnWallLeft = false;
        this.isOnWallRight = false;
        this.isGrounded = false;

        // Kinematic vs dynamic
        this.bodyType = 'dynamic'; // 'dynamic', 'kinematic', 'static'
    }

    applyForce(fx, fy) {
        this.acceleration.x += fx / this.mass;
        this.acceleration.y += fy / this.mass;
    }

    applyImpulse(ix, iy) {
        this.velocity.x += ix / this.mass;
        this.velocity.y += iy / this.mass;
    }

    fixedUpdate(dt) {
        if (this.bodyType === 'static') return;

        // Apply gravity
        this.velocity.y += this.gravity * dt;

        // Apply acceleration
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;

        // Clamp speed
        this.velocity.x = Math.max(-this.maxSpeed.x, Math.min(this.maxSpeed.x, this.velocity.x));
        this.velocity.y = Math.max(-this.maxSpeed.y, Math.min(this.maxSpeed.y, this.velocity.y));

        // Apply friction
        if (this.isOnFloor) {
            this.velocity.x *= this.friction;
        }

        // Move
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // Reset acceleration
        this.acceleration.x = 0;
        this.acceleration.y = 0;
    }

    // Get world-space collider bounds
    getWorldBounds() {
        const gp = this.globalPosition;
        return {
            x: gp.x + this.collider.x,
            y: gp.y + this.collider.y,
            width: this.collider.width,
            height: this.collider.height,
            right: gp.x + this.collider.x + this.collider.width,
            bottom: gp.y + this.collider.y + this.collider.height
        };
    }

    _renderDebug(ctx) {
        ctx.save();
        ctx.strokeStyle = this.bodyType === 'static' ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.collider.x, this.collider.y, this.collider.width, this.collider.height);

        // Velocity vector
        if (this.bodyType !== 'static') {
            ctx.strokeStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(this.collider.x + this.collider.width / 2, this.collider.y + this.collider.height / 2);
            ctx.lineTo(
                this.collider.x + this.collider.width / 2 + this.velocity.x * 0.1,
                this.collider.y + this.collider.height / 2 + this.velocity.y * 0.1
            );
            ctx.stroke();
        }
        ctx.restore();
        super._renderDebug(ctx);
    }

    _serializeData() {
        return {
            collider: { ...this.collider },
            gravity: this.gravity,
            friction: this.friction,
            bodyType: this.bodyType,
            bounce: this.bounce
        };
    }
}


/* ============================================
   AREA2D — Trigger zones (no physics response)
   ============================================ */
class Area2D extends Node {
    constructor(name = 'Area2D') {
        super(name);
        this.collider = { x: 0, y: 0, width: 32, height: 32 };
        this.collisionLayer = 1;
        this.collisionMask = 1;
        this._overlapping = new Set();
    }

    getWorldBounds() {
        const gp = this.globalPosition;
        return {
            x: gp.x + this.collider.x,
            y: gp.y + this.collider.y,
            width: this.collider.width,
            height: this.collider.height,
            right: gp.x + this.collider.x + this.collider.width,
            bottom: gp.y + this.collider.y + this.collider.height
        };
    }

    _renderDebug(ctx) {
        ctx.save();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(this.collider.x, this.collider.y, this.collider.width, this.collider.height);
        ctx.restore();
        super._renderDebug(ctx);
    }
}


/* ============================================
   PHYSICS ENGINE — Collision detection & resolution
   ============================================ */
class PhysicsEngine {
    constructor() {
        this.gravity = 980;
    }

    update(scene, dt) {
        if (!scene) return;

        const bodies = scene.findByType(PhysicsBody);
        const areas = scene.findByType(Area2D);
        const tilemaps = scene.findByType(TileMap);

        // Reset ground state
        for (const body of bodies) {
            body.isOnFloor = false;
            body.isOnCeiling = false;
            body.isOnWallLeft = false;
            body.isOnWallRight = false;
        }

        // Body vs Tilemap collision
        for (const body of bodies) {
            if (body.bodyType === 'static') continue;
            for (const tm of tilemaps) {
                this._bodyVsTilemap(body, tm);
            }
        }

        // Body vs Body collision
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                if (!this._layersMatch(bodies[i], bodies[j])) continue;
                this._bodyVsBody(bodies[i], bodies[j]);
            }
        }

        // Area overlap detection
        for (const area of areas) {
            for (const body of bodies) {
                if (!this._layersMatch(area, body)) continue;
                const overlapping = this._aabb(area.getWorldBounds(), body.getWorldBounds());
                const wasOverlapping = area._overlapping.has(body);

                if (overlapping && !wasOverlapping) {
                    area._overlapping.add(body);
                    area.signals.emit('body_entered', body);
                } else if (!overlapping && wasOverlapping) {
                    area._overlapping.delete(body);
                    area.signals.emit('body_exited', body);
                }
            }
        }

        // Update grounded state
        for (const body of bodies) {
            body.isGrounded = body.isOnFloor;
        }
    }

    _layersMatch(a, b) {
        return (a.collisionLayer & b.collisionMask) !== 0 || (b.collisionLayer & a.collisionMask) !== 0;
    }

    _aabb(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    _bodyVsBody(a, b) {
        if (a.bodyType === 'static' && b.bodyType === 'static') return;
        const ab = a.getWorldBounds();
        const bb = b.getWorldBounds();
        if (!this._aabb(ab, bb)) return;

        // Calculate overlap
        const overlapX = Math.min(ab.right - bb.x, bb.right - ab.x);
        const overlapY = Math.min(ab.bottom - bb.y, bb.bottom - ab.y);

        if (overlapX < overlapY) {
            const sign = ab.x < bb.x ? -1 : 1;
            if (a.bodyType !== 'static') a.position.x += sign * overlapX / 2;
            if (b.bodyType !== 'static') b.position.x -= sign * overlapX / 2;
            a.velocity.x *= -a.bounce;
            b.velocity.x *= -b.bounce;
        } else {
            const sign = ab.y < bb.y ? -1 : 1;
            if (sign < 0) { a.isOnFloor = true; } else { a.isOnCeiling = true; }
            if (a.bodyType !== 'static') a.position.y += sign * overlapY / 2;
            if (b.bodyType !== 'static') b.position.y -= sign * overlapY / 2;
            a.velocity.y *= -a.bounce;
            b.velocity.y *= -b.bounce;
        }

        a.signals.emit('collision', b);
        b.signals.emit('collision', a);
    }

    _bodyVsTilemap(body, tilemap) {
        const bounds = body.getWorldBounds();
        const tw = tilemap.tileWidth;
        const th = tilemap.tileHeight;
        const tmPos = tilemap.globalPosition;

        // Get tile range to check
        const startCol = Math.floor((bounds.x - tmPos.x) / tw) - 1;
        const endCol = Math.ceil((bounds.right - tmPos.x) / tw) + 1;
        const startRow = Math.floor((bounds.y - tmPos.y) / th) - 1;
        const endRow = Math.ceil((bounds.bottom - tmPos.y) / th) + 1;

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const tile = tilemap.getTile(col, row);
                if (tile === null || tile === -1 || tile === undefined) continue;
                if (tilemap.collisionTiles && !tilemap.collisionTiles.has(tile)) continue;

                const tileRect = {
                    x: tmPos.x + col * tw,
                    y: tmPos.y + row * th,
                    width: tw,
                    height: th,
                    right: tmPos.x + (col + 1) * tw,
                    bottom: tmPos.y + (row + 1) * th
                };

                const bodyRect = body.getWorldBounds();
                if (!this._aabb(bodyRect, tileRect)) continue;

                // Resolve collision
                const overlapX = Math.min(bodyRect.right - tileRect.x, tileRect.right - bodyRect.x);
                const overlapY = Math.min(bodyRect.bottom - tileRect.y, tileRect.bottom - bodyRect.y);

                // Bias toward vertical resolution to prevent sticking on tile seams
                if (overlapX < overlapY - 0.5) {
                    if (bodyRect.x < tileRect.x) {
                        body.position.x -= overlapX;
                        body.isOnWallRight = true;
                    } else {
                        body.position.x += overlapX;
                        body.isOnWallLeft = true;
                    }
                    body.velocity.x = 0;
                } else {
                    if (bodyRect.y < tileRect.y) {
                        body.position.y -= overlapY;
                        body.isOnFloor = true;
                        body.velocity.y = 0;
                    } else {
                        body.position.y += overlapY;
                        body.isOnCeiling = true;
                        body.velocity.y = 0;
                    }
                }
            }
        }
    }

    // Raycast
    raycast(scene, origin, direction, maxDistance = 1000) {
        const tilemaps = scene.findByType(TileMap);
        let closest = null;
        let closestDist = maxDistance;

        for (const tm of tilemaps) {
            const step = Math.min(tm.tileWidth, tm.tileHeight) / 2;
            for (let d = 0; d < maxDistance; d += step) {
                const px = origin.x + direction.x * d;
                const py = origin.y + direction.y * d;
                const tmPos = tm.globalPosition;
                const col = Math.floor((px - tmPos.x) / tm.tileWidth);
                const row = Math.floor((py - tmPos.y) / tm.tileHeight);
                const tile = tm.getTile(col, row);
                if (tile !== null && tile !== -1 && (!tm.collisionTiles || tm.collisionTiles.has(tile))) {
                    if (d < closestDist) {
                        closestDist = d;
                        closest = { point: { x: px, y: py }, distance: d, tile, col, row };
                    }
                    break;
                }
            }
        }

        return closest;
    }
}


registerNodeType('PhysicsBody', PhysicsBody);
registerNodeType('Area2D', Area2D);
window.PhysicsBody = PhysicsBody;
window.Area2D = Area2D;
window.PhysicsEngine = PhysicsEngine;
