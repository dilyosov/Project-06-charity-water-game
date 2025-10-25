// Clean Drop Runner - Canvas version using requestAnimationFrame
// Beginner-friendly, commented, uses const/let and template literals

/* ===========
   DOM Elements
   =========== */
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const gameArea = document.getElementById('game-area');
const gameOverScreen = document.getElementById('game-over');
const playAgainBtn = document.getElementById('play-again-btn');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const finalScore = document.getElementById('final-score');
const waterFact = document.getElementById('water-fact');
const highscoreEl = document.getElementById('highscore');

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
// add HUD control reference (ensure pauseBtn exists to avoid ReferenceError)
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');

/* ===============
   Game parameters
   =============== */
let running = false;
let paused = false; // new: pause state
let lastTime = 0;
let spawnTimer = 0;
let score = 0;
let secondsCounter = 0;
let highscore = Number(localStorage.getItem('cdr-highscore') || 0);

let gameSpeed = 180; // pixels per second base
let difficultyTimer = 0;

/* Player (clean water drop) */
const player = {
	x: 80,
	y: 0,
	width: 44,
	height: 56,
	vy: 0,
	jumpPower: -760,
	gravity: 2200,
	onGround: true,
	color: '#2E9DF7',
	filterActive: false,
	// new: track expression state (happy vs mad)
	isMad: false,
	// new: remember previous Y to detect stomps
	prevY: 0
};

/* Arrays for obstacles, collectibles, powerups */
let obstacles = [];
let collectibles = [];
let powerups = [];

/* Confetti particle array (temporary celebration) */
let confettiParticles = [];

/* Filter aura visual state (activated when player picks up a filter powerup) */
let filterAura = { active: false, radius: 0, opacity: 0 };

/* Speed line particles for pump visual */
let speedLines = [];

/* Water facts for game over screen */
const waterFacts = [
	"771 million people lack access to clean water.",
	"Clean water improves health and education.",
	"Every drop counts!",
	"Women and children spend 200 million hours daily collecting water.",
	"Access to clean water can break the cycle of poverty."
];

/* Utility: random choice */
function rand(min, max) { return Math.random() * (max - min) + min; }

/* ==============
   Canvas resizing
   ============== */
/* Make canvas responsive while keeping internal coordinate system */
function resizeCanvas() {
	// keep the logical size fixed for consistent gameplay and scale CSS size
	canvas.width = 820; // logical width
	canvas.height = 360; // logical height
	// CSS width is handled via styles.css (max-width)
}
resizeCanvas();

/* ============
   Game methods
   ============ */

/* Initialize or reset the game state */
function initGame() {
	// Reset variables
	running = true;
	lastTime = performance.now();
	spawnTimer = 0;
	score = 0;
	secondsCounter = 0;
	gameSpeed = 180;
	difficultyTimer = 0;
	obstacles = [];
	collectibles = [];
	powerups = [];
	activePower = null;
	player.y = canvas.height - player.height - 32; // ground offset 32
	player.vy = 0;
	player.onGround = true;
	player.filterActive = false;
	// reset expression to happy when starting
	player.isMad = false;

	// Update HUD
	scoreDisplay.textContent = `Score: ${score}`;
	livesDisplay.textContent = `Lives: ${3}`;
	highscoreEl && (highscoreEl.textContent = `High: ${highscore}`);

	// audio removed: no loading or playback

	// Start loop
	lastTime = performance.now();
	requestAnimationFrame(gameLoop);
}

/* Reset game to start screen (called after game over) */
function resetGame() {
	// stop the loop and clear state
	running = false;
	paused = false;
	// clear objects and reset scores
	obstacles = [];
	collectibles = [];
	powerups = [];
	score = 0;
	secondsCounter = 0;
	scoreDisplay.textContent = `Score: ${score}`;
	livesDisplay.textContent = `Lives: ${3}`;
	// ensure pause button shows 'Pause' next time
	if (pauseBtn) pauseBtn.textContent = 'Pause';
	// show start UI
	showStartScreen();
}

