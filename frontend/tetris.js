// ████████╗███████╗████████╗██████╗  ██████╗ ███████╗
// ╚══██╔══╝██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗██╔════╝
//    ██║   █████╗     ██║   ██████╔╝██║   ██║███████╗
//    ██║   ██╔══╝     ██║   ██╔══██╗██║   ██║╚════██║
//    ██║   ███████╗   ██║   ██║  ██║╚██████╔╝███████║
//    ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝

// ═══════════════════════════════════
// DUAL LAYOUT: Desktop (fixed) + Mobile (responsive)
// ═══════════════════════════════════
const bgCanvas = document.getElementById('bg');
const bgCtx = bgCanvas.getContext('2d');

// Desktop elements
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');

// Mobile elements
const canvasM = document.getElementById('boardMobile');
const ctxM = canvasM.getContext('2d');
const nextCanvasM = document.getElementById('nextMobile');
const nextCtxM = nextCanvasM.getContext('2d');
const overlayM = document.getElementById('overlayMobile');
const overlayTextM = document.getElementById('overlayTextMobile');
const startBtnM = document.getElementById('startBtnMobile');

// Sync all score/level/lines displays
const scoreEls = document.querySelectorAll('.val-score');
const levelEls = document.querySelectorAll('.val-level');
const linesEls = document.querySelectorAll('.val-lines');
function setScore(v) { scoreEls.forEach(el => el.textContent = v); }
function setLevel(v) { levelEls.forEach(el => el.textContent = v); }
function setLines(v) { linesEls.forEach(el => el.textContent = v); }

bgCanvas.width = window.innerWidth;
bgCanvas.height = window.innerHeight;

const COLS = 14;
const ROWS = 24;
const BLOCK = 30; // desktop is always 30
let BLOCK_M = 30; // mobile scales

function isMobile() {
    return window.innerWidth <= 700;
}

// active context — which canvas to draw on
function getCtx() { return isMobile() ? ctxM : ctx; }
function getCanvas() { return isMobile() ? canvasM : canvas; }
function getBLOCK() { return isMobile() ? BLOCK_M : BLOCK; }

function resizeMobileCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;

    if (!isMobile()) return;

    const touchH = 150;
    const topBarH = 65;
    const titleH = 36;
    const availH = window.innerHeight - touchH - topBarH - titleH - 10;
    const availW = window.innerWidth - 12;

    const blockFromH = Math.floor(availH / ROWS);
    const blockFromW = Math.floor(availW / COLS);
    BLOCK_M = Math.max(12, Math.min(blockFromH, blockFromW, 30));

    canvasM.width = COLS * BLOCK_M;
    canvasM.height = ROWS * BLOCK_M;
}

resizeMobileCanvas();
window.addEventListener('resize', () => {
    resizeMobileCanvas();
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    generateBgTriangles();
});

// ═══════════════════════════════════════════
// ABSTRACT ENTITIES - NOT YOUR MOTHERS TETRIS
// ═══════════════════════════════════════════
// Each "entity" is a non-standard abstract form — 20 shapes
const SHAPES = [
    null,
    // 1 "The Spire" - tall asymmetric spike
    [[1,0],[1,0],[1,1],[0,1]],
    // 2 "The Amoeba" - organic blob
    [[0,2,0],[2,2,2],[0,2,0]],
    // 3 "The Rift" - zigzag tear in space
    [[3,0,0],[3,3,0],[0,3,3]],
    // 4 "The Shard" - crystalline diagonal
    [[0,0,4],[0,4,4],[4,4,0]],
    // 5 "The Void" - hollow frame
    [[5,5,5],[5,0,5],[5,5,5]],
    // 6 "The Fang" - predatory shape
    [[6,0,6],[6,0,6],[0,6,0]],
    // 7 "The Sigil" - mystical asymmetric rune
    [[0,7,0],[7,7,7],[7,0,0]],
    // 8 "The Fracture" - broken line
    [[8,8,0,0],[0,0,8,0],[0,0,8,8]],
    // 9 "The Eye" - watching you
    [[0,9,0],[9,9,9],[0,9,0],[0,9,0]],
    // 10 "The Helix" - spiraling DNA strand
    [[10,0,0],[0,10,0],[0,0,10],[0,10,0]],
    // 11 "The Claw" - three prongs reaching
    [[11,0,11],[0,11,0],[11,0,11]],
    // 12 "The Monolith" - imposing vertical slab
    [[12],[12],[12],[12],[12]],
    // 13 "The Parasite" - latches on from the side
    [[0,13,13],[13,13,0],[0,13,0]],
    // 14 "The Crown" - royal jagged top
    [[14,0,14,0,14],[0,14,14,14,0]],
    // 15 "The Worm" - slithering diagonal
    [[15,0,0],[0,15,0],[0,15,0],[0,0,15]],
    // 16 "The Anchor" - heavy bottom
    [[0,16,0],[0,16,0],[16,16,16],[16,0,16]],
    // 17 "The Phantom" - barely there, L with gap
    [[17,0],[17,0],[17,17],[0,17]],
    // 18 "The Nebula" - scattered cosmic dust
    [[18,0,18],[0,18,0],[18,0,18]],
    // 19 "The Scythe" - curved blade
    [[0,0,19],[0,19,19],[19,19,0],[19,0,0]],
    // 20 "The Colossus" - massive 2x3 block
    [[20,20],[20,20],[20,20]],
    // === CLASSIC TETROMINOS ===
    // 21 I-piece
    [[21,21,21,21]],
    // 22 O-piece
    [[22,22],[22,22]],
    // 23 T-piece
    [[0,23,0],[23,23,23]],
    // 24 S-piece
    [[0,24,24],[24,24,0]],
    // 25 Z-piece
    [[25,25,0],[0,25,25]],
    // 26 L-piece
    [[26,0],[26,0],[26,26]],
    // 27 J-piece
    [[0,27],[0,27],[27,27]],
];

const ENTITY_NAMES = [
    null, 'SPIRE', 'AMOEBA', 'RIFT', 'SHARD', 'VOID', 'FANG', 'SIGIL', 'FRACTURE', 'EYE',
    'HELIX', 'CLAW', 'MONOLITH', 'PARASITE', 'CROWN', 'WORM', 'ANCHOR', 'PHANTOM', 'NEBULA', 'SCYTHE', 'COLOSSUS',
    'I-LINE', 'CUBE', 'T-RUNE', 'S-TWIST', 'Z-TWIST', 'L-BEND', 'J-BEND'
];

