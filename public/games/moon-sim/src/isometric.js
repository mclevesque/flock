/* ============================================
   ISOMETRIC & TOP-DOWN RENDERING
   For RTS, RPG, MOBA, Stardew-style games
   ============================================ */

class IsometricMap extends Node {
    constructor(name = 'IsometricMap') {
        super(name);
        this.tileWidth = 64;    // Width of diamond
        this.tileHeight = 32;   // Height of diamond
        this.imageName = null;
        this.columns = 0;
        this.data = [];
        this.mapWidth = 0;
        this.mapHeight = 0;
        this.heightData = [];   // Height values per tile (for elevation)
        this.collisionTiles = null;
    }

    create(width, height, fill = 0) {
        this.mapWidth = width;
        this.mapHeight = height;
        this.data = [];
        this.heightData = [];
        for (let row = 0; row < height; row++) {
            this.data[row] = new Array(width).fill(fill);
            this.heightData[row] = new Array(width).fill(0);
        }
        return this;
    }

    setTile(col, row, tile) {
        if (row >= 0 && row < this.mapHeight && col >= 0 && col < this.mapWidth) {
            this.data[row][col] = tile;
        }
    }

    getTile(col, row) {
        if (row < 0 || row >= this.mapHeight || col < 0 || col >= this.mapWidth) return null;
        return this.data[row][col];
    }

    setHeight(col, row, height) {
        if (row >= 0 && row < this.mapHeight && col >= 0 && col < this.mapWidth) {
            this.heightData[row][col] = height;
        }
    }

    // ---- Coordinate Conversion ----
    tileToScreen(col, row) {
        return {
            x: (col - row) * this.tileWidth / 2,
            y: (col + row) * this.tileHeight / 2
        };
    }

    screenToTile(screenX, screenY) {
        const tw = this.tileWidth / 2;
        const th = this.tileHeight / 2;
        const col = Math.floor((screenX / tw + screenY / th) / 2);
        const row = Math.floor((screenY / th - screenX / tw) / 2);
        return { col, row };
    }

    worldToTile(worldX, worldY) {
        const localX = worldX - this.position.x;
        const localY = worldY - this.position.y;
        return this.screenToTile(localX, localY);
    }

    tileToWorld(col, row) {
        const screen = this.tileToScreen(col, row);
        return {
            x: this.position.x + screen.x + this.tileWidth / 2,
            y: this.position.y + screen.y + this.tileHeight / 2
        };
    }

    // ---- Rendering ----
    draw(ctx) {
        if (!this.imageName || !this.engine) return;
        const img = this.engine.assets.getImage(this.imageName);
        if (!img) return;

        if (!this.columns) {
            this.columns = Math.floor(img.width / this.tileWidth);
        }

        // Render back to front for correct overlap
        for (let row = 0; row < this.mapHeight; row++) {
            for (let col = 0; col < this.mapWidth; col++) {
                const tile = this.data[row][col];
                if (tile === -1 || tile === null) continue;

                const screen = this.tileToScreen(col, row);
                const elevation = this.heightData[row]?.[col] || 0;

                const srcCol = tile % this.columns;
                const srcRow = Math.floor(tile / this.columns);

                ctx.drawImage(
                    img,
                    srcCol * this.tileWidth, srcRow * this.tileHeight,
                    this.tileWidth, this.tileHeight,
                    screen.x, screen.y - elevation * this.tileHeight / 2,
                    this.tileWidth, this.tileHeight
                );
            }
        }
    }

    // ---- Tile Highlight (for mouse hover) ----
    drawHighlight(ctx, col, row, color = 'rgba(255, 255, 255, 0.3)') {
        const screen = this.tileToScreen(col, row);
        const hw = this.tileWidth / 2;
        const hh = this.tileHeight / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(screen.x + hw, screen.y);
        ctx.lineTo(screen.x + this.tileWidth, screen.y + hh);
        ctx.lineTo(screen.x + hw, screen.y + this.tileHeight);
        ctx.lineTo(screen.x, screen.y + hh);
        ctx.closePath();
        ctx.fill();
    }

