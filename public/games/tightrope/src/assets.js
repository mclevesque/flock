/* ============================================
   ASSET MANAGER — Load images, audio, data
   ============================================ */

class AssetManager {
    constructor() {
        this.images = {};
        this.audio = {};
        this.data = {};
        this.spritesheets = {};
        this._loading = 0;
        this._loaded = 0;
        this._onProgress = null;
    }

    get progress() {
        return this._loading === 0 ? 1 : this._loaded / this._loading;
    }

    get isLoading() {
        return this._loaded < this._loading;
    }

    // ---- Image Loading ----
    loadImage(name, src) {
        this._loading++;
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[name] = img;
                this._loaded++;
                if (this._onProgress) this._onProgress(this.progress);
                resolve(img);
            };
            img.onerror = () => {
                console.error(`Failed to load image: ${src}`);
                this._loaded++;
                reject(new Error(`Failed to load: ${src}`));
            };
            img.src = src;
        });
    }

    // ---- Spritesheet Registration ----
    defineSpritesheet(name, imageName, config) {
        // config: { frameWidth, frameHeight, animations: { idle: { frames: [0,1,2,3], speed: 0.15, loop: true } } }
        const sheet = {
            image: imageName,
            frameWidth: config.frameWidth,
            frameHeight: config.frameHeight,
            columns: 0,
            rows: 0,
            animations: config.animations || {}
        };

        const img = this.images[imageName];
        if (img) {
            sheet.columns = Math.floor(img.width / config.frameWidth);
            sheet.rows = Math.floor(img.height / config.frameHeight);
        }

        this.spritesheets[name] = sheet;
        return sheet;
    }

    // Auto-detect spritesheet from image dimensions and frame size
    autoSpritesheet(name, imageName, frameWidth, frameHeight, animations = {}) {
        return this.defineSpritesheet(name, imageName, { frameWidth, frameHeight, animations });
    }

    // ---- Audio Loading ----
    loadAudio(name, src) {
        this._loading++;
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.audio[name] = audio;
                this._loaded++;
                if (this._onProgress) this._onProgress(this.progress);
                resolve(audio);
            };
            audio.onerror = () => {
                console.error(`Failed to load audio: ${src}`);
                this._loaded++;
                reject(new Error(`Failed to load: ${src}`));
            };
            audio.src = src;
        });
    }

    // ---- JSON Data Loading ----
    loadJSON(name, src) {
        this._loading++;
        return fetch(src)
            .then(r => r.json())
            .then(data => {
                this.data[name] = data;
                this._loaded++;
                if (this._onProgress) this._onProgress(this.progress);
                return data;
            });
    }

    // ---- Bulk Loading ----
    async loadAll(manifest) {
        const promises = [];
        if (manifest.images) {
            for (const [name, src] of Object.entries(manifest.images)) {
                promises.push(this.loadImage(name, src));
            }
        }
        if (manifest.audio) {
            for (const [name, src] of Object.entries(manifest.audio)) {
                promises.push(this.loadAudio(name, src));
            }
        }
        if (manifest.data) {
            for (const [name, src] of Object.entries(manifest.data)) {
                promises.push(this.loadJSON(name, src));
            }
        }
        await Promise.all(promises);

        // Auto-define spritesheets after images load
        if (manifest.spritesheets) {
            for (const [name, config] of Object.entries(manifest.spritesheets)) {
                this.defineSpritesheet(name, config.image, config);
            }
        }

        return this;
    }

    onProgress(callback) {
        this._onProgress = callback;
        return this;
    }

    getImage(name) {
        return this.images[name] || null;
    }

    getSpritesheet(name) {
        return this.spritesheets[name] || null;
    }

    toJSON() {
        return {
            spritesheets: { ...this.spritesheets }
        };
    }
}

window.AssetManager = AssetManager;
