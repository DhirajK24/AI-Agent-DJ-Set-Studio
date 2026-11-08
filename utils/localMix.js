const leadTime = 0.05;
const overlapSeconds = 4;
const fadeIn = Float32Array.from({ length: 65 }, (_, step) => Math.sin(step * Math.PI / 128));
const fadeOut = Float32Array.from(fadeIn).reverse();

function overlap(outgoing, incoming) {
  return Math.min(overlapSeconds, outgoing / 3, incoming / 3);
}

export class LocalMix {
  constructor() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.context.destination);
    this.entries = [];
  }

  async decode(file) {
    return this.context.decodeAudioData(await file.arrayBuffer());
  }

  schedule(tracks, start, incomingOverlap = 0) {
    for (const [index, track] of tracks.entries()) {
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      const end = start + track.buffer.duration;
      const next = tracks[index + 1];
      const outgoingOverlap = next ? overlap(track.buffer.duration, next.buffer.duration) : 0;

      source.buffer = track.buffer;
      source.connect(gain);
      gain.connect(this.master);
      gain.gain.setValueAtTime(incomingOverlap ? 0 : 1, start);
      if (incomingOverlap) gain.gain.setValueCurveAtTime(fadeIn, start, incomingOverlap);
      if (outgoingOverlap) gain.gain.setValueCurveAtTime(fadeOut, end - outgoingOverlap, outgoingOverlap);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
      source.start(start);
      this.entries.push({ track, source, gain, start, end });

      start = end - outgoingOverlap;
      incomingOverlap = outgoingOverlap;
    }
  }

  async play(tracks) {
    await this.context.resume();
    if (this.context.state === 'closed') return;
    if (!this.entries.length || this.snapshot().finished) {
      this.entries = [];
      this.schedule(tracks, this.context.currentTime + leadTime);
    }
  }

  pause() {
    return this.context.suspend();
  }

  stop() {
    for (const { source, end } of this.entries) {
      if (end > this.context.currentTime) source.stop();
    }
    this.entries = [];
  }

  mixNext() {
    const now = this.context.currentTime;
    const { playing, current, incoming, next } = this.snapshot();
    const start = now + leadTime;
    if (!playing || !current || incoming || !next || next.start <= start) return;
    const seconds = overlap(current.end - start, next.track.buffer.duration);
    if (seconds <= 0) return;

    const nextIndex = this.entries.indexOf(next);
    const future = this.entries.splice(nextIndex);
    for (const { source } of future) source.stop();

    current.gain.gain.cancelScheduledValues(now);
    current.gain.gain.setValueAtTime(1, now);
    current.gain.gain.setValueCurveAtTime(fadeOut, start, seconds);
    current.end = start + seconds;
    current.source.stop(current.end);
    this.schedule(future.map(({ track }) => track), start, seconds);
  }

  snapshot() {
    const now = this.context.currentTime;
    const [current, incoming] = this.entries.filter(({ start, end }) => start <= now && end > now);
    const next = this.entries.find(({ start }) => start > now);
    const last = this.entries.at(-1);
    return {
      current,
      incoming,
      next,
      elapsed: current ? now - current.start : 0,
      mixProgress: incoming && current ? (now - incoming.start) / (current.end - incoming.start) : 0,
      playing: Boolean(last && now < last.end && this.context.state === 'running'),
      finished: Boolean(last && now >= last.end),
    };
  }

  close() {
    return this.context.close();
  }
}