// Colors shift based on time - these are base hues (27 entries)
const BASE_HUES = [null, 300, 180, 60, 120, 30, 330, 210, 90, 270, 150, 345, 200, 45, 15, 240, 75, 165, 315, 105, 225, 190, 50, 280, 100, 10, 140, 260];

let board, piece, nextPiece, score, lines, level, gameOver, paused, dropInterval, lastDrop;
let particles = [];
let combo = 0;       // consecutive line-clear counter
let countingDown = false; // countdown lock
let screenShake = 0;
let globalTime = 0;
let breathe = 0;
let dimensionWarp = 0;
let trailBoard; // afterimage board

// ═══════════════════════════════════════════════════════
// AUDIO ENGINE - PSYCHEDELIC GENERATIVE MUSIC SYSTEM
// ═══════════════════════════════════════════════════════
let audioCtx;
let masterGain, reverbNode, delayNode, delayFeedback, filterNode;
let musicPlaying = false;
let musicLayers = [];

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // === MASTER CHAIN: filter → delay → reverb → master ===
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;

    // reverb via convolver with generated IR
    reverbNode = audioCtx.createConvolver();
    const irLen = audioCtx.sampleRate * 3;
    const irBuf = audioCtx.createBuffer(2, irLen, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = irBuf.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
        }
    }
    reverbNode.buffer = irBuf;

    // delay for psychedelic echo
    delayNode = audioCtx.createDelay(2);
    delayNode.delayTime.value = 0.42;
    delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0.35;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);

    // master filter that breathes
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 3000;
    filterNode.Q.value = 2;

    // connect chain
    const reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.3;
    const delayGain = audioCtx.createGain();
    delayGain.gain.value = 0.25;

    filterNode.connect(masterGain);
    filterNode.connect(delayNode);
    filterNode.connect(reverbNode);
    delayNode.connect(delayGain);
    delayGain.connect(masterGain);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);
}

function playTone(freq, duration, type = 'sine', volume = 0.15, detune = 0, useEffects = false) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(useEffects ? filterNode : masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playChord(freqs, duration, type = 'sine', vol = 0.08, fx = false) {
    freqs.forEach((f, i) => playTone(f, duration, type, vol, i * 7, fx));
}

// ═══════════════════════════════════════════
// PSYCHEDELIC GENERATIVE BACKGROUND MUSIC
// ═══════════════════════════════════════════
// Scales for different "dimensions" (levels)
const SCALES = [
    [0, 2, 4, 7, 9],           // pentatonic
    [0, 1, 5, 7, 10],          // japanese
    [0, 3, 5, 6, 7, 10],       // blues
    [0, 2, 3, 5, 7, 8, 10],    // dorian
    [0, 1, 4, 5, 7, 8, 11],    // phrygian dominant
    [0, 2, 4, 6, 8, 10],       // whole tone
    [0, 1, 3, 5, 6, 8, 10],    // altered
    [0, 2, 3, 6, 7, 8, 11],    // hungarian minor
];

function getScale() {
    return SCALES[(level - 1) % SCALES.length];
}

function scaleNote(degree, octave = 0) {
    const scale = getScale();
    const idx = ((degree % scale.length) + scale.length) % scale.length;
    const oct = Math.floor(degree / scale.length);
    return scale[idx] + (oct + octave) * 12;
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// --- LAYER 1: Deep sub-bass drone ---
function startDrone() {
    if (!audioCtx) return;
    const drone = { oscs: [], gains: [], active: true };

    function updateDrone() {
        if (!drone.active || !audioCtx) return;
        // clean up old oscillators
        drone.oscs.forEach(o => { try { o.stop(); } catch(e){} });
        drone.oscs = [];
        drone.gains = [];

        const root = midiToFreq(scaleNote(0, -1) + 36); // low root
        const fifth = midiToFreq(scaleNote(4, -1) + 36);

        [root, fifth, root * 2].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = i === 0 ? 'sine' : 'triangle';
            osc.frequency.value = freq;
            // slow detune wobble
            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.value = 0.1 + i * 0.07;
            lfoGain.gain.value = 3 + i * 2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.detune);
            lfo.start();

            gain.gain.value = (i === 0 ? 0.06 : 0.03);
            osc.connect(gain);
            gain.connect(filterNode);
            osc.start();

            drone.oscs.push(osc, lfo);
            drone.gains.push(gain);
        });
    }

    updateDrone();
    drone.interval = setInterval(() => {
        if (gameOver || !drone.active) return;
        updateDrone();
    }, 8000);
    drone.stop = () => {
        drone.active = false;
        clearInterval(drone.interval);
        drone.oscs.forEach(o => { try { o.stop(); } catch(e){} });
    };
    return drone;
}

// --- LAYER 2: Ethereal pad chords ---
function startPads() {
    if (!audioCtx) return;
    const pad = { active: true, timeout: null };

    function playPad() {
        if (!pad.active || !audioCtx || gameOver) return;

        const t = audioCtx.currentTime;
        const dur = 4 + Math.random() * 4;
        const rootMidi = scaleNote(0, 0) + 48;
        // pick 3-4 notes from scale
        const degrees = [0];
        const pool = [1, 2, 3, 4, 5, 6];
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
            const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
            degrees.push(pick);
        }

        degrees.forEach((deg, i) => {
            const freq = midiToFreq(scaleNote(deg, 0) + 48);
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const pan = audioCtx.createStereoPanner();
            pan.pan.value = (Math.random() - 0.5) * 1.4;

            osc.type = ['sine', 'triangle'][Math.floor(Math.random() * 2)];
            osc.frequency.value = freq;
            osc.detune.value = (Math.random() - 0.5) * 12;

            // slow attack, slow release
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.015, t + dur * 0.4);
            gain.gain.linearRampToValueAtTime(0.02, t + dur * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc.connect(gain);
            gain.connect(pan);
            pan.connect(filterNode);
            osc.start(t + i * 0.1);
            osc.stop(t + dur + 0.1);
        });

        const next = dur * 0.7 + Math.random() * 2;
        pad.timeout = setTimeout(playPad, next * 1000);
    }

    playPad();
    pad.stop = () => { pad.active = false; clearTimeout(pad.timeout); };
    return pad;
}

