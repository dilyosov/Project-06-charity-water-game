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
// Difficulty UI elements (added to index.html)
const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
const difficultyDisplay = document.getElementById('difficulty-display');
// current difficulty state and settings placeholder
let currentDifficulty = localStorage.getItem('cdr-difficulty') || 'Normal';
let difficultyConfig = {};
// Canvas wrapper for DOM-positioned popups
const canvasWrap = document.getElementById('canvas-wrap');

/* =====================
   Audio: SFX and BGM loader & player
   Place audio files in `audio/` (ogg preferred). If files are missing the game will continue silently.
   Expected filenames (examples): jump/collect/hit/powerup/stomp/click/win/bgm
   Defining this near the top ensures `playSound()` is available for early handlers (jump, UI clicks).
======================*/

const audioFiles = {
	jump: 'audio/jump.ogg',
	collect: 'audio/collect.ogg',
	hit: 'audio/hit.ogg',
	powerup: 'audio/powerup.ogg',
	stomp: 'audio/stomp.ogg',
	click: 'audio/click.ogg',
	win: 'audio/win.ogg',
	bgm: 'audio/bgm.ogg'
};

// Preload audio elements (Audio objects). For short SFX we create an Audio and clone when playing
const audioCache = {};
Object.keys(audioFiles).forEach(key => {
	try {
		const src = audioFiles[key];
		const a = new Audio();
		a.src = src;
		a.preload = 'auto';
		a.load();
		audioCache[key] = a;
		a.addEventListener('error', () => {
			// not fatal; warn for debugging
			// console.warn(`Audio failed to load: ${src}`);
		});
	} catch (e) {
		// ignore environments without Audio
	}
});

// Play a short SFX by cloning the cached Audio element so multiple instances can overlap.
// Track whether audio should currently play. This is true during gameplay and
// turned false when the game ends so no further SFX/BGM will play.
// persisted mute flag (true when muted)
let muted = (localStorage.getItem('cdr-muted') === 'true');
// audioEnabled reflects whether audio may play (true when not muted)
let audioEnabled = !muted;
// Track active cloned audio instances so we can stop them on game over.
const activeAudioInstances = new Set();

function playSound(name, options = {}) {
	// options: { volume, play, force, excludeFromStop }
	// `force` allows playing even when `audioEnabled` is false (useful for
	// feedback clicks when muting). `excludeFromStop` marks the instance so
	// `stopAllAudio()` will not pause/remove it.
	const force = !!options.force;
	if (!audioEnabled && !force) return;
	const base = audioCache[name];
	if (!base) return;
	try {
		// For BGM, use the base element and control loop/volume
		if (name === 'bgm') {
			base.loop = true;
			base.volume = (options.volume !== undefined) ? options.volume : 0.36;
			if (options.play) base.play().catch(() => {});
			return;
		}

		// For short SFX, clone the Audio so multiple instances can overlap.
		const inst = base.cloneNode(true);
		inst.volume = (options.volume !== undefined) ? options.volume : 0.9;

		// Track instance so we can stop it on game over, unless explicitly excluded.
		const shouldTrack = !options.excludeFromStop;
		if (shouldTrack) activeAudioInstances.add(inst);
		const removeInstance = () => { if (shouldTrack) activeAudioInstances.delete(inst); };
		inst.addEventListener('ended', removeInstance);
		inst.addEventListener('pause', removeInstance);
		inst.play().catch(() => {
			// If playback fails (autoplay policy), ensure we don't leak the instance
			removeInstance();
		});
	} catch (e) {
		// ignore playback exceptions (autoplay policies, missing file)
	}
}

// Helper: start/stop background music
function startBGM() { if (audioEnabled) playSound('bgm', { play: true, volume: 0.36 }); }
function stopBGM() { const b = audioCache['bgm']; if (b) { b.pause(); try { b.currentTime = 0; } catch(e){} } }

