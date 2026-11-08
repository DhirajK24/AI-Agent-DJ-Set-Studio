const fades = new WeakMap();

export function cancelVolumeFade(player) {
  fades.get(player)?.();
}

export function fadePlayerVolume(player, target, milliseconds) {
  cancelVolumeFade(player);
  const start = player.getVolume();
  if (start === target) return Promise.resolve();
  const startedAt = performance.now();

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / milliseconds);
      const eased = progress * progress * (3 - 2 * progress);
      player.setVolume(Math.round(start + (target - start) * eased));
      if (progress === 1) finish();
    }, 32);

    function finish() {
      clearInterval(timer);
      fades.delete(player);
      resolve();
    }

    fades.set(player, finish);
  });
}