/* Spawn helpers (create simple rectangle objects) */
function spawnObstacle() {
	// Spawn obstacles shaped like barrels: slightly wider and taller range
	const h = rand(36, 64);   // taller for barrel look
	const w = rand(30, 46);   // wider for barrel look
	const y = canvas.height - h - 32; // ground offset
	// mark as barrel so drawGame knows to render barrel details
	obstacles.push({ x: canvas.width + 10, y, w, h, barrel: true, color: '#1b1b1b' });
}

function spawnCollectible() {
	const size = 18;
	const y = canvas.height - rand(80, 140);
	collectibles.push({ x: canvas.width + 10, y, w: size, h: size, color: '#4FCB53' });
}

function spawnPowerup() {
	const types = ['filter', 'pump', 'well'];
	const type = types[Math.floor(Math.random()*types.length)];
	const size = 20;
	const y = canvas.height - rand(100, 160);
	powerups.push({ x: canvas.width + 10, y, w: size, h: size, type });
}

/* AABB collision detection */
function isColliding(a, b) {
	return (
		a.x < b.x + b.w &&
		a.x + a.width > b.x &&
		a.y < b.y + b.h &&
		a.y + a.height > b.y
	);
}

/* Update game state (physics, spawning, collisions) */
function updateGame(dt) {
	if (!running) return;

	// remember previous vertical position for stomp detection
	player.prevY = player.y;

	// increase difficulty slowly
	difficultyTimer += dt;
	if (difficultyTimer > 10) {
		gameSpeed += 12; // small bump every 10 seconds
		difficultyTimer = 0;
	}

	// Player physics: integrate velocity
	player.vy += player.gravity * dt;
	player.y += player.vy * dt;

	// Ground collision
	const groundY = canvas.height - 32 - player.height;
	if (player.y >= groundY) {
		player.y = groundY;
		player.vy = 0;
		player.onGround = true;
	} else {
		player.onGround = false;
	}

	// Spawning logic
	spawnTimer += dt;
	// spawn obstacles with some probability per second
	if (spawnTimer > 0.6) {
		if (Math.random() < 0.6) spawnObstacle();
		if (Math.random() < 0.35) spawnCollectible();
		if (Math.random() < 0.08) spawnPowerup();
		spawnTimer = 0;
	}

	// Move obstacles / collectibles / powerups from right to left
	const moveBy = gameSpeed * dt;
	obstacles.forEach(o => o.x -= moveBy);
	collectibles.forEach(c => c.x -= moveBy);
	powerups.forEach(p => p.x -= moveBy);

	// Remove off-screen items
	obstacles = obstacles.filter(o => o.x + o.w > -20);
	collectibles = collectibles.filter(c => c.x + c.w > -20);
	powerups = powerups.filter(p => p.x + p.w > -20);

	// Collisions with obstacles (player is rectangle)
	const playerRect = { x: player.x, y: player.y, width: player.width, height: player.height };
	// Track lives via a variable and display
	let lives = Number(livesDisplay.textContent.replace(/[^\d]/g, '')) || 3;

	for (let i = obstacles.length - 1; i >= 0; i--) {
		const o = obstacles[i];
		const obsRect = { x: o.x, y: o.y, w: o.w, h: o.h };

		if (isColliding(playerRect, obsRect)) {
			// If it's a barrel, allow stomping: player must be falling and previous bottom was above obstacle top
			const playerPrevBottom = player.prevY + player.height;
			const obstacleTop = o.y;
			const isFalling = player.vy > 0;

			if (o.barrel && isFalling && playerPrevBottom <= obstacleTop + 6) {
				// Stomp: remove barrel, award points, bounce player
				obstacles.splice(i, 1);
				score += 10;
				scoreDisplay.textContent = `Score: ${score}`;
				// small bounce: set upward velocity (fraction of jumpPower)
				player.vy = player.jumpPower * 0.6;
				player.onGround = false;
			} else {
				// existing behavior: filter power or take a life
				if (activePower && activePower.type === 'filter') {
					obstacles.splice(i, 1);
				} else {
					obstacles.splice(i, 1);
					lives--;
					livesDisplay.textContent = `Lives: ${lives}`;
					// audio removed: no warning sound played
					// End game when lives reach 0
					if (lives <= 0) {
						endGame();
						return;
					}
				}
			}
		}
	}

	// Collectibles collision -> +10 points
	for (let i = collectibles.length - 1; i >= 0; i--) {
		const c = collectibles[i];
		if (isColliding(playerRect, { x: c.x, y: c.y, w: c.w, h: c.h })) {
			collectibles.splice(i, 1);
			score += 10;
			scoreDisplay.textContent = `Score: ${score}`;
			// audio removed: no chime played
		}
	}

	// Powerup collision
	for (let i = powerups.length - 1; i >= 0; i--) {
		const p = powerups[i];
		if (isColliding(playerRect, { x: p.x, y: p.y, w: p.w, h: p.h })) {
			powerups.splice(i, 1);
			activatePowerup(p.type);
		}
	}

	// Powerup active timer decrement
	if (activePower) {
		activePower.timer -= dt;
		if (activePower.timer <= 0) {
			// deactivate effects
			if (activePower.type === 'pump') {
				gameSpeed = Math.max(140, gameSpeed - 60); // revert speed bump
			}
			activePower = null;
			player.filterActive = false;
		}
	}

	// Score increments by time survived (1 point per second)
	secondsCounter += dt;
	if (secondsCounter >= 1) {
		score += Math.floor(secondsCounter); // add whole seconds
		scoreDisplay.textContent = `Score: ${score}`;
		secondsCounter = 0;
	}

	// Update highscore live display
	if (score > highscore) {
		highscore = score;
		localStorage.setItem('cdr-highscore', `${highscore}`);
		highscoreEl && (highscoreEl.textContent = `High: ${highscore}`);
	}

	// Update confetti particles
	if (confettiParticles.length > 0) {
		// gravity pixels/sec^2
		const G = 900;
		for (let p of confettiParticles) {
			// integrate physics using dt (seconds)
			p.vy += G * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.angle += p.spin * dt;
			p.life -= dt;
		}
		// remove dead particles
		confettiParticles = confettiParticles.filter(p => p.life > 0);
	}

	// Update filter aura animation (expand + fade)
	if (filterAura.active) {
		filterAura.radius += 100 * dt;      // expand speed (px/sec)
		filterAura.opacity -= 1.2 * dt;    // fade speed (per second)
		if (filterAura.opacity <= 0) {
			filterAura.active = false;
			filterAura.opacity = 0;
		}
	}

	// Update speedLines (pump visual)
	if (speedLines.length > 0) {
		for (let s of speedLines) {
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.life -= dt;
			s.opacity = Math.max(0, s.opacity - 2.5 * dt); // fade faster
		}
		speedLines = speedLines.filter(s => s.life > 0);
	}
}

