/* ============================================
   CHIPTUNE MUSIC ENGINE
   Procedural music generation — no audio files needed
   Generates NES/GB style music from note patterns
   ============================================ */

class MusicEngine {
    constructor() {
        this._ctx = null;
        this._masterGain = null;
        this._channels = [];
        this._playing = false;
        this._bpm = 120;
        this._currentSong = null;
        this._stepTimer = null;
        this._currentStep = 0;
        this._looping = true;
        this.volume = 0.3;
    }

    _ensureContext() {
        if (this._ctx) return;
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._masterGain = this._ctx.createGain();
        this._masterGain.gain.value = this.volume;
        this._masterGain.connect(this._ctx.destination);
    }

    // ---- Note Helpers ----
    static noteToFreq(note) {
        // Accepts: 'C4', 'D#5', 'Gb3', etc. or MIDI number
        if (typeof note === 'number') {
            return 440 * Math.pow(2, (note - 69) / 12);
        }
        if (note === '-' || note === '.' || note === null) return 0; // Rest

        const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
        let i = 0;
        let semitone = noteMap[note[i++]];
        if (note[i] === '#') { semitone++; i++; }
        else if (note[i] === 'b') { semitone--; i++; }
        const octave = parseInt(note[i]) || 4;
        const midi = semitone + (octave + 1) * 12;
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // ---- Instrument Definitions ----
    static INSTRUMENTS = {
        square: { type: 'square', attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1, volume: 0.2 },
        pulse: { type: 'square', attack: 0.01, decay: 0.05, sustain: 0.4, release: 0.05, volume: 0.15, duty: 0.25 },
        triangle: { type: 'triangle', attack: 0.01, decay: 0.0, sustain: 0.5, release: 0.05, volume: 0.3 },
        bass: { type: 'triangle', attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.1, volume: 0.35 },
        noise: { type: 'noise', attack: 0.01, decay: 0.05, sustain: 0.0, release: 0.05, volume: 0.15 },
        lead: { type: 'sawtooth', attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.15, volume: 0.15 },
        arp: { type: 'square', attack: 0.005, decay: 0.08, sustain: 0.1, release: 0.05, volume: 0.12 },
        pad: { type: 'sine', attack: 0.3, decay: 0.2, sustain: 0.5, release: 0.5, volume: 0.2 },
    };

    // Play a single note with an instrument
    playNote(freq, instrument, duration = 0.2, time = null) {
        this._ensureContext();
        const ctx = this._ctx;
        const now = time || ctx.currentTime;
        const inst = typeof instrument === 'string' ? MusicEngine.INSTRUMENTS[instrument] : instrument;
        if (!inst || freq <= 0) return;

        const gain = ctx.createGain();
        gain.connect(this._masterGain);

        if (inst.type === 'noise') {
            // White noise via buffer
            const bufferSize = ctx.sampleRate * duration * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(gain);
            // ADSR
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(inst.volume, now + inst.attack);
            gain.gain.linearRampToValueAtTime(inst.sustain * inst.volume, now + inst.attack + inst.decay);
            gain.gain.setValueAtTime(inst.sustain * inst.volume, Math.max(now, now + duration - inst.release));
            gain.gain.linearRampToValueAtTime(0, now + duration);
            source.start(now);
            source.stop(now + duration);
        } else {
            const osc = ctx.createOscillator();
            osc.type = inst.type;
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(gain);
            // ADSR envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(inst.volume, now + inst.attack);
            gain.gain.linearRampToValueAtTime(inst.sustain * inst.volume, now + inst.attack + inst.decay);
            gain.gain.setValueAtTime(inst.sustain * inst.volume, Math.max(now, now + duration - inst.release));
            gain.gain.linearRampToValueAtTime(0, now + duration);
            osc.start(now);
            osc.stop(now + duration + 0.01);
        }
    }

    // ---- Song System ----
    // Song format: { bpm, tracks: [{ instrument, notes: ['C4', 'E4', '-', 'G4', ...] }] }
    playSong(song) {
        this._ensureContext();
        if (this._ctx.state === 'suspended') this._ctx.resume();
        this.stopSong();
        this._currentSong = song;
        this._bpm = song.bpm || 120;
        this._currentStep = 0;
        this._playing = true;
        this._scheduleAhead();
    }

    _scheduleAhead() {
        if (!this._playing || !this._currentSong) return;

        const song = this._currentSong;
        const stepDuration = 60 / this._bpm / 4; // 16th notes
        const maxSteps = Math.max(...song.tracks.map(t => t.notes.length));
        const ctx = this._ctx;
        const now = ctx.currentTime;

        // Schedule next 8 steps ahead
        for (let i = 0; i < 8; i++) {
            const step = (this._currentStep + i) % maxSteps;
            const time = now + i * stepDuration;

            for (const track of song.tracks) {
                if (step >= track.notes.length) continue;
                const note = track.notes[step];
                if (!note || note === '-' || note === '.') continue;

                const freq = MusicEngine.noteToFreq(note);
                if (freq > 0) {
                    this.playNote(freq, track.instrument, stepDuration * 0.9, time);
                }
            }
        }

        this._currentStep = (this._currentStep + 8) % maxSteps;

        if (this._currentStep === 0 && !this._looping) {
            this._playing = false;
            return;
        }

        // Schedule next batch
        this._stepTimer = setTimeout(() => this._scheduleAhead(), stepDuration * 8 * 1000 * 0.9);
    }

    stopSong() {
        this._playing = false;
        if (this._stepTimer) clearTimeout(this._stepTimer);
        this._stepTimer = null;
    }

    setBPM(bpm) {
        this._bpm = bpm;
        if (this._playing) {
            this.stopSong();
            this._playing = true;
            this._scheduleAhead();
        }
    }

    setVolume(v) {
        this.volume = v;
        if (this._masterGain) this._masterGain.gain.value = v;
    }

    // ---- Pre-built Songs ----
    static SONGS = {
        titleScreen: {
            bpm: 140,
            tracks: [
                {
                    instrument: 'lead',
                    notes: ['E5','.','.','E5','-','E5','.','C5','E5','.','.','G5','-','-','-','-',
                            'C5','.','.','.','-','G4','.','-','-','E4','.','.','A4','.','B4','.','A#4','A4','.',
                            'G4','E5','.','G5','A5','.','F5','G5','.','E5','.','C5','D5','B4','-','-']
                },
                {
                    instrument: 'bass',
                    notes: ['C3','-','C3','-','C3','-','C3','-','G3','-','G3','-','G3','-','G3','-',
                            'C3','-','C3','-','C3','-','C3','-','G3','-','G3','-','G3','-','G3','-',
                            'A2','-','A2','-','E3','-','E3','-','F3','-','F3','-','C3','-','G2','-']
                },
                {
                    instrument: 'noise',
                    notes: ['-','.','-','.','-','C1','-','.','-','.','-','.','-','C1','-','.',
                            '-','.','-','.','-','C1','-','.','-','.','-','.','-','C1','-','.',
                            '-','.','-','.','-','C1','-','.','-','.','-','.','-','C1','-','.']
                }
            ]
        },

        adventure: {
            bpm: 130,
            tracks: [
                {
                    instrument: 'square',
                    notes: ['C5','E5','G5','C6','.','G5','E5','C5','D5','F5','A5','D6','.','A5','F5','D5',
                            'E5','G5','B5','E6','.','B5','G5','E5','C5','E5','G5','C6','.','.','.','.']
                },
                {
                    instrument: 'triangle',
                    notes: ['C3','.','G3','.','C3','.','G3','.','D3','.','A3','.','D3','.','A3','.',
                            'E3','.','B3','.','E3','.','B3','.','C3','.','G3','.','C3','.','.','.' ]
                },
                {
                    instrument: 'noise',
                    notes: ['C1','.','.','C1','C1','.','.','C1','C1','.','.','C1','C1','.','.','C1',
                            'C1','.','.','C1','C1','.','.','C1','C1','.','.','C1','C1','.','C1','C1']
                }
            ]
        },

        battle: {
            bpm: 160,
            tracks: [
                {
                    instrument: 'lead',
                    notes: ['A4','.','.','A4','C5','.','.','E5','A4','.','.','A4','G4','.','.','.',
                            'F4','.','.','F4','A4','.','.','C5','F4','.','.','E4','D4','.','.','.',
                            'A4','.','.','A4','C5','.','.','E5','F5','.','.','E5','D5','.','.','.',
                            'C5','.','.','A4','G4','.','.','A4','E4','.','.','.','-','-','-','-']
                },
                {
                    instrument: 'bass',
                    notes: ['A2','A2','.','.','A2','A2','.','.','A2','A2','.','.','G2','G2','.','.',
                            'F2','F2','.','.','F2','F2','.','.','F2','F2','.','.','E2','E2','.','.',
                            'A2','A2','.','.','A2','A2','.','.','F2','F2','.','.','D2','D2','.','.',
                            'C2','C2','.','.','C2','C2','.','.','E2','E2','.','.','.','.','.','.']
                },
                {
                    instrument: 'noise',
                    notes: ['C1','.','C1','.','C1','.','C1','C1','C1','.','C1','.','C1','.','C1','C1',
                            'C1','.','C1','.','C1','.','C1','C1','C1','.','C1','.','C1','.','C1','C1',
                            'C1','.','C1','.','C1','.','C1','C1','C1','.','C1','.','C1','.','C1','C1',
                            'C1','.','C1','.','C1','.','C1','C1','C1','.','C1','.','C1','C1','C1','C1']
                }
            ]
        },

        peaceful: {
            bpm: 90,
            tracks: [
                {
                    instrument: 'pad',
                    notes: ['C4','.','.','.','.','.','.','E4','.','.','.','.','.','.','G4','.',
                            '.','.','.','.','.','.','.','E4','.','.','.','.','.','.','.','.',
                            'F4','.','.','.','.','.','.','A4','.','.','.','.','.','.','C5','.',
                            '.','.','.','.','.','.','.','G4','.','.','.','.','.','.','.','.']
                },
                {
                    instrument: 'triangle',
                    notes: ['C3','.','G3','.','E3','.','G3','.','C3','.','G3','.','E3','.','G3','.',
                            'F3','.','C4','.','A3','.','C4','.','F3','.','C4','.','A3','.','C4','.',
                            'F3','.','C4','.','A3','.','C4','.','G3','.','D4','.','B3','.','D4','.',
                            'C3','.','G3','.','E3','.','G3','.','C3','.','.','.','.','.','.','.' ]
                }
            ]
        },

        gameOver: {
            bpm: 80,
            tracks: [
                {
                    instrument: 'square',
                    notes: ['E5','.','.','.','.','D5','.','.','.','.','C5','.','.','.','.','.', 'B4','.','.','.','.','.','.','.','A4','.','.','.','.','.','-','-']
                },
                {
                    instrument: 'bass',
                    notes: ['A2','.','.','.','.','G2','.','.','.','.','F2','.','.','.','.','.', 'E2','.','.','.','.','.','.','.',  'A2','.','.','.','.','.','-','-']
                }
            ]
        },

        victory: {
            bpm: 160,
            tracks: [
                {
                    instrument: 'lead',
                    notes: ['C5','E5','G5','.','C6','.','.','.','.','.','.','.','.','.','-','-']
                },
                {
                    instrument: 'square',
                    notes: ['E4','G4','C5','.','E5','.','.','.','.','.','.','.','.','.','-','-']
                },
                {
                    instrument: 'bass',
                    notes: ['C3','.','C3','.','C3','.','.','.','.','.','.','.','.','.','-','-']
                }
            ]
        }
    };
}

window.MusicEngine = MusicEngine;