// --- LAYER 3: Generative melody ---
function startMelody() {
    if (!audioCtx) return;
    const mel = { active: true, timeout: null, degree: 0 };

    function playNote() {
        if (!mel.active || !audioCtx || gameOver) return;

        const t = audioCtx.currentTime;
        // random walk on scale
        mel.degree += Math.floor(Math.random() * 5) - 2;
        mel.degree = Math.max(-3, Math.min(8, mel.degree));

        const freq = midiToFreq(scaleNote(mel.degree, 1) + 48);
        const dur = [0.2, 0.3, 0.4, 0.6, 0.8, 1.2][Math.floor(Math.random() * 6)];

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const pan = audioCtx.createStereoPanner();
        pan.pan.value = (Math.random() - 0.5) * 1.0;

        osc.type = ['sine', 'triangle', 'sine'][Math.floor(Math.random() * 3)];
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 8;

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.03, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(pan);
        pan.connect(filterNode);
        osc.start(t);
        osc.stop(t + dur + 0.1);

        // sometimes add harmonics
        if (Math.random() > 0.6) {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.value = freq * (Math.random() > 0.5 ? 2 : 1.5);
            gain2.gain.setValueAtTime(0, t);
            gain2.gain.linearRampToValueAtTime(0.015, t + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
            osc2.connect(gain2);
            gain2.connect(pan);
            osc2.start(t);
            osc2.stop(t + dur);
        }

        // rhythm: sometimes rest, sometimes quick
        const spacing = Math.random() > 0.2
            ? dur + 0.1 + Math.random() * 0.8
            : 1.5 + Math.random() * 2; // longer pause
        mel.timeout = setTimeout(playNote, spacing * 1000);
    }

    // start after a brief delay
    mel.timeout = setTimeout(playNote, 1500);
    mel.stop = () => { mel.active = false; clearTimeout(mel.timeout); };
    return mel;
}

// --- LAYER 4: Rhythmic pulses / percussion ---
function startRhythm() {
    if (!audioCtx) return;
    const rhy = { active: true, timeout: null, step: 0 };

    function pulse() {
        if (!rhy.active || !audioCtx || gameOver) return;

        const t = audioCtx.currentTime;
        rhy.step++;

        // deep kick-like thud
        if (rhy.step % 4 === 0) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
            osc.connect(gain);
            gain.connect(filterNode);
            osc.start(t);
            osc.stop(t + 0.5);
        }

        // hi noise tick
        if (rhy.step % 2 === 0 || Math.random() > 0.6) {
            const bufLen = audioCtx.sampleRate * 0.04;
            const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            const gain = audioCtx.createGain();
            const filt = audioCtx.createBiquadFilter();
            filt.type = 'bandpass';
            filt.frequency.value = 4000 + Math.random() * 6000;
            filt.Q.value = 5;
            gain.gain.value = 0.02 + Math.random() * 0.02;
            const pan = audioCtx.createStereoPanner();
            pan.pan.value = (Math.random() - 0.5) * 1.6;
            src.connect(filt);
            filt.connect(gain);
            gain.connect(pan);
            pan.connect(filterNode);
            src.start(t);
        }

        // metallic ping on odd beats
        if (Math.random() > 0.75) {
            const freq = midiToFreq(scaleNote(Math.floor(Math.random() * 5), 2) + 48);
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.02, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain);
            gain.connect(filterNode);
            osc.start(t);
            osc.stop(t + 0.2);
        }

        // tempo scales with level
        const baseInterval = Math.max(120, 400 - (level - 1) * 30);
        const swing = Math.random() * 60 - 30;
        rhy.timeout = setTimeout(pulse, baseInterval + swing);
    }

    pulse();
    rhy.stop = () => { rhy.active = false; clearTimeout(rhy.timeout); };
    return rhy;
}

// --- LAYER 5: Ambient textures (wind, shimmer) ---
function startTextures() {
    if (!audioCtx) return;
    const tex = { active: true, timeout: null };

    function shimmer() {
        if (!tex.active || !audioCtx || gameOver) return;
        const t = audioCtx.currentTime;
        const dur = 3 + Math.random() * 5;

        // filtered noise wash
        const bufLen = audioCtx.sampleRate * dur;
        const buf = audioCtx.createBuffer(2, bufLen, audioCtx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buf.getChannelData(ch);
            for (let i = 0; i < bufLen; i++) {
                const env = Math.sin(Math.PI * i / bufLen);
                data[i] = (Math.random() * 2 - 1) * env * 0.3;
            }
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        const filt = audioCtx.createBiquadFilter();
        filt.type = 'bandpass';
        const centerFreq = midiToFreq(scaleNote(Math.floor(Math.random() * 5), 2) + 48);
        filt.frequency.value = centerFreq;
        filt.Q.value = 15 + Math.random() * 20;
        // modulate filter
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 0.2 + Math.random() * 0.5;
        lfoGain.gain.value = centerFreq * 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(filt.frequency);
        lfo.start(t);
        lfo.stop(t + dur);

        const gain = audioCtx.createGain();
        gain.gain.value = 0.012;

        src.connect(filt);
        filt.connect(gain);
        gain.connect(filterNode);
        src.start(t);

        tex.timeout = setTimeout(shimmer, (dur * 0.6 + Math.random() * 3) * 1000);
    }

    shimmer();
    tex.stop = () => { tex.active = false; clearTimeout(tex.timeout); };
    return tex;
}

// --- MASTER FILTER BREATHING ---
let filterBreathInterval;
function startFilterBreathing() {
    filterBreathInterval = setInterval(() => {
        if (!audioCtx || !filterNode || gameOver) return;
        const t = audioCtx.currentTime;
        const target = 1500 + Math.sin(t * 0.3) * 1000 + level * 100;
        filterNode.frequency.linearRampToValueAtTime(target, t + 0.5);
        filterNode.Q.linearRampToValueAtTime(1 + Math.sin(t * 0.2) * 1.5, t + 0.5);
    }, 500);
}

function startMusic() {
    if (musicPlaying) stopMusic();
    musicPlaying = true;
    musicLayers = [
        startDrone(),
        startPads(),
        startMelody(),
        startRhythm(),
        startTextures(),
    ];
    startFilterBreathing();
    // delay modulation based on level
    if (delayNode) {
        const t = audioCtx.currentTime;
        delayNode.delayTime.linearRampToValueAtTime(
            0.3 + (level % 4) * 0.08, t + 1
        );
    }
}

function stopMusic() {
    musicPlaying = false;
    musicLayers.forEach(layer => { if (layer && layer.stop) layer.stop(); });
    musicLayers = [];
    clearInterval(filterBreathInterval);
}

function pauseMusic() {
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
}

function resumeMusic() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

// === SFX (routed through effects chain) ===
function sndMove() {
    playTone(220 + Math.random() * 80, 0.06, 'sine', 0.05, 0, true);
}

function sndRotate() {
    playTone(440, 0.08, 'triangle', 0.06, 0, true);
    playTone(660, 0.08, 'triangle', 0.04, 0, true);
}

function sndDrop() {
    playTone(80, 0.3, 'sawtooth', 0.1, 0, true);
    playTone(60, 0.4, 'sine', 0.08, 0, true);
}

function sndLand() {
    playTone(100 + Math.random() * 40, 0.15, 'square', 0.04, 0, true);
}

function sndLineClear(count) {
    const scale = getScale();
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const freq = midiToFreq(scaleNote(i * 2, 1) + 48);
            playTone(freq, 0.6, 'triangle', 0.08, 0, true);
            playTone(freq * 1.5, 0.5, 'sine', 0.04, 5, true);
        }, i * 120);
    }
    // dimension sweep
    setTimeout(() => {
        const sweep = midiToFreq(scaleNote(7, 2) + 48);
        playTone(sweep, 1.2, 'sine', 0.05, 0, true);
    }, count * 100);
}

