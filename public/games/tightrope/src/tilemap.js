/* ============================================
   TILEMAP SYSTEM — Auto-tiling, layers, collision
   ============================================ */

class TileMap extends Node {
    constructor(name = 'TileMap') {
        super(name);
        this.tileWidth = 32;
        this.tileHeight = 32;
        this.imageName = null;
        this.columns = 0;      // tileset columns
        this.data = [];         // 2D array of tile indices
        this.mapWidth = 0;
        this.mapHeight = 0;

        // Collision
        this.collisionTiles = null; // Set of tile indices that are solid. null = all solid

        // Auto-tiling
        this.autoTileRules = null;

        // Decoration layer
        this.decorations = []; // { x, y, tile }
    }

    // ---- Map Creation ----
    create(width, height, fill = -1) {
        this.mapWidth = width;
        this.mapHeight = height;
        this.data = [];
        for (let row = 0; row < height; row++) {
            this.data[row] = new Array(width).fill(fill);
        }
        return this;
    }

    setTileset(imageName, tileWidth, tileHeight) {
        this.imageName = imageName;
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
        if (this.engine) {
            const img = this.engine.assets.getImage(imageName);
            if (img) this.columns = Math.floor(img.width / tileWidth);
        }
        return this;
    }

    // ---- Tile Access ----
    getTile(col, row) {
        if (row < 0 || row >= this.mapHeight || col < 0 || col >= this.mapWidth) return null;
        return this.data[row][col];
    }

    setTile(col, row, tile) {
        if (row < 0 || row >= this.mapHeight || col < 0 || col >= this.mapWidth) return;
        this.data[row][col] = tile;
    }

    // ---- Bulk Operations ----
    fill(tile, x = 0, y = 0, w = this.mapWidth, h = this.mapHeight) {
        for (let row = y; row < Math.min(y + h, this.mapHeight); row++) {
            for (let col = x; col < Math.min(x + w, this.mapWidth); col++) {
                this.data[row][col] = tile;
            }
        }
        return this;
    }

    fillRect(tile, x, y, w, h) {
        return this.fill(tile, x, y, w, h);
    }

    // Draw a line of tiles (for platforms)
    line(tile, x1, y1, x2, y2) {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;
        let x = x1, y = y1;

        while (true) {
            this.setTile(x, y, tile);
            if (x === x2 && y === y2) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
        return this;
    }

    // ---- Level Building Helpers ----
    addGround(row, startCol = 0, endCol = this.mapWidth - 1, surfaceTile = 0, fillTile = 1) {
        // Surface
        for (let col = startCol; col <= endCol; col++) {
            this.setTile(col, row, surfaceTile);
        }
        // Fill below
        for (let r = row + 1; r < this.mapHeight; r++) {
            for (let col = startCol; col <= endCol; col++) {
                this.setTile(col, r, fillTile);
            }
        }
        return this;
    }

    addPlatform(row, startCol, width, tile = 0) {
        for (let col = startCol; col < startCol + width; col++) {
            this.setTile(col, row, tile);
        }
        return this;
    }

    addWall(col, startRow, height, tile = 1) {
        for (let row = startRow; row < startRow + height; row++) {
            this.setTile(col, row, tile);
        }
        return this;
    }

    carveGap(row, startCol, width) {
        for (let r = row; r < this.mapHeight; r++) {
            for (let col = startCol; col < startCol + width; col++) {
                this.setTile(col, r, -1);
            }
        }
        return this;
    }

    // ---- Auto-Tiling (Simple 4-bit) ----
    autoTile(solidCheck = (tile) => tile >= 0) {
        if (!this.autoTileRules) return;
        const newData = this.data.map(row => [...row]);

        for (let row = 0; row < this.mapHeight; row++) {
            for (let col = 0; col < this.mapWidth; col++) {
                if (!solidCheck(this.data[row][col])) continue;

                // 4-bit bitmask: top, right, bottom, left
                const top = row > 0 && solidCheck(this.data[row - 1][col]) ? 1 : 0;
                const right = col < this.mapWidth - 1 && solidCheck(this.data[row][col + 1]) ? 1 : 0;
                const bottom = row < this.mapHeight - 1 && solidCheck(this.data[row + 1][col]) ? 1 : 0;
                const left = col > 0 && solidCheck(this.data[row][col - 1]) ? 1 : 0;

                const mask = (top << 3) | (right << 2) | (bottom << 1) | left;
                if (this.autoTileRules[mask] !== undefined) {
                    newData[row][col] = this.autoTileRules[mask];
                }
            }
        }

        this.data = newData;
        return this;
    }

    // ---- Decoration Scattering ----
    scatterDecorations(tiles, density = 0.3, onSurface = true) {
        for (let col = 0; col < this.mapWidth; col++) {
            for (let row = 0; row < this.mapHeight; row++) {
                if (this.data[row][col] === -1 || this.data[row][col] === null) continue;

                if (onSurface) {
                    // Only place on top of solid tiles with empty above
                    const above = row > 0 ? this.data[row - 1][col] : -1;
                    if (above !== -1 && above !== null) continue;
                }

                if (Math.random() < density) {
                    const tile = tiles[Math.floor(Math.random() * tiles.length)];
                    this.decorations.push({ x: col, y: onSurface ? row - 1 : row, tile });
                }
            }
        }
        return this;
    }

    // ---- Rendering ----
    draw(ctx) {
        if (!this.imageName || !this.engine) return;
        const img = this.engine.assets.getImage(this.imageName);
        if (!img) return;

        if (!this.columns) {
            this.columns = Math.floor(img.width / this.tileWidth);
        }

        // Calculate visible range based on camera
        const cam = this.engine.camera;
        const startCol = Math.max(0, Math.floor((-this.position.x + cam.position.x - cam.width / 2) / this.tileWidth) - 1);
        const endCol = Math.min(this.mapWidth, Math.ceil((-this.position.x + cam.position.x + cam.width / 2) / this.tileWidth) + 1);
        const startRow = Math.max(0, Math.floor((-this.position.y + cam.position.y - cam.height / 2) / this.tileHeight) - 1);
        const endRow = Math.min(this.mapHeight, Math.ceil((-this.position.y + cam.position.y + cam.height / 2) / this.tileHeight) + 1);

        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                const tile = this.data[row]?.[col];
                if (tile === null || tile === -1 || tile === undefined) continue;

                const srcCol = tile % this.columns;
                const srcRow = Math.floor(tile / this.columns);

                ctx.drawImage(
                    img,
                    srcCol * this.tileWidth, srcRow * this.tileHeight,
                    this.tileWidth, this.tileHeight,
                    col * this.tileWidth, row * this.tileHeight,
                    this.tileWidth, this.tileHeight
                );
            }
        }