    _renderDebug(ctx) {
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.2)';
        ctx.lineWidth = 0.5;
        for (let row = 0; row < this.mapHeight; row++) {
            for (let col = 0; col < this.mapWidth; col++) {
                const screen = this.tileToScreen(col, row);
                const hw = this.tileWidth / 2;
                const hh = this.tileHeight / 2;
                ctx.beginPath();
                ctx.moveTo(screen.x + hw, screen.y);
                ctx.lineTo(screen.x + this.tileWidth, screen.y + hh);
                ctx.lineTo(screen.x + hw, screen.y + this.tileHeight);
                ctx.lineTo(screen.x, screen.y + hh);
                ctx.closePath();
                ctx.stroke();
            }
        }
    }
}


/* ============================================
   TOP-DOWN CHARACTER CONTROLLER
   4/8 directional movement for RPG/action
   ============================================ */

class TopDownBody extends PhysicsBody {
    constructor(name = 'TopDownBody') {
        super(name);
        this.speed = 150;
        this.gravity = 0; // No gravity in top-down
        this.friction = 0.8;
        this.direction = 'down'; // 'up', 'down', 'left', 'right'
        this.eightDirectional = false;
    }

    update(dt) {
        const input = this.engine?.input;
        if (!input) return;

        const move = input.getMovementVector();

        this.velocity.x = move.x * this.speed;
        this.velocity.y = move.y * this.speed;

        // Update facing direction
        if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) {
            if (this.eightDirectional) {
                if (Math.abs(move.x) > Math.abs(move.y)) {
                    this.direction = move.x > 0 ? 'right' : 'left';
                } else {
                    this.direction = move.y > 0 ? 'down' : 'up';
                }
            } else {
                if (Math.abs(move.x) > Math.abs(move.y)) {
                    this.direction = move.x > 0 ? 'right' : 'left';
                } else {
                    this.direction = move.y > 0 ? 'down' : 'up';
                }
            }
        }
    }

    get isMoving() {
        return Math.abs(this.velocity.x) > 5 || Math.abs(this.velocity.y) > 5;
    }
}


/* ============================================
   FOG OF WAR — For strategy and exploration
   ============================================ */

class FogOfWar {
    constructor(mapWidth, mapHeight, tileSize = 16) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.tileSize = tileSize;
        // 0 = unexplored, 1 = explored but not visible, 2 = visible
        this.visibility = Array.from({ length: mapHeight }, () => new Array(mapWidth).fill(0));
        this._canvas = document.createElement('canvas');
        this._canvas.width = mapWidth * tileSize;
        this._canvas.height = mapHeight * tileSize;
        this._ctx = this._canvas.getContext('2d');
    }

    reveal(centerCol, centerRow, radius) {
        for (let row = centerRow - radius; row <= centerRow + radius; row++) {
            for (let col = centerCol - radius; col <= centerCol + radius; col++) {
                if (row < 0 || row >= this.mapHeight || col < 0 || col >= this.mapWidth) continue;
                const dist = Math.sqrt((col - centerCol) ** 2 + (row - centerRow) ** 2);
                if (dist <= radius) {
                    this.visibility[row][col] = 2;
                }
            }
        }
    }

    // Move all "visible" to "explored" (call before reveal each frame)
    resetVisibility() {
        for (let row = 0; row < this.mapHeight; row++) {
            for (let col = 0; col < this.mapWidth; col++) {
                if (this.visibility[row][col] === 2) {
                    this.visibility[row][col] = 1;
                }
            }
        }
    }

    render(ctx, camera) {
        const ts = this.tileSize;
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        for (let row = 0; row < this.mapHeight; row++) {
            for (let col = 0; col < this.mapWidth; col++) {
                const v = this.visibility[row][col];
                if (v === 2) continue; // Fully visible, no fog
                this._ctx.fillStyle = v === 0 ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.6)';
                this._ctx.fillRect(col * ts, row * ts, ts, ts);
            }
        }

        ctx.drawImage(this._canvas, 0, 0);
    }

    isVisible(col, row) {
        if (row < 0 || row >= this.mapHeight || col < 0 || col >= this.mapWidth) return false;
        return this.visibility[row][col] === 2;
    }

    isExplored(col, row) {
        if (row < 0 || row >= this.mapHeight || col < 0 || col >= this.mapWidth) return false;
        return this.visibility[row][col] >= 1;
    }
}