function sndGameOver() {
    stopMusic();
    [200, 160, 120, 80, 60].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.8, 'sawtooth', 0.08 - i * 0.012, 0, true), i * 200);
    });
    setTimeout(() => playChord([55, 82.5, 110], 2.5, 'triangle', 0.06, true), 800);
}

function sndAmbientPulse() {
    // replaced by continuous music system
}

// ═══════════════════════════
// BACKGROUND - THE VOID
// ═══════════════════════════
let bgTriangles = [];
function generateBgTriangles() {
    bgTriangles = [];
    const w = bgCanvas.width;
    const h = bgCanvas.height;
    // create a mesh of wandering triangles
    const gridSize = 80;
    const cols = Math.ceil(w / gridSize) + 2;
    const rows = Math.ceil(h / gridSize) + 2;
    const points = [];
    for (let r = 0; r < rows; r++) {
        points[r] = [];
        for (let c = 0; c < cols; c++) {
            points[r][c] = {
                x: c * gridSize - gridSize + (Math.random() - 0.5) * 40,
                y: r * gridSize - gridSize + (Math.random() - 0.5) * 40,
                ox: 0, oy: 0,
                phase: Math.random() * Math.PI * 2,
                speed: 0.3 + Math.random() * 0.7,
                amp: 10 + Math.random() * 25,
            };
        }
    }
    // create triangles from point grid
    for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
            bgTriangles.push([points[r][c], points[r][c + 1], points[r + 1][c]]);
            bgTriangles.push([points[r][c + 1], points[r + 1][c + 1], points[r + 1][c]]);
        }
    }
}
generateBgTriangles();
window.addEventListener('resize', generateBgTriangles);

function drawBackground(time) {
    bgCtx.fillStyle = 'rgba(0,0,0,0.15)';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    const t = time * 0.001;

    bgTriangles.forEach((tri, i) => {
        // animate points
        const pts = tri.map(p => ({
            x: p.x + Math.sin(t * p.speed + p.phase) * p.amp,
            y: p.y + Math.cos(t * p.speed * 0.7 + p.phase) * p.amp * 0.6,
        }));

        const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
        const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
        const dist = Math.sqrt((cx - bgCanvas.width / 2) ** 2 + (cy - bgCanvas.height / 2) ** 2);
        const maxDist = Math.sqrt(bgCanvas.width ** 2 + bgCanvas.height ** 2) / 2;
        const normDist = dist / maxDist;

        const hue = (i * 7 + t * 20 + normDist * 120) % 360;
        const pulse = Math.sin(t * 0.5 + i * 0.1) * 0.5 + 0.5;
        const alpha = (0.02 + pulse * 0.04) * (1 - normDist * 0.5);

        bgCtx.beginPath();
        bgCtx.moveTo(pts[0].x, pts[0].y);
        bgCtx.lineTo(pts[1].x, pts[1].y);
        bgCtx.lineTo(pts[2].x, pts[2].y);
        bgCtx.closePath();

        bgCtx.fillStyle = `hsla(${hue}, 70%, 50%, ${alpha})`;
        bgCtx.fill();
        bgCtx.strokeStyle = `hsla(${hue}, 80%, 60%, ${alpha * 1.5})`;
        bgCtx.lineWidth = 0.5;
        bgCtx.stroke();
    });

    // central glow
    const grd = bgCtx.createRadialGradient(
        bgCanvas.width / 2, bgCanvas.height / 2, 0,
        bgCanvas.width / 2, bgCanvas.height / 2, 400
    );
    const glowHue = (t * 30) % 360;
    grd.addColorStop(0, `hsla(${glowHue}, 100%, 50%, ${0.03 + Math.sin(t) * 0.02})`);
    grd.addColorStop(1, 'transparent');
    bgCtx.fillStyle = grd;
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
}

// ═══════════════════════════
// GAME LOGIC
// ═══════════════════════════
function createBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomType() {
    return Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
}

function createPiece(type) {
    const shape = SHAPES[type].map(row => [...row]);
    return { shape, type, x: Math.floor((COLS - shape[0].length) / 2), y: -1 };
}

function rotate(shape) {
    const rows = shape.length, cols = shape[0].length;
    const rotated = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            rotated[c][rows - 1 - r] = shape[r][c];
    return rotated;
}

function collides(board, piece, dx, dy, newShape) {
    const shape = newShape || piece.shape;
    for (let r = 0; r < shape.length; r++)
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const nx = piece.x + c + dx;
            const ny = piece.y + r + dy;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && board[ny][nx]) return true;
        }
    return false;
}

function merge(board, piece) {
    piece.shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val) {
                const y = piece.y + r;
                const x = piece.x + c;
                if (y >= 0) board[y][x] = val;
            }
        });
    });
    spawnLandingParticles(piece);
    sndLand();
}

// ═══════════════════════════
// PARTICLE MADNESS
// ═══════════════════════════
function spawnLandingParticles(p) {
    const bs = getBLOCK();
    p.shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (!val) return;
            const px = (p.x + c) * bs + bs / 2;
            const py = (p.y + r) * bs + bs / 2;
            const hue = getHue(val);
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: px, y: py,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: 40 + Math.random() * 30,
                    hue, size: 1.5 + Math.random() * 4,
                    type: Math.random() > 0.5 ? 'tri' : 'dot',
                    rot: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.3,
                });
            }
        });
    });
}