// Stop and clear all active audio instances (SFX and BGM). Called on game over.
function stopAllAudio() {
	// disable audio to prevent new sounds from starting while we clean up
	audioEnabled = false;
	// stop cloned SFX instances
	for (const inst of Array.from(activeAudioInstances)) {
		try { inst.pause(); inst.currentTime = 0; } catch (e) {}
		activeAudioInstances.delete(inst);
	}
	// stop background music
	stopBGM();
}

// Update UI for mute buttons and persist state
function updateMuteUI() {
	const btn = document.getElementById('mute-btn');
	const btnMobile = document.getElementById('mute-btn-mobile');
	const icon = muted ? '🔇' : '🔊';
	if (btn) { btn.textContent = icon; btn.setAttribute('aria-pressed', String(muted)); }
	if (btnMobile) { btnMobile.textContent = icon; btnMobile.setAttribute('aria-pressed', String(muted)); }
}

// Toggle mute state (persist in localStorage, control audio)
function setMuted(value) {
	muted = !!value;
	localStorage.setItem('cdr-muted', muted ? 'true' : 'false');
	audioEnabled = !muted;
	updateMuteUI();
	if (muted) {
		// stop all audio immediately when muting
		stopAllAudio();
	} else {
		// unmuting: if game is running, resume BGM
		if (running) startBGM();
	}
}

// attach handlers for mute buttons (both desktop and mobile versions)
function initMuteButtons() {
	const b = document.getElementById('mute-btn');
	const bm = document.getElementById('mute-btn-mobile');
	// Play the click sound even when muting. We force playback and exclude the
	// instance from global stop so it won't be immediately silenced when
	// setMuted(true) calls stopAllAudio().
	if (b) b.addEventListener('click', () => {
		playSound('click', { force: true, excludeFromStop: true });
		setMuted(!muted);
	});
	if (bm) bm.addEventListener('click', () => {
		playSound('click', { force: true, excludeFromStop: true });
		setMuted(!muted);
	});
	// reflect initial state
	updateMuteUI();
}

// initialize mute buttons after DOM load (script is at page end but safe)
initMuteButtons();

/* Create a floating DOM popup positioned over the canvas. 
   logicalX/logicalY are in canvas logical coordinates (0..canvas.width, 0..canvas.height).
   className is one of .popup-collect/.popup-stomp/.popup-powerup/.popup-hit to style it. */
function createPopup(text, logicalX, logicalY, className) {
	if (!canvasWrap) return;
	const wrapRect = canvasWrap.getBoundingClientRect();
	// convert logical canvas coords to pixel positions within the canvas wrapper
	const px = (logicalX / canvas.width) * canvasWrap.clientWidth;
	const py = (logicalY / canvas.height) * canvasWrap.clientHeight;

	const el = document.createElement('div');
	el.className = `popup-floating ${className || ''}`;
	el.textContent = text;
	// position absolute inside canvasWrap
	el.style.left = `${px}px`;
	el.style.top = `${py}px`;
	// initial visual state (centered)
	el.style.transform = 'translate(-50%, -50%)';
	el.style.opacity = '1';
	canvasWrap.appendChild(el);

	// force a reflow, then animate upward + fade
	// small timeout to ensure transition runs
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			el.style.transform = 'translate(-50%, -140%) scale(1.02)';
			el.style.opacity = '0';
		});
	});

	// remove after transition
	setTimeout(() => {
		if (el && el.parentNode) el.parentNode.removeChild(el);
	}, 800);
}

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

