# Clean Drop Runner — Skills & tricky elements

This file lists beginner-friendly HTML/CSS/JS skills you'll use to build the game and highlights parts that may need more study.

## HTML skills
- Basic document structure: doctype, head, body.
- Semantic elements and IDs: header, buttons, divs with id/class for game area, HUD, screens.
- Media tags: <audio> for music and sounds (know `loop`, `currentTime`, `play()`).
- Accessibility basics: `alt` text for images, `aria-label` or roles for interactive controls (start/play buttons).

## CSS skills
- Layout with positioning: `position: relative/absolute` to place player and objects.
- Sizing and units: `px`, `%`, `vh/vw` for responsive game area.
- Transitions and simple animations: `transition`, `transform` for smooth visual changes.
- Visual states: use classes like `.hidden` to show/hide screens.
- Mobile-first responsive styling and touch targets (bigger buttons).
- Filters and shadows: `filter: drop-shadow(...)` for power-up effects.

## JavaScript skills
- DOM selection and manipulation: `getElementById`, `querySelector`, `createElement`, `appendChild`, `innerHTML`, `textContent`.
- Event handling: `addEventListener` for keyboard, mouse, and touch events.
- Game loop concepts:
  - Timing methods: `setTimeout`/`setInterval` (easy) and `requestAnimationFrame` (recommended for smoother animation).
  - Managing state: variables for score, lives, speed, active power-ups.
- Movement and spawning:
  - Update element styles each frame: `element.style.left` / `style.bottom`.
  - Create and remove DOM nodes for obstacles, collectibles, power-ups.
- Collision detection:
  - Using `getBoundingClientRect()` and AABB checks (rect overlaps).
- Simple physics:
  - Jump logic using velocity and gravity (update position over frames).
- Audio control: start/pause, reset `currentTime`, check browser autoplay rules.
- Persistence (optional): `localStorage` to store high scores.
- Debugging: console.log, breakpoints, inspect DOM.

## Beginner-friendly implementation tips
- Start with `setTimeout` / `setInterval` for the game loop, then learn `requestAnimationFrame`.
- Keep object counts low (few DOM elements) while testing to avoid slowdown.
- Use simple, named functions for spawning, movement, collisions, and power-up handling.
- Add comments explaining each step (helps learning and debugging).

## Tricky / advanced elements (may need more practice)
- Smooth, consistent animation:
  - `requestAnimationFrame` is better than fixed timeouts. Learn how to compute delta time (time between frames) for frame-rate independent movement.
- Precise collision detection:
  - getBoundingClientRect is easy but can be imprecise for rotated/animated sprites. Pixel-perfect collisions are advanced.
- Physics & jump feel:
  - Tuning gravity and jump velocity for a natural feel requires tweaking and understanding acceleration vs velocity.
- Performance and memory:
  - Many DOM nodes or frequent layout reads (like calling `getBoundingClientRect()` frequently) can cause jank. Learn about minimizing layout thrashing.
- Mobile input and browser restrictions:
  - Touch event nuances, preventing default scrolling, and mobile audio autoplay policies (user gesture required to start audio).
- Responsive UI across screen sizes:
  - Scaling game area and object positions so gameplay feels consistent on phones and desktops.
- Asset loading and management:
  - Preloading images/audio and handling load errors.
- Game loop structure & state management:
  - Avoiding multiple loops running simultaneously; cleanly starting/stopping intervals and timeouts.
- Saving high scores securely:
  - localStorage is simple; secure leaderboards require backend.

## Next steps / study suggestions
- Read about `requestAnimationFrame` and replace `setTimeout` for smoother frames.
- Practice a small demo of jump physics (velocity, gravity) in a simple HTML page.
- Build a minimal collision demo using two movable divs and `getBoundingClientRect()`.
- Learn a bit about browser audio autoplay rules and how to start audio on first user interaction.