function spawnLineClearParticles(row) {
    const bs = getBLOCK();
    for (let c = 0; c < COLS; c++) {
        const val = board[row][c];
        const hue = val ? getHue(val) : Math.random() * 360;
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 10;
            particles.push({
                x: c * bs + bs / 2,
                y: row * bs + bs / 2,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 3,
                life: 50 + Math.random() * 40,
                hue, size: 2 + Math.random() * 5,
                type: ['tri', 'dot', 'ring'][Math.floor(Math.random() * 3)],
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.4,
            });
        }
    }
}

function spawnDimensionRipple() {
    const cv = getCanvas();
    const cx = cv.width / 2, cy = cv.height / 2;
    for (let i = 0; i < 30; i++) {
        const angle = (i / 30) * Math.PI * 2;
        particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * 8,
            vy: Math.sin(angle) * 8,
            life: 60,
            hue: (i * 12) % 360,
            size: 3,
            type: 'ring',
            rot: 0, rotSpeed: 0.2,
        });
    }
}

function updateParticles(cx, bs) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.98;
        p.life--;
        p.size *= 0.975;
        p.rot += p.rotSpeed;
        if (p.life <= 0 || p.size < 0.2) particles.splice(i, 1);
    }
}

function drawParticles(dc) {
    particles.forEach(p => {
        const alpha = Math.min(1, p.life / 25);
        dc.save();
        dc.translate(p.x, p.y);
        dc.rotate(p.rot);
        dc.globalAlpha = alpha;

        if (p.type === 'tri') {
            dc.beginPath();
            dc.moveTo(0, -p.size);
            dc.lineTo(-p.size * 0.866, p.size * 0.5);
            dc.lineTo(p.size * 0.866, p.size * 0.5);
            dc.closePath();
            dc.fillStyle = `hsl(${p.hue}, 100%, 70%)`;
            dc.shadowColor = `hsl(${p.hue}, 100%, 60%)`;
            dc.shadowBlur = 6;
            dc.fill();
        } else if (p.type === 'ring') {
            dc.beginPath();
            dc.arc(0, 0, p.size, 0, Math.PI * 2);
            dc.strokeStyle = `hsl(${p.hue}, 100%, 70%)`;
            dc.shadowColor = `hsl(${p.hue}, 100%, 60%)`;
            dc.shadowBlur = 8;
            dc.lineWidth = 1.5;
            dc.stroke();
        } else {
            dc.fillStyle = `hsl(${p.hue}, 100%, 70%)`;
            dc.shadowColor = `hsl(${p.hue}, 100%, 60%)`;
            dc.shadowBlur = 6;
            dc.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        dc.restore();
    });
    dc.globalAlpha = 1;
    dc.shadowBlur = 0;
}

// ═══════════════════════════
// ABSTRACT BLOCK RENDERING
// ═══════════════════════════
function getHue(colorIndex) {
    const base = BASE_HUES[colorIndex] || 0;
    return (base + globalTime * 0.03) % 360;
}

function drawBlock(context, x, y, colorIndex, size, isGhost) {
    const hue = getHue(colorIndex);
    const px = x * size;
    const py = y * size;
    const s = size;
    const t = globalTime * 0.002;

    if (isGhost) {
        context.save();
        context.globalAlpha = 0.12 + Math.sin(t * 3) * 0.06;
        context.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        context.shadowColor = `hsl(${hue}, 100%, 50%)`;
        context.shadowBlur = 10;
        context.lineWidth = 1;
        // draw as triangle outline
        context.beginPath();
        context.moveTo(px + s / 2, py + 2);
        context.lineTo(px + s - 2, py + s - 2);
        context.lineTo(px + 2, py + s - 2);
        context.closePath();
        context.stroke();
        context.restore();
        return;
    }

    const breatheScale = Math.sin(t + x * 0.5 + y * 0.3) * 0.03;
    const sat = 80 + Math.sin(t * 2 + colorIndex) * 20;
    const light = 45 + Math.sin(t * 1.5 + x + y) * 15;

    context.save();

    // main triangle 1 (top-left)
    context.beginPath();
    context.moveTo(px, py);
    context.lineTo(px + s, py);
    context.lineTo(px + s / 2, py + s / 2);
    context.closePath();
    context.fillStyle = `hsl(${hue}, ${sat}%, ${light + 10}%)`;
    context.fill();

    // triangle 2 (right)
    context.beginPath();
    context.moveTo(px + s, py);
    context.lineTo(px + s, py + s);
    context.lineTo(px + s / 2, py + s / 2);
    context.closePath();
    context.fillStyle = `hsl(${(hue + 15) % 360}, ${sat}%, ${light}%)`;
    context.fill();

    // triangle 3 (bottom)
    context.beginPath();
    context.moveTo(px + s, py + s);
    context.lineTo(px, py + s);
    context.lineTo(px + s / 2, py + s / 2);
    context.closePath();
    context.fillStyle = `hsl(${(hue + 30) % 360}, ${sat}%, ${light - 8}%)`;
    context.fill();

    // triangle 4 (left)
    context.beginPath();
    context.moveTo(px, py + s);
    context.lineTo(px, py);
    context.lineTo(px + s / 2, py + s / 2);
    context.closePath();
    context.fillStyle = `hsl(${(hue - 15 + 360) % 360}, ${sat}%, ${light + 5}%)`;
    context.fill();

    // center glow
    const grd = context.createRadialGradient(
        px + s / 2, py + s / 2, 0,
        px + s / 2, py + s / 2, s / 2
    );
    grd.addColorStop(0, `hsla(${hue}, 100%, 80%, ${0.2 + breatheScale * 3})`);
    grd.addColorStop(1, 'transparent');
    context.fillStyle = grd;
    context.fillRect(px, py, s, s);

    // neon edge glow
    context.shadowColor = `hsl(${hue}, 100%, 60%)`;
    context.shadowBlur = 8 + Math.sin(t * 3 + x + y) * 4;
    context.strokeStyle = `hsla(${hue}, 100%, 70%, 0.6)`;
    context.lineWidth = 0.8;
    // draw inner lines
    context.beginPath();
    context.moveTo(px, py); context.lineTo(px + s / 2, py + s / 2);
    context.moveTo(px + s, py); context.lineTo(px + s / 2, py + s / 2);
    context.moveTo(px + s, py + s); context.lineTo(px + s / 2, py + s / 2);
    context.moveTo(px, py + s); context.lineTo(px + s / 2, py + s / 2);
    context.stroke();

    // outer border
    context.shadowBlur = 12;
    context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
    context.shadowBlur = 0;

    context.restore();
}

// ═══════════════════════════
// GHOST + MAIN DRAW
// ═══════════════════════════
function drawGhost() {
    let ghostY = 0;
    while (!collides(board, piece, 0, ghostY + 1)) ghostY++;
    if (ghostY === 0) return;
    const cx = getCtx(), bs = getBLOCK();
    piece.shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val) drawBlock(cx, piece.x + c, piece.y + r + ghostY, val, bs, true);
        });
    });
}

