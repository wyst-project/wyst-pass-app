let context: AudioContext | null = null;

export async function playChime(volume = 0.16) {
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);

    const note = (
      frequency: number,
      start: number,
      length: number,
      peak: number,
    ) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + start);
      oscillator.stop(now + start + length + 0.05);
    };

    note(783.99, 0, 0.55, 1);
    note(392, 0, 0.45, 0.25);
    note(1046.5, 0.16, 0.7, 0.8);
  } catch {}
}