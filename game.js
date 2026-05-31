// Main Game Controller
const Game = {
  canvas: null,
  ctx: null,
  player: null,
  particles: null,
  currentStage: 0,
  isTransitioning: false,
  lastTime: 0,
  lightningTimer: 300,
  lightningFlash: 0,
  keys: {},
  
  // Camera
  camera: { x: 0, y: 0 },
  shakeTime: 0,
  shakeIntensity: 0,
  
  // Dialogue state
  activeDialogue: null,
  dialogueIndex: 0,
  dialogueTextNode: null,
  dialoguePromptNode: null,
  dialogueContainer: null,
  typingInterval: null,
  isDialogueActive: false,
  pendingDialogueText: null,
  introFallen: false,
  
  // Dream cutscene state
  inDreamCutscene: false,
  dreamState: 0,
  dreamTimer: 0,
  dreamDialogueIndex: 0,
  dreamDialogue: [
    { speaker: "Me", text: "Is this... a dream?" },
    { speaker: "Her", text: "It is, my love. A dream to say goodbye." },
    { speaker: "Me", text: "I've missed you so much. The world feels so empty without you." },
    { speaker: "Her", text: "I know. The grief was heavy. But you don't have to carry it all alone anymore." },
    { speaker: "Me", text: "I didn't think I could go on." },
    { speaker: "Her", text: "You are stronger than you think. You walked through the dark, and you found the light." },
    { speaker: "Me", text: "Will you stay with me?" },
    { speaker: "Her", text: "In your heart, always. But now, it's time for you to live. To step into tomorrow." },
    { speaker: "Me", text: "I love you. Goodbye..." },
    { speaker: "Her", text: "Goodbye... I am so proud of you." }
  ],
  
  // Animation trails
  playerTrails: [],

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Set logical canvas resolution
    this.canvas.width = 1280;
    this.canvas.height = 720;
    
    // UI nodes
    this.dialogueTextNode = document.getElementById('dialogue-text');
    this.dialoguePromptNode = document.getElementById('dialogue-prompt');
    this.dialogueContainer = document.getElementById('dialogue-container');
    
    // Setup inputs
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      
      // Prevent default scrolling for game keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      // Handle dialogue progression
      if (this.isDialogueActive && (e.code === 'Space' || e.code === 'Enter')) {
        if (this.inDreamCutscene) {
          this.advanceDreamDialogue();
        } else {
          this.advanceDialogue();
        }
      }
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    // Custom touch listener for gliding in Acceptance
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keys['HoldJump'] = true;
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keys['HoldJump'] = false;
      }
    });

    // Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
    
    // Create systems
    this.particles = new ParticleSystem();
    this.player = new Player(0, 0);

    // Initialize WebGL post-processor
    const webglCanvas = document.getElementById('webgl-canvas');
    this.postProcessor = new ShaderPostProcessor(webglCanvas, this.canvas);

    // Setup buttons
    document.getElementById('start-btn').addEventListener('click', () => this.startGame(false));
    const continueBtn = document.getElementById('continue-btn');
    continueBtn.addEventListener('click', () => this.startGame(true));
    document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());

    // Key shortcut to restart stage
    window.addEventListener('keydown', e => {
      if (e.code === 'KeyR' && !this.isDialogueActive && document.getElementById('start-screen').classList.contains('hidden')) {
        this.player.die(this.particles, this);
      }
    });

    // Load level data dynamically
    const editedLevels = localStorage.getItem('grief_edited_levels');
    let levelsPromise;
    if (editedLevels) {
      console.log("Loading levels from localStorage editor cache...");
      levelsPromise = Promise.resolve(JSON.parse(editedLevels));
    } else {
      console.log("Loading levels from levels.json...");
      const antiCache = Date.now().toString() + Math.floor(Math.random() * 1000000000).toString();
      levelsPromise = fetch(`levels.json?anticache=${antiCache}`).then(r => r.json());
    }

    levelsPromise.then(data => {
      STAGES.length = 0;
      data.forEach((stage, idx) => {
        // Re-attach procedural drawing routines
        stage.drawSpecial = drawSpecialRoutines[idx] || (() => {});
        STAGES.push(stage);
      });

      // Check localStorage progress
      const savedStage = localStorage.getItem('grief_game_stage');
      if (savedStage !== null) {
        const stageIdx = parseInt(savedStage, 10);
        if (stageIdx >= 0 && stageIdx < STAGES.length) {
          this.currentStage = stageIdx;
          continueBtn.classList.remove('hidden');
        }
      }

      // Check if we are running in playtest mode
      if (window.location.search.includes('playtest')) {
        console.log("Playtest query parameter detected. Launching stage playtest instantly...");
        const match = window.location.search.match(/playtest=(\d+)/);
        const playtestStageIdx = match ? parseInt(match[1], 10) : 0;
        
        this.currentStage = (playtestStageIdx >= 0 && playtestStageIdx < STAGES.length) ? playtestStageIdx : 0;
        this.startGame(true); // Launch directly into currentStage
      }
    }).catch(err => {
      console.error("Error loading stage levels:", err);
    });
  },

  resizeCanvas() {
    const logicalRatio = 1280 / 720;
    const windowRatio = window.innerWidth / window.innerHeight;
    
    let width, height;
    if (windowRatio > logicalRatio) {
      height = window.innerHeight;
      width = window.innerHeight * logicalRatio;
    } else {
      width = window.innerWidth;
      height = window.innerWidth / logicalRatio;
    }
    
    const webglCanvas = document.getElementById('webgl-canvas');
    if (webglCanvas) {
      webglCanvas.style.width = `${width}px`;
      webglCanvas.style.height = `${height}px`;
      webglCanvas.width = width;
      webglCanvas.height = height;
      if (this.postProcessor) {
        this.postProcessor.resize(width, height);
      }
    }
    
    // Keep offscreen canvas at logical resolution
    this.canvas.width = 1280;
    this.canvas.height = 720;
  },

  startGame(isContinue = false) {
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('start-screen').classList.add('hidden');
    
    this.lastTime = 0;
    // Init audio on click
    AudioEngine.init();
    
    if (!isContinue) {
      this.currentStage = 0;
    }
    this.loadStage(this.currentStage);
    
    // Start game loop
    document.getElementById('game-gui').classList.add('active');
    document.getElementById('game-gui').classList.remove('hidden');
    
    requestAnimationFrame(timestamp => this.loop(timestamp));
  },

  restartGame() {
    this.inDreamCutscene = false;
    this.dreamState = 0;
    document.getElementById('end-screen').classList.remove('active');
    document.getElementById('end-screen').classList.add('hidden');
    this.lastTime = 0;
    this.currentStage = 0;
    this.loadStage(0);
    document.getElementById('game-gui').classList.add('active');
    document.getElementById('game-gui').classList.remove('hidden');
  },

  loadStage(stageIndex) {
    this.inDreamCutscene = false;
    this.dreamState = 0;
    this.isTransitioning = false;
    this.particles.clear();
    const stage = STAGES[stageIndex];
    if (stageIndex === 0) this.introFallen = false;
    
    // Save progress to localStorage
    localStorage.setItem('grief_game_stage', stageIndex);
    
    // Setup player position and stage variables
    this.player.reset(stage.spawnX, stage.spawnY);
    this.player.checkpointX = stage.spawnX;
    this.player.checkpointY = stage.spawnY;
    
    // Reset platform lives/destruction
    stage.platforms.forEach(p => {
      p.destroyed = false;
      if (p.type === 'checkpoint') p.activated = false;
    });

    // Clean up temporary platforms from previous stage runs
    stage.platforms = stage.platforms.filter(p => p.type !== 'bargained_solid');

    // Camera initial position centered
    this.camera.x = this.player.x - this.canvas.width / 2;
    this.camera.y = this.player.y - this.canvas.height / 2;
    
    // UI Update
    document.getElementById('gui-stage-name').innerText = `Stage: ${stage.name}`;
    
    // Set UI mechanic tips
    const tips = [
      "Find a way forward",
      "Fog clouds reality. Invisible walls might solidify near you.",
      "Fury dash: SHIFT to smash blocks. Mind the lava.",
      "Space is fragile. Press E to construct golden platforms.",
      "The dark water rises! Climb quickly, jump is weaker.",
      "Clouds break. Double jump and hold Jump to float.",
      "Walk forward in peace."
    ];
    document.getElementById('gui-mechanic-tip').innerText = tips[stageIndex];

    // Ability bar visibility
    const bar = document.getElementById('ability-bar-container');
    if (stageIndex === 3) {
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }

    // Play stage audio
    AudioEngine.setStage(stageIndex);

    // Dynamic vignette styling
    const vignette = document.getElementById('vignette');
    const vignetteColors = [
      "radial-gradient(circle, transparent 20%, rgba(0, 0, 0, 0.95) 90%, rgba(0, 0, 0, 0.98) 100%)", // Intro
      "radial-gradient(circle, transparent 30%, rgba(10, 10, 10, 0.92) 80%, rgba(0, 0, 0, 0.98) 100%)", // Denial
      "radial-gradient(circle, transparent 30%, rgba(45, 10, 10, 0.9) 80%, rgba(5, 0, 0, 0.98) 100%)", // Anger
      "radial-gradient(circle, transparent 30%, rgba(30, 20, 10, 0.88) 80%, rgba(10, 5, 0, 0.98) 100%)", // Bargaining
      "radial-gradient(circle, transparent 20%, rgba(10, 20, 35, 0.95) 80%, rgba(0, 5, 15, 0.98) 100%)", // Depression
      "radial-gradient(circle, transparent 50%, rgba(241, 196, 15, 0.08) 90%, rgba(241, 196, 15, 0.15) 100%)", // Acceptance
      "radial-gradient(circle, transparent 60%, rgba(46, 204, 113, 0.05) 90%, rgba(46, 204, 113, 0.15) 100%)" // Hope
    ];
    vignette.style.background = vignetteColors[stageIndex];

    // Reset dialogue triggers
    stage.triggers.forEach(t => t.triggered = false);

    // Show Stage Announcement Banner
    this.announceStage(stage);
  },

  announceStage(stage) {
    const banner = document.getElementById('stage-banner');
    document.getElementById('stage-number').innerText = stage.number;
    document.getElementById('stage-name').innerText = stage.name;
    document.getElementById('stage-name').style.color = stage.color;
    document.getElementById('stage-desc').innerText = stage.desc;
    
    // Pause player while banner is visible
    this.isCutscene = true;

    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('active'), 50);

    setTimeout(() => {
      banner.classList.remove('active');
      setTimeout(() => {
        banner.classList.add('hidden');
        this.isCutscene = false;
      }, 1000);
    }, 2800);
  },

  nextStage() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.isCutscene = true;
    AudioEngine.playSFX('transition');
    
    // Fade out game view
    const vignette = document.getElementById('vignette');
    vignette.style.background = '#000000';
    
    setTimeout(() => {
      if (this.currentStage === 6) {
        this.isTransitioning = false;
        this.startDreamCutscene();
        return;
      }
      this.currentStage++;
      this.isTransitioning = false;
      if (this.currentStage < STAGES.length) {
        this.loadStage(this.currentStage);
      } else {
        // Ended game
        localStorage.removeItem('grief_game_stage'); // Clear progress on completion
        document.getElementById('game-gui').classList.add('hidden');
        document.getElementById('game-gui').classList.remove('active');
        document.getElementById('end-screen').classList.remove('hidden');
        setTimeout(() => document.getElementById('end-screen').classList.add('active'), 50);
        AudioEngine.playGuitarCreditsTheme();
      }
    }, 1500);
  },

  triggerScreenshake(intensity) {
    this.shakeTime = 15; // 15 frames
    this.shakeIntensity = intensity;
  },

  triggerDialogue(text) {
    this.isDialogueActive = true;
    this.activeDialogue = text;
    this.dialogueIndex = 0;
    this.dialogueTextNode.innerText = "";
    this.dialoguePromptNode.classList.remove('visible');
    
    this.dialogueContainer.classList.remove('hidden');
    setTimeout(() => this.dialogueContainer.classList.add('active'), 50);
    
    // Typewriting effect
    if (this.typingInterval) clearInterval(this.typingInterval);
    if (this.dialogueTimeout) clearTimeout(this.dialogueTimeout);

    this.typingInterval = setInterval(() => {
      if (this.dialogueIndex < this.activeDialogue.length) {
        this.dialogueTextNode.innerText += this.activeDialogue[this.dialogueIndex];
        this.dialogueIndex++;
        // Audio tick sound
        if (this.dialogueIndex % 2 === 0) {
          AudioEngine.playSFX('text_beep');
        }
      } else {
        clearInterval(this.typingInterval);
        this.typingInterval = null;
        
        // Auto close after 3.5 seconds
        this.dialogueTimeout = setTimeout(() => {
          this.closeDialogue();
        }, 3500);
      }
    }, 35);
  },

  closeDialogue() {
    this.dialogueContainer.classList.remove('active');
    this.isDialogueActive = false;
    this.isCutscene = false;
    setTimeout(() => {
      this.dialogueContainer.classList.add('hidden');
    }, 500);
  },

  advanceDialogue() {
    if (this.typingInterval) {
      // Skip typing animation
      clearInterval(this.typingInterval);
      this.typingInterval = null;
      this.dialogueTextNode.innerText = this.activeDialogue;
      if (this.dialogueTimeout) clearTimeout(this.dialogueTimeout);
      this.dialogueTimeout = setTimeout(() => {
        this.closeDialogue();
      }, 3500);
    } else {
      // Close dialogue
      this.closeDialogue();
    }
  },

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    let elapsed = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Clamp elapsed to prevent massive jumps when tab is backgrounded
    if (elapsed > 100) elapsed = 16.67;

    const dt = elapsed / 16.67;

    this.update(dt);
    this.draw(timestamp);
    
    requestAnimationFrame(timestamp => this.loop(timestamp));
  },

  update(dt) {
    if (this.inDreamCutscene) {
      this.updateDreamCutscene(dt);
      return;
    }
    if (this.currentStage >= STAGES.length || !STAGES[this.currentStage]) return;
    const stage = STAGES[this.currentStage];
    
    // Decrement lightning flash timer
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt);
    }
    
    // Update temporary platforms countdowns
    if (this.currentStage === 3) {
      for(let i = stage.platforms.length - 1; i >= 0; i--) {
        const p = stage.platforms[i];
        if (p.type === 'bargained_solid') {
          p.life -= dt;
          if (p.life <= 0) {
            // Spawn puff of sparks when vanishing
            this.particles.spawnBurst(p.x + 30, p.y + 7, 8, 1.5, 3, 'rgba(224, 169, 109, 0.4)', 20, 'light');
            stage.platforms.splice(i, 1);
          }
        }
      }
      // Update UI ability bar fill
      const barFill = document.getElementById('ability-bar');
      barFill.style.width = `${(this.player.energy / this.player.maxEnergy) * 100}%`;
    }

    // UPDATE PLAYER PHYSICS
    const canMove = !this.isCutscene;
    if (canMove) {
      this.player.update(this.keys, stage, this.particles, this, dt);
    } else {
      // Apply friction/drag only
      this.player.vx *= Math.pow(this.player.drag, dt);
      this.player.vy += this.player.gravity * dt;
      this.player.moveY(this.player.vy, stage, this.particles, this, dt);
    }

    // INTRO PROLOGUE: Trigger fall music & glitch transition
    if (this.currentStage === 0 && !this.introFallen && this.player.y > 450) {
      this.introFallen = true;
      AudioEngine.triggerIntroFall();
    }

    // If dialogue is pending, wait until player is on the ground and quiet
    if (this.pendingDialogueText) {
      if (this.player.onGround && Math.abs(this.player.vx) < 0.25 && Math.abs(this.player.vy) < 0.25) {
        this.player.vx = 0;
        this.player.vy = 0;
        const text = this.pendingDialogueText;
        this.pendingDialogueText = null;
        this.triggerDialogue(text);
      }
    }

    // DEPRESSION: UPDATE WATER LEVEL AND WEATHER EFFECTS
    if (this.currentStage === 4 && !this.isCutscene) {
      stage.waterLevel -= stage.waterRiseSpeed * dt;
      if (this.player.y + this.player.h > stage.waterLevel) {
        this.player.die(this.particles, this);
      }
      
      // Spawn rain splashes on platforms dynamically near camera
      if (Math.random() > 0.4) {
        const plat = stage.platforms[Math.floor(Math.random() * stage.platforms.length)];
        if (plat.type === 'solid' && plat.x > this.camera.x - 200 && plat.x < this.camera.x + this.canvas.width + 200) {
          const rx = plat.x + Math.random() * plat.w;
          this.particles.spawnRainSplash(rx, plat.y);
        }
      }

      // Lightning logic: trigger flash and thunder crash every 7-13 seconds
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 420 + Math.random() * 360; // 7-13 seconds at 60fps
        this.lightningFlash = 6; // flash stays active for 6 frames (0.1s)
        AudioEngine.playSFX('thunder');
        this.triggerScreenshake(12);
      }
    }

    // UPDATE PARTICLES
    this.particles.update(dt);

    // Spawn ambient weather particles with throttled rates for performance
    if (this.currentStage === 1) {
      if (Math.random() > 0.95) { // Spawn fog rarely (extremely heavy)
        this.particles.spawnFog(this.canvas.width, this.canvas.height, 1);
      }
    } else if (this.currentStage === 2) {
      if (Math.random() > 0.6) {
        this.particles.spawnAsh(this.canvas.width, this.canvas.height, this.camera.x, this.camera.y, 1);
      }
    } else if (this.currentStage === 3) {
      if (Math.random() > 0.85) {
        this.particles.spawnBargainingTick(this.player.x + (Math.random() - 0.5) * 80, this.player.y + (Math.random() - 0.5) * 80);
      }
    } else if (this.currentStage === 4) {
      if (Math.random() > 0.5) { // Spawn rain less frequently
        this.particles.spawnRain(this.canvas.width, this.canvas.height, this.camera.x, this.camera.y, 1);
      }
    } else if (this.currentStage === 5) {
      if (Math.random() > 0.85) {
        this.particles.spawnAcceptanceLight(this.canvas.width, this.canvas.height, this.camera.x, this.camera.y, 1);
      }
    } else if (this.currentStage === 6) {
      if (Math.random() > 0.85) {
        this.particles.spawnHopeLight(this.canvas.width, this.canvas.height, this.camera.x, this.camera.y, 1);
      }
    }

    // DIALOGUE TRIGGERS CHECK
    if (canMove) {
      for (let t of stage.triggers) {
        if (!t.triggered && this.player.x + this.player.w > t.x && this.player.x < t.x + t.w && this.player.y + this.player.h > t.y && this.player.y < t.y + t.h) {
          t.triggered = true;
          this.pendingDialogueText = t.text;
          this.isCutscene = true; // Stop player inputs so they slide/fall to a stop
          break;
        }
      }
    }

    // CAMERA LOGIC
    // Lerp camera behind player
    const targetCamX = this.player.x - this.canvas.width / 2 + this.player.w / 2;
    const targetCamY = this.player.y - this.canvas.height * 0.6;
    
    this.camera.x += (targetCamX - this.camera.x) * 0.08;
    this.camera.y += (targetCamY - this.camera.y) * 0.08;

    // Clamp camera within stage bounds
    this.camera.x = Math.max(0, Math.min(stage.width - this.canvas.width, this.camera.x));
    this.camera.y = Math.max(0, Math.min(stage.height - this.canvas.height, this.camera.y));

    // Handle screen shake
    if (this.shakeTime > 0) {
      this.shakeTime--;
      this.camera.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.y += (Math.random() - 0.5) * this.shakeIntensity;
    }

    // Update Player Animation Trails
    if (!this.player.isDead && (Math.abs(this.player.vx) > 1 || Math.abs(this.player.vy) > 1)) {
      this.playerTrails.push({ 
        x: this.player.x, 
        y: this.player.y, 
        stretchX: this.player.stretchX || 1.0, 
        stretchY: this.player.stretchY || 1.0 
      });
      if (this.playerTrails.length > 6) {
        this.playerTrails.shift();
      }
    } else {
      if (this.playerTrails.length > 0) this.playerTrails.shift();
    }
  },

  draw(timestamp) {
    if (this.inDreamCutscene) {
      this.drawDreamCutscene(timestamp);
      return;
    }
    if (this.currentStage >= STAGES.length || !STAGES[this.currentStage]) return;
    const stage = STAGES[this.currentStage];
    
    // CLEAR BACKGROUND WITH DYNAMIC STAGE COLORS
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // DRAW CINEMATIC SKY BACKGROUNDS
    this.ctx.save();
    let skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    if (this.currentStage === 0) {
      let transitionFactor = Math.min(1.0, Math.max(0.0, (this.player.y - 400) / 300));
      let r1 = Math.round(179 * (1.0 - transitionFactor) + 0 * transitionFactor);
      let g1 = Math.round(229 * (1.0 - transitionFactor) + 0 * transitionFactor);
      let b1 = Math.round(252 * (1.0 - transitionFactor) + 0 * transitionFactor);

      let r2 = Math.round(255 * (1.0 - transitionFactor) + 5 * transitionFactor);
      let g2 = Math.round(183 * (1.0 - transitionFactor) + 5 * transitionFactor);
      let b2 = Math.round(77 * (1.0 - transitionFactor) + 5 * transitionFactor);

      skyGrad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
      skyGrad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
    } else if (this.currentStage === 1) {
      skyGrad.addColorStop(0, '#101010');
      skyGrad.addColorStop(1, '#1b1b1b');
    } else if (this.currentStage === 2) {
      skyGrad.addColorStop(0, '#1a0303');
      skyGrad.addColorStop(1, '#080101');
    } else if (this.currentStage === 3) {
      skyGrad.addColorStop(0, '#120d1c');
      skyGrad.addColorStop(1, '#08050d');
    } else if (this.currentStage === 4) {
      skyGrad.addColorStop(0, '#08101a');
      skyGrad.addColorStop(1, '#020508');
    } else if (this.currentStage === 5) {
      skyGrad.addColorStop(0, '#2c2512');
      skyGrad.addColorStop(0.6, '#18150d');
      skyGrad.addColorStop(1, '#0a0a0a');
    }
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    // DRAW PARTICLES UNDER PLAYER
    this.particles.draw(this.ctx, this.camera.x, this.camera.y);

    // DRAW PLATFORMS
    stage.platforms.forEach(p => {
      if (p.destroyed) return;

      this.ctx.save();
      const px = p.x - this.camera.x;
      const py = p.y - this.camera.y;

      if (p.type === 'solid' || p.type === 'fake') {
        this.ctx.save();
        
        if (this.currentStage === 0) {
          // Stage 0: Intro (The Void)
          if (p.y < 500) {
            // Draw happy grass platform that dissolves as we descend
            let transitionFactor = Math.min(1.0, Math.max(0.0, (this.player.y - 400) / 300));
            let alpha = 1.0 - transitionFactor;
            
            this.ctx.fillStyle = `rgba(76, 175, 80, ${alpha})`; // green top
            this.ctx.fillRect(px, py, p.w, 6);
            this.ctx.fillStyle = `rgba(141, 110, 99, ${alpha * 0.8})`; // dirt body
            this.ctx.fillRect(px, py + 6, p.w, p.h - 6);
            
            // Draw wireframe overlay that fades in as we get dark
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * transitionFactor})`;
            this.ctx.strokeRect(px, py, p.w, p.h);
          } else {
            // Dark hollow void wireframe block
            this.ctx.fillStyle = '#0a0a0a';
            this.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            this.ctx.lineWidth = 1.5;
            this.ctx.fillRect(px, py, p.w, p.h);
            this.ctx.strokeRect(px, py, p.w, p.h);
            
            // Draw a very thin inner accent line
            this.ctx.strokeStyle = 'rgba(255,255,255,0.03)';
            this.ctx.strokeRect(px + 4, py + 4, p.w - 8, p.h - 8);
          }
          
        } else if (this.currentStage === 1) {
          // Stage 1: Denial
          // Split panels, monochromatic grey, look solid yet fragile
          const grad = this.ctx.createLinearGradient(px, py, px, py + p.h);
          grad.addColorStop(0, '#161616');
          grad.addColorStop(1, '#0e0e0e');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(px, py, p.w, p.h);
          
          // Outer borders
          this.ctx.strokeStyle = 'rgba(160, 160, 160, 0.2)';
          this.ctx.lineWidth = 1.5;
          this.ctx.strokeRect(px, py, p.w, p.h);
          
          // Bevel highlight top
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          this.ctx.beginPath();
          this.ctx.moveTo(px, py + 1.5);
          this.ctx.lineTo(px + p.w, py + 1.5);
          this.ctx.stroke();
          
          // Draw subtle panel division lines to look architectural
          this.ctx.strokeStyle = 'rgba(160, 160, 160, 0.08)';
          this.ctx.beginPath();
          for(let xOffset = 60; xOffset < p.w; xOffset += 80) {
            this.ctx.moveTo(px + xOffset, py);
            this.ctx.lineTo(px + xOffset, py + p.h);
          }
          this.ctx.stroke();
          
        } else if (this.currentStage === 2) {
          // Stage 2: Anger
          // Dark volcanic charcoal with glowing red hot fissures
          const grad = this.ctx.createLinearGradient(px, py, px, py + p.h);
          grad.addColorStop(0, '#1c0d0b');
          grad.addColorStop(1, '#0e0504');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(px, py, p.w, p.h);
          
          // Dark red outer stroke
          this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.3)';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(px, py, p.w, p.h);
          
          // Top burning border
          this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.6)';
          this.ctx.beginPath();
          this.ctx.moveTo(px, py + 1);
          this.ctx.lineTo(px + p.w, py + 1);
          this.ctx.stroke();
          
          // Random volcanic cracks on the platform faces
          this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.25)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          // Seeded cracks based on position so they remain static
          const seed = Math.sin(p.x) * 1000;
          const crackX = px + Math.abs(seed % (p.w - 20)) + 10;
          this.ctx.moveTo(crackX, py);
          this.ctx.lineTo(crackX - 10, py + p.h / 2);
          this.ctx.lineTo(crackX + 5, py + p.h);
          this.ctx.stroke();

        } else if (this.currentStage === 3) {
          // Stage 3: Bargaining
          // Golden grid panels with coordinate nodes
          const grad = this.ctx.createLinearGradient(px, py, px, py + p.h);
          grad.addColorStop(0, '#141018');
          grad.addColorStop(1, '#0b080e');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(px, py, p.w, p.h);
          
          // Gold wireframe stroke
          this.ctx.strokeStyle = 'rgba(224, 169, 109, 0.35)';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(px, py, p.w, p.h);
          
          // Elegant grid lines inside
          this.ctx.strokeStyle = 'rgba(224, 169, 109, 0.08)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          // Draw thin crossing grid lines
          for (let xOffset = 30; xOffset < p.w; xOffset += 40) {
            this.ctx.moveTo(px + xOffset, py);
            this.ctx.lineTo(px + xOffset, py + p.h);
          }
          for (let yOffset = 30; yOffset < p.h; yOffset += 40) {
            this.ctx.moveTo(px, py + yOffset);
            this.ctx.lineTo(px + p.w, py + yOffset);
          }
          this.ctx.stroke();

        } else if (this.currentStage === 4) {
          // Stage 4: Depression
          // Wet dark slate slabs with water droplets/rain streaks
          const grad = this.ctx.createLinearGradient(px, py, px, py + p.h);
          grad.addColorStop(0, '#0c121c');
          grad.addColorStop(1, '#04070c');
          this.ctx.fillStyle = grad;
          this.ctx.fillRect(px, py, p.w, p.h);
          
          // Deep blue borders
          this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.28)';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(px, py, p.w, p.h);
          
          // Bright wet highlight on top
          this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.5)';
          this.ctx.beginPath();
          this.ctx.moveTo(px, py + 1);
          this.ctx.lineTo(px + p.w, py + 1);
          this.ctx.stroke();

          // Weeping water drips on the face of the block
          this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.12)';
          this.ctx.beginPath();
          const seed = Math.sin(p.x * 3.4) * 2000;
          const dripX1 = px + Math.abs(seed % (p.w - 15)) + 5;
          const dripX2 = px + Math.abs((seed * 1.5) % (p.w - 15)) + 5;
          this.ctx.moveTo(dripX1, py);
          this.ctx.lineTo(dripX1, py + p.h * 0.7);
          this.ctx.moveTo(dripX2, py);
          this.ctx.lineTo(dripX2, py + p.h * 0.5);
          this.ctx.stroke();

        } else if (this.currentStage === 5) {
          // Stage 5: Acceptance
          // Beautiful golden-white glassmorphic clouds catching light
          // Semi-transparent golden glass fill
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          this.ctx.fillRect(px, py, p.w, p.h);
          
          // Double golden outline representing pure resolution
          this.ctx.strokeStyle = 'rgba(241, 196, 15, 0.35)';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(px, py, p.w, p.h);
          
          // Inner glowing highlight
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(px + 3, py + 3, p.w - 6, p.h - 6);
          
          // Shimmer reflection on top edge
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          this.ctx.beginPath();
          this.ctx.moveTo(px + 4, py + 1.5);
          this.ctx.lineTo(px + p.w - 4, py + 1.5);
          this.ctx.stroke();

        } else if (this.currentStage === 6) {
          // Stage 6: Hope
          // Emerald glowing growth blocks
          // Semi-transparent fresh green glass fill
          this.ctx.fillStyle = 'rgba(46, 204, 113, 0.05)';
          this.ctx.fillRect(px, py, p.w, p.h);
          
          // Glowing emerald borders
          this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.45)';
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(px, py, p.w, p.h);
          
          // Inner soft stroke
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(px + 3, py + 3, p.w - 6, p.h - 6);

          // Top emerald grass/moss highlight
          this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
          this.ctx.beginPath();
          this.ctx.moveTo(px, py + 1);
          this.ctx.lineTo(px + p.w, py + 1);
          this.ctx.stroke();
        } else {
          // Fallback basic styling
          this.ctx.fillStyle = '#101010';
          this.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          this.ctx.lineWidth = 2;
          this.ctx.fillRect(px, py, p.w, p.h);
          this.ctx.strokeRect(px, py, p.w, p.h);
        }
        
        this.ctx.restore();
      } 
      else if (p.type === 'glitch') {
        // Stage 1 glitch blocks: fade based on proximity
        const dist = Math.hypot((this.player.x + this.player.w/2) - (p.x + p.w/2), (this.player.y + this.player.h/2) - (p.y + p.h/2));
        let alpha = 0;
        if (dist <= 80) alpha = 0.8;
        else if (dist < 180) alpha = 0.8 * (1 - (dist - 80) / 100);
        
        if (alpha > 0) {
          this.ctx.fillStyle = `rgba(160, 160, 160, ${alpha * 0.15})`;
          this.ctx.strokeStyle = `rgba(160, 160, 160, ${alpha * 0.6})`;
          this.ctx.lineWidth = 1.5;
          this.ctx.fillRect(px, py, p.w, p.h);
          this.ctx.strokeRect(px, py, p.w, p.h);
        } else {
          // Draw thin outline hint
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
          this.ctx.strokeRect(px, py, p.w, p.h);
        }
      } 
      else if (p.type === 'breakable') {
        // Red angry cracked blocks
        this.ctx.fillStyle = '#2d0f0c';
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 1.5;
        this.ctx.fillRect(px, py, p.w, p.h);
        this.ctx.strokeRect(px, py, p.w, p.h);
        
        // Draw cracks
        this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
        this.ctx.beginPath();
        this.ctx.moveTo(px + 5, py + 5);
        this.ctx.lineTo(px + p.w - 10, py + p.h - 5);
        this.ctx.moveTo(px + p.w - 5, py + 8);
        this.ctx.lineTo(px + 8, py + p.h - 10);
        this.ctx.stroke();
      } 
      else if (p.type === 'bargained_solid') {
        // Transparent gold grid block
        const alpha = p.life / 180;
        this.ctx.fillStyle = `rgba(224, 169, 109, ${alpha * 0.18})`;
        this.ctx.strokeStyle = `rgba(224, 169, 109, ${alpha * 0.7})`;
        this.ctx.lineWidth = 2;
        this.ctx.fillRect(px, py, p.w, p.h);
        this.ctx.strokeRect(px, py, p.w, p.h);
        
        // Inside grid drawing
        this.ctx.strokeStyle = `rgba(224, 169, 109, ${alpha * 0.15})`;
        this.ctx.beginPath();
        this.ctx.moveTo(px + p.w / 2, py);
        this.ctx.lineTo(px + p.w / 2, py + p.h);
        this.ctx.moveTo(px, py + p.h / 2);
        this.ctx.lineTo(px + p.w, py + p.h / 2);
        this.ctx.stroke();
      } 
      else if (p.type === 'spike') {
        // Spikes
        const isLava = (this.currentStage === 2);
        this.ctx.fillStyle = isLava ? '#e74c3c' : '#222222';
        this.ctx.strokeStyle = isLava ? 'rgba(231,76,60,0.8)' : 'rgba(255,255,255,0.15)';
        this.ctx.lineWidth = 1;
        
        const numSpikes = Math.floor(p.w / 20);
        const spikeW = p.w / numSpikes;
        
        this.ctx.beginPath();
        this.ctx.moveTo(px, py + p.h);
        for(let i = 0; i < numSpikes; i++) {
          const sx = px + i * spikeW;
          this.ctx.lineTo(sx, py + p.h);
          this.ctx.lineTo(sx + spikeW/2, py);
          this.ctx.lineTo(sx + spikeW, py + p.h);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      } 
      else if (p.type === 'energy') {
        // Rotating golden nodes
        const age = Date.now() * 0.003;
        this.ctx.save();
        this.ctx.translate(px + p.w/2, py + p.h/2);
        this.ctx.rotate(age);
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#e0a96d';
        this.ctx.fillStyle = '#e0a96d';
        this.ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        this.ctx.restore();
      } 
      else if (p.type === 'checkpoint') {
        // Checkpoint Altar
        this.ctx.fillStyle = p.activated ? stage.color : '#333333';
        this.ctx.fillRect(px + p.w/2 - 3, py + p.h - 30, 6, 30); // pole
        
        // Glow orb on top
        this.ctx.save();
        this.ctx.shadowBlur = p.activated ? 20 : 0;
        this.ctx.shadowColor = stage.color;
        this.ctx.beginPath();
        this.ctx.arc(px + p.w/2, py + p.h - 35, p.activated ? 8 : 6, 0, Math.PI*2);
        this.ctx.fillStyle = p.activated ? stage.color : '#555555';
        this.ctx.fill();
        this.ctx.restore();
      }
      else if (p.type === 'portal' || p.type === 'portal_in') {
        // Swirling cinematic portal
        const isWarp = (p.type === 'portal_in');
        const color = isWarp ? '#e0a96d' : stage.color;
        const speed = isWarp ? 0.005 : 0.003;
        const time = Date.now() * speed;
        
        this.ctx.save();
        this.ctx.translate(px + p.w/2, py + p.h/2);
        this.ctx.shadowBlur = 25;
        this.ctx.shadowColor = color;
        
        // Multi layered ellipses rotating
        for (let i = 0; i < 3; i++) {
          this.ctx.rotate(time + i * Math.PI/3);
          this.ctx.strokeStyle = color;
          this.ctx.lineWidth = 2 - i * 0.5;
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, p.w/2 - i*4, p.h/2 - i*6, 0, 0, Math.PI*2);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }
      this.ctx.restore();
    });

    // DRAW SPECIAL STAGE OVERLAYS (e.g. rising water, volumetric beams)
    stage.drawSpecial(this.ctx, this);

    // DRAW PLAYER TRAILS
    this.playerTrails.forEach((t, i) => {
      const tx = t.x - this.camera.x;
      const ty = t.y - this.camera.y;
      const alpha = 0.04 + 0.04 * i;
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      
      const baseX = tx + this.player.w / 2;
      const baseY = ty + this.player.h;
      const drawW = this.player.w * (t.stretchX || 1.0);
      const drawH = this.player.h * (t.stretchY || 1.0);
      this.ctx.fillRect(baseX - drawW / 2, baseY - drawH, drawW, drawH);
    });

    // DRAW PLAYER SILHOUETTE (With squash & stretch)
    if (!this.player.isDead) {
      const px = this.player.x - this.camera.x;
      const py = this.player.y - this.camera.y;
      
      this.ctx.save();
      
      // Draw silhouette body
      this.ctx.fillStyle = '#ffffff'; // White silhouette glows slightly in darkness
      
      // Custom stage coloring
      if (this.currentStage === 0) this.ctx.fillStyle = '#444444'; // void dark grey body (visible in spotlight)
      else if (this.currentStage === 1) this.ctx.fillStyle = '#e8e8e8';
      else if (this.currentStage === 2) this.ctx.fillStyle = '#ffdeda';
      else if (this.currentStage === 3) this.ctx.fillStyle = '#fff4e5';
      else if (this.currentStage === 4) this.ctx.fillStyle = '#def0ff';
      else if (this.currentStage === 5) this.ctx.fillStyle = '#fffbeb';
      
      // Render body rectangle with squash and stretch scaled around the base
      const baseX = px + this.player.w / 2;
      const baseY = py + this.player.h;
      const drawW = this.player.w * (this.player.stretchX || 1.0);
      const drawH = this.player.h * (this.player.stretchY || 1.0);
      this.ctx.fillRect(baseX - drawW / 2, baseY - drawH, drawW, drawH);
      
      // Render glowing eyes
      this.ctx.fillStyle = '#ffffff';
      
      // Color shift eyes in stage 2 (Anger - red glowing eyes)
      if (this.currentStage === 2) this.ctx.fillStyle = '#ff0000';
      else if (this.currentStage === 4) this.ctx.fillStyle = '#88c9f2';
      else if (this.currentStage === 5) this.ctx.fillStyle = '#f1c40f';

      // Draw two white slits for eyes (scaled with stretch)
      const eyeY = baseY - drawH + 8 * (this.player.stretchY || 1.0);
      const eyeOffsetLeft = this.player.w * 0.5 * (this.player.stretchX || 1.0);
      if (this.player.facingDir > 0) {
        this.ctx.fillRect(baseX + eyeOffsetLeft * 0.1, eyeY, 3, 3);
        this.ctx.fillRect(baseX + eyeOffsetLeft * 0.6, eyeY, 3, 3);
      } else {
        this.ctx.fillRect(baseX - eyeOffsetLeft * 0.9, eyeY, 3, 3);
        this.ctx.fillRect(baseX - eyeOffsetLeft * 0.4, eyeY, 3, 3);
      }

      this.ctx.restore();
    }

    // DRAW SPOTLIGHT / LIGHTING MASK (OPPRESSIVE VIGNETTE ON CANVAS)
    if (this.currentStage !== 5 && this.currentStage !== 6) {
      this.ctx.save();
      
      const px = this.player.x + this.player.w/2 - this.camera.x;
      const py = this.player.y + this.player.h/2 - this.camera.y;

      let radius = 250; // Increased base radius from 170 for better visibility
      let alpha = 0.90; // Slightly lowered alpha for clearer view
      
      if (this.currentStage === 0) {
        let transitionFactor = Math.min(1.0, Math.max(0.0, (this.player.y - 400) / 300));
        radius = 350; // Larger spotlight for visibility in the void
        alpha = 0.85 * transitionFactor; // Spotlight fades in as we descend into darkness
      } else if (this.currentStage === 2) {
        radius = 320; // Increased from 220
        alpha = 0.85;
      } else if (this.currentStage === 3) {
        radius = 360; // Increased from 260
        alpha = 0.82;
      } else if (this.currentStage === 4) {
        radius = 290; // Increased from 200
        alpha = 0.88;
      }

      // Draw a radial gradient directly on the main canvas centered on the player.
      // This runs 1000x faster than offscreen compositing and avoids lag/memory thrashing.
      const radGrad = this.ctx.createRadialGradient(px, py, 15, px, py, radius);
      radGrad.addColorStop(0, 'rgba(3, 3, 3, 0)');
      radGrad.addColorStop(0.35, 'rgba(3, 3, 3, 0.2)');
      radGrad.addColorStop(1, `rgba(3, 3, 3, ${alpha})`);

      this.ctx.fillStyle = radGrad;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // DRAW LIGHTNING FLASH OVERLAY
    if (this.lightningFlash > 0) {
      this.ctx.save();
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + (this.lightningFlash / 6) * 0.6})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // RENDER WEBGL SHADER EFFECTS
    if (this.postProcessor) {
      const shakeVal = this.shakeTime > 0 ? this.shakeIntensity : 0.0;
      let transitionVal = 1.0;
      if (this.currentStage === 0) {
        transitionVal = Math.min(1.0, Math.max(0.0, (this.player.y - 400) / 300));
      }
      this.postProcessor.render(timestamp, this.currentStage, shakeVal, transitionVal);
    }
  },

  startDreamCutscene() {
    this.inDreamCutscene = true;
    this.isCutscene = true;
    this.dreamState = 1;
    this.dreamTimer = 0;
    this.dreamDialogueIndex = 0;
    this.playerTrails = [];
    
    // Play transition sound
    AudioEngine.playSFX('transition');
    
    // Stop stage music and start dream theme
    AudioEngine.playDreamTheme();
    
    // Teleport player to the bottom-center of the screen
    this.player.reset(640, 620);
    this.player.vx = 0;
    this.player.vy = 0;
    
    // Lock camera at x: 0, y: 0
    this.camera.x = 0;
    this.camera.y = 0;

    // Reset vignette for dream style
    const vignette = document.getElementById('vignette');
    vignette.style.background = "radial-gradient(circle, transparent 50%, rgba(46, 204, 113, 0.08) 85%, rgba(46, 204, 113, 0.2) 100%)";
  },

  updateDreamCutscene(dt) {
    // Ambient floating particles (Hope style)
    if (Math.random() > 0.7) {
      const px = Math.random() * this.canvas.width;
      const py = this.canvas.height;
      this.particles.spawn(px, py, (Math.random() - 0.5) * 0.5, -0.8 - Math.random() * 0.6, 2 + Math.random() * 2, 'rgba(46, 204, 113, 0.4)', 150, 'light');
    }
    
    this.particles.update(dt);
    
    if (this.dreamState === 1) {
      // Intro state: wait for fade-in
      this.dreamTimer += dt;
      if (this.dreamTimer > 60) {
        this.dreamState = 2; // Float up
        this.dreamTimer = 0;
      }
    } else if (this.dreamState === 2) {
      // Float/fly up
      this.player.y -= 1.2 * dt;
      // Spawn flying tail sparkles
      if (Math.random() > 0.4) {
        this.particles.spawn(this.player.x + this.player.w/2, this.player.y + this.player.h, (Math.random() - 0.5) * 1.0, 0.8 + Math.random() * 0.8, 2.5 + Math.random() * 2.5, 'rgba(46, 204, 113, 0.5)', 30, 'light');
      }
      
      // Update player visual trails
      this.playerTrails.push({ 
        x: this.player.x, 
        y: this.player.y, 
        stretchX: 0.8, 
        stretchY: 1.2 
      });
      if (this.playerTrails.length > 6) {
        this.playerTrails.shift();
      }

      if (this.player.y <= 380) {
        this.player.y = 380;
        this.dreamState = 3; // Start dialogue
        this.triggerDreamDialogue();
      }
    } else if (this.dreamState === 3) {
      // Floating in place during dialogue
      const time = Date.now();
      this.player.y = 380 + Math.sin(time * 0.002) * 4;
      this.lovedOneY = 220 + Math.sin(time * 0.0018) * 6;
      
      // Decelerate trails if any exist
      if (this.playerTrails.length > 0) {
        this.playerTrails.shift();
      }
    } else if (this.dreamState === 4) {
      // Farewell dissolve
      AudioEngine.playSFX('change');
      const ly = this.lovedOneY || 220;
      this.particles.spawnBurst(640, ly, 80, 3.5, 3.5, 'rgba(46, 204, 113, 0.85)', 90, 'light');
      this.particles.spawnBurst(640, ly, 60, 2.5, 3.0, 'rgba(255, 255, 255, 0.95)', 70, 'light');
      
      this.dreamState = 5;
      this.dreamTimer = 0;
    } else if (this.dreamState === 5) {
      // Fade out
      this.dreamTimer += dt;
      if (this.dreamTimer > 120) {
        // End game and show credits
        this.inDreamCutscene = false;
        localStorage.removeItem('grief_game_stage'); // Clear progress on completion
        document.getElementById('game-gui').classList.add('hidden');
        document.getElementById('game-gui').classList.remove('active');
        document.getElementById('end-screen').classList.remove('hidden');
        setTimeout(() => document.getElementById('end-screen').classList.add('active'), 50);
        AudioEngine.playGuitarCreditsTheme();
      }
    }
  },

  drawDreamCutscene(timestamp) {
    // Clear with deep dreamy dark gradient
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    let skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    skyGrad.addColorStop(0, '#03140a'); // Ethereal deep green
    skyGrad.addColorStop(0.5, '#010603');
    skyGrad.addColorStop(1, '#000000');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    
    // Draw volumetric shafts of hope light
    this.ctx.save();
    this.ctx.fillStyle = "rgba(46, 204, 113, 0.02)";
    for (let i = 0; i < 3; i++) {
      const xStart = 200 + i * 400;
      this.ctx.beginPath();
      this.ctx.moveTo(xStart, 0);
      this.ctx.lineTo(xStart + 150, 0);
      this.ctx.lineTo(xStart + 300, this.canvas.height);
      this.ctx.lineTo(xStart + 100, this.canvas.height);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();

    // Draw ambient particles
    this.particles.draw(this.ctx, 0, 0);

    // Draw dream ground (fading out as player floats high)
    let groundAlpha = 1.0;
    if (this.dreamState >= 2) {
      groundAlpha = Math.max(0.0, 1.0 - (620 - this.player.y) / 200);
    }
    if (groundAlpha > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = groundAlpha;
      this.ctx.fillStyle = 'rgba(46, 204, 113, 0.05)';
      this.ctx.fillRect(0, 650, 1280, 70);
      this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.45)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(0, 650, 1280, 70);
      
      this.ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, 650);
      this.ctx.lineTo(1280, 650);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Draw loved one silhouette
    if (this.dreamState < 4) {
      const ly = this.lovedOneY || 220;
      this.ctx.save();
      
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.ctx.shadowBlur = 20;
      this.ctx.shadowColor = '#2ecc71';
      
      const sx = 640;
      
      // Head
      this.ctx.beginPath();
      this.ctx.arc(sx, ly - 35, 9, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Dress / Body
      this.ctx.beginPath();
      this.ctx.moveTo(sx, ly - 26);
      this.ctx.lineTo(sx - 15, ly + 25);
      this.ctx.lineTo(sx + 15, ly + 25);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Emitter sparkles
      if (Math.random() > 0.5) {
        this.particles.spawn(sx + (Math.random() - 0.5) * 40, ly + (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5, 2 + Math.random() * 2, 'rgba(46, 204, 113, 0.7)', 40, 'light');
      }
      
      this.ctx.restore();
    }

    // Draw player trails
    this.playerTrails.forEach((t, i) => {
      const alpha = 0.04 + 0.04 * i;
      this.ctx.fillStyle = `rgba(46, 204, 113, ${alpha})`;
      const drawW = this.player.w * (t.stretchX || 1.0);
      const drawH = this.player.h * (t.stretchY || 1.0);
      this.ctx.fillRect(t.x + this.player.w / 2 - drawW / 2, t.y + this.player.h - drawH, drawW, drawH);
    });

    // Draw player silhouette
    this.ctx.save();
    this.ctx.fillStyle = '#fffbeb';
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#2ecc71';
    
    const drawW = this.player.w * (this.player.stretchX || 1.0);
    const drawH = this.player.h * (this.player.stretchY || 1.0);
    this.ctx.fillRect(this.player.x + this.player.w / 2 - drawW / 2, this.player.y + this.player.h - drawH, drawW, drawH);
    
    // Glowing emerald eyes
    this.ctx.fillStyle = '#2ecc71';
    const eyeY = this.player.y + this.player.h - drawH + 8 * (this.player.stretchY || 1.0);
    this.ctx.fillRect(this.player.x + this.player.w / 2 - drawW * 0.2, eyeY, 3, 3);
    this.ctx.fillRect(this.player.x + this.player.w / 2 + drawW * 0.1, eyeY, 3, 3);
    this.ctx.restore();

    // Draw transition fades
    if (this.dreamState === 1) {
      const alpha = Math.max(0.0, 1.0 - this.dreamTimer / 50);
      if (alpha > 0) {
        this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else if (this.dreamState === 5) {
      const alpha = Math.min(1.0, this.dreamTimer / 100);
      this.ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // WebGL Shader effects
    if (this.postProcessor) {
      this.postProcessor.render(timestamp, 6, 0.0, 1.0); // stage 6 Hope shader
    }
  },

  triggerDreamDialogue() {
    const line = this.dreamDialogue[this.dreamDialogueIndex];
    this.isDialogueActive = true;
    this.dialogueIndex = 0; // Fix: reset character index for typewriter
    this.dialogueTextNode.innerHTML = "";
    this.dialoguePromptNode.classList.remove('visible');
    
    this.dialogueContainer.classList.remove('hidden');
    this.dialogueContainer.classList.add('active');
    
    const speakerColor = line.speaker === "Me" ? "#ffffff" : "#2ecc71";
    const speakerShadow = line.speaker === "Me" ? "none" : "0 0 10px rgba(46, 204, 113, 0.5)";
    this.dialogueTextNode.innerHTML = `<span style="color: ${speakerColor}; font-weight: bold; text-shadow: ${speakerShadow}; font-family: 'Cinzel', serif;">${line.speaker}:</span> <span class="speech-text" style="font-style: italic;"></span>`;
    const speechNode = this.dialogueTextNode.querySelector('.speech-text');
    
    this.typingInterval = setInterval(() => {
      if (this.dialogueIndex < line.text.length) {
        speechNode.innerText += line.text[this.dialogueIndex];
        this.dialogueIndex++;
        if (this.dialogueIndex % 2 === 0) {
          AudioEngine.playSFX('text_beep');
        }
      } else {
        clearInterval(this.typingInterval);
        this.typingInterval = null;
        this.dialoguePromptNode.classList.add('visible');
        this.dialoguePromptNode.innerText = "Press Space to continue...";
      }
    }, 40);
  },

  advanceDreamDialogue() {
    const line = this.dreamDialogue[this.dreamDialogueIndex];
    const speechNode = this.dialogueTextNode.querySelector('.speech-text');
    
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
      if (speechNode) {
        speechNode.innerText = line.text;
      }
      this.dialogueIndex = line.text.length; // Sync index
      this.dialoguePromptNode.classList.add('visible');
      this.dialoguePromptNode.innerText = "Press Space to continue...";
    } else {
      this.dreamDialogueIndex++;
      if (this.dreamDialogueIndex < this.dreamDialogue.length) {
        this.triggerDreamDialogue();
      } else {
        this.closeDialogue();
        this.dreamState = 4;
        this.dreamTimer = 0;
      }
    }
  }
};

// Start initialization once DOM is loaded
window.addEventListener('DOMContentLoaded', () => Game.init());