function draw(time) {
    globalTime = time;
    breathe = Math.sin(time * 0.001) * 0.5 + 0.5;

    const cx = getCtx();
    const cv = getCanvas();
    const bs = getBLOCK();

    let shakeX = 0, shakeY = 0;
    if (screenShake > 0) {
        shakeX = (Math.random() - 0.5) * screenShake;
        shakeY = (Math.random() - 0.5) * screenShake;
        screenShake *= 0.82;
        if (screenShake < 0.5) screenShake = 0;
    }

    cx.save();
    cx.translate(shakeX, shakeY);
    cx.clearRect(-20, -20, cv.width + 40, cv.height + 40);

    // warped grid - breathes and shifts
    const t = time * 0.001;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const dist = Math.sqrt((c - 5) ** 2 + (r - 10) ** 2);
            const wave = Math.sin(t * 1.5 + dist * 0.4) * 0.5 + 0.5;
            const hue = (t * 25 + dist * 20 + c * 10 + r * 10) % 360;
            const warpX = Math.sin(t + r * 0.3) * wave * 1.5;
            const warpY = Math.cos(t * 0.7 + c * 0.3) * wave * 1.5;

            cx.strokeStyle = `hsla(${hue}, 60%, 40%, ${0.03 + wave * 0.04})`;
            cx.lineWidth = 0.5;

            const x = c * bs + warpX;
            const y = r * bs + warpY;
            cx.beginPath();
            cx.moveTo(x, y);
            cx.lineTo(x + bs, y);
            cx.lineTo(x, y + bs);
            cx.closePath();
            cx.stroke();
            cx.beginPath();
            cx.moveTo(x + bs, y);
            cx.lineTo(x + bs, y + bs);
            cx.lineTo(x, y + bs);
            cx.closePath();
            cx.stroke();
        }
    }

    // trail/afterimage from trailBoard
    if (trailBoard) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (trailBoard[r][c] > 0) {
                    cx.globalAlpha = trailBoard[r][c] * 0.3;
                    const hue = (t * 30 + c * 20 + r * 20) % 360;
                    cx.fillStyle = `hsl(${hue}, 80%, 40%)`;
                    cx.fillRect(c * bs, r * bs, bs, bs);
                    trailBoard[r][c] -= 0.015;
                    if (trailBoard[r][c] < 0) trailBoard[r][c] = 0;
                }
                cx.globalAlpha = 1;
            }
        }
    }

    // board blocks
    board.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val) drawBlock(cx, c, r, val, bs, false);
        });
    });

    // current piece
    if (piece) {
        drawGhost();
        piece.shape.forEach((row, r) => {
            row.forEach((val, c) => {
                if (val && piece.y + r >= 0)
                    drawBlock(cx, piece.x + c, piece.y + r, val, bs, false);
            });
        });
    }

    updateParticles(cx, bs);
    drawParticles(cx);

    // vignette
    const vgrd = cx.createRadialGradient(
        cv.width / 2, cv.height / 2, cv.height * 0.3,
        cv.width / 2, cv.height / 2, cv.height * 0.7
    );
    vgrd.addColorStop(0, 'transparent');
    vgrd.addColorStop(1, `rgba(0,0,0,${0.4 + breathe * 0.15})`);
    cx.fillStyle = vgrd;
    cx.fillRect(0, 0, cv.width, cv.height);

    cx.restore();
}