/* ============================================
   MINIMAP
   ============================================ */

class Minimap {
    constructor(tilemap, options = {}) {
        this.tilemap = tilemap;
        this.x = options.x || 10;
        this.y = options.y || 10;
        this.size = options.size || 150;
        this.borderColor = options.borderColor || '#ffffff';
        this.bgColor = options.bgColor || 'rgba(0,0,0,0.7)';
        this.playerColor = options.playerColor || '#00ff00';
        this.enemyColor = options.enemyColor || '#ff0000';
        this.itemColor = options.itemColor || '#ffcc00';
        this._canvas = document.createElement('canvas');
        this._canvas.width = this.size;
        this._canvas.height = this.size;
        this._ctx = this._canvas.getContext('2d');
        this._dirty = true;
    }

    render(ctx, scene, camera) {
        // Draw border
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(this.x - 2, this.y - 2, this.size + 4, this.size + 4);
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - 2, this.y - 2, this.size + 4, this.size + 4);

        const scaleX = this.size / (this.tilemap.pixelWidth || 1);
        const scaleY = this.size / (this.tilemap.pixelHeight || 1);

        // Draw tilemap (simplified)
        if (this._dirty) {
            this._ctx.fillStyle = '#1a1a2e';
            this._ctx.fillRect(0, 0, this.size, this.size);
            for (let row = 0; row < this.tilemap.mapHeight; row++) {
                for (let col = 0; col < this.tilemap.mapWidth; col++) {
                    const tile = this.tilemap.getTile(col, row);
                    if (tile !== -1 && tile !== null) {
                        this._ctx.fillStyle = '#4a6040';
                        this._ctx.fillRect(
                            col * this.tilemap.tileWidth * scaleX,
                            row * this.tilemap.tileHeight * scaleY,
                            Math.max(1, this.tilemap.tileWidth * scaleX),
                            Math.max(1, this.tilemap.tileHeight * scaleY)
                        );
                    }
                }
            }
            this._dirty = false;
        }

        ctx.drawImage(this._canvas, this.x, this.y);

        // Draw entities
        if (scene) {
            const players = scene.findByTag('player');
            const enemies = scene.findByTag('enemy');
            const items = scene.findByTag('coin');

            for (const p of players) {
                const gp = p.globalPosition;
                ctx.fillStyle = this.playerColor;
                ctx.fillRect(this.x + gp.x * scaleX - 2, this.y + gp.y * scaleY - 2, 4, 4);
            }

            for (const e of enemies) {
                const gp = e.globalPosition;
                ctx.fillStyle = this.enemyColor;
                ctx.fillRect(this.x + gp.x * scaleX - 1, this.y + gp.y * scaleY - 1, 3, 3);
            }

            for (const i of items) {
                const gp = i.globalPosition;
                ctx.fillStyle = this.itemColor;
                ctx.fillRect(this.x + gp.x * scaleX - 1, this.y + gp.y * scaleY - 1, 2, 2);
            }
        }

        // Camera viewport indicator
        if (camera) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            const viewW = (camera.width / camera.zoom) * scaleX;
            const viewH = (camera.height / camera.zoom) * scaleY;
            ctx.strokeRect(
                this.x + (camera.position.x - camera.width / camera.zoom / 2) * scaleX,
                this.y + (camera.position.y - camera.height / camera.zoom / 2) * scaleY,
                viewW, viewH
            );
        }
    }
}


registerNodeType('IsometricMap', IsometricMap);
registerNodeType('TopDownBody', TopDownBody);
window.IsometricMap = IsometricMap;
window.TopDownBody = TopDownBody;
window.FogOfWar = FogOfWar;
window.Minimap = Minimap;
