// Platformer physics and player class
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    
    // Bounds
    this.w = 20;
    this.h = 44;

    // Movement constants (will be adjusted by stage)
    this.accel = 0.6;
    this.drag = 0.85;
    this.gravity = 0.55;
    this.jumpForce = -10.5;
    this.maxSpeedX = 5.2;
    this.maxSpeedY = 12;

    // Helper states
    this.onGround = false;
    this.coyoteTime = 0; // jump tolerance frames
    this.jumpBuffer = 0; // jump buffer frames
    this.facingDir = 1; // 1 = right, -1 = left
    this.isDead = false;
    
    // Wall jump / slide properties
    this.wallOnLeft = false;
    this.wallOnRight = false;
    this.wasWallOnLeft = false;
    this.wasWallOnRight = false;
    this.isWallSliding = false;
    this.wallJumpTimer = 0;
    
    // Squash & Stretch factors
    this.stretchX = 1.0;
    this.stretchY = 1.0;
    
    // Stage-specific mechanics
    // Stage 2: Anger Dash
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.isDashing = false;
    
    // Stage 3: Bargaining
    this.energy = 0;
    this.maxEnergy = 100;
    
    // Stage 5: Acceptance
    this.doubleJumps = 1;
    this.isGliding = false;

    // Checkpoint
    this.checkpointX = x;
    this.checkpointY = y;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.isDead = false;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.isDashing = false;
    this.energy = 30; // start with some energy for bargaining
    this.doubleJumps = 1;
    this.isGliding = false;
    this.wallOnLeft = false;
    this.wallOnRight = false;
    this.wasWallOnLeft = false;
    this.wasWallOnRight = false;
    this.isWallSliding = false;
    this.wallJumpTimer = 0;
    this.stretchX = 1.0;
    this.stretchY = 1.0;
  }

  update(keys, stage, particles, game, dt) {
    if (this.isDead) return;

    const nowStage = game.currentStage;
    
    // ADJUST PHYSICS CONSTANTS PER STAGE
    this.accel = 0.6;
    this.drag = 0.85;
    this.gravity = 0.55;
    this.jumpForce = -10.5;
    this.maxSpeedX = 5.2;
    this.maxSpeedY = 12;

    if (nowStage === 4) {
      // Depression: Walk is slow/sluggish, but jump is standard so player doesn't get stuck
      this.accel = 0.35;
      this.drag = 0.90;
      this.gravity = 0.55;
      this.jumpForce = -10.5;
      this.maxSpeedX = 3.6;
    } else if (nowStage === 5) {
      // Acceptance: Light movement, floaty jump
      this.accel = 0.8;
      this.drag = 0.88;
      this.gravity = 0.35;
      this.jumpForce = -8.0;
      this.maxSpeedX = 6.0;
    }

    // Cache wall states from previous frame and reset
    this.wasWallOnLeft = this.wallOnLeft;
    this.wasWallOnRight = this.wallOnRight;
    this.wallOnLeft = false;
    this.wallOnRight = false;

    // TICK TIMER BUFFERS (scaled by dt)
    if (this.coyoteTime > 0) this.coyoteTime = Math.max(0, this.coyoteTime - dt);
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.wallJumpTimer > 0) this.wallJumpTimer = Math.max(0, this.wallJumpTimer - dt);

    // Lerp visual stretch factor back to normal
    this.stretchX += (1.0 - this.stretchX) * 0.15 * dt;
    this.stretchY += (1.0 - this.stretchY) * 0.15 * dt;

    // ANGER DASH LOGIC
    if (nowStage === 2 && this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.vy = 0; // ignore gravity while dashing
      this.vx = 14 * this.facingDir;
      particles.spawn(this.x + this.w/2, this.y + this.h/2 + (Math.random() - 0.5) * 20, -this.vx * 0.2, (Math.random() - 0.5) * 1.5, 3, 'rgba(231, 76, 60, 0.6)', 15);
      
      if (this.dashTimer === 0) {
        this.isDashing = false;
        this.vx *= 0.5; // lose some speed at the end of dash
      }
      
      // Perform movements and collisions during dash
      this.moveX(this.vx, stage, particles, game, dt);
      return; // Skip normal inputs while dashing
    }

    // NORMAL INPUTS
    // Horizontal Movement
    let inputX = 0;
    if (this.wallJumpTimer <= 0) {
      if (keys['KeyA'] || keys['ArrowLeft']) {
        inputX = -1;
        this.facingDir = -1;
      }
      if (keys['KeyD'] || keys['ArrowRight']) {
        inputX = 1;
        this.facingDir = 1;
      }
    }

    if (inputX !== 0) {
      this.vx += inputX * this.accel * dt;
      if (Math.abs(this.vx) > this.maxSpeedX) {
        this.vx = this.maxSpeedX * Math.sign(this.vx);
      }
    } else {
      this.vx *= Math.pow(this.drag, dt);
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    // Jump Input Buffer
    if (keys['KeyW'] || keys['Space'] || keys['ArrowUp']) {
      this.jumpBuffer = 6; // buffer jump for 6 frames
      keys['KeyW'] = false;
      keys['Space'] = false; // consume input
      keys['ArrowUp'] = false;
    }

    // Apply gravity and wall-sliding
    if (!this.onGround) {
      // Check for wall sliding condition
      this.isWallSliding = false;
      const holdingLeft = keys['KeyA'] || keys['ArrowLeft'];
      const holdingRight = keys['KeyD'] || keys['ArrowRight'];
      
      if (this.vy > 0 && ((this.wasWallOnLeft && holdingLeft) || (this.wasWallOnRight && holdingRight))) {
        this.isWallSliding = true;
      }

      if (this.isWallSliding) {
        // Wall slide friction: clamp downward speed
        const slideMaxSpeedY = 2.0;
        if (this.vy > slideMaxSpeedY) {
          this.vy = slideMaxSpeedY;
        } else {
          this.vy += this.gravity * 0.4 * dt;
        }

        // Spawn slide particles
        if (Math.random() > 0.4) {
          const px = this.wasWallOnLeft ? this.x : this.x + this.w;
          const py = this.y + Math.random() * this.h;
          const color = STAGES[nowStage].color || '#ffffff';
          particles.spawn(px, py, (this.wasWallOnLeft ? 0.5 : -0.5) * Math.random(), 0.5 * Math.random(), 2, color, 15);
        }
      } else if (nowStage === 5 && (keys['KeyW'] || keys['Space'] || keys['ArrowUp'] || keys['HoldJump']) && this.vy > 0) {
        // Stage 5 (Acceptance) Gliding
        this.vy += this.gravity * 0.25 * dt; // slow descent
        this.isGliding = true;
        
        // Spawn pretty golden sparkles while gliding
        if (Math.random() > 0.6) {
          particles.spawn(this.x + this.w/2, this.y + this.h, (Math.random() - 0.5) * 1.0, 0.5 + Math.random(), 3 + Math.random() * 3, 'rgba(241, 196, 15, 0.6)', 30, 'light');
        }
      } else {
        this.vy += this.gravity * dt;
        this.isGliding = false;
      }
      
      if (this.vy > this.maxSpeedY) {
        this.vy = this.maxSpeedY;
      }
    } else {
      this.isGliding = false;
      this.isWallSliding = false;
    }

    // JUMP RESOLUTION
    if (this.jumpBuffer > 0) {
      if (this.onGround || this.coyoteTime > 0) {
        this.jump();
        particles.spawnJumpSparks(this.x + this.w/2, this.y + this.h, nowStage);
      } else if (!this.onGround && (this.wasWallOnLeft || this.wasWallOnRight)) {
        // Wall Jump!
        const jumpDir = this.wasWallOnLeft ? 1 : -1;
        this.vx = jumpDir * this.maxSpeedX * 1.35; // horizontal push
        this.vy = this.jumpForce * 0.92; // vertical thrust
        this.wallJumpTimer = 8; // Lock keyboard inputs for 8 frames
        this.jumpBuffer = 0;
        this.coyoteTime = 0;
        this.facingDir = jumpDir;
        
        // Wall jump squash and stretch
        this.stretchX = 0.7;
        this.stretchY = 1.35;

        // Play jump sound
        AudioEngine.playSFX('jump');

        // Spawn wall jump sparks
        const px = this.wasWallOnLeft ? this.x : this.x + this.w;
        const color = STAGES[nowStage].color || '#ffffff';
        particles.spawnBurst(px, this.y + this.h/2, 8, 1.5, 2.5, color, 25);
      } else if (nowStage === 5 && this.doubleJumps > 0) {
        // Double jump in Acceptance
        this.doubleJumps--;
        this.jump();
        AudioEngine.playSFX('jump');
        particles.spawnJumpSparks(this.x + this.w/2, this.y + this.h, nowStage);
      }
    }

    // STAGE 2 ANGER DASH TRIGGER
    if (nowStage === 2 && (keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyE']) && this.dashCooldown === 0) {
      this.isDashing = true;
      this.dashTimer = 10; // dash lasts 10 frames
      this.dashCooldown = 45; // cooldown
      AudioEngine.playSFX('dash');
      keys['ShiftLeft'] = false;
      keys['ShiftRight'] = false;
      keys['KeyE'] = false;
      return;
    }

    // STAGE 3 BARGAINING PLATFORM SPAWN
    if (nowStage === 3 && keys['KeyE'] && this.energy >= 25 && !this.onGround) {
      // Spawn temporary platform beneath feet
      const platX = Math.floor(this.x - 20);
      const platY = Math.floor(this.y + this.h);
      stage.platforms.push({
        x: platX,
        y: platY,
        w: 60,
        h: 15,
        type: 'bargained_solid',
        life: 180 // lasts 3 seconds at 60fps
      });
      this.energy -= 25;
      
      AudioEngine.playSFX('rewind');
      particles.spawnBurst(platX + 30, platY + 7, 10, 2.0, 3, 'rgba(224, 169, 109, 0.8)', 30, 'light');
      
      keys['KeyE'] = false;
    }

    // APPLY VELOCITY AND COLLIDE SEPARATELY
    this.moveX(this.vx, stage, particles, game, dt);
    this.moveY(this.vy, stage, particles, game, dt);
  }

  jump() {
    this.vy = this.jumpForce;
    this.onGround = false;
    this.coyoteTime = 0;
    this.jumpBuffer = 0;
    this.stretchX = 0.72;
    this.stretchY = 1.35;
    AudioEngine.playSFX('jump');
  }

  die(particles, game) {
    if (this.isDead) return;
    this.isDead = true;
    AudioEngine.playSFX('death');
    
    // Spawn dramatic particles
    const currentStageObj = STAGES[game.currentStage];
    const particleColor = currentStageObj ? currentStageObj.color : '#ffffff';
    particles.spawnBurst(this.x + this.w/2, this.y + this.h/2, 25, 4.0, 4, particleColor, 50);
    game.triggerScreenshake(15);
    
    // Fade out and respawn after 1 second
    setTimeout(() => {
      this.respawn(game);
    }, 1000);
  }

  respawn(game) {
    this.reset(this.checkpointX, this.checkpointY);
    game.pendingDialogueText = null;
    game.isCutscene = false;
    if (game.isDialogueActive) {
      game.closeDialogue();
    }
    // Reset energy spots in current stage so they reappear
    const stage = STAGES[game.currentStage];
    if (stage && stage.platforms) {
      stage.platforms.forEach(p => {
        if (p.type === 'energy') p.destroyed = false;
      });
    }
    // If Depression, reset water level to default static level
    if (game.currentStage === 4) {
      STAGES[4].waterLevel = 650;
    }
  }

  moveX(vx, stage, particles, game, dt) {
    this.x += vx * dt;

    // Keep within world bounds
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }
    if (this.x + this.w > stage.width) {
      this.x = stage.width - this.w;
      this.vx = 0;
    }

    // Solid collision checks
    const playerRect = { x: this.x, y: this.y, w: this.w, h: this.h };
    
    for (let plat of stage.platforms) {
      if (plat.destroyed || plat.type === 'fake' || plat.type === 'portal' || plat.type === 'checkpoint' || plat.type === 'energy' || plat.type === 'portal_in') continue;
      
      // Stage 1 Glitch platform logic - only solid if visible
      if (plat.type === 'glitch') {
        const dist = Math.hypot((this.x + this.w/2) - (plat.x + plat.w/2), (this.y + this.h/2) - (plat.y + plat.h/2));
        if (dist > 180) continue; // Not solid when far away
      }

      const platRect = { x: plat.x, y: plat.y, w: plat.w, h: plat.h };
      const intersect = getIntersection(playerRect, platRect);
      
      if (intersect) {
        // Collided! Resolve X axis
        if (plat.type === 'breakable' && this.isDashing) {
          // Smash breakable block in Stage 2 (Anger)
          plat.destroyed = true;
          AudioEngine.playSFX('break_wall');
          particles.spawnBurst(plat.x + plat.w/2, plat.y + plat.h/2, 15, 3.5, 4, '#e74c3c', 40);
          game.triggerScreenshake(10);
          continue;
        }

        if (plat.type === 'spike') {
          this.die(particles, game);
          return;
        }

        // Standard solid push back
        if (vx > 0) {
          this.x -= intersect.x;
          this.vx = 0;
          this.wallOnRight = true;
        } else if (vx < 0) {
          this.x += intersect.x;
          this.vx = 0;
          this.wallOnLeft = true;
        }
        
        // Re-update player bounds for subsequent loops
        playerRect.x = this.x;
      }
    }
  }

  moveY(vy, stage, particles, game, dt) {
    this.y += vy * dt;
    this.onGround = false;

    // Out of bounds bottom = death
    if (!stage || this.y + this.h > stage.height) {
      this.die(particles, game);
      return;
    }

    const playerRect = { x: this.x, y: this.y, w: this.w, h: this.h };

    for (let plat of stage.platforms) {
      if (plat.destroyed || plat.type === 'fake') continue;

      // Check portals / checkpoints / energy overlays
      if (plat.type === 'portal') {
        if (getIntersection(playerRect, { x: plat.x, y: plat.y, w: plat.w, h: plat.h })) {
          game.nextStage();
          return;
        }
        continue;
      }

      if (plat.type === 'portal_in') {
        if (getIntersection(playerRect, { x: plat.x, y: plat.y, w: plat.w, h: plat.h })) {
          // Warp player
          this.x = plat.targetX;
          this.y = plat.targetY;
          this.vx = 0;
          this.vy = 0;
          AudioEngine.playSFX('rewind');
          particles.spawnBurst(this.x + this.w/2, this.y + this.h/2, 12, 2.5, 3, 'rgba(224, 169, 109, 0.7)', 30, 'light');
          game.triggerScreenshake(5);
          return;
        }
        continue;
      }

      if (plat.type === 'energy') {
        if (getIntersection(playerRect, { x: plat.x, y: plat.y, w: plat.w, h: plat.h })) {
          plat.destroyed = true;
          this.energy = Math.min(this.maxEnergy, this.energy + 35);
          AudioEngine.playSFX('text_beep');
          particles.spawnBurst(plat.x + 10, plat.y + 10, 8, 2.0, 3, 'rgba(224, 169, 109, 0.9)', 30, 'light');
        }
        continue;
      }

      if (plat.type === 'checkpoint') {
        if (getIntersection(playerRect, { x: plat.x, y: plat.y, w: plat.w, h: plat.h })) {
          if (this.checkpointX !== plat.x || this.checkpointY !== plat.y - 10) {
            this.checkpointX = plat.x;
            this.checkpointY = plat.y - 10;
            plat.activated = true;
            AudioEngine.playSFX('text_beep');
            particles.spawnBurst(plat.x + 20, plat.y + 25, 10, 1.5, 2.5, STAGES[game.currentStage].color, 35, 'light');
          }
        }
        continue;
      }

      // Stage 1 Glitch platform logic - only solid if visible
      if (plat.type === 'glitch') {
        const dist = Math.hypot((this.x + this.w/2) - (plat.x + plat.w/2), (this.y + this.h/2) - (plat.y + plat.h/2));
        if (dist > 180) continue; // Not solid when far away
      }

      const platRect = { x: plat.x, y: plat.y, w: plat.w, h: plat.h };
      const intersect = getIntersection(playerRect, platRect);

      if (intersect) {
        if (plat.type === 'spike') {
          this.die(particles, game);
          return;
        }

        // Resolve Y axis
        if (vy > 0) {
          // Landing
          this.y -= intersect.y;
          this.vy = 0;
          this.onGround = true;
          this.coyoteTime = 5; // 5 frames tolerance to jump after leaving floor
          this.doubleJumps = 1; // reset double jumps
          
          if (!this.onGroundPrev) {
            // Landing squash
            this.stretchX = 1.35;
            this.stretchY = 0.68;

            // Trigger landing audio & dust sparks
            AudioEngine.playSFX('land');
            particles.spawnJumpSparks(this.x + this.w/2, this.y + this.h, game.currentStage === 5);
          }
        } else if (vy < 0) {
          // Hitting ceiling
          this.y += intersect.y;
          this.vy = 0;
        }
        
        playerRect.y = this.y;
      }
    }

    this.onGroundPrev = this.onGround;
  }
}

// Global collision resolution checker helper
function getIntersection(r1, r2) {
  let overlapX = Math.min(r1.x + r1.w, r2.x + r2.w) - Math.max(r1.x, r2.x);
  let overlapY = Math.min(r1.y + r1.h, r2.y + r2.h) - Math.max(r1.y, r2.y);
  if (overlapX > 0 && overlapY > 0) {
    return { x: overlapX, y: overlapY };
  }
  return null;
}