/* Draw the game (background scrolling, player, obstacles, items) */
let bgOffset = 0;
function drawGame() {
	// Clear canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw simple scrolling background: two rectangles moving left
	bgOffset = (bgOffset + (gameSpeed * 0.2) / 60) % canvas.width;
	ctx.fillStyle = '#e6f8ff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	// Simple ground pattern
	ctx.fillStyle = '#d4f0ff';
	for (let x = -bgOffset; x < canvas.width; x += 120) {
		ctx.fillRect(x, canvas.height - 32, 60, 32);
	}

	// Draw player as a teardrop water icon (bigger and visually clear)
	ctx.save();

	// small bob animation for friendly feel (visual only — doesn't affect collision)
	const t = performance.now() / 180; // time factor
	const bob = Math.sin(t) * (player.onGround ? 2 : 6); // gentle on ground, bigger in air

	// slight visual "pop" when jumping (scale) — apply to drawing transform
	if (!player.onGround) {
		ctx.translate(player.x + player.width/2, player.y + player.height/2 + bob);
		ctx.scale(1.02, 1.02);
		ctx.translate(-(player.x + player.width/2), -(player.y + player.height/2 + bob));
	}

	const px = player.x, py = player.y + bob, pw = player.width, ph = player.height;
	// drawDrop now handles path + fill (including gradient) and stroke outline
	drawDrop(ctx, px, py, pw, ph, player.filterActive);
	// draw friendly face (eyes, mouth), rosy cheeks, rounded limbs
	drawFaceAndLimbs(ctx, px, py, pw, ph, player.isMad);
	ctx.restore();

	// Draw speed lines (pump visual) right after player so they appear around the player
	if (speedLines.length > 0) {
		for (let line of speedLines) {
			ctx.save();
			ctx.strokeStyle = `rgba(255,144,42, ${line.opacity})`; // Orange brand color
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(line.x, line.y);
			ctx.lineTo(line.x + line.length, line.y);
			ctx.stroke();
			ctx.restore();
		}
	}

	// Draw filter aura (friendly light-blue ring) just after player so it appears around them
	if (filterAura.active && filterAura.opacity > 0) {
		ctx.save();
		ctx.fillStyle = `rgba(139,209,203, ${filterAura.opacity})`; // light blue with variable opacity
		ctx.beginPath();
		ctx.arc(
			player.x + player.width / 2,
			player.y + player.height / 2,
			filterAura.radius,
			0,
			Math.PI * 2
		);
		ctx.fill();
		ctx.restore();
	}

	// Draw obstacles (barrels)
	obstacles.forEach(o => {
		if (o.barrel) {
			const bx = o.x, by = o.y, bw = o.w, bh = o.h;

			// main cylindrical body (slightly inset top/bottom for better shape)
			ctx.fillStyle = '#1b1b1b';
			roundRect(ctx, bx, by + 6, bw, bh - 12, 6);
			ctx.fill();

			// top rim (ellipse)
			ctx.fillStyle = '#0f0f0f';
			ctx.beginPath();
			ctx.ellipse(bx + bw/2, by + 6, bw/2, Math.max(6, bw * 0.12), 0, 0, Math.PI * 2);
			ctx.fill();

			// subtle highlight on front
			ctx.fillStyle = 'rgba(255,255,255,0.05)';
			ctx.beginPath();
			ctx.ellipse(bx + bw*0.35, by + bh*0.45, bw*0.12, bh*0.18, -0.25, 0, Math.PI*2);
			ctx.fill();

			// metal bands across barrel
			ctx.fillStyle = '#2f2f2f';
			const bandCount = 2;
			for (let i = 1; i <= bandCount; i++) {
				const bandY = by + 8 + ( (bh - 16) * i / (bandCount + 1) );
				ctx.fillRect(bx, bandY, bw, Math.max(3, bw * 0.04));
			}

			// bottom shadow ellipse
			ctx.fillStyle = 'rgba(0,0,0,0.22)';
			ctx.beginPath();
			ctx.ellipse(bx + bw/2, by + bh - 6, bw/2 * 0.98, Math.max(6, bw * 0.10), 0, 0, Math.PI * 2);
			ctx.fill();
		} else {
			// ...existing code for non-barrel obstacles...
			ctx.fillStyle = o.color;
			roundRect(ctx, o.x, o.y, o.w, o.h, 4);
			ctx.fill();
		}
	});

	// Draw collectibles (clean drops)
	collectibles.forEach(c => {
		ctx.fillStyle = c.color;
		ctx.beginPath();
		ctx.ellipse(c.x + c.w/2, c.y + c.h/2, c.w/2, c.h/2, 0, 0, Math.PI*2);
		ctx.fill();
	});

	// Draw powerups
	powerups.forEach(p => {
		// use the loaded image for this powerup type if available
		const img = powerupImages[p.type];
		// check image finished loading before drawing
		if (img && img.complete && img.naturalWidth !== 0) {
			// draw image at powerup position and size
			ctx.drawImage(img, p.x, p.y, p.w, p.h);
		} else {
			// fallback: draw a colored rounded rect as before while image loads / on error
			if (p.type === 'filter') ctx.fillStyle = '#8BD1CB';
			else if (p.type === 'pump') ctx.fillStyle = '#FF902A';
			else ctx.fillStyle = '#159A48';
			roundRect(ctx, p.x, p.y, p.w, p.h, 4);
			ctx.fill();

			// small letter for type (fallback)
			ctx.fillStyle = '#fff';
			ctx.font = '12px sans-serif';
			ctx.fillText(p.type[0].toUpperCase(), p.x + 6, p.y + 14);
		}
	});

	// Draw confetti particles (render above player for visibility)
	if (confettiParticles.length > 0) {
		for (let p of confettiParticles) {
			ctx.save();
			ctx.translate(p.x, p.y);
			ctx.rotate(p.angle);
			ctx.fillStyle = p.color;
			// draw centered rectangle
			ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
			ctx.restore();
		}
	}
}

