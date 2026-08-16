/**
 * Microbe Canvas Animation
 * Shared animation system for blog pages featuring a phagocytic microbe
 * that follows the mouse cursor and engulfs food particles
 */

// Initialize microbe animation when DOM is loaded
function initMicrobeAnimation(options = {}) {
  const canvas = document.getElementById('canvas');
  if (!canvas) {
    console.warn('Canvas element with id "canvas" not found');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Set canvas dimensions
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Mouse tracking variables
  let mouseX = null;
  let mouseY = null;
  let mouseActive = false;
  let mouseLastMoved = 0;

  // Configuration options with defaults
  const config = {
    foodParticleCount: options.foodParticleCount || 80,
    backgroundFoodCount: options.backgroundFoodCount || 65,
    obstacleSelectors: options.obstacleSelectors || ['.header-section', '.post-card', '.blog-article'],
    microbeSpawnX: options.microbeSpawnX !== undefined ? options.microbeSpawnX : 0.2, // fraction of canvas width
    microbeSpawnY: options.microbeSpawnY !== undefined ? options.microbeSpawnY : 0.5, // fraction of canvas height
    // Overall size of the microbe. Smaller on phones, where it otherwise fills the screen.
    microbeScale: options.microbeScale !== undefined ? options.microbeScale
                  : (window.innerWidth < 768 ? 0.45 : 0.62),
  };
  const S = config.microbeScale;

  // Mouse event listeners
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    mouseActive = true;
    mouseLastMoved = Date.now();
  });

  canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
    mouseX = null;
    mouseY = null;
  });

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  // Microbe class
  class Microbe {
    constructor() {
      this.x = canvas.width / 2;
      this.y = canvas.height / 2;
      this.width = 140 * S;
      this.height = 80 * S;
      this.targetX = this.x;
      this.targetY = this.y;
      this.velocityX = 0;
      this.velocityY = 0;
      this.angle = 0;
      this.targetAngle = 0;
      this.isEngulfing = false;
      this.ruffleOffset = [];
      this.membraneDistortions = [];
      this.cytoplasmicDots = [];
      this.flagella = [];
      this.currentTarget = null; // Track current food target to prevent jumping

      this.phagosome = {
        x: -35 * S,
        y: 0,
        particles: [],
        phagosomeRadius: 20 * S
      };

      // Initialize ruffle offsets
      for (let i = 0; i < 50; i++) {
        this.ruffleOffset.push(Math.random() * Math.PI * 2);
      }

      // Initialize flagella (clustered at rear of microbe)
      const numFlagella = 4;
      for (let i = 0; i < numFlagella; i++) {
        // Cluster around π (180°, the rear when microbe faces right at 0°)
        // Spread across ~80 degree arc
        const arcSpread = Math.PI * 0.45; // ~80 degrees
        const baseAngle = Math.PI + (i / (numFlagella - 1) - 0.5) * arcSpread;
        const angleVariation = (Math.random() - 0.5) * 0.15;
        this.flagella.push({
          angle: baseAngle + angleVariation,
          length: (20 + Math.random() * 10) * S,
          waveOffset: Math.random() * Math.PI * 2,
          waveSpeed: 0.08 + Math.random() * 0.06
        });
      }

      // Initialize cytoplasmic dots
      for (let i = 0; i < 20; i++) {
        let dotX, dotY;
        let validPosition = false;
        while (!validPosition) {
          const angle = Math.random() * Math.PI * 2;
          const radiusX = (Math.random() * (this.width / 2 - 10 * S));
          const radiusY = (Math.random() * (this.height / 2 - 10 * S));
          dotX = Math.cos(angle) * radiusX;
          dotY = Math.sin(angle) * radiusY;
          const distFromPhagosome = Math.hypot(dotX - this.phagosome.x, dotY - this.phagosome.y);
          const isInFrontZone = dotX > (this.width / 2 - 25 * S) && Math.abs(dotY) < 20 * S;
          if (distFromPhagosome > this.phagosome.phagosomeRadius + 5 * S && !isInFrontZone) {
            validPosition = true;
          }
        }
        this.cytoplasmicDots.push({
          x: dotX,
          y: dotY,
          size: (1 + Math.random() * 1.5) * S
        });
      }
    }

    findNearestFood(foodParticles) {
      let nearest = null;
      let minDist = Infinity;
      foodParticles.forEach(food => {
        if (food === this.ignoredTarget) return; // just gave up on this one
        if (!food.eaten && !food.engulfing) {
          const dist = Math.hypot(food.x - this.x, food.y - this.y);
          if (dist < minDist && dist < 300) {
            minDist = dist;
            nearest = food;
          }
        }
      });
      return nearest;
    }

    update(foodParticles, mouseX, mouseY, mouseActive, deltaTime = 1.0) {
      // Check if ANY food is currently being engulfed (not just membrane distortions)
      const activelyEngulfing = this.membraneDistortions.length > 0 ||
                                foodParticles.some(f => f.engulfing);
      const timeSinceMouseMoved = Date.now() - mouseLastMoved;
      const mouseStillActive = mouseActive && timeSinceMouseMoved < 500;

      if (mouseStillActive && mouseX !== null && mouseY !== null) {
        const distToMouse = Math.hypot(mouseX - this.x, mouseY - this.y);
        if (distToMouse > 80) {
          this.targetX = mouseX;
          this.targetY = mouseY;
        }
      } else if (!activelyEngulfing) {
        // If we have a current target that's still valid, keep pursuing it
        if (this.currentTarget && !this.currentTarget.eaten && !this.currentTarget.engulfing) {
          const dx = this.currentTarget.x - this.x;
          const dy = this.currentTarget.y - this.y;
          const dist = Math.hypot(dx, dy);

          // Give up on target if it gets too far away
          if (dist > 400) {
            this.currentTarget = null;
          }
        } else {
          this.currentTarget = null;
        }

        // Find new target if we don't have one
        if (!this.currentTarget) {
          this.currentTarget = this.findNearestFood(foodParticles);
          this.targetPursuitFrames = 0;
        } else {
          // Eating needs food inside a 15-degree cone, so a target approached at a
          // bad angle can be circled indefinitely. Give up rather than jitter on it.
          this.targetPursuitFrames = (this.targetPursuitFrames || 0) + deltaTime;
          if (this.targetPursuitFrames > 240) {
            this.ignoredTarget = this.currentTarget;
            this.currentTarget = null;
            this.targetPursuitFrames = 0;
            this.targetX = Math.random() * canvas.width;
            this.targetY = Math.random() * canvas.height;
          }
        }

        const targetFood = this.currentTarget;
        if (targetFood) {
          this.targetX = targetFood.x;
          this.targetY = targetFood.y;
          const dx = targetFood.x - this.x;
          const dy = targetFood.y - this.y;
          const angleToFood = Math.atan2(dy, dx);
          let angleDiff = angleToFood - this.angle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          // Only eat if food is directly in front (within 15 degrees cone - very strict)
          const isFrontFacing = Math.abs(angleDiff) < Math.PI / 12; // 15 degree cone (7.5° each side)
          const dist = Math.hypot(dx, dy);

          if (isFrontFacing && dist < this.width / 2 + 15 * S) {
            targetFood.engulfing = true;
            targetFood.engulfProgress = 0;
            // Store relative offsets (dx, dy) like the backup does
            targetFood.targetX = dx;
            targetFood.targetY = dy;
            this.isEngulfing = true;
            this.currentTarget = null; // Clear target after eating starts

            // Create membrane opening at the front (always angle 0)
            this.membraneDistortions.push({
              angle: 0, // Always at front (angle 0 in cell's rotated coordinate system)
              intensity: 0,
              maxIntensity: 1,
              phase: 'opening',
              food: targetFood,
              openingRadius: 0
            });
          }
        } else {
          this.isEngulfing = false;
          if (Math.random() < 0.02) {
            this.targetX = Math.random() * canvas.width;
            this.targetY = Math.random() * canvas.height;
          }
        }
      }

      this.membraneDistortions = this.membraneDistortions.filter(distortion => {
        if (distortion.phase === 'opening') {
          distortion.intensity += 0.05 * deltaTime;
          distortion.openingRadius += 1.2 * deltaTime;
          if (distortion.intensity >= distortion.maxIntensity) {
            distortion.phase = 'closing';
          }
        } else if (distortion.phase === 'closing') {
          distortion.intensity -= 0.06 * deltaTime;
          distortion.openingRadius -= 1.5 * deltaTime;
          if (distortion.intensity <= 0) {
            return false;
          }
        }
        return true;
      });

      foodParticles.forEach(food => {
        if (food.engulfing) {
          food.engulfProgress += 0.035 * deltaTime;

          // Smoothly move food toward center (relative to microbe)
          const currentX = food.targetX * (1 - food.engulfProgress);
          const currentY = food.targetY * (1 - food.engulfProgress);

          food.currentX = currentX;
          food.currentY = currentY;

          if (food.engulfProgress >= 1) {
            food.eaten = true;
            if (this.phagosome.particles.length < 15) {
              const particleData = {
                size: food.size,
                color: food.color,
                hollow: food.hollow,
                x: (Math.random() - 0.5) * this.phagosome.phagosomeRadius * 0.8,
                y: (Math.random() - 0.5) * this.phagosome.phagosomeRadius * 0.8
              };
              this.phagosome.particles.push(particleData);
            }
          }
        }
      });

      // Smooth movement toward target (like backup)
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;

      this.velocityX += dx * 0.0006 * deltaTime;
      this.velocityY += dy * 0.0006 * deltaTime;

      // Apply friction (simpler linear damping for stability)
      this.velocityX *= 0.95;
      this.velocityY *= 0.95;

      // Cap maximum velocity to prevent zooming
      const maxVelocity = 3.0;
      const currentSpeed = Math.hypot(this.velocityX, this.velocityY);
      if (currentSpeed > maxVelocity) {
        const scale = maxVelocity / currentSpeed;
        this.velocityX *= scale;
        this.velocityY *= scale;
      }

      this.x += this.velocityX * deltaTime;
      this.y += this.velocityY * deltaTime;

      // Smooth angle rotation (slower when engulfing)
      this.targetAngle = Math.atan2(dy, dx);
      let angleDiff = this.targetAngle - this.angle;

      // Normalize angle difference
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Keep reasonable turning speed when engulfing (don't slow down too much)
      const turnSpeed = this.isEngulfing ? 0.05 : 0.08;
      this.angle += angleDiff * turnSpeed * deltaTime;
      this.ruffleOffset = this.ruffleOffset.map(offset => offset + 0.08);
      this.flagella.forEach(flagellum => {
        flagellum.waveOffset += flagellum.waveSpeed;
      });
      if (this.x < 0) this.x = 0;
      if (this.x > canvas.width) this.x = canvas.width;
      if (this.y < 0) this.y = 0;
      if (this.y > canvas.height) this.y = canvas.height;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.beginPath();
      let pathPoints = [];
      for (let i = 0; i <= 50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const ruffle = Math.sin(this.ruffleOffset[i % this.ruffleOffset.length]) * 2;
        let radiusX = this.width / 2 + ruffle;
        let radiusY = this.height / 2 + ruffle;
        this.membraneDistortions.forEach(distortion => {
          const angleDiff = Math.abs(((angle - distortion.angle + Math.PI) % (Math.PI * 2)) - Math.PI);
          const openingArc = 0.6;
          if (angleDiff < openingArc && distortion.openingRadius > 5) {
            const openingFactor = Math.cos(angleDiff / openingArc * Math.PI / 2);
            const smoothFactor = Math.pow(openingFactor, 3.5);
            radiusX -= distortion.openingRadius * smoothFactor;
            radiusY -= distortion.openingRadius * smoothFactor;
          }
        });
        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;
        pathPoints.push({x, y});
      }
      pathPoints.forEach((point, idx) => {
        if (idx === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(100, 100, 100, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(80, 80, 80, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw flagella
      this.flagella.forEach(flagellum => {
        const membraneX = Math.cos(flagellum.angle) * this.width / 2;
        const membraneY = Math.sin(flagellum.angle) * this.height / 2;
        ctx.beginPath();
        ctx.moveTo(membraneX, membraneY);
        const segments = 10;
        for (let i = 1; i <= segments; i++) {
          const t = i / segments;
          const distance = t * flagellum.length;
          const wave = Math.sin(t * Math.PI * 2 + flagellum.waveOffset) * 1.5;
          const baseX = membraneX + Math.cos(flagellum.angle) * distance;
          const baseY = membraneY + Math.sin(flagellum.angle) * distance;
          const perpAngle = flagellum.angle + Math.PI / 2;
          const x = baseX + Math.cos(perpAngle) * wave;
          const y = baseY + Math.sin(perpAngle) * wave;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(80, 80, 80, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // Draw phagosome
      const phagosome = this.phagosome;
      if (!phagosome.roughnessValues) {
        phagosome.roughnessValues = [];
        const numPoints = 25;
        for (let i = 0; i <= numPoints; i++) {
          phagosome.roughnessValues.push((Math.random() - 0.5) * 4);
        }
      }
      ctx.beginPath();
      const numPoints = 25;
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const roughness = phagosome.roughnessValues[i];
        const radius = phagosome.phagosomeRadius + roughness;
        const x = phagosome.x + Math.cos(angle) * radius;
        const y = phagosome.y + Math.sin(angle) * radius;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw particles in phagosome
      phagosome.particles.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(phagosome.x + particle.x, phagosome.y + particle.y, particle.size, 0, Math.PI * 2);
        if (particle.hollow) {
          ctx.strokeStyle = particle.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = particle.color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });

      // Draw cytoplasmic dots
      this.cytoplasmicDots.forEach(dot => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
        ctx.fill();
      });

      ctx.restore();
    }
  }

  // Food particle colors (darker shades)
  const foodColors = [
    'rgba(220, 140, 160, 0.85)',  // Darker pink
    'rgba(130, 180, 200, 0.85)',  // Darker blue
    'rgba(210, 200, 150, 0.85)',  // Darker yellow
    'rgba(150, 190, 150, 0.85)'   // Darker green
  ];

  // Background food particle class (static, non-edible, depth effect via opacity)
  class BackgroundFoodParticle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = 2.5 + Math.random() * 3; // Slightly varied size
      this.color = foodColors[Math.floor(Math.random() * foodColors.length)];
      this.hollow = Math.random() < 0.5;
      this.opacity = 0.15 + Math.random() * 0.3; // Very low opacity for background/depth effect

      // Subtle drift properties for floating effect
      this.driftPhaseX = Math.random() * Math.PI * 2;
      this.driftPhaseY = Math.random() * Math.PI * 2;
      this.driftSpeedX = 0.01 + Math.random() * 0.015; // Very slow drift
      this.driftSpeedY = 0.008 + Math.random() * 0.012;
      this.driftAmplitude = 0.3 + Math.random() * 0.4; // Small oscillation range
      this.baseX = this.x;
      this.baseY = this.y;

      // Fade-in effect
      this.fadeOpacity = 0;
      this.targetOpacity = this.opacity;
    }

    update(time) {
      // Fade in gradually
      if (this.fadeOpacity < this.targetOpacity) {
        this.fadeOpacity = Math.min(this.fadeOpacity + 0.01, this.targetOpacity);
      }

      // Gentle sine-wave drift to simulate floating in liquid
      this.x = this.baseX + Math.sin(time * this.driftSpeedX + this.driftPhaseX) * this.driftAmplitude;
      this.y = this.baseY + Math.cos(time * this.driftSpeedY + this.driftPhaseY) * this.driftAmplitude;

      // Keep within canvas bounds
      if (this.baseX < 0 || this.baseX > canvas.width) {
        this.baseX = Math.random() * canvas.width;
      }
      if (this.baseY < 0 || this.baseY > canvas.height) {
        this.baseY = Math.random() * canvas.height;
      }
    }

    draw() {
      // Parse color and adjust opacity for depth effect with fade-in
      const colorMatch = this.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (colorMatch) {
        const [_, r, g, b] = colorMatch;
        const adjustedColor = `rgba(${r}, ${g}, ${b}, ${this.fadeOpacity})`;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);

        if (this.hollow) {
          ctx.strokeStyle = adjustedColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = adjustedColor;
          ctx.fill();
          ctx.strokeStyle = `rgba(0, 0, 0, ${this.fadeOpacity * 0.2})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  // Food particle class
  class FoodParticle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = 2 + Math.random() * 2;
      this.color = foodColors[Math.floor(Math.random() * foodColors.length)];
      this.hollow = Math.random() < 0.5;
      this.eaten = false;
      this.engulfing = false;
      this.engulfProgress = 0;
      this.currentX = 0;
      this.currentY = 0;

      // Subtle drift properties for floating effect
      this.driftPhaseX = Math.random() * Math.PI * 2;
      this.driftPhaseY = Math.random() * Math.PI * 2;
      this.driftSpeedX = 0.012 + Math.random() * 0.018; // Very slow drift
      this.driftSpeedY = 0.01 + Math.random() * 0.015;
      this.driftAmplitude = 0.4 + Math.random() * 0.5; // Small oscillation range
      this.baseX = this.x;
      this.baseY = this.y;

      // Fade-in effect
      this.fadeOpacity = 0;
    }

    update(time) {
      // Fade in gradually
      if (this.fadeOpacity < 1.0) {
        this.fadeOpacity = Math.min(this.fadeOpacity + 0.02, 1.0);
      }

      // Only drift if not being eaten
      if (!this.engulfing && !this.eaten) {
        // Gentle sine-wave drift to simulate floating in liquid
        this.x = this.baseX + Math.sin(time * this.driftSpeedX + this.driftPhaseX) * this.driftAmplitude;
        this.y = this.baseY + Math.cos(time * this.driftSpeedY + this.driftPhaseY) * this.driftAmplitude;

        // Keep within canvas bounds
        if (this.baseX < 0 || this.baseX > canvas.width) {
          this.baseX = Math.random() * canvas.width;
        }
        if (this.baseY < 0 || this.baseY > canvas.height) {
          this.baseY = Math.random() * canvas.height;
        }
      }
    }

    draw(microbeX, microbeY) {
      if (!this.eaten) {
        let drawX = this.x;
        let drawY = this.y;

        // If being engulfed, draw at intermediate position relative to microbe
        if (this.engulfing) {
          drawX = microbeX + this.currentX;
          drawY = microbeY + this.currentY;
        }

        // Parse color and apply fade-in opacity
        const colorMatch = this.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (colorMatch) {
          const [_, r, g, b, a] = colorMatch;
          const baseOpacity = a ? parseFloat(a) : 0.85;
          const finalOpacity = baseOpacity * this.fadeOpacity;
          const adjustedColor = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;

          ctx.beginPath();
          ctx.arc(drawX, drawY, this.size, 0, Math.PI * 2);
          if (this.hollow) {
            ctx.strokeStyle = adjustedColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();
          } else {
            ctx.fillStyle = adjustedColor;
            ctx.fill();
            ctx.strokeStyle = `rgba(0, 0, 0, ${0.3 * this.fadeOpacity})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
    }
  }

  // Helper functions for obstacle detection
  function getObstacles() {
    const obstacles = [];
    config.obstacleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const rect = element.getBoundingClientRect();
        obstacles.push({x: rect.left, y: rect.top, width: rect.width, height: rect.height});
      });
    });
    return obstacles;
  }

  function isInsideObstacle(x, y, obstacles, padding = 20) {
    return obstacles.some(obs =>
      x > obs.x - padding &&
      x < obs.x + obs.width + padding &&
      y > obs.y - padding &&
      y < obs.y + obs.height + padding
    );
  }

  // Initialize microbe
  const microbe = new Microbe();
  microbe.x = canvas.width * config.microbeSpawnX;
  microbe.y = canvas.height * config.microbeSpawnY;

  // Initialize background food particles (static, non-edible, blurred)
  const backgroundFoodParticles = [];
  for (let i = 0; i < config.backgroundFoodCount; i++) {
    backgroundFoodParticles.push(new BackgroundFoodParticle());
  }

  // Initialize food particles
  const foodParticles = [];
  const obstacles = getObstacles();
  for (let i = 0; i < config.foodParticleCount; i++) {
    let foodParticle;
    let validPosition = false;
    let attempts = 0;

    while (!validPosition && attempts < 100) {
      foodParticle = new FoodParticle();
      const distFromMicrobe = Math.hypot(foodParticle.x - microbe.x, foodParticle.y - microbe.y);
      const notInObstacle = !isInsideObstacle(foodParticle.x, foodParticle.y, obstacles, 30); // Increased padding

      if (distFromMicrobe > 150 && notInObstacle) {
        validPosition = true;
      }
      attempts++;
    }

    if (validPosition) {
      foodParticles.push(foodParticle);
    }
  }

  // Animation loop with delta time for consistent speed across different refresh rates
  let lastTime = performance.now();

  function animate(currentTime) {
    // Calculate delta time (time since last frame) and normalize to 60fps baseline
    // This ensures animation runs at same speed whether display is 60Hz, 120Hz, or 144Hz
    const deltaTime = Math.min((currentTime - lastTime) / 16.67, 2.0); // Cap at 2.0 to prevent huge jumps
    lastTime = currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const currentObstacles = getObstacles();

    // Obstacle rects are viewport-relative, so scrolling (or an accordion opening)
    // can leave food stranded behind a content box. Move any that ends up there,
    // otherwise the microbe hovers over the card chasing food it can never reach.
    foodParticles.forEach((food, index) => {
      if (food.eaten || food.engulfing) return;
      if (!isInsideObstacle(food.x, food.y, currentObstacles, 30)) return;
      for (let attempt = 0; attempt < 30; attempt++) {
        const candidate = new FoodParticle();
        if (!isInsideObstacle(candidate.x, candidate.y, currentObstacles, 30) &&
            Math.hypot(candidate.x - microbe.x, candidate.y - microbe.y) > 100) {
          if (microbe.currentTarget === food) microbe.currentTarget = null;
          foodParticles[index] = candidate;
          break;
        }
      }
    });

    // Respawn eaten food particles
    foodParticles.forEach((food, index) => {
      if (food.eaten) {
        let newFood;
        let attempts = 0;
        let validPosition = false;

        while (!validPosition && attempts < 50) {
          newFood = new FoodParticle();
          const notInObstacle = !isInsideObstacle(newFood.x, newFood.y, currentObstacles, 30); // Increased padding
          const distFromMicrobe = Math.hypot(newFood.x - microbe.x, newFood.y - microbe.y);

          if (notInObstacle && distFromMicrobe > 100) {
            validPosition = true;
          }
          attempts++;
        }

        if (validPosition) {
          foodParticles[index] = newFood;
        }
      }
    });

    // Update all particles with gentle floating movement
    const time = currentTime * 0.001; // Convert to seconds for smoother movement
    backgroundFoodParticles.forEach(bgFood => bgFood.update(time));
    foodParticles.forEach(food => food.update(time));

    // Draw everything in layers (back to front):
    // 1. Background food (blurred, static, non-edible)
    backgroundFoodParticles.forEach(bgFood => bgFood.draw());

    // 2. Regular food particles (edible)
    foodParticles.forEach(food => food.draw(microbe.x, microbe.y));

    // 3. Microbe (on top)
    microbe.update(foodParticles, mouseX, mouseY, mouseActive, deltaTime);
    microbe.draw();

    requestAnimationFrame(animate);
  }

  // Start animation (passing initial time to prevent large first deltaTime)
  animate(performance.now());
}

// Auto-initialize only if data-auto-init-microbe attribute is present
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.hasAttribute('data-auto-init-microbe')) {
      const config = {};
      if (document.body.hasAttribute('data-microbe-obstacles')) {
        config.obstacleSelectors = document.body.getAttribute('data-microbe-obstacles').split(',');
      }
      if (document.body.hasAttribute('data-microbe-food-count')) {
        config.foodParticleCount = parseInt(document.body.getAttribute('data-microbe-food-count'));
      }
      if (document.body.hasAttribute('data-microbe-background-food-count')) {
        config.backgroundFoodCount = parseInt(document.body.getAttribute('data-microbe-background-food-count'));
      }
      if (document.body.hasAttribute('data-microbe-spawn-x')) {
        config.microbeSpawnX = parseFloat(document.body.getAttribute('data-microbe-spawn-x'));
      }
      if (document.body.hasAttribute('data-microbe-spawn-y')) {
        config.microbeSpawnY = parseFloat(document.body.getAttribute('data-microbe-spawn-y'));
      }
      initMicrobeAnimation(config);
    }
  });
} else {
  if (document.body.hasAttribute('data-auto-init-microbe')) {
    const config = {};
    if (document.body.hasAttribute('data-microbe-obstacles')) {
      config.obstacleSelectors = document.body.getAttribute('data-microbe-obstacles').split(',');
    }
    if (document.body.hasAttribute('data-microbe-food-count')) {
      config.foodParticleCount = parseInt(document.body.getAttribute('data-microbe-food-count'));
    }
    if (document.body.hasAttribute('data-microbe-background-food-count')) {
      config.backgroundFoodCount = parseInt(document.body.getAttribute('data-microbe-background-food-count'));
    }
    if (document.body.hasAttribute('data-microbe-spawn-x')) {
      config.microbeSpawnX = parseFloat(document.body.getAttribute('data-microbe-spawn-x'));
    }
    if (document.body.hasAttribute('data-microbe-spawn-y')) {
      config.microbeSpawnY = parseFloat(document.body.getAttribute('data-microbe-spawn-y'));
    }
    initMicrobeAnimation(config);
  }
}

// Make function globally available for manual initialization
window.initMicrobeAnimation = initMicrobeAnimation;
