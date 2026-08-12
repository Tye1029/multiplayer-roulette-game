(() => {
  const review = document.querySelector('[data-v66-review]');
  if (!review) return;

  const ROUTE_WIDTH = 1024;
  const ROUTE_HEIGHT = 3840;
  const GROUND_Y = 3640;
  const HOLD_COUNT = 30;
  const directions = ['right', 'up', 'left', 'left', 'down', 'right', 'up', 'right'];
  const stateName = new URLSearchParams(location.search).get('state') || 'start';
  const states = {
    start: { progress: [0, 0], time: '30', label: 'START · ARMS DOWN' },
    middle: { progress: [12, 18], time: '17', label: 'MID-RACE · INDEPENDENT CAMERAS' },
    summit: { progress: [30, 21], time: '06', label: 'SUMMIT · FINAL LEDGE IS THE STAND SURFACE', winner: 0 },
  };
  const state = states[stateName] || states.start;
  const rootStyle = getComputedStyle(document.documentElement);
  const holds = Array.from({ length: HOLD_COUNT }, (_, index) => ({
    x: parseFloat(rootStyle.getPropertyValue(`--mr-v66-hold-${index}-x`)) / 100 * ROUTE_WIDTH,
    y: parseFloat(rootStyle.getPropertyValue(`--mr-v66-hold-${index}-y`)),
  }));

  document.querySelector('[data-v66-time]').textContent = state.time;
  document.querySelector('[data-v66-state-label]').textContent = state.label;
  document.querySelectorAll('[data-v66-score]').forEach((score, index) => {
    score.textContent = state.progress[index] >= HOLD_COUNT ? 'SUMMIT REACHED' : `${state.progress[index]} / ${HOLD_COUNT}`;
  });

  function createConfetti(container) {
    container.replaceChildren();
    for (let index = 0; index < 20; index += 1) {
      const piece = document.createElement('i');
      piece.style.setProperty('--n', index);
      piece.style.setProperty('--x', `${7 + (index * 29) % 88}%`);
      container.append(piece);
    }
  }

  function layoutLane(lane, laneIndex) {
    const progress = state.progress[laneIndex];
    const laneWidth = lane.clientWidth;
    const laneHeight = lane.clientHeight;
    const routeWidth = innerWidth <= 640 ? 610 : Math.max(660, laneWidth * 1.18);
    const scale = routeWidth / ROUTE_WIDTH;
    let routeTop;
    let contact;
    let contactScreenY;

    if (progress === 0) {
      contactScreenY = Math.min(laneHeight - 143, 520);
      routeTop = contactScreenY - GROUND_Y * scale;
      contact = { x: ROUTE_WIDTH / 2, y: GROUND_Y };
    } else if (progress >= HOLD_COUNT) {
      contact = holds[HOLD_COUNT - 1];
      contactScreenY = Math.min(laneHeight * .61, 410);
      routeTop = contactScreenY - contact.y * scale;
    } else {
      contact = holds[progress - 1];
      contactScreenY = Math.min(laneHeight * .51, 350);
      routeTop = contactScreenY - contact.y * scale;
    }

    lane.style.setProperty('--v66-route-display-width', `${routeWidth}px`);
    lane.style.setProperty('--v66-route-top', `${routeTop}px`);

    const routeX = routeCoordinate => laneWidth / 2 + (routeCoordinate - ROUTE_WIDTH / 2) * scale;
    const routeY = routeCoordinate => routeTop + routeCoordinate * scale;
    const overlays = lane.querySelector('.v66-route-overlays');
    overlays.replaceChildren();

    if (laneIndex === 0) {
      const firstUpcoming = Math.min(progress, HOLD_COUNT - 1);
      for (let offset = 0; offset < 4; offset += 1) {
        const holdIndex = firstUpcoming + offset;
        if (holdIndex >= HOLD_COUNT) break;
        const marker = document.createElement('span');
        marker.className = `v66-hold-marker${offset === 0 ? ' current' : ''}`;
        marker.textContent = directions[holdIndex % directions.length] === 'up' ? '↑'
          : directions[holdIndex % directions.length] === 'down' ? '↓'
            : directions[holdIndex % directions.length] === 'left' ? '←' : '→';
        marker.style.left = `${routeX(holds[holdIndex].x)}px`;
        marker.style.top = `${routeY(holds[holdIndex].y)}px`;
        overlays.append(marker);
      }
    }

    const climber = lane.querySelector('.v66-climber');
    const climberWidth = parseFloat(getComputedStyle(climber).width);
    const climberHeight = parseFloat(getComputedStyle(climber).height);
    climber.className = `v66-climber ${laneIndex === 0 ? 'v66-climber-you' : 'v66-climber-opponent'}`;

    if (progress === 0) {
      climber.classList.add('waiting');
      climber.style.left = `${laneWidth / 2 - climberWidth / 2}px`;
      climber.style.top = `${contactScreenY - climberHeight + 4}px`;
    } else if (progress >= HOLD_COUNT) {
      climber.classList.add('celebrating');
      climber.style.left = `${routeX(contact.x) - climberWidth / 2}px`;
      climber.style.top = `${routeY(contact.y) - climberHeight + 5}px`;
    } else {
      const previous = progress > 1 ? holds[progress - 2] : { x: ROUTE_WIDTH / 2 };
      const directionLeft = contact.x < previous.x;
      climber.classList.add('climbing');
      if (directionLeft) climber.classList.add('direction-left');
      const handX = directionLeft ? climberWidth * .31 : climberWidth * .69;
      climber.style.left = `${routeX(contact.x) - handX}px`;
      climber.style.top = `${routeY(contact.y) - 4}px`;
    }

    const confetti = lane.querySelector('.v66-confetti');
    confetti.classList.toggle('active', state.winner === laneIndex);
    if (state.winner === laneIndex) {
      createConfetti(confetti);
      confetti.style.left = `${routeX(contact.x)}px`;
      confetti.style.top = `${routeY(contact.y) - climberHeight * .48}px`;
    }
  }

  function layout() {
    review.querySelectorAll('[data-v66-lane]').forEach((lane, index) => layoutLane(lane, index));
  }

  addEventListener('resize', layout, { passive: true });
  addEventListener('load', layout, { once: true });
  requestAnimationFrame(layout);
})();
