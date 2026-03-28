/* ============================================
   SAVE/LOAD & GAME STATE SYSTEM
   LocalStorage, file export, game flow
   ============================================ */

class SaveSystem {
    constructor(gameName = 'vibe-game') {
        this.gameName = gameName;
        this.maxSlots = 5;
    }

    // ---- Save ----
    save(slot, data) {
        const saveData = {
            slot,
            timestamp: Date.now(),
            version: 1,
            data
        };
        try {
            localStorage.setItem(`${this.gameName}_save_${slot}`, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    }

    // ---- Load ----
    load(slot) {
        try {
            const raw = localStorage.getItem(`${this.gameName}_save_${slot}`);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.error('Load failed:', e);
            return null;
        }
    }

    // ---- Delete ----
    deleteSave(slot) {
        localStorage.removeItem(`${this.gameName}_save_${slot}`);
    }

    // ---- List all saves ----
    listSaves() {
        const saves = [];
        for (let i = 0; i < this.maxSlots; i++) {
            const save = this.load(i);
            saves.push(save);
        }
        return saves;
    }

    // ---- Auto-save ----
    autoSave(data) {
        this.save('auto', data);
    }

    loadAutoSave() {
        return this.load('auto');
    }

    // ---- Settings ----
    saveSettings(settings) {
        localStorage.setItem(`${this.gameName}_settings`, JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(`${this.gameName}_settings`);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    // ---- File Export/Import ----
    exportToFile(data, filename = 'savegame.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    importFromFile() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) { resolve(null); return; }
                const reader = new FileReader();
                reader.onload = () => {
                    try { resolve(JSON.parse(reader.result)); }
                    catch { resolve(null); }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }

    // ---- High Scores ----
    getHighScores(board = 'default', limit = 10) {
        try {
            const raw = localStorage.getItem(`${this.gameName}_scores_${board}`);
            const scores = raw ? JSON.parse(raw) : [];
            return scores.sort((a, b) => b.score - a.score).slice(0, limit);
        } catch { return []; }
    }

    addHighScore(board, name, score) {
        const scores = this.getHighScores(board, 100);
        scores.push({ name, score, date: Date.now() });
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem(`${this.gameName}_scores_${board}`, JSON.stringify(scores.slice(0, 100)));
    }
}


/* ============================================
   GAME STATE MACHINE — Menu flow & game management
   ============================================ */

class GameState {
    constructor(name) {
        this.name = name;
        this.engine = null;
    }
    enter(engine) { this.engine = engine; }
    exit() {}
    update(dt) {}
    render(ctx) {}
    handleInput(input) {}
}

class GameStateManager {
    constructor(engine) {
        this.engine = engine;
        this.states = {};
        this.current = null;
        this.previous = null;
        this.stack = []; // For pause overlay
    }

    add(name, state) {
        this.states[name] = state;
        return this;
    }

    switch(name, transition = null) {
        const next = this.states[name];
        if (!next) return;

        if (transition) {
            this.engine.transitions.play(transition, () => {
                if (this.current) this.current.exit();
                this.previous = this.current;
                this.current = next;
                this.current.enter(this.engine);
            });
        } else {
            if (this.current) this.current.exit();
            this.previous = this.current;
            this.current = next;
            this.current.enter(this.engine);
        }
    }

    push(name) {
        if (this.current) this.stack.push(this.current);
        this.current = this.states[name];
        this.current?.enter(this.engine);
    }

    pop() {
        if (this.current) this.current.exit();
        this.current = this.stack.pop() || null;
    }

    update(dt) {
        this.current?.update(dt);
    }

    render(ctx) {
        // Render stack (for overlays like pause)
        for (const state of this.stack) state.render(ctx);
        this.current?.render(ctx);
    }
}


/* ============================================
   LEVEL MANAGER — Level loading, progression
   ============================================ */

class LevelManager {
    constructor() {
        this.levels = [];
        this.currentIndex = 0;
        this.signals = new EventBus();
    }

    addLevel(config) {
        // config: { name, build: (scene) => {}, music, background, ... }
        this.levels.push(config);
        return this;
    }

    getCurrent() { return this.levels[this.currentIndex]; }

    next() {
        if (this.currentIndex < this.levels.length - 1) {
            this.currentIndex++;
            this.signals.emit('level_changed', this.getCurrent());
            return true;
        }
        this.signals.emit('all_complete');
        return false;
    }

    goTo(index) {
        if (index >= 0 && index < this.levels.length) {
            this.currentIndex = index;
            this.signals.emit('level_changed', this.getCurrent());
        }
    }

    restart() {
        this.signals.emit('level_restart', this.getCurrent());
    }

    get totalLevels() { return this.levels.length; }
    get isLastLevel() { return this.currentIndex >= this.levels.length - 1; }
}


window.SaveSystem = SaveSystem;
window.GameState = GameState;
window.GameStateManager = GameStateManager;
window.LevelManager = LevelManager;