        // Render decorations
        for (const dec of this.decorations) {
            if (dec.x < startCol || dec.x >= endCol || dec.y < startRow || dec.y >= endRow) continue;
            const srcCol = dec.tile % this.columns;
            const srcRow = Math.floor(dec.tile / this.columns);
            ctx.drawImage(
                img,
                srcCol * this.tileWidth, srcRow * this.tileHeight,
                this.tileWidth, this.tileHeight,
                dec.x * this.tileWidth, dec.y * this.tileHeight,
                this.tileWidth, this.tileHeight
            );
        }
    }

    _renderDebug(ctx) {
        ctx.strokeStyle = 'rgba(255,255,0,0.2)';
        ctx.lineWidth = 0.5;
        for (let row = 0; row < this.mapHeight; row++) {
            for (let col = 0; col < this.mapWidth; col++) {
                ctx.strokeRect(col * this.tileWidth, row * this.tileHeight, this.tileWidth, this.tileHeight);
            }
        }
        super._renderDebug(ctx);
    }

    // ---- World helpers ----
    worldToTile(worldX, worldY) {
        const gp = this.globalPosition;
        return {
            col: Math.floor((worldX - gp.x) / this.tileWidth),
            row: Math.floor((worldY - gp.y) / this.tileHeight)
        };
    }

    tileToWorld(col, row) {
        const gp = this.globalPosition;
        return {
            x: gp.x + col * this.tileWidth + this.tileWidth / 2,
            y: gp.y + row * this.tileHeight + this.tileHeight / 2
        };
    }

    get pixelWidth() { return this.mapWidth * this.tileWidth; }
    get pixelHeight() { return this.mapHeight * this.tileHeight; }

    _serializeData() {
        return {
            tileWidth: this.tileWidth,
            tileHeight: this.tileHeight,
            imageName: this.imageName,
            mapWidth: this.mapWidth,
            mapHeight: this.mapHeight,
            data: this.data,
            decorations: this.decorations
        };
    }

    _deserializeData(d) {
        Object.assign(this, d);
    }
}


/* ============================================
   PARALLAX LAYER — Scrolling backgrounds
   ============================================ */
class ParallaxLayer extends Node {
    constructor(name = 'ParallaxLayer', imageName = null, scrollFactor = 0.5) {
        super(name);
        this.imageName = imageName;
        this.scrollFactor = scrollFactor;
        this.repeatX = true;
        this.repeatY = false;
        this.offsetY = 0;
        this.autoScrollX = 0; // pixels per second
        this._scrollOffset = 0;
    }

    update(dt) {
        this._scrollOffset += this.autoScrollX * dt;
    }

    draw(ctx) {
        if (!this.imageName || !this.engine) return;
        const img = this.engine.assets.getImage(this.imageName);
        if (!img) return;

        const cam = this.engine.camera;
        const scrollX = cam.position.x * this.scrollFactor + this._scrollOffset;
        const scrollY = cam.position.y * this.scrollFactor;

        ctx.save();
        // Undo camera transform for this layer, apply our own
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (this.repeatX) {
            const startX = -(scrollX % img.width) - img.width;
            for (let x = startX; x < this.engine.width + img.width; x += img.width) {
                ctx.drawImage(img, x, this.offsetY - scrollY * this.scrollFactor);
            }
        } else {
            ctx.drawImage(img, -scrollX, this.offsetY - scrollY * this.scrollFactor);
        }

        ctx.restore();
    }
}


registerNodeType('TileMap', TileMap);
registerNodeType('ParallaxLayer', ParallaxLayer);
window.TileMap = TileMap;
window.ParallaxLayer = ParallaxLayer;
