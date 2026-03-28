/* ============================================
   EXPORT SYSTEM
   Package game as standalone HTML5
   ============================================ */

class GameExporter {
    constructor(engine) {
        this.engine = engine;
    }

    // Export as single self-contained HTML file
    async exportHTML(gameCode, options = {}) {
        const title = options.title || 'Vibe Engine Game';
        const width = options.width || this.engine.width;
        const height = options.height || this.engine.height;
        const bgColor = options.bgColor || '#000000';
        const fullscreen = options.fullscreen !== false;

        // Collect all engine source files
        const engineFiles = [
            'engine', 'scene', 'assets', 'sprite', 'physics', 'tilemap',
            'camera', 'input', 'audio', 'particles', 'animator', 'ui',
            'music', 'pathfinding', 'lighting', 'saveload', 'effects',
            'levelgen', 'isometric', 'export'
        ];

        let engineSource = '';
        for (const file of engineFiles) {
            try {
                const resp = await fetch(`src/${file}.js`);
                if (resp.ok) {
                    engineSource += await resp.text() + '\n\n';
                }
            } catch (e) {
                console.warn(`Could not load ${file}.js`);
            }
        }

        // Collect embedded assets (images as data URLs)
        const assetData = {};
        for (const [name, img] of Object.entries(this.engine.assets.images)) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            assetData[name] = canvas.toDataURL();
        }

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: ${bgColor};
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
        }
        canvas {
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            ${fullscreen ? `
            width: 100vw;
            height: 100vh;
            object-fit: contain;
            ` : `
            max-width: 100vw;
            max-height: 100vh;
            `}
        }
    </style>
</head>
<body>
    <canvas id="game-canvas"></canvas>
    <script>
    // ---- VIBE ENGINE (embedded) ----
    ${engineSource}

    // ---- EMBEDDED ASSETS ----
    const _embeddedAssets = ${JSON.stringify(assetData)};

    // Load embedded assets
    async function _loadEmbeddedAssets(engine) {
        for (const [name, dataUrl] of Object.entries(_embeddedAssets)) {
            const img = new Image();
            await new Promise(resolve => {
                img.onload = resolve;
                img.src = dataUrl;
            });
            engine.assets.images[name] = img;
        }
    }

    // ---- GAME CODE ----
    ${gameCode}
    </${'script'}>
</body>
</html>`;

        return html;
    }

    // Download as HTML file
    async downloadHTML(gameCode, options = {}) {
        const html = await this.exportHTML(gameCode, options);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (options.filename || 'game') + '.html';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Export game data (scenes, settings) as JSON
    exportData() {
        return {
            version: '0.1',
            engine: 'VibeEngine',
            timestamp: Date.now(),
            settings: {
                width: this.engine.width,
                height: this.engine.height,
            },
            scenes: this.engine.toJSON().scenes,
            assets: {
                spritesheets: this.engine.assets.spritesheets
            }
        };
    }

    // Download game data
    downloadData(filename = 'game-data.json') {
        const data = this.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}


/* ============================================
   SCREEN RECORDER — Record gameplay as WebM
   ============================================ */

class ScreenRecorder {
    constructor(canvas) {
        this.canvas = canvas;
        this._recorder = null;
        this._chunks = [];
        this.recording = false;
    }

    start(fps = 30) {
        const stream = this.canvas.captureStream(fps);
        this._recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2500000
        });
        this._chunks = [];

        this._recorder.ondataavailable = (e) => {
            if (e.data.size > 0) this._chunks.push(e.data);
        };

        this._recorder.start();
        this.recording = true;
    }

    stop() {
        return new Promise((resolve) => {
            this._recorder.onstop = () => {
                const blob = new Blob(this._chunks, { type: 'video/webm' });
                this.recording = false;
                resolve(blob);
            };
            this._recorder.stop();
        });
    }

    async stopAndDownload(filename = 'gameplay.webm') {
        const blob = await this.stop();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}


/* ============================================
   CINEMATIC SYSTEM — Sprite-based cutscenes
   No video files needed
   ============================================ */

class Cinematic {
    constructor(engine) {
        this.engine = engine;
        this.timeline = [];
        this._currentIndex = 0;
        this._stepTimer = 0;
        this.playing = false;
        this._onComplete = null;
    }

    // Timeline actions
    dialogue(name, text, duration = null) {
        this.timeline.push({ type: 'dialogue', name, text, duration });
        return this;
    }

    moveTo(node, x, y, duration = 1) {
        this.timeline.push({ type: 'move', node, x, y, duration });
        return this;
    }

    wait(duration) {
        this.timeline.push({ type: 'wait', duration });
        return this;
    }

    cameraTo(x, y, duration = 1) {
        this.timeline.push({ type: 'camera', x, y, duration });
        return this;
    }

    zoom(level, duration = 0.5) {
        this.timeline.push({ type: 'zoom', level, duration });
        return this;
    }

    fadeIn(duration = 0.5) {
        this.timeline.push({ type: 'fade', direction: 'in', duration });
        return this;
    }

    fadeOut(duration = 0.5) {
        this.timeline.push({ type: 'fade', direction: 'out', duration });
        return this;
    }

    shake(intensity = 6) {
        this.timeline.push({ type: 'shake', intensity });
        return this;
    }

    playMusic(songName) {
        this.timeline.push({ type: 'music', song: songName });
        return this;
    }

    sfx(soundName) {
        this.timeline.push({ type: 'sfx', sound: soundName });
        return this;
    }

    call(fn) {
        this.timeline.push({ type: 'call', fn });
        return this;
    }

    onComplete(fn) {
        this._onComplete = fn;
        return this;
    }

    play() {
        this.playing = true;
        this._currentIndex = 0;
        this._stepTimer = 0;
        this._executeStep();
        return this;
    }

    _executeStep() {
        if (this._currentIndex >= this.timeline.length) {
            this.playing = false;
            if (this._onComplete) this._onComplete();
            return;
        }

        const step = this.timeline[this._currentIndex];

        switch (step.type) {
            case 'dialogue':
                // Use engine's dialogue system
                // Auto-advance after duration, or wait for input
                this._stepTimer = step.duration || 3;
                break;

            case 'move':
                if (step.node) {
                    new Tween(step.node.position)
                        .to({ x: step.x, y: step.y }, step.duration)
                        .start();
                }
                this._stepTimer = step.duration;
                break;

            case 'camera':
                new Tween(this.engine.camera.position)
                    .to({ x: step.x, y: step.y }, step.duration, 'easeInOut')
                    .start();
                this._stepTimer = step.duration;
                break;

            case 'zoom':
                this.engine.camera.setZoom(step.level);
                this._stepTimer = step.duration;
                break;

            case 'wait':
                this._stepTimer = step.duration;
                break;

            case 'fade':
                this.engine.transitions.play('fade', null, step.duration);
                this._stepTimer = step.duration * 2;
                break;

            case 'shake':
                this.engine.shake(step.intensity);
                this._stepTimer = 0.3;
                break;

            case 'music':
            case 'sfx':
            case 'call':
                if (step.fn) step.fn();
                this._stepTimer = 0;
                break;

            default:
                this._stepTimer = 0;
        }
    }

    update(dt) {
        if (!this.playing) return;

        this._stepTimer -= dt;
        TweenManager.update(dt);

        if (this._stepTimer <= 0) {
            this._currentIndex++;
            this._executeStep();
        }
    }
}


window.GameExporter = GameExporter;
window.ScreenRecorder = ScreenRecorder;
window.Cinematic = Cinematic;