/* Default difficulty settings (adjusts pace, spawn rates, lives, scoring) */
function getDifficultySettings(mode) {
	// returns settings object for Easy / Normal / Hard
	switch (mode) {
		case 'Easy':
			return {
				gameSpeed: 140,
				lives: 5,
				spawnObstacleProb: 0.45,
				spawnCollectibleProb: 0.5,
				spawnPowerupProb: 0.12,
				scoreMultiplier: 0.9,
				bumpPer10s: 8,
				/* spawnInterval (seconds) controls how often we try to spawn items;
				   make Easy mode spawn less frequently (longer interval) */
				spawnInterval: 0.9
			};
		case 'Hard':
			return {
				gameSpeed: 220,
				lives: 2,
				spawnObstacleProb: 0.78,
				spawnCollectibleProb: 0.28,
				spawnPowerupProb: 0.05,
				scoreMultiplier: 1.15,
				bumpPer10s: 20,
				/* Hard spawns more often */
				spawnInterval: 0.45
			};
		case 'Normal':
 		default:
 			return {
 				gameSpeed: 180,
 				lives: 3,
 				spawnObstacleProb: 0.6,
 				spawnCollectibleProb: 0.35,
 				spawnPowerupProb: 0.08,
 				scoreMultiplier: 1.0,
	 			bumpPer10s: 12,
	 			/* default spawning cadence */
	 			spawnInterval: 0.6
 			};
}
}

// apply saved difficulty selection to radios and HUD
function applySavedDifficulty() {
    // ensure radios reflect stored value
    difficultyRadios.forEach(r => {
        r.checked = (r.value === currentDifficulty);
    });
    difficultyConfig = getDifficultySettings(currentDifficulty);
    if (difficultyDisplay) difficultyDisplay.textContent = `Diff: ${currentDifficulty}`;
}
applySavedDifficulty();

// Wire up changing difficulty on start screen
difficultyRadios.forEach(r => {
    r.addEventListener('change', (e) => {
        if (!e.target.checked) return;
        currentDifficulty = e.target.value;
        localStorage.setItem('cdr-difficulty', currentDifficulty);
        applySavedDifficulty();
    });
});

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

/* =======
   Canvas decorations (clouds, trees, grass)
   Declared with let/const before use per requirement.
   These are friendly, low-cost canvas shapes drawn behind the player.
   ======= */
let decorClouds = [];
let decorTrees = [];
let decorGrass = [];
let decorTime = 0; // seconds, drives decor animations (cloud parallax, tree sway)

/* Initialize decorations based on canvas logical size. Keeps positions responsive. */
function initDecor() {
	// ensure canvas logical size is set
	const w = canvas.width;
	const h = canvas.height;

	// Clouds: few fluffy clouds with x,y and scale
	decorClouds = [
		{ x: Math.round(w * 0.18), y: Math.round(h * 0.12), scale: 1.0 },
		{ x: Math.round(w * 0.62), y: Math.round(h * 0.08), scale: 1.35 },
		{ x: Math.round(w * 0.85), y: Math.round(h * 0.18), scale: 0.9 }
	];

	// assign a gentle horizontal speed and direction for parallax (px/sec)
	for (const c of decorClouds) {
		c.speed = rand(6, 18) * (0.6 + c.scale * 0.2); // scale affects apparent speed
		c.dir = (Math.random() < 0.5) ? -1 : 1; // some clouds drift left, some right
	}

	// Trees: position along the ground (x, baseY, size)
	decorTrees = [];
	const groundY = h - 32; // matches ground offset used elsewhere
	for (let i = 0; i < 4; i++) {
		const tx = Math.round((w / 4) * i + rand(20, w / 6));
		const size = Math.round(rand(36, 58));
		// add a small sway phase so trees animate gently
		decorTrees.push({ x: tx, baseY: groundY, size, phase: rand(0, Math.PI*2), swayAmp: rand(2,6) });
	}

	// Grass: generate blades across the visible ground area
	decorGrass = [];
	const blades = Math.round(w / 28);
	for (let i = 0; i < blades; i++) {
		const gx = Math.round(i * (w / blades) + rand(-6, 6));
		const gh = Math.round(rand(8, 18));
		decorGrass.push({ x: gx, h: gh });
	}
}

/* Water facts for game over screen */
const waterFacts = [
	"771 million people lack access to clean water.",
	"Clean water improves health and education.",
	"Every drop counts!",
	"Women and children spend 200 million hours daily collecting water.",
	"Access to clean water can break the cycle of poverty."
];