function drawNextTo(targetCtx, targetCanvas, blockSize) {
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    if (!nextPiece) return;
    const shape = nextPiece.shape;
    const size = blockSize;
    const offsetX = (targetCanvas.width - shape[0].length * size) / 2;
    const offsetY = (targetCanvas.height - shape.length * size) / 2;

    targetCtx.save();
    targetCtx.translate(targetCanvas.width / 2, targetCanvas.height / 2);
    targetCtx.rotate(Math.sin(globalTime * 0.001) * 0.08);
    targetCtx.translate(-targetCanvas.width / 2, -targetCanvas.height / 2);

    shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (!val) return;
            const hue = getHue(val);
            const px = offsetX + c * size;
            const py = offsetY + r * size;
            const cx = px + size / 2, cy = py + size / 2;
            [[px,py,px+size,py],[px+size,py,px+size,py+size],[px+size,py+size,px,py+size],[px,py+size,px,py]].forEach(([x1,y1,x2,y2], i) => {
                targetCtx.beginPath();
                targetCtx.moveTo(x1,y1);
                targetCtx.lineTo(x2,y2);
                targetCtx.lineTo(cx,cy);
                targetCtx.closePath();
                targetCtx.fillStyle = `hsl(${(hue + i*15)%360}, 80%, ${45 + i*5}%)`;
                targetCtx.fill();
            });
            targetCtx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            targetCtx.shadowBlur = 8;
            targetCtx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.5)`;
            targetCtx.lineWidth = 0.8;
            targetCtx.strokeRect(px, py, size, size);
            targetCtx.shadowBlur = 0;
        });
    });
    targetCtx.restore();
}

function drawNext() {
    drawNextTo(nextCtx, nextCanvas, 26);
    drawNextTo(nextCtxM, nextCanvasM, 20);
}

// ═══════════════════════════
// GAME ACTIONS
// ═══════════════════════════
function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
            spawnLineClearParticles(r);
            // leave trail
            for (let c = 0; c < COLS; c++) trailBoard[r][c] = 1;
            board.splice(r, 1);
            board.unshift(new Array(COLS).fill(0));
            cleared++;
            r++;
        }
    }
    if (cleared > 0) {
        combo++;
        const points = [0, 100, 300, 500, 800];
        let base = (points[Math.min(cleared, 4)] || cleared * 200) * level;
        // combo bonus: 50 * combo * level for chains ≥ 2
        if (combo >= 2) base += 50 * combo * level;
        score += base;
        lines += cleared;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(80, 1000 - (level - 1) * 75);
        setScore(score);
        setLevel(level);
        setLines(lines);
        screenShake = cleared * 8;
        getCanvas().parentElement.classList.add('line-clear-flash');
        setTimeout(() => getCanvas().parentElement.classList.remove('line-clear-flash'), 400);
        sndLineClear(cleared);

        // when level changes, restart music with new scale
        if (Math.floor((lines - cleared) / 10) + 1 !== level) {
            startMusic();
        }

        if (cleared >= 3) {
            spawnDimensionRipple();
        }
    } else {
        combo = 0;
    }
}

function drop() {
    if (collides(board, piece, 0, 1)) {
        merge(board, piece);
        clearLines();
        piece = createPiece(nextPiece.type);
        nextPiece = createPiece(randomType());
        drawNext();
        if (collides(board, piece, 0, 0)) {
            gameOver = true;
            overlay.classList.remove('hidden');
            overlayM.classList.remove('hidden');
            overlayText.textContent = 'THE VOID CONSUMES';
            overlayTextM.textContent = 'THE VOID CONSUMES';
            startBtn.textContent = 'REAWAKEN';
            startBtnM.textContent = 'REAWAKEN';
            screenShake = 25;
            getCanvas().parentElement.classList.add('shake');
            setTimeout(() => getCanvas().parentElement.classList.remove('shake'), 600);
            sndGameOver();
            showGameOverUI();
        }
    } else {
        piece.y++;
    }
}

function hardDrop() {
    let dropped = 0;
    while (!collides(board, piece, 0, 1)) {
        piece.y++;
        score += 2;
        dropped++;
    }
    setScore(score);
    screenShake = Math.min(dropped * 0.8, 12);
    sndDrop();
    drop();
}

function moveLeft() {
    if (!collides(board, piece, -1, 0)) { piece.x--; sndMove(); }
}
function moveRight() {
    if (!collides(board, piece, 1, 0)) { piece.x++; sndMove(); }
}
function rotatePiece() {
    const newShape = rotate(piece.shape);
    for (const kick of [0, -1, 1, -2, 2]) {
        if (!collides(board, piece, kick, 0, newShape)) {
            piece.shape = newShape;
            piece.x += kick;
            sndRotate();
            return;
        }
    }
}

// ═══════════════════════════
// GAME LOOP
// ═══════════════════════════
function update(time) {
    drawBackground(time);

    if (gameOver || paused) {
        if (!gameOver) requestAnimationFrame(update);
        else { draw(time); requestAnimationFrame(update); } // keep rendering on game over for particles
        return;
    }

    if (time - lastDrop > dropInterval) {
        drop();
        lastDrop = time;
    }

    // update delay time with level for evolving sound
    if (delayNode && Math.floor(time) % 5000 < 20) {
        delayNode.delayTime.linearRampToValueAtTime(
            0.25 + Math.sin(time * 0.0001) * 0.15 + (level % 4) * 0.06,
            audioCtx.currentTime + 1
        );
    }

    draw(time);
    drawNext();
    requestAnimationFrame(update);
}

// keep bg animating even before game start
function idleLoop(time) {
    drawBackground(time);
    if (!gameOver && paused) requestAnimationFrame(idleLoop);
}

// ═══════════════════════════
// HIGHSCORE & GAME OVER UI
// ═══════════════════════════
const API_BASE = '/api';
const gameoverForm = document.getElementById('gameoverForm');
const gameoverFormM = document.getElementById('gameoverFormMobile');
const inputName = document.getElementById('inputName');
const inputEmail = document.getElementById('inputEmail');
const inputNameM = document.getElementById('inputNameMobile');
const inputEmailM = document.getElementById('inputEmailMobile');
const formMsg = document.getElementById('formMsg');
const formMsgM = document.getElementById('formMsgMobile');
const submitBtn = document.getElementById('submitScoreBtn');
const submitBtnM = document.getElementById('submitScoreBtnMobile');
const skipBtnEl = document.getElementById('skipBtn');
const skipBtnMEl = document.getElementById('skipBtnMobile');
const highscoreList = document.getElementById('highscoreList');
const highscoreListM = document.getElementById('highscoreListMobile');

function showGameOverUI() {
    gameoverForm.classList.remove('hidden');
    gameoverFormM.classList.remove('hidden');
    formMsg.textContent = '';
    formMsgM.textContent = '';
    inputName.value = '';
    inputEmail.value = '';
    inputNameM.value = '';
    inputEmailM.value = '';
    fetchHighscores();
}

function hideGameOverUI() {
    gameoverForm.classList.add('hidden');
    gameoverFormM.classList.add('hidden');
}

async function submitScore(name, email) {
    const cleanName = name.trim();
    if (!cleanName) {
        formMsg.textContent = 'NAME REQUIRED';
        formMsgM.textContent = 'NAME REQUIRED';
        return;
    }
    const body = { username: cleanName, score, level, lines };
    if (email && email.trim()) body.email = email.trim();

    try {
        const res = await fetch(`${API_BASE}/scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Server error');
        formMsg.textContent = 'TRANSMITTED';
        formMsgM.textContent = 'TRANSMITTED';
        gameoverForm.querySelectorAll('input, .submit-btn').forEach(el => el.style.display = 'none');
        gameoverFormM.querySelectorAll('input, .submit-btn').forEach(el => el.style.display = 'none');
        fetchHighscores();
    } catch {
        formMsg.textContent = 'TRANSMISSION FAILED';
        formMsgM.textContent = 'TRANSMISSION FAILED';
    }
}

let currentPeriod = 'all';

async function fetchHighscores(period) {
    if (period) currentPeriod = period;
    // update tab active states
    document.querySelectorAll('.hs-tab').forEach(t => t.classList.toggle('active', t.dataset.period === currentPeriod));
    try {
        const res = await fetch(`${API_BASE}/scores?period=${currentPeriod}`);
        if (!res.ok) return;
        const data = await res.json();
        renderHighscores(data);
    } catch { /* silently fail */ }
}

