// Gelombang bunyi beranimasi (bar VU gaya mixer lama).
let data = null;
let idle = 0;

export function drawWave(canvas, analyser, playing) {
  const g = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  g.clearRect(0, 0, W, H);
  const bars = 56;
  const bw = W / bars;
  if (analyser && playing) {
    if (!data || data.length !== analyser.frequencyBinCount) data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
  }
  idle += 0.03;
  const grad = g.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0, '#ff7a1a');
  grad.addColorStop(0.7, '#ffb347');
  grad.addColorStop(1, '#fff0d0');
  for (let i = 0; i < bars; i++) {
    let v;
    if (analyser && playing && data) {
      // skala log supaya bass dan treble seimbang
      const lo = Math.floor(Math.pow(i / bars, 2) * data.length * 0.7);
      const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / bars, 2) * data.length * 0.7));
      let s = 0;
      for (let j = lo; j < hi; j++) s += data[j];
      v = s / (hi - lo) / 255;
    } else {
      v = 0.06 + 0.04 * Math.sin(idle + i * 0.35);
    }
    const bh = Math.max(3, v * H * 0.95);
    const segs = Math.ceil(bh / 7);
    g.fillStyle = grad;
    for (let k = 0; k < segs; k++) {
      g.globalAlpha = playing ? 0.95 : 0.35;
      g.fillRect(i * bw + 2, H - (k + 1) * 7, bw - 4, 5);
    }
  }
  g.globalAlpha = 1;
}
