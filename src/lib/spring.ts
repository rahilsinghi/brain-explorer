interface SpringState {
  position: number;
  velocity: number;
}

const SETTLE_THRESHOLD = 0.01;

export function stepSpring(
  state: SpringState,
  restPosition: number,
  stiffness: number,
  damping: number,
  deltaTime: number,
): SpringState {
  const displacement = state.position - restPosition;
  const force = -stiffness * displacement;
  const velocity = (state.velocity + force * deltaTime) * damping;
  const position = state.position + velocity * deltaTime;
  return { position, velocity };
}

export function isSpringSettled(
  displacement: number,
  velocity: number,
): boolean {
  return Math.abs(displacement) < SETTLE_THRESHOLD && Math.abs(velocity) < SETTLE_THRESHOLD;
}