/* Clean Water Impact milestones: show an impact popup when score reaches milestones */
const impactFacts = [
	{ score: 100, text: "You’ve brought clean water to 1 person 💧", shown: false },
	{ score: 300, text: "A whole family now has access to clean water! 🚰", shown: false },
	{ score: 600, text: "Your drops could fill a new well! 🌍", shown: false }
];

function checkImpactFacts() {
	// show each fact only once when score passes its threshold
	for (const fact of impactFacts) {
		if (!fact.shown && score >= fact.score) {
			fact.shown = true;
			// position popup slightly above player for visibility
			createPopup(fact.text, player.x + 40, Math.max(20, player.y - 20), 'popup-impact');
		}
	}
}

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
// initialize decorations once logical size is known
initDecor();

/* ============
   Game methods
   ============ */

/* Initialize or reset the game state */
function initGame() {
	// enable audio for the upcoming gameplay session if not muted
	audioEnabled = !muted;
	// Reset variables
	running = true;
	lastTime = performance.now();
	spawnTimer = 0;
	score = 0;
	secondsCounter = 0;
	// base parameters come from selected difficulty
	difficultyConfig = getDifficultySettings(currentDifficulty);
	gameSpeed = difficultyConfig.gameSpeed;
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
	// set lives according to difficulty
	livesDisplay.textContent = `Lives: ${difficultyConfig.lives}`;
	highscoreEl && (highscoreEl.textContent = `High: ${highscore}`);

	// reposition decorations for current canvas size
	initDecor();

	// start background music (if available)
	startBGM();

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
	livesDisplay.textContent = `Lives: ${difficultyConfig.lives}`;
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

/* Spawn a charity: water jerry can that moves like a barrel but gives a random bonus on hit */
function spawnJerry() {
	const h = rand(34, 50);
	const w = rand(28, 40);
	const y = canvas.height - h - 32; // ground aligned
	// mark as jerry so drawGame knows to render a jerry can and collision gives bonus
	obstacles.push({ x: canvas.width + 10, y, w, h, jerry: true });
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

	// advance decorative animation clock
	decorTime += dt;

	// remember previous vertical position for stomp detection
	player.prevY = player.y;

	// increase difficulty slowly
	difficultyTimer += dt;
	if (difficultyTimer > 10) {
		// increase speed based on difficulty-configured bump amount
		const bump = (difficultyConfig && difficultyConfig.bumpPer10s) ? difficultyConfig.bumpPer10s : 12;
		gameSpeed += bump; // small bump every 10 seconds
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

	// Spawning logic (probabilities & cadence controlled by difficulty)
	spawnTimer += dt;
	// Use a configurable spawn interval so Easy/Hard can change how often items appear
	const spawnInterval = (difficultyConfig && difficultyConfig.spawnInterval) ? difficultyConfig.spawnInterval : 0.6;
	if (spawnTimer > spawnInterval) {
		const obsProb = (difficultyConfig && difficultyConfig.spawnObstacleProb) ? difficultyConfig.spawnObstacleProb : 0.6;
		const colProb = (difficultyConfig && difficultyConfig.spawnCollectibleProb) ? difficultyConfig.spawnCollectibleProb : 0.35;
		const powProb = (difficultyConfig && difficultyConfig.spawnPowerupProb) ? difficultyConfig.spawnPowerupProb : 0.08;
		if (Math.random() < obsProb) spawnObstacle();
		if (Math.random() < colProb) spawnCollectible();
		if (Math.random() < powProb) spawnPowerup();
		// small chance to spawn a charity: water jerry can (rare)
		const jerryProb = (difficultyConfig && difficultyConfig.jerryProb) ? difficultyConfig.jerryProb : 0.06;
		if (Math.random() < jerryProb) spawnJerry();
		spawnTimer = 0;
	}

	// Update cloud positions for gentle parallax and wrap around edges
	if (decorClouds && decorClouds.length) {
		for (const c of decorClouds) {
			// move horizontally based on speed and direction
			c.x += c.dir * c.speed * dt;
			// wrap so clouds loop across the scene
			if (c.x < -120) c.x = canvas.width + 120;
			if (c.x > canvas.width + 120) c.x = -120;
		}
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
				// award stomp points scaled by difficulty
				const stompPoints = Math.round(10 * ((difficultyConfig && difficultyConfig.scoreMultiplier) ? difficultyConfig.scoreMultiplier : 1));
				// show popup at obstacle center
				createPopup(`+${stompPoints}`, o.x + o.w/2, o.y + o.h/2, 'popup-stomp');
				score += stompPoints;
				scoreDisplay.textContent = `Score: ${score}`;
				// check for impact milestones
				checkImpactFacts();
				// remove barrel after showing popup
				obstacles.splice(i, 1);
				// small bounce: set upward velocity (fraction of jumpPower)
				player.vy = player.jumpPower * 0.6;
				player.onGround = false;
	                // play stomp SFX
	                playSound('stomp');
			} else {
				// If it's a jerry can, award a random bonus instead of damaging the player
                if (o.jerry) {
					// remove jerry, award bonus
					obstacles.splice(i, 1);
					const bonus = applyJerryBonus();
					// show popup near player
					createPopup(bonus.label, player.x + player.width/2, player.y + player.height/2, 'popup-powerup');
				// play a joyful sound for jerry bonus (powerup or collect)
				if (bonus.key === 'score' || bonus.key === 'confetti') playSound('collect');
				else playSound('powerup');
					continue; // skip life loss logic
				}

				// existing behavior: filter power or take a life
				if (activePower && activePower.type === 'filter') {
					obstacles.splice(i, 1);
				} else {
					obstacles.splice(i, 1);
					lives--;
					livesDisplay.textContent = `Lives: ${lives}`;
					// show negative-life popup near player
					createPopup(`-1`, player.x + player.width/2, player.y + player.height/2, 'popup-hit');
					// play hit sound
					playSound('hit');
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
			const collectPoints = Math.round(10 * ((difficultyConfig && difficultyConfig.scoreMultiplier) ? difficultyConfig.scoreMultiplier : 1));
			// show popup at collectible center
			createPopup(`+${collectPoints}`, c.x + c.w/2, c.y + c.h/2, 'popup-collect');
			collectibles.splice(i, 1);
			score += collectPoints;
			scoreDisplay.textContent = `Score: ${score}`;
			// check for impact milestones
			checkImpactFacts();
			// play collectible chime
			playSound('collect');
		}
	}

	// Powerup collision
	for (let i = powerups.length - 1; i >= 0; i--) {
		const p = powerups[i];
		if (isColliding(playerRect, { x: p.x, y: p.y, w: p.w, h: p.h })) {
			// show popup naming the powerup (or +life for well)
			if (p.type === 'well') createPopup('+1 Life', p.x + p.w/2, p.y + p.h/2, 'popup-powerup');
			else createPopup(p.type.charAt(0).toUpperCase() + p.type.slice(1), p.x + p.w/2, p.y + p.h/2, 'popup-powerup');
			powerups.splice(i, 1);
			// play a powerup sound
			playSound('powerup');
			activatePowerup(p.type);
		}
	}

	// Powerup active timer decrement
	if (activePower) {
		activePower.timer -= dt;
		if (activePower.timer <= 0) {
			// deactivate effects
			if (activePower.type === 'pump') {
				// restore previous gameSpeed if stored, otherwise fallback
				if (activePower.prevGameSpeed !== undefined) gameSpeed = activePower.prevGameSpeed;
				else gameSpeed = Math.max(140, gameSpeed - 60);
			}
			activePower = null;
			player.filterActive = false;
		}
	}

	// Score increments by time survived (1 point per second)
	// award time-based score using difficulty multiplier
	secondsCounter += dt;
	if (secondsCounter >= 1) {
		const mult = (difficultyConfig && difficultyConfig.scoreMultiplier) ? difficultyConfig.scoreMultiplier : 1;
		score += Math.floor(secondsCounter * mult); // add whole seconds scaled by multiplier
		scoreDisplay.textContent = `Score: ${score}`;
		secondsCounter = 0;
		// check for impact milestones when time-based score increases
		checkImpactFacts();
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

	// Draw decorative trees, grass and clouds (cartoon style)
	function drawDecor() {
		// Clouds (soft white puffs)
		for (const c of decorClouds) {
			const cx = c.x;
			const cy = c.y;
			const s = c.scale;
			ctx.save();
			ctx.translate(cx, cy);
			ctx.scale(s, s);
			// multiple overlapping ellipses for fluffy cloud
			ctx.fillStyle = 'rgba(255,255,255,0.95)';
			ctx.beginPath();
			ctx.ellipse(-24, 4, 36, 28, 0, 0, Math.PI*2);
			ctx.ellipse(0, -6, 48, 34, 0, 0, Math.PI*2);
			ctx.ellipse(30, 6, 34, 26, 0, 0, Math.PI*2);
			ctx.fill();
			ctx.strokeStyle = 'rgba(4,34,60,0.06)';
			ctx.lineWidth = 2;
			ctx.stroke();
			ctx.restore();
		}

		// Trees (simple trunk + round canopy)
		for (const t of decorTrees) {
			// compute a gentle sway offset using decorTime and per-tree phase/amplitude
			const sway = Math.sin(decorTime + (t.phase || 0)) * (t.swayAmp || 3);
			const tx = t.x + sway;
			const baseY = t.baseY;
			const size = t.size;
			// trunk
			ctx.fillStyle = '#8b5a3c';
			roundRect(ctx, tx - size*0.08, baseY - size*0.5, size*0.16, size*0.5, 4);
			ctx.fill();
			// canopy: three overlapping circles
			ctx.fillStyle = '#1DB07A';
			ctx.beginPath();
			ctx.ellipse(tx - size*0.18, baseY - size*0.48, size*0.36, size*0.28, 0, 0, Math.PI*2);
			ctx.ellipse(tx + size*0.12, baseY - size*0.58, size*0.4, size*0.3, 0, 0, Math.PI*2);
			ctx.ellipse(tx + size*0.4, baseY - size*0.36, size*0.28, size*0.22, 0, 0, Math.PI*2);
			ctx.fill();
			// light highlight
			ctx.fillStyle = 'rgba(255,255,255,0.06)';
			ctx.beginPath();
			ctx.ellipse(tx - size*0.12, baseY - size*0.56, size*0.14, size*0.10, -0.35, 0, Math.PI*2);
			ctx.fill();
		}

		// Grass (short blades along ground)
		for (const g of decorGrass) {
			const gx = g.x;
			const gh = g.h;
			const gy = canvas.height - 16; // position grass a bit above bottom
			ctx.strokeStyle = '#118344';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(gx, gy);
			ctx.quadraticCurveTo(gx + 2, gy - gh, gx + 4, gy);
			ctx.stroke();
		}
	}

	// call drawDecor to place trees/clouds/grass into the scene
	drawDecor();

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
			if (o.jerry) {
				// draw charity: water jerry can — friendly, cartoon style
				const jx = o.x, jy = o.y, jw = o.w, jh = o.h;
				// prefer using the real image if it loaded
				if (jerryImage && jerryImage.complete && jerryImage.naturalWidth) {
					// draw while preserving aspect ratio so the can isn't squeezed
					const imgW = jerryImage.naturalWidth;
					const imgH = jerryImage.naturalHeight;
					const imgAspect = imgW / imgH;
					let drawW = jw;
					let drawH = jh;
					if (jw / jh > imgAspect) {
						// available area is wider than image aspect -> limit by height
						drawH = jh;
						drawW = drawH * imgAspect;
					} else {
						// limit by width
						drawW = jw;
						drawH = drawW / imgAspect;
					}
					const drawX = jx + (jw - drawW) / 2;
					const drawY = jy + (jh - drawH) / 2;
					ctx.drawImage(jerryImage, drawX, drawY, drawW, drawH);
				} else {
					// canvas fallback: body
					ctx.save();
					ctx.fillStyle = '#FFD54F'; // warm yellow accent for brand can
					roundRect(ctx, jx, jy, jw, jh, 6);
					ctx.fill();
					// handle (top-right)
					ctx.fillStyle = '#e6bf3a';
					ctx.beginPath();
					ctx.ellipse(jx + jw - 6, jy + 6, 8, 6, 0, 0, Math.PI*2);
					ctx.fill();
					// drop logo (blue) on can
					ctx.fillStyle = '#2E9DF7';
					ctx.beginPath();
					ctx.moveTo(jx + jw/2, jy + jh*0.25);
					ctx.quadraticCurveTo(jx + jw*0.68, jy + jh*0.22, jx + jw*0.60, jy + jh*0.45);
					ctx.quadraticCurveTo(jx + jw/2, jy + jh*0.66, jx + jw*0.40, jy + jh*0.45);
					ctx.quadraticCurveTo(jx + jw*0.32, jy + jh*0.22, jx + jw/2, jy + jh*0.25);
					ctx.fill();
					ctx.restore();
				}
			} else {
				ctx.fillStyle = o.color;
				roundRect(ctx, o.x, o.y, o.w, o.h, 4);
				ctx.fill();
			}
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
		// store previous speed so we can restore it exactly
		const prev = gameSpeed;
		activePower = { type: 'pump', timer: 2.5, prevGameSpeed: prev };
		// temporarily boost speed
		gameSpeed = prev + 60;

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

/* Choose and apply a random bonus when player hits a jerry can.
   Returns an object with a `label` describing the bonus for popups. */
function applyJerryBonus() {
	const bonuses = ['life','score','filter','pump','confetti'];
	const choice = bonuses[Math.floor(Math.random() * bonuses.length)];
	switch (choice) {
		case 'life': {
			let lives = Number(livesDisplay.textContent.replace(/[^\d]/g, '')) || 3;
			lives++;
			livesDisplay.textContent = `Lives: ${lives}`;
				playSound('powerup');
			return { key: 'life', label: '+1 Life' };
		}
		case 'score': {
			const pts = 50;
			score += pts;
			scoreDisplay.textContent = `Score: ${score}`;
				playSound('collect');
			return { key: 'score', label: `+${pts}` };
		}
		case 'filter': {
			activatePowerup('filter');
				playSound('powerup');
			return { key: 'filter', label: 'Filter!' };
		}
		case 'pump': {
			activatePowerup('pump');
				playSound('powerup');
			return { key: 'pump', label: 'Pump!' };
		}
		case 'confetti': {
			const pts = 30;
			score += pts;
			scoreDisplay.textContent = `Score: ${score}`;
			createConfettiBurst(player.x + player.width/2, player.y + player.height/2);
				playSound('collect');
			return { key: 'confetti', label: `+${pts}` };
		}
	}
}

/* End game: show game over screen and final stats */
function endGame() {
	running = false;
	// set expression to mad so player shows angry face / posture
	player.isMad = true;
	// stop and clear all audio (SFX + BGM) so audio does not continue after game over
	stopAllAudio();
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
		// sound for jump
		playSound('jump');
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
		// click SFX
		playSound('click');
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
		playSound('click');
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
	// enable audio for this session if not muted and play UI click SFX
	audioEnabled = !muted;
	playSound('click');
	startScreen.classList.add('hidden');
	gameOverScreen.classList.add('hidden');
	gameArea.classList.remove('hidden');
	// set initial lives display according to difficulty
	livesDisplay.textContent = `Lives: ${difficultyConfig.lives}`;
	initGame();
});

playAgainBtn.addEventListener('click', () => {
	// enable audio (unless muted) and play click SFX when starting again
	audioEnabled = !muted;
	playSound('click');
	gameOverScreen.classList.add('hidden');
	startScreen.classList.add('hidden');
	gameArea.classList.remove('hidden');
	livesDisplay.textContent = `Lives: ${difficultyConfig.lives}`;
	initGame();
});

/* On load show start */
showStartScreen();

/* Make sure canvas scales nicely if window is resized (CSS handles width; keep logical size) */
window.addEventListener('resize', () => {
	// If you want to adjust any scaling logic, do it here.
});

// Measure the site's footer height and write it to the CSS root variable
// so the controls (TAP TO JUMP) can be positioned above it on small screens.
// This keeps the UI from overlapping the footer even when the footer height
// changes (responsive, i18n, or when buttons wrap).
let __footerHeightTimer = null;
function setFooterHeightCSS() {
	try {
		const footer = document.getElementById('site-footer');
		if (!footer) return;
		const h = Math.ceil(footer.getBoundingClientRect().height) || 64;
		document.documentElement.style.setProperty('--footer-height', `${h}px`);
	} catch (e) {
		// ignore in environments where DOM measurement isn't available
	}
}

// Debounced resize handler to avoid thrashing layout on rapid resizes
window.addEventListener('resize', () => {
	if (__footerHeightTimer) clearTimeout(__footerHeightTimer);
	__footerHeightTimer = setTimeout(setFooterHeightCSS, 110);
});

// Ensure value is set on load (script is loaded at end of body, but this is defensive)
document.addEventListener('DOMContentLoaded', setFooterHeightCSS);
window.addEventListener('load', setFooterHeightCSS);
// Also call shortly after script evaluation in case layout stabilizes right after load
setTimeout(setFooterHeightCSS, 100);

// Accessibility: ensure the instructions modal doesn't carry a static aria-hidden="true"
// (some toolchains add it incorrectly). Prefer using the `inert` attribute on the
// page content while the modal is open so assistive tech and focus are blocked
// without setting aria-hidden on the modal itself.
try {
	const instrModal = document.getElementById('instructionsModal');
	if (instrModal) {
		// remove any lingering aria-hidden attribute that might conflict with focusable descendants
		if (instrModal.getAttribute('aria-hidden') === 'true') instrModal.removeAttribute('aria-hidden');

		instrModal.addEventListener('show.bs.modal', () => {
			const area = document.getElementById('game-area');
			if (area) area.setAttribute('inert', '');
		});
		instrModal.addEventListener('hidden.bs.modal', () => {
			const area = document.getElementById('game-area');
			if (area) area.removeAttribute('inert');
		});
	}
} catch (e) {
	// If Bootstrap events or inert are not available, silently continue.
}

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

// Load jerry can image (charity: water water-can); fallback drawing used when missing
const jerryImage = new Image();
jerryImage.src = 'img/water-can.png';
jerryImage.onerror = function() {
    console.warn('Jerry can image failed to load: img/water-can.png — falling back to canvas-drawn can');
};

/* =====================
   Audio: SFX and BGM loader & player
   Place audio files in `audio/` (mp3 or ogg). If files are missing the game will continue silently.
   Expected filenames (examples):
 	 audio/jump.mp3         -> Jump splish/boing
 	 audio/collect.mp3      -> Collectible chime
 	 audio/hit.mp3          -> Obstacle hit (bonk)
 	 audio/powerup.mp3      -> Power-up activation (whoosh/fanfare)
 	 audio/stomp.mp3        -> Stomp on barrel
 	 audio/click.mp3        -> Button click
 	 audio/win.mp3          -> Win / game over flourish
 	 audio/bgm.mp3          -> Loopable background music (low volume)
=======================*/

// (Definitions hoisted earlier in the file to ensure handlers like jump() can call playSound())


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