/* Utility: draw rounded rectangle */
function roundRect(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y,   x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x,   y + h, r);
	ctx.arcTo(x,   y + h, x,   y,   r);
	ctx.arcTo(x,   y,   x + w, y,   r);
	ctx.closePath();
}

/* New: draw a friendlier, cartoon-style teardrop with outline and layered highlights */
function drawDrop(ctx, x, y, w, h, isFiltered) {
	const cx = x + w / 2;
	const topY = y;
	const bottomY = y + h;

	// soft teardrop path
	ctx.beginPath();
	ctx.moveTo(cx, topY); // tip
	ctx.bezierCurveTo(x + w * 1.02, y + h * 0.20, x + w * 0.62, bottomY - h * 0.06, cx, bottomY);
	ctx.bezierCurveTo(x + w * 0.38, bottomY - h * 0.06, x - w * 0.02, y + h * 0.20, cx, topY);
	ctx.closePath();

	// gentle vertical gradient
	const grad = ctx.createLinearGradient(x, y, x, y + h);
	if (isFiltered) {
		grad.addColorStop(0, '#9ff7c6');
		grad.addColorStop(1, '#2EA84A');
	} else {
		grad.addColorStop(0, '#cfefff');
		grad.addColorStop(0.6, '#7fd7ff');
		grad.addColorStop(1, '#2E9DF7');
	}
	ctx.fillStyle = grad;
	ctx.fill();

	// friendly outline (soft dark stroke)
	ctx.lineWidth = Math.max(2, w * 0.04);
	ctx.strokeStyle = 'rgba(4,34,60,0.85)';
	ctx.stroke();

	// layered highlights for cartoon gloss
	ctx.save();
	ctx.fillStyle = 'rgba(255,255,255,0.22)';
	ctx.beginPath();
	ctx.ellipse(cx - w * 0.18, y + h * 0.22, w * 0.20, h * 0.14, -0.25, 0, Math.PI * 2);
	ctx.fill();

	ctx.fillStyle = 'rgba(255,255,255,0.12)';
	ctx.beginPath();
	ctx.ellipse(cx - w * 0.06, y + h * 0.12, w * 0.08, h * 0.05, -0.35, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/* New: friendlier face and rounded limbs (cute eyes, rosy cheeks, rounded hands/feet).
   isMad toggles eyebrow/mouth to angry style for game over. */
function drawFaceAndLimbs(ctx, x, y, w, h, isMad) {
	const cx = x + w / 2;
	// Eye positions
	const eyeY = y + h * 0.34;
	const eyeLX = x + w * 0.33;
	const eyeRX = x + w * 0.67;
	const eyeOuter = Math.max(4, w * 0.12);
	const pupil = Math.max(2, w * 0.05);

	// Cheeks
	const cheekY = y + h * 0.48;
	const cheekOffsetX = w * 0.22;
	ctx.fillStyle = 'rgba(245,100,140,0.14)';
	ctx.beginPath();
	ctx.ellipse(cx - cheekOffsetX, cheekY, w * 0.09, h * 0.05, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(cx + cheekOffsetX, cheekY, w * 0.09, h * 0.05, 0, 0, Math.PI * 2);
	ctx.fill();

	// Eyes (big white with dark pupils and shine)
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.ellipse(eyeLX, eyeY, eyeOuter, eyeOuter * 0.85, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(eyeRX, eyeY, eyeOuter, eyeOuter * 0.85, 0, 0, Math.PI * 2);
	ctx.fill();

	// Pupils
	ctx.fillStyle = '#062033';
	ctx.beginPath();
	ctx.ellipse(eyeLX + (isMad ? -1 : 2), eyeY + (isMad ? -1 : 1), pupil, pupil, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(eyeRX + (isMad ? -1 : 2), eyeY + (isMad ? -1 : 1), pupil, pupil, 0, 0, Math.PI * 2);
	ctx.fill();

	// Eye shine
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	ctx.beginPath();
	ctx.ellipse(eyeLX - w * 0.03, eyeY - h * 0.02, Math.max(1, w * 0.03), Math.max(1, h * 0.02), 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(eyeRX - w * 0.03, eyeY - h * 0.02, Math.max(1, w * 0.03), Math.max(1, h * 0.02), 0, 0, Math.PI * 2);
	ctx.fill();

	// Eyebrows (soft for happy, angled for mad)
	ctx.strokeStyle = '#062033';
	ctx.lineWidth = Math.max(2, w * 0.03);
	ctx.lineCap = 'round';
	if (isMad) {
		ctx.beginPath();
		ctx.moveTo(eyeLX - w * 0.06, eyeY - h * 0.14);
		ctx.lineTo(eyeLX + w * 0.02, eyeY - h * 0.06);
		ctx.moveTo(eyeRX - w * 0.02, eyeY - h * 0.06);
		ctx.lineTo(eyeRX + w * 0.06, eyeY - h * 0.14);
		ctx.stroke();
	} else {
		ctx.beginPath();
		ctx.moveTo(eyeLX - w * 0.08, eyeY - h * 0.12);
		ctx.quadraticCurveTo(eyeLX, eyeY - h * 0.18, eyeLX + w * 0.08, eyeY - h * 0.12);
		ctx.moveTo(eyeRX - w * 0.08, eyeY - h * 0.12);
		ctx.quadraticCurveTo(eyeRX, eyeY - h * 0.18, eyeRX + w * 0.08, eyeY - h * 0.12);
		ctx.stroke();
	}

	// Mouth: friendly open smile or small angry frown
	const mouthY = y + h * 0.60;
	if (isMad) {
		ctx.strokeStyle = '#062033';
		ctx.lineWidth = Math.max(2, w * 0.04);
		ctx.beginPath();
		ctx.moveTo(cx - w * 0.12, mouthY + 6);
		ctx.quadraticCurveTo(cx, mouthY - 6, cx + w * 0.12, mouthY + 6);
		ctx.stroke();
	} else {
		// smile with slight fill (happy)
		ctx.fillStyle = '#062033';
		ctx.beginPath();
		ctx.moveTo(cx - w * 0.18, mouthY);
		ctx.quadraticCurveTo(cx, mouthY + h * 0.09, cx + w * 0.18, mouthY);
		ctx.lineTo(cx + w * 0.14, mouthY + h * 0.14);
		ctx.quadraticCurveTo(cx, mouthY + h * 0.24, cx - w * 0.14, mouthY + h * 0.14);
		ctx.closePath();
		ctx.fill();
		// small tongue highlight
		ctx.fillStyle = 'rgba(255,120,140,0.9)';
		ctx.beginPath();
		ctx.ellipse(cx, mouthY + h * 0.12, w * 0.05, h * 0.03, 0, 0, Math.PI * 2);
		ctx.fill();
	}

	// Arms: rounded, slightly curved (cute)
	ctx.strokeStyle = '#062033';
	ctx.lineWidth = Math.max(2, w * 0.035);
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(x + w * 0.16, y + h * 0.56);
	ctx.quadraticCurveTo(x + w * 0.06, y + h * 0.64, x - w * 0.02, y + h * 0.66);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + w * 0.84, y + h * 0.56);
	ctx.quadraticCurveTo(x + w * 0.94, y + h * 0.64, x + w + w * 0.02, y + h * 0.66);
	ctx.stroke();

	// small rounded hands
	ctx.fillStyle = '#062033';
	ctx.beginPath();
	ctx.ellipse(x - w * 0.02, y + h * 0.66 + 2, w * 0.035, w * 0.035, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(x + w + w * 0.02, y + h * 0.66 + 2, w * 0.035, w * 0.035, 0, 0, Math.PI * 2);
	ctx.fill();

	// Legs: short rounded feet
	ctx.lineWidth = Math.max(2, w * 0.04);
	ctx.beginPath();
	ctx.moveTo(cx - w * 0.16, y + h - h * 0.06);
	ctx.lineTo(cx - w * 0.16, y + h - h * 0.06 + (isMad ? 14 : 18));
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx + w * 0.16, y + h - h * 0.06);
	ctx.lineTo(cx + w * 0.16, y + h - h * 0.06 + (isMad ? 14 : 18));
	ctx.stroke();

	// feet circles
	ctx.fillStyle = '#062033';
	ctx.beginPath();
	ctx.ellipse(cx - w * 0.16, y + h - h * 0.06 + (isMad ? 14 : 18), w * 0.045, w * 0.03, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(cx + w * 0.16, y + h - h * 0.06 + (isMad ? 14 : 18), w * 0.045, w * 0.03, 0, 0, Math.PI * 2);
	ctx.fill();
}

/* Activate powerup effects */
function activatePowerup(type) {
	if (type === 'filter') {
		activePower = { type: 'filter', timer: 3.0 }; // seconds
		player.filterActive = true;

		// start the filter aura visual
		filterAura.active = true;
		filterAura.radius = player.width / 2;
		filterAura.opacity = 1.0;

	} else if (type === 'pump') {
		activePower = { type: 'pump', timer: 2.5 };
		// temporarily boost speed
		gameSpeed += 60;

		// create a short burst of speed lines around player
		createSpeedLinesBurst(player.x + player.width / 2, player.y + player.height / 2);

	} else if (type === 'well') {
		// add 1 life (we read/write from the DOM)
		let lives = Number(livesDisplay.textContent.replace(/[^\d]/g, '')) || 3;
		lives++;
		livesDisplay.textContent = `Lives: ${lives}`;
		// create a small confetti burst at the player's center
		createConfettiBurst(player.x + player.width / 2, player.y + player.height / 2);
		// small green flash could be drawn; for now rely on HUD
	}
}

/* New: create speed-line burst for pump effect */
function createSpeedLinesBurst(cx, cy) {
	const now = performance.now();
	// spawn a number of short-lived speed lines
	for (let i = 0; i < 30; i++) {
		const angle = rand(-0.25, 0.25); // mostly horizontal
		const length = rand(24, 80);
		const vy = rand(-12, 12);
		const vx = -rand(240, 560); // negative: move left quickly
		const life = rand(0.25, 0.6);
		speedLines.push({
			x: cx + rand(-8, 8),
			y: cy + rand(-10, 10),
			vx: vx,
			vy: vy,
			length: length,
			opacity: 1.0,
			life: life,
			created: now
		});
	}
}

/* New: create confetti burst */
function createConfettiBurst(x, y) {
	// colors for confetti pieces
	const colors = ['#FFC107', '#FF5722', '#FF80AB', '#8BD1CB', '#2E9DF7'];
	for (let i = 0; i < 50; i++) {
		const angle = (Math.random() * Math.PI * 2);
		const speed = rand(120, 420); // pixels per second initial speed
		const vx = Math.cos(angle) * speed;
		const vy = -rand(220, 480); // initial upward throw (negative vy)
		const w = rand(4, 9);
		const h = rand(6, 12);
		const spin = rand(-8, 8); // radians per second
		const life = rand(2.0, 3.2); // seconds
		const color = colors[Math.floor(Math.random() * colors.length)];
		confettiParticles.push({
			x: x,
			y: y,
			vx: vx,
			vy: vy,
			width: w,
			height: h,
			color: color,
			angle: Math.random() * Math.PI * 2,
			spin: spin,
			life: life
		});
	}
}

/* End game: show game over screen and final stats */
function endGame() {
	running = false;
	// set expression to mad so player shows angry face / posture
	player.isMad = true;
	// audio removed: no bgMusic.pause()
	// briefly show the mad expression on canvas, then show game over screen
	setTimeout(function() {
		gameArea.classList.add('hidden');
		gameOverScreen.classList.remove('hidden');
		finalScore.textContent = `Final Score: ${score}`;
		waterFact.textContent = `Water Fact: ${waterFacts[Math.floor(Math.random()*waterFacts.length)]}`;
		// ensure highscore saved
		if (score > highscore) {
			highscore = score;
			localStorage.setItem('cdr-highscore', `${highscore}`);
		}
	}, 600); // 600ms pause to let player see the mad expression
}

/* Main loop using requestAnimationFrame */
function gameLoop(timestamp) {
	if (!running) return;           // game not active
	if (paused) return;            // paused: stop requesting next frame
	const dt = Math.min(0.05, (timestamp - lastTime) / 1000); // clamp dt for safety
	lastTime = timestamp;

	updateGame(dt);
	drawGame();

	requestAnimationFrame(gameLoop);
}

/* ============
   Input handling
   ============ */
/* Jump action */
function jump() {
	// allow jump when on ground or small coyote window (simple)
	if (player.onGround) {
		player.vy = player.jumpPower;
		player.onGround = false;
	}
}

/* Keyboard */
document.addEventListener('keydown', (e) => {
	if (!running && (e.code === 'Space' || e.code === 'ArrowUp')) {
		// If on start screen, start game on first interaction
		startBtn.click();
		return;
	}
	if (e.code === 'Space' || e.code === 'ArrowUp') {
		e.preventDefault();
		jump();
	}
});

/* Touch for mobile: tap canvas to jump */
canvas.addEventListener('touchstart', (e) => {
	e.preventDefault();
	if (!running) {
		startBtn.click();
		return;
	}
	jump();
}, { passive: false });

/* Mouse click also jumps */
canvas.addEventListener('mousedown', (e) => {
	if (!running) {
		startBtn.click();
		return;
	}
	jump();
});

// Pause button behavior
if (pauseBtn) {
	pauseBtn.addEventListener('click', () => {
		// only allow pause when game is running
		if (!running) return;
		paused = !paused;
		pauseBtn.textContent = paused ? 'Resume' : 'Pause';
		// resume: restart the loop with fresh timestamp
		if (!paused) {
			lastTime = performance.now();
			requestAnimationFrame(gameLoop);
		}
	});
}

// Reset button behavior
if (resetBtn) {
	resetBtn.addEventListener('click', () => {
		resetGame();
	});
}

/* ============
   UI controls
   ============ */
function showStartScreen() {
	startScreen.classList.remove('hidden');
	gameArea.classList.add('hidden');
	gameOverScreen.classList.add('hidden');
	// show highscore
	highscoreEl && (highscoreEl.textContent = `High: ${highscore}`);
}

startBtn.addEventListener('click', () => {
	startScreen.classList.add('hidden');
	gameOverScreen.classList.add('hidden');
	gameArea.classList.remove('hidden');
	// set initial lives display
	livesDisplay.textContent = `Lives: ${3}`;
	initGame();
});

playAgainBtn.addEventListener('click', () => {
	gameOverScreen.classList.add('hidden');
	startScreen.classList.add('hidden');
	gameArea.classList.remove('hidden');
	livesDisplay.textContent = `Lives: ${3}`;
	initGame();
});

/* On load show start */
showStartScreen();

/* Make sure canvas scales nicely if window is resized (CSS handles width; keep logical size) */
window.addEventListener('resize', () => {
	// If you want to adjust any scaling logic, do it here.
});

/* ===========
   Asset loading (powerup images)
   =========== */
// Load powerup images before drawing them; file names must match exact case
const powerupImages = {
	filter: new Image(),
	pump: new Image(),
	well: new Image()
};
// exact filenames required
powerupImages.filter.src = 'img/Filter.PNG';
powerupImages.pump.src   = 'img/Pump.PNG';
powerupImages.well.src   = 'img/Well.PNG';

// optional: log load errors to help debug 404s
Object.keys(powerupImages).forEach(key => {
	powerupImages[key].onerror = function() {
		console.warn(`Powerup image failed to load: img/${key[0].toUpperCase() + key.slice(1)}.PNG`);
	};
});

/* ======================
   Helpful comments / tips
   ======================
- This implementation keeps a fixed logical canvas size (820x360) for predictable gameplay.
- requestAnimationFrame() provides smooth animation; we compute dt (seconds between frames) so movement is time-based.
- Collision uses simple AABB (axis-aligned bounding box).
- Powerups are simple and time-limited: filter (neutralize), pump (speed), well (+life).
- localStorage stores the high score under key 'cdr-highscore'.
- Audio is loaded from data-src when starting the game to avoid 404s before user interaction.
*/