function renderHighscores(data) {
    const html = data.map((row, i) =>
        `<li><span class="rank">${i + 1}.</span><span class="name">${escapeHtml(row.username)}</span><span class="hs-score">${row.score}</span></li>`
    ).join('');
    highscoreList.innerHTML = html;
    highscoreListM.innerHTML = html;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// wire up form buttons (desktop)
submitBtn.addEventListener('click', () => submitScore(inputName.value, inputEmail.value));
skipBtnEl.addEventListener('click', hideGameOverUI);
// wire up form buttons (mobile)
submitBtnM.addEventListener('click', () => submitScore(inputNameM.value, inputEmailM.value));
skipBtnMEl.addEventListener('click', hideGameOverUI);

// highscore tab clicks
document.querySelectorAll('.hs-tab').forEach(tab => {
    tab.addEventListener('click', () => fetchHighscores(tab.dataset.period));
});

// load highscores on page load
fetchHighscores('all');

function startGame() {
    if (countingDown) return;
    hideGameOverUI();
    // reset form inputs visibility
    [gameoverForm, gameoverFormM].forEach(f => f.querySelectorAll('input, .submit-btn').forEach(el => el.style.display = ''));
    initAudio();
    board = createBoard();
    trailBoard = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
    score = 0; lines = 0; level = 1; combo = 0;
    dropInterval = 1000;
    gameOver = false;
    paused = true; // paused during countdown
    particles = [];
    screenShake = 0;
    setScore('0');
    setLevel('1');
    setLines('0');
    piece = createPiece(randomType());
    nextPiece = createPiece(randomType());
    drawNext();

    // countdown 3-2-1
    countingDown = true;
    startBtn.style.display = 'none';
    startBtnM.style.display = 'none';
    overlayText.style.animation = 'none';
    overlayTextM.style.animation = 'none';
    overlayText.style.opacity = '1';
    overlayTextM.style.opacity = '1';
    overlayText.style.fontSize = '3rem';
    overlayTextM.style.fontSize = '2rem';

    const steps = ['3', '2', '1', 'GO'];
    let step = 0;
    overlayText.textContent = steps[0];
    overlayTextM.textContent = steps[0];
    playTone(330, 0.15, 'triangle', 0.08);

    const cdInterval = setInterval(() => {
        step++;
        if (step < steps.length) {
            overlayText.textContent = steps[step];
            overlayTextM.textContent = steps[step];
            playTone(step === 3 ? 660 : 330, 0.15, 'triangle', 0.08);
        }
        if (step >= steps.length) {
            clearInterval(cdInterval);
            overlay.classList.add('hidden');
            overlayM.classList.add('hidden');
            // restore overlay styles
            overlayText.style.animation = '';
            overlayTextM.style.animation = '';
            overlayText.style.opacity = '';
            overlayTextM.style.opacity = '';
            overlayText.style.fontSize = '';
            overlayTextM.style.fontSize = '';
            startBtn.style.display = '';
            startBtnM.style.display = '';
            paused = false;
            countingDown = false;
            lastDrop = performance.now();
            startMusic();
            requestAnimationFrame(update);
        }
    }, 700);

    requestAnimationFrame(update);
}

document.addEventListener('keydown', e => {
    if (gameOver && e.key !== 'Enter') return;
    switch (e.key) {
        case 'ArrowLeft': moveLeft(); break;
        case 'ArrowRight': moveRight(); break;
        case 'ArrowDown': drop(); score += 1; setScore(score); break;
        case 'ArrowUp': rotatePiece(); break;
        case ' ': hardDrop(); break;
        case 'p': case 'P':
            paused = !paused;
            if (!paused) {
                lastDrop = performance.now();
                resumeMusic();
                requestAnimationFrame(update);
            } else {
                pauseMusic();
                requestAnimationFrame(idleLoop);
            }
            break;
        case 'Enter': if (gameOver) startGame(); break;
    }
    if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(e.key)) e.preventDefault();
});

startBtn.addEventListener('click', startGame);
startBtnM.addEventListener('click', startGame);

// ═══════════════════════════════════════════
// TOUCH CONTROLS + SWIPE GESTURES
// ═══════════════════════════════════════════

// --- Button touch controls ---
document.querySelectorAll('.touch-btn').forEach(btn => {
    const action = btn.dataset.action;
    let holdInterval = null;

    function doAction() {
        if (gameOver || paused || !piece) return;
        switch (action) {
            case 'left': moveLeft(); break;
            case 'right': moveRight(); break;
            case 'down': drop(); score += 1; setScore(score); break;
            case 'rotate': rotatePiece(); break;
            case 'hardDrop': hardDrop(); break;
        }
    }

    function startHold() {
        doAction();
        // repeat for left/right/down on hold
        if (['left', 'right', 'down'].includes(action)) {
            holdInterval = setInterval(doAction, 80);
        }
        btn.classList.add('active');
    }

    function stopHold() {
        clearInterval(holdInterval);
        holdInterval = null;
        btn.classList.remove('active');
    }

    btn.addEventListener('touchstart', e => { e.preventDefault(); startHold(); });
    btn.addEventListener('touchend', e => { e.preventDefault(); stopHold(); });
    btn.addEventListener('touchcancel', stopHold);
    // mouse fallback for testing
    btn.addEventListener('mousedown', e => { e.preventDefault(); startHold(); });
    btn.addEventListener('mouseup', stopHold);
    btn.addEventListener('mouseleave', stopHold);
});

// --- Swipe gestures on the mobile game board ---
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;
let swipeHandled = false;

canvasM.addEventListener('touchstart', e => {
    if (gameOver || paused) return;
    e.preventDefault();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    swipeHandled = false;
}, { passive: false });

canvasM.addEventListener('touchmove', e => {
    if (gameOver || paused || swipeHandled) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const threshold = BLOCK_M * 1.2;

    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) moveRight(); else moveLeft();
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    } else if (dy > threshold && Math.abs(dy) > Math.abs(dx)) {
        drop();
        score += 1;
        setScore(score);
        touchStartY = touch.clientY;
    }
}, { passive: false });

canvasM.addEventListener('touchend', e => {
    if (gameOver || paused) return;
    const dt = Date.now() - touchStartTime;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // quick tap = rotate
    if (dt < 200 && dist < 15) {
        rotatePiece();
    }
    // fast swipe down = hard drop
    else if (dy > 60 && dt < 300 && Math.abs(dy) > Math.abs(dx) * 2) {
        hardDrop();
    }
});

// prevent zoom/scroll on mobile only
if ('ontouchstart' in window) {
    document.addEventListener('touchmove', e => {
        if (e.target.closest('.overlay')) return;
        e.preventDefault();
    }, { passive: false });
}

// start background animation immediately
requestAnimationFrame(function bgLoop(t) {
    drawBackground(t);
    requestAnimationFrame(bgLoop);
});
