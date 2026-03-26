/* ============================================
   AUDIO ENGINE — Music, SFX, procedural audio
   ============================================ */

class AudioEngine {
    constructor() {
        this._ctx = null;
        this._master = null;
        this._musicGain = null;
        this._sfxGain = null;
        this._currentMusic = null;
        this._musicSource = null;
        this._sounds = {};
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
    }

    _ensureContext() {
        if (this._ctx) return;
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._master = this._ctx.createGain();
        this._master.connect(this._ctx.destination);
        this._musicGain = this._ctx.createGain();
        this._musicGain.gain.value = this.musicVolume;
        this._musicGain.connect(this._master);
        this._sfxGain = this._ctx.createGain();
        this._sfxGain.gain.value = this.sfxVolume;
        this._sfxGain.connect(this._master);
    }

    resume() {
        this._ensureContext();
        if (this._ctx.state === 'suspended') this._ctx.resume();
    }

    // ---- SFX ----
    play(name, options = {}) {
        this._ensureContext();
        this.resume();
        const audio = document.querySelector(`audio[data-name="${name}"]`) || new Audio();
        // Clone for overlapping plays
        const clone = audio.cloneNode ? audio.cloneNode() : audio;
        clone.volume = (options.volume || 1) * this.sfxVolume;
        clone.playbackRate = options.pitch || 1;
        if (options.pitchVariation) {
            clone.playbackRate += (Math.random() - 0.5) * options.pitchVariation;
        }
        clone.play().catch(() => {});
        return clone;
    }

    // Procedural SFX — no audio files needed!
    synth(type, options = {}) {
        this._ensureContext();
        this.resume();
        const ctx = this._ctx;
        const now = ctx.currentTime;
        const duration = options.duration || 0.1;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
        osc.frequency.setValueAtTime(options.frequency || 440, now);

        if (options.frequencyEnd) {
            osc.frequency.linearRampToValueAtTime(options.frequencyEnd, now + duration);
        }

        gain.gain.setValueAtTime((options.volume || 0.3) * this.sfxVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this._sfxGain);

        osc.start(now);
        osc.stop(now + duration);
    }

    // Pre-built sound effects
    sfxJump() { this.synth('square', { frequency: 300, frequencyEnd: 600, duration: 0.15, volume: 0.2 }); }
    sfxLand() { this.synth('triangle', { frequency: 150, frequencyEnd: 50, duration: 0.08, volume: 0.15 }); }
    sfxHit() { this.synth('sawtooth', { frequency: 200, frequencyEnd: 80, duration: 0.12, volume: 0.3 }); }
    sfxCoin() { this.synth('square', { frequency: 800, frequencyEnd: 1200, duration: 0.1, volume: 0.15 }); }
    sfxExplosion() {
        this.synth('sawtooth', { frequency: 100, frequencyEnd: 20, duration: 0.4, volume: 0.4 });
        this.synth('square', { frequency: 300, frequencyEnd: 50, duration: 0.3, volume: 0.2 });
    }
    sfxSelect() { this.synth('sine', { frequency: 500, frequencyEnd: 700, duration: 0.06, volume: 0.15 }); }
    sfxDeath() {
        this.synth('square', { frequency: 400, frequencyEnd: 100, duration: 0.5, volume: 0.3 });
    }
    sfxPowerUp() {
        const ctx = this._ctx;
        [523, 659, 784, 1047].forEach((freq, i) => {
            setTimeout(() => this.synth('square', { frequency: freq, duration: 0.12, volume: 0.15 }), i * 80);
        });
    }

    // ---- Music ----
    playMusic(audioElement, loop = true) {
        this.stopMusic();
        if (typeof audioElement === 'string') {
            audioElement = new Audio(audioElement);
        }
        audioElement.loop = loop;
        audioElement.volume = this.musicVolume;
        audioElement.play().catch(() => {});
        this._currentMusic = audioElement;
    }

    stopMusic(fadeOut = 0.5) {
        if (!this._currentMusic) return;
        const music = this._currentMusic;
        if (fadeOut > 0) {
            const startVol = music.volume;
            const step = startVol / (fadeOut * 60);
            const fade = setInterval(() => {
                music.volume = Math.max(0, music.volume - step);
                if (music.volume <= 0) {
                    clearInterval(fade);
                    music.pause();
                    music.currentTime = 0;
                }
            }, 1000 / 60);
        } else {
            music.pause();
            music.currentTime = 0;
        }
        this._currentMusic = null;
    }

    setMusicVolume(v) {
        this.musicVolume = v;
        if (this._currentMusic) this._currentMusic.volume = v;
        if (this._musicGain) this._musicGain.gain.value = v;
    }

    setSfxVolume(v) {
        this.sfxVolume = v;
        if (this._sfxGain) this._sfxGain.gain.value = v;
    }
}

window.AudioEngine = AudioEngine;
