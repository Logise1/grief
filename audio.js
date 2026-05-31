// procedural and file-based cinematic sound engine
const AudioEngine = {
  ctx: null,
  masterVolume: null,
  activeNodes: [],
  currentStage: -1,
  
  // Audio Buffers Cache
  buffers: {},
  
  // List of files to load
  sfxFiles: {
    jump: 'sfx/jump.wav',
    land: 'sfx/land.wav',
    dash: 'sfx/dash.wav',
    rewind: 'sfx/rewind.wav',
    death: 'sfx/death.wav',
    transition: 'sfx/transition.wav',
    text_beep: 'sfx/text_beep.wav',
    break_wall: 'sfx/break_wall.wav',
    thunder: 'sfx/thunder.wav',
    change: 'sfx/change.wav'
  },
  
  // Synth states
  sequenceInterval: null,
  rainNode: null,
  clockNode: null,
  droneOscillators: [],
  delayNode: null, // Reverb send node
  reverbNode: null, // Convolver reverb node

  init() {
    if (this.ctx) return;
    
    // Create audio context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master volume node
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.gain.setValueAtTime(0.82, this.ctx.currentTime);
    this.masterVolume.connect(this.ctx.destination);

    // Setup a global reverb send node (aliased as delayNode for compatibility)
    this.delayNode = this.ctx.createGain();
    this.delayNode.gain.setValueAtTime(0.35, this.ctx.currentTime);
    
    // Create Convolver Reverb node
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createReverbImpulseResponse(2.5, 2.5);
    
    // Route: send -> convolver -> master volume
    this.delayNode.connect(this.reverbNode);
    this.reverbNode.connect(this.masterVolume);

    // Preload SFX files (will fall back to synth if not found)
    this.preloadSFX();
  },

  createReverbImpulseResponse(duration, decay) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
      const percent = i / length;
      const env = Math.pow(1.0 - percent, decay);
      left[i] = (Math.random() * 2.0 - 1.0) * env;
      right[i] = (Math.random() * 2.0 - 1.0) * env;
    }
    return impulse;
  },

  preloadSFX() {
    for (let key in this.sfxFiles) {
      const url = this.sfxFiles[key];
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error("File not found");
          return response.arrayBuffer();
        })
        .then(arrayBuffer => this.ctx.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          this.buffers[key] = audioBuffer;
          console.log(`Preloaded SFX file: ${key}`);
        })
        .catch(err => {
          console.log(`Procedural fallback active for SFX: ${key} (file not loaded)`);
        });
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  playSFX(type) {
    if (!this.ctx) return;
    this.resume();

    // 1. FILE PLAYBACK
    if (this.buffers[type]) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffers[type];
      
      // Connect spacey sweeps to echo line
      if (type === 'transition' || type === 'rewind') {
        const delaySend = this.ctx.createGain();
        delaySend.gain.setValueAtTime(0.4, this.ctx.currentTime);
        source.connect(delaySend);
        delaySend.connect(this.delayNode);
      }
      
      source.connect(this.masterVolume);
      source.start(0);
      return;
    }

    // 2. PROCEDURAL SYNTH PLAYBACK (Fallback)
    const now = this.ctx.currentTime;
    
    switch (type) {
      case 'jump': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.15);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        
        osc.connect(gain);
        gain.connect(this.masterVolume);
        
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case 'land': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.1);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
        
        osc.connect(gain);
        gain.connect(this.masterVolume);
        
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'dash': {
        // Noise buffer for air rush
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(2500, now + 0.15);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);
        
        noise.start(now);
        noise.stop(now + 0.2);
        break;
      }
      case 'rewind': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        
        // Lowpass filter sweep
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.linearRampToValueAtTime(200, now + 0.3);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);
        
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case 'death': {
        // Low frequency noise shock
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
 
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.4);
 
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
 
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);
 
        noise.start(now);
        noise.stop(now + 0.4);
        
        // Glitch tone
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(110, now + 0.1);
        osc.frequency.setValueAtTime(55, now + 0.2);
        
        oscGain.gain.setValueAtTime(0.15, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc.connect(oscGain);
        oscGain.connect(this.masterVolume);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }
      case 'transition': {
        // Massive ambient sweep
        const nowTime = this.ctx.currentTime;
        const duration = 1.5;
        
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(220, nowTime);
        osc1.frequency.exponentialRampToValueAtTime(440, nowTime + duration);
        
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(330, nowTime);
        osc2.frequency.exponentialRampToValueAtTime(660, nowTime + duration);
        
        gain.gain.setValueAtTime(0.01, nowTime);
        gain.gain.linearRampToValueAtTime(0.2, nowTime + duration * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, nowTime + duration);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.delayNode); // Feed it to delay for massive spatial echo
        gain.connect(this.masterVolume);
        
        osc1.start(nowTime);
        osc2.start(nowTime);
        osc1.stop(nowTime + duration);
        osc2.stop(nowTime + duration);
        break;
      }
      case 'text_beep': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
        
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        osc.connect(gain);
        gain.connect(this.masterVolume);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case 'break_wall': {
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
 
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.3);
 
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
 
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterVolume);
        noise.start(now);
        noise.stop(now + 0.3);
        break;
      }
      case 'thunder': {
        const nowTime = this.ctx.currentTime;
        
        // Loud sharp electrical crack
        const crackOsc = this.ctx.createOscillator();
        const crackGain = this.ctx.createGain();
        crackOsc.type = 'sawtooth';
        crackOsc.frequency.setValueAtTime(80, nowTime);
        crackOsc.frequency.exponentialRampToValueAtTime(10, nowTime + 0.15);
        crackGain.gain.setValueAtTime(0.3, nowTime);
        crackGain.gain.exponentialRampToValueAtTime(0.001, nowTime + 0.15);
        crackOsc.connect(crackGain);
        crackGain.connect(this.masterVolume);
        crackOsc.start(nowTime);
        crackOsc.stop(nowTime + 0.15);

        // Low rolling rumble
        const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds of rumble
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const rumbleSource = this.ctx.createBufferSource();
        rumbleSource.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, nowTime);
        filter.frequency.exponentialRampToValueAtTime(30, nowTime + 2.0);

        const rumbleGain = this.ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.45, nowTime);
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, nowTime + 2.0);

        rumbleSource.connect(filter);
        filter.connect(rumbleGain);
        rumbleGain.connect(this.masterVolume);
        rumbleSource.start(nowTime);
        rumbleSource.stop(nowTime + 2.0);
        break;
      }
      case 'jumpscare_static': {
        const jNow = this.ctx.currentTime;

        // Route directly to destination, bypassing master volume attenuation
        const jDirectOut = this.ctx.createGain();
        jDirectOut.gain.setValueAtTime(1.0, jNow);
        jDirectOut.connect(this.ctx.destination);

        // 1. MASSIVE white noise burst — wall of full-spectrum static
        const jBufSize = this.ctx.sampleRate * 0.65;
        const jBuf = this.ctx.createBuffer(2, jBufSize, this.ctx.sampleRate); // stereo
        const jDataL = jBuf.getChannelData(0);
        const jDataR = jBuf.getChannelData(1);
        for (let i = 0; i < jBufSize; i++) {
          jDataL[i] = Math.random() * 2 - 1;
          jDataR[i] = Math.random() * 2 - 1;
        }
        const jNoise = this.ctx.createBufferSource();
        jNoise.buffer = jBuf;

        const jNoiseFilter = this.ctx.createBiquadFilter();
        jNoiseFilter.type = 'bandpass';
        jNoiseFilter.frequency.setValueAtTime(3200, jNow);
        jNoiseFilter.frequency.exponentialRampToValueAtTime(600, jNow + 0.5);
        jNoiseFilter.Q.setValueAtTime(0.5, jNow);

        const jNoiseGain = this.ctx.createGain();
        jNoiseGain.gain.setValueAtTime(0.0, jNow);
        jNoiseGain.gain.linearRampToValueAtTime(3.5, jNow + 0.008); // instant SLAM
        jNoiseGain.gain.exponentialRampToValueAtTime(0.001, jNow + 0.6);

        jNoise.connect(jNoiseFilter);
        jNoiseFilter.connect(jNoiseGain);
        jNoiseGain.connect(jDirectOut);
        jNoiseGain.connect(this.masterVolume); // double feed for extra volume
        jNoise.start(jNow);
        jNoise.stop(jNow + 0.65);

        // 2. Sub-bass body impact — room-shaking boom
        const jSub = this.ctx.createOscillator();
        const jSubGain = this.ctx.createGain();
        jSub.type = 'sine';
        jSub.frequency.setValueAtTime(60, jNow);
        jSub.frequency.exponentialRampToValueAtTime(15, jNow + 0.4);
        jSubGain.gain.setValueAtTime(0.0, jNow);
        jSubGain.gain.linearRampToValueAtTime(2.8, jNow + 0.008);
        jSubGain.gain.exponentialRampToValueAtTime(0.001, jNow + 0.5);
        jSub.connect(jSubGain);
        jSubGain.connect(jDirectOut);
        jSubGain.connect(this.masterVolume);
        jSub.start(jNow);
        jSub.stop(jNow + 0.5);

        // 3. Screaming pitch sweep — piercing shriek
        const jScream = this.ctx.createOscillator();
        const jScreamGain = this.ctx.createGain();
        jScream.type = 'sawtooth';
        jScream.frequency.setValueAtTime(280, jNow);
        jScream.frequency.exponentialRampToValueAtTime(2400, jNow + 0.08); // rapid shriek rise
        jScream.frequency.exponentialRampToValueAtTime(60, jNow + 0.5);

        const jScreamFilter = this.ctx.createBiquadFilter();
        jScreamFilter.type = 'bandpass';
        jScreamFilter.frequency.setValueAtTime(1200, jNow);
        jScreamFilter.Q.setValueAtTime(1.5, jNow);

        jScreamGain.gain.setValueAtTime(0.0, jNow);
        jScreamGain.gain.linearRampToValueAtTime(1.8, jNow + 0.01);
        jScreamGain.gain.exponentialRampToValueAtTime(0.001, jNow + 0.52);

        jScream.connect(jScreamFilter);
        jScreamFilter.connect(jScreamGain);
        jScreamGain.connect(jDirectOut);
        jScreamGain.connect(this.masterVolume);
        jScream.start(jNow);
        jScream.stop(jNow + 0.55);

        // 4. High-frequency piercing whine — the real screamer
        const jWhine = this.ctx.createOscillator();
        const jWhineGain = this.ctx.createGain();
        jWhine.type = 'square';
        jWhine.frequency.setValueAtTime(4200, jNow);
        jWhine.frequency.exponentialRampToValueAtTime(800, jNow + 0.4);
        jWhineGain.gain.setValueAtTime(0.0, jNow);
        jWhineGain.gain.linearRampToValueAtTime(1.2, jNow + 0.01);
        jWhineGain.gain.exponentialRampToValueAtTime(0.001, jNow + 0.45);
        jWhine.connect(jWhineGain);
        jWhineGain.connect(jDirectOut);
        jWhine.start(jNow);
        jWhine.stop(jNow + 0.5);

        break;
      }
    }
  },

  setStage(stageIndex) {
    if (!this.ctx) return;
    if (this.currentStage === stageIndex) return;
    
    this.resume();
    this.currentStage = stageIndex;
    
    // Stop previous synthesizers
    this.clearSynthesizers();
    
    const now = this.ctx.currentTime;
    
    // Dynamic Reverb adjustments per stage
    // Denial, Intro, Depression, and Bargaining get massive space washes
    const isSpacious = [0, 1, 3, 4].includes(stageIndex);
    const targetSendGain = isSpacious ? 0.75 : 0.25;
    
    this.delayNode.gain.setValueAtTime(this.delayNode.gain.value, now);
    this.delayNode.gain.linearRampToValueAtTime(targetSendGain, now + 1.0);

    // Dynamic music selection
    switch (stageIndex) {
      case 0: // Intro Prologue
        this.playIntroTheme();
        break;
      case 1: // Stage 1: Denial
        this.playDenialTheme();
        break;
      case 2: // Stage 2: Anger
        this.playAngerTheme();
        break;
      case 3: // Stage 3: Bargaining
        this.playBargainingTheme();
        break;
      case 4: // Stage 4: Depression
        this.playDepressionTheme();
        break;
      case 5: // Stage 5: Acceptance
        this.playAcceptanceTheme();
        break;
      case 6: // Stage 6: Hope
        this.playHopeTheme();
        break;
    }
  },

  clearSynthesizers() {
    // Clear loop interval
    if (this.sequenceInterval) {
      clearInterval(this.sequenceInterval);
      this.sequenceInterval = null;
    }
    
    const now = this.ctx.currentTime;

    // Fade out and disconnect drone oscillators
    this.droneOscillators.forEach(osc => {
      try {
        const gain = osc.gainNode;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0, now + 1.5);
        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch(e){}
        }, 1600);
      } catch(e){}
    });
    this.droneOscillators = [];

    // Fade out rain noise
    if (this.rainNode) {
      try {
        const gain = this.rainNode.gainNode;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0, now + 1.5);
        const node = this.rainNode;
        setTimeout(() => {
          try {
            node.stop();
            node.disconnect();
          } catch(e){}
        }, 1600);
        this.rainNode = null;
      } catch(e){}
    }

    // Fade out clock ticking
    if (this.clockNode) {
      try {
        this.clockNode.gainNode.gain.setValueAtTime(this.clockNode.gainNode.gain.value, now);
        this.clockNode.gainNode.gain.linearRampToValueAtTime(0.0, now + 1.0);
        const node = this.clockNode;
        setTimeout(() => {
          try {
            node.stop();
            node.disconnect();
          } catch(e){}
        }, 1200);
        this.clockNode = null;
      } catch(e){}
    }
  },

  // STAGE 0: INTRO - PROLOGUE (Upbeat & Animated)
  playIntroTheme() {
    const now = this.ctx.currentTime;
    
    // Warm C Major arpeggios, animated and happy
    const happyScale = [261.63, 329.63, 392.00, 523.25, 587.33, 659.25]; // C4, E4, G4, C5, D5, E5
    let index = 0;
    
    // Warm bass line
    const baseFreqs = [130.81, 196.00]; // C3, G3
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 1.0);
      osc.connect(gain);
      gain.connect(this.masterVolume);
      osc.start(now);
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    this.sequenceInterval = setInterval(() => {
      if (!this.ctx) return;
      const freq = happyScale[index % happyScale.length];
      // Rhythmic placement (every 220ms)
      if (index % 4 === 0 || index % 4 === 2 || Math.random() > 0.6) {
        this.triggerSynthPluck(freq, 0.12, 'sine', 0.45);
      }
      index++;
    }, 220);
  },

  // STAGE 0: INTRO - DARK ABYSS (Melancholic Hollow Drone)
  playVoidDarkTheme() {
    const now = this.ctx.currentTime;
    
    // Deep dark hollow drone (A minor / Void)
    const baseFreqs = [55.00, 110.00, 164.81]; // A1, A2, E3
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      // detune for a thick cold sound
      osc.detune.setValueAtTime((Math.random() - 0.5) * 12, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 2.0);
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      
      // Connect to reverb for space
      const delaySend = this.ctx.createGain();
      delaySend.gain.setValueAtTime(0.35, now);
      gain.connect(delaySend);
      delaySend.connect(this.delayNode);
      
      osc.start(now);
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    // Sparse arpeggios that sound distant and cold
    const notes = [220.00, 261.63, 329.63, 392.00];
    this.sequenceInterval = setInterval(() => {
      if (Math.random() > 0.5) {
        const note = notes[Math.floor(Math.random() * notes.length)];
        this.triggerSynthPluck(note, 0.05, 'triangle', 1.2);
      }
    }, 2000);
  },

  // Transition Glitch triggering
  triggerIntroFall() {
    if (!this.ctx) return;
    this.resume();

    // 1. Play the glitch transition SFX (sfx/change.wav)
    this.playSFX('change');

    // 2. Play sudden distorted procedural glitch crash on top
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.linearRampToValueAtTime(30, now + 0.6); 
    
    const dist = this.ctx.createWaveShaper();
    dist.curve = this.makeDistortionCurve(100);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    osc.connect(dist);
    dist.connect(gain);
    gain.connect(this.masterVolume);
    
    osc.start(now);
    osc.stop(now + 0.6);

    // 3. Clear the happy arpeggios immediately
    this.clearSynthesizers();

    // 4. Start the deep dark void theme
    this.playVoidDarkTheme();
  },

  makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  },

  // STAGE 1: DENIAL
  // Melancholic hollow drone with wind effects and sparse, echoing minor notes
  playDenialTheme() {
    const now = this.ctx.currentTime;
    
    // Wind background noise
    this.rainNode = this.createNoiseGenerator('wind', 0.08);

    // Deep drone chord (Am9 - A, C, E, G, B)
    const baseFreqs = [55, 110, 130.81, 164.81, 196.00]; // A1, A2, C3, E3, G3
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      // Detune slightly for lush chorusing
      osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 2.0); // slow fade in
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      
      // Connect drone slightly to delay line for massive ambient spaciousness
      const delaySend = this.ctx.createGain();
      delaySend.gain.setValueAtTime(0.28, now);
      gain.connect(delaySend);
      delaySend.connect(this.delayNode);
      
      osc.start(now);
      
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    // Sparse arpeggios
    const notes = [220, 261.63, 329.63, 392.00, 440.00, 523.25]; // A3, C4, E4, G4, A4, C5
    let index = 0;
    
    this.sequenceInterval = setInterval(() => {
      if (Math.random() > 0.4) {
        const note = notes[Math.floor(Math.random() * notes.length)];
        this.triggerSynthPluck(note, 0.05, 'triangle', 0.8);
      }
    }, 1800);
  },

  // STAGE 2: ANGER
  // Heavy distorted synth pulses, aggressive bass notes, rhythmic drums
  playAngerTheme() {
    const now = this.ctx.currentTime;
    
    // Angry low rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(65.41, now); // C2
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 1.0);
    
    osc.connect(gain);
    gain.connect(this.masterVolume);
    osc.start(now);
    
    osc.gainNode = gain;
    this.droneOscillators.push(osc);

    // Fast aggressive rhythm
    let step = 0;
    this.sequenceInterval = setInterval(() => {
      const stepNow = this.ctx.currentTime;
      
      // Heavy synth pulse on every beat
      if (step % 2 === 0) {
        this.triggerAngryBassPulse(65.41 * (step % 8 === 6 ? 1.2 : 1.0), 0.15);
      }
      
      // Metallic hi-hat/noise strike
      if (step % 4 === 2) {
        this.triggerHihat(0.03);
      }

      // Volcanic boom/snare
      if (step % 8 === 4) {
        this.triggerVolcanicBoom(0.12);
      }
      
      step++;
    }, 280); // Fast tempo
  },

  // STAGE 3: BARGAINING
  // Unstable shifting chords, ticking clock soundscape
  playBargainingTheme() {
    const now = this.ctx.currentTime;
    
    // Ticking clock noise source
    this.clockNode = this.createClockTickLoop();

    // Drone chord that shifts between D minor and D major
    const baseFreqs = [73.42, 146.83, 220.00]; // D2, D3, A3
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 2.0);
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      
      // Connect drone slightly to delay line for massive ambient spaciousness
      const delaySend = this.ctx.createGain();
      delaySend.gain.setValueAtTime(0.25, now);
      gain.connect(delaySend);
      delaySend.connect(this.delayNode);
      
      osc.start(now);
      
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    // An unstable arpeggiator that pitches up and down rapidly
    let index = 0;
    const chordMinor = [293.66, 349.23, 440.00, 587.33]; // D4, F4, A4, D5
    const chordMajor = [293.66, 369.99, 440.00, 587.33]; // D4, F#4, A4, D5
    
    this.sequenceInterval = setInterval(() => {
      const isMinor = Math.floor(this.ctx.currentTime / 8) % 2 === 0;
      const chord = isMinor ? chordMinor : chordMajor;
      
      const freq = chord[index % chord.length];
      this.triggerSynthPluck(freq, 0.04, 'sine', 0.35);
      
      index++;
    }, 400);
  },

  // STAGE 4: DEPRESSION
  // Slow, heavy descending minor piano chords, ambient rain sounds
  playDepressionTheme() {
    const now = this.ctx.currentTime;
    
    // Ambient rain sound
    this.rainNode = this.createNoiseGenerator('rain', 0.12);

    // Deep heavy low-pass filtered drone (Bm)
    const baseFreqs = [61.74, 123.47]; // B1, B2
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 3.0);
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      
      // Connect drone slightly to delay line for massive ambient spaciousness
      const delaySend = this.ctx.createGain();
      delaySend.gain.setValueAtTime(0.32, now);
      gain.connect(delaySend);
      delaySend.connect(this.delayNode);
      
      osc.start(now);
      
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    // Descending piano-like chords: Bm -> G -> Em -> F#m
    const progressions = [
      [246.94, 293.66, 369.99, 493.88], // Bm
      [196.00, 293.66, 392.00, 493.88], // G
      [164.81, 246.94, 329.63, 440.00], // Em
      [185.00, 277.18, 369.99, 440.00]  // F#m
    ];
    let chordIdx = 0;
    
    this.sequenceInterval = setInterval(() => {
      const chord = progressions[chordIdx % progressions.length];
      
      // Play notes of chord with slight offsets (strum)
      chord.forEach((freq, noteIdx) => {
        setTimeout(() => {
          this.triggerPianoPluck(freq, 0.05);
        }, noteIdx * 120);
      });
      
      chordIdx++;
    }, 4500); // very slow pace
  },

  // STAGE 5: ACCEPTANCE
  // Warm major chord swells, sparkling bells, peaceful tempo
  playAcceptanceTheme() {
    const now = this.ctx.currentTime;
    
    // Warm Major drone chord (Cmaj7 - C, E, G, B)
    const baseFreqs = [65.41, 130.81, 196.00, 246.94, 329.63]; // C2, C3, G3, B3, E4
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 4.0); // very slow swell
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      osc.start(now);
      
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    // Gentle sparkling bells in C Major Pentatonic (C, D, E, G, A)
    const bellScale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51]; // C5 to E6
    
    this.sequenceInterval = setInterval(() => {
      if (Math.random() > 0.3) {
        // Sparkle bell
        const freq = bellScale[Math.floor(Math.random() * bellScale.length)];
        this.triggerSparklingBell(freq, 0.04);
      }
    }, 900);
  },

  playHopeTheme() {
    const now = this.ctx.currentTime;
    // Cmaj9 Chord (C, G, D, E, G)
    const baseFreqs = [65.41, 130.81, 196.00, 293.66, 329.63, 392.00]; 
    baseFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 4.0); // slow swell
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      osc.start(now);
      
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    // An optimistic arpeggiator playing C major pentatonic melodies
    const melodyScale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00]; // C4 to A5
    let step = 0;
    
    this.sequenceInterval = setInterval(() => {
      if (!this.ctx) return;
      const freq = melodyScale[step % melodyScale.length];
      if (step % 4 === 0 || Math.random() > 0.4) {
        this.triggerSynthPluck(freq, 0.08, 'sine', 1.5);
      }
      
      // Occasionally spark a high bell
      if (Math.random() > 0.7) {
        const highFreq = melodyScale[Math.floor(Math.random() * 4) + 6]; // C5 to A5
        this.triggerSparklingBell(highFreq, 0.04);
      }
      
      step++;
    }, 450);
  },

  // HELPER METHODS FOR SYNTHESIS
  
  triggerSynthPluck(freq, volume, oscType, decay = 1.0) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    
    osc.connect(gain);
    gain.connect(this.delayNode); // Feed to echo delay line
    gain.connect(this.masterVolume);
    
    osc.start(now);
    osc.stop(now + decay + 0.1);
  },

  triggerPianoPluck(freq, volume) {
    const now = this.ctx.currentTime;
    
    // Soft piano sound: combine a sine wave and a quiet triangle wave
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now); // Second harmonic
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0); // long soft ringout
    
    // Lowpass filter to make it warmer/darker
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    
    osc1.connect(filter);
    osc2.connect(filter);
    
    // Connect second harmonic with lower gain
    const harmonicGain = this.ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.05, now);
    osc2.connect(harmonicGain);
    harmonicGain.connect(filter);

    filter.connect(gain);
    gain.connect(this.delayNode);
    gain.connect(this.masterVolume);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 3.2);
    osc2.stop(now + 3.2);
  },

  triggerSparklingBell(freq, volume) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.00001, now + 1.2);
    
    osc.connect(gain);
    gain.connect(this.delayNode); // heavy spatial delay
    gain.connect(this.masterVolume);
    
    osc.start(now);
    osc.stop(now + 1.3);
  },

  triggerAngryBassPulse(freq, volume) {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.9, now + 0.25);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterVolume);
    
    osc.start(now);
    osc.stop(now + 0.3);
  },

  triggerHihat(volume) {
    const now = this.ctx.currentTime;
    
    // High frequency bandpassed noise
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(10000, now);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterVolume);
    
    noise.start(now);
    noise.stop(now + 0.05);
  },

  triggerVolcanicBoom(volume) {
    const now = this.ctx.currentTime;
    
    // Heavy deep explosion/snare
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.2);
    
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(this.masterVolume);
    
    osc.start(now);
    osc.stop(now + 0.25);
    
    // Add noise crunch
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 150;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterVolume);
    
    noise.start(now);
    noise.stop(now + 0.15);
  },

  createNoiseGenerator(type, maxVolume) {
    const now = this.ctx.currentTime;
    
    // Create random white noise buffer
    const bufferSize = this.ctx.sampleRate * 2.0; // 2 seconds of looping noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    
    if (type === 'wind') {
      filter.frequency.setValueAtTime(300, now);
      // Setup dynamic sweep on wind frequency to sound gusty
      this.modulateWindFilter(filter);
    } else {
      // rain
      filter.frequency.setValueAtTime(1200, now);
    }
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0, now);
    gainNode.gain.linearRampToValueAtTime(maxVolume, now + 2.0); // gradual swell
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterVolume);
    
    source.start(now);
    
    source.gainNode = gainNode;
    return source;
  },

  modulateWindFilter(filter) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Schedule random frequency sweeps to simulate gusts of wind
    const targetFreq = 180 + Math.random() * 400;
    const sweepDuration = 1.5 + Math.random() * 2.5;
    
    filter.frequency.exponentialRampToValueAtTime(targetFreq, now + sweepDuration);
    
    // Keep modulating loop
    setTimeout(() => {
      if (this.currentStage === 1 || this.currentStage === 0) {
        this.modulateWindFilter(filter);
      }
    }, sweepDuration * 1000);
  },

  createClockTickLoop() {
    const now = this.ctx.currentTime;
    
    // Custom loop that generates tick-tock sounds on an interval
    const bufferSize = this.ctx.sampleRate * 0.02; // very short tick
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0, now);
    gainNode.gain.linearRampToValueAtTime(0.06, now + 1.0);
    gainNode.connect(this.masterVolume);

    let isTick = true;
    const tickInterval = setInterval(() => {
      try {
        const tickNow = this.ctx.currentTime;
        const tickSource = this.ctx.createBufferSource();
        tickSource.buffer = buffer;
        
        const tickFilter = this.ctx.createBiquadFilter();
        tickFilter.type = 'bandpass';
        // Tick is high pitched, Tock is lower
        tickFilter.frequency.setValueAtTime(isTick ? 4000 : 2500, tickNow);
        
        const tickGain = this.ctx.createGain();
        tickGain.gain.setValueAtTime(0.12, tickNow);
        tickGain.gain.exponentialRampToValueAtTime(0.001, tickNow + 0.015);
        
        tickSource.connect(tickFilter);
        tickFilter.connect(tickGain);
        tickGain.connect(gainNode);
        
        tickSource.start(tickNow);
        tickSource.stop(tickNow + 0.02);
        
        isTick = !isTick;
      } catch(e){}
    }, 1000); // 1 tick per second
    
    // Mock standard audio source interface to allow clearing
    return {
      gainNode: gainNode,
      stop: () => {
        clearInterval(tickInterval);
      },
      disconnect: () => {
        gainNode.disconnect();
      }
    };
  },

  playDreamTheme() {
    if (!this.ctx) return;
    this.resume();
    this.clearSynthesizers();
    const now = this.ctx.currentTime;
    
    // Very gentle and warm chords (C major progression: C -> F -> C -> G)
    const droneFreqs = [130.81, 164.81, 196.00, 261.63]; // C3, E3, G3, C4 (Warm C Major chord)
    droneFreqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 8, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 3.0); // slow beautiful fade in
      
      osc.connect(gain);
      gain.connect(this.masterVolume);
      
      const delaySend = this.ctx.createGain();
      delaySend.gain.setValueAtTime(0.4, now);
      gain.connect(delaySend);
      delaySend.connect(this.delayNode);
      
      osc.start(now);
      osc.gainNode = gain;
      this.droneOscillators.push(osc);
    });

    // Beautiful sparkling bell melody playing slow, nostalgic pentatonic notes
    const bellScale = [329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99]; // E4, G4, A4, C5, D5, E5, G5
    let index = 0;
    this.sequenceInterval = setInterval(() => {
      if (!this.ctx) return;
      if (Math.random() > 0.3) {
        const freq = bellScale[index % bellScale.length];
        this.triggerSparklingBell(freq, 0.05);
      }
      index++;
    }, 900); // very slow and peaceful
  },

  triggerGuitarPluck(freq, volume) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Plucked string strike synthesis
    const oscBody = this.ctx.createOscillator();
    const oscBite = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    oscBody.type = 'triangle';
    oscBody.frequency.setValueAtTime(freq, now);
    
    oscBite.type = 'sawtooth';
    oscBite.frequency.setValueAtTime(freq, now);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 1.2);
    
    const bufferSize = this.ctx.sampleRate * 0.02; // 20ms noise pick strike
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1000, now);
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    
    gain.gain.setValueAtTime(0.0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5); // long acoustic decay
    
    oscBite.detune.setValueAtTime(8, now);
    
    oscBody.connect(filter);
    
    const biteGain = this.ctx.createGain();
    biteGain.gain.setValueAtTime(0.18, now);
    biteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    oscBite.connect(biteGain);
    biteGain.connect(filter);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.delayNode);
    noiseGain.connect(this.masterVolume);
    
    filter.connect(gain);
    gain.connect(this.delayNode);
    gain.connect(this.masterVolume);
    
    oscBody.start(now);
    oscBite.start(now);
    noise.start(now);
    
    oscBody.stop(now + 2.6);
    oscBite.stop(now + 2.6);
    noise.stop(now + 0.03);
  },

  playGuitarCreditsTheme() {
    if (!this.ctx) return;
    this.resume();
    this.clearSynthesizers();
    const now = this.ctx.currentTime;
    
    // Melancholic acoustic guitar chord progression (Am -> G -> F -> C -> E7)
    const progressions = [
      [110.00, 164.81, 220.00, 261.63, 329.63], // Am (A2, E3, A3, C4, E4)
      [98.00, 146.83, 196.00, 246.94, 293.66],  // G  (G2, D3, G3, B3, D4)
      [87.31, 130.81, 174.61, 220.00, 261.63],  // F  (F2, C3, F3, A3, C4)
      [130.81, 196.00, 261.63, 329.63, 392.00], // C  (C3, G3, C4, E4, G4)
      [82.41, 123.47, 164.81, 207.65, 293.66]   // E7 (E2, B2, E3, G#3, D4)
    ];
    
    let chordIndex = 0;
    let noteIndex = 0;
    
    this.sequenceInterval = setInterval(() => {
      if (!this.ctx) return;
      
      const currentChord = progressions[chordIndex % progressions.length];
      const freq = currentChord[noteIndex % currentChord.length];
      
      this.triggerGuitarPluck(freq, 0.18);
      
      noteIndex++;
      if (noteIndex % 8 === 0) {
        chordIndex++;
        noteIndex = 0;
      }
    }, 280);
  }
};
