
/**
 * Imperial Audio Service
 * Generiert synthetische POS-Sounds ohne externe Assets.
 */

class AudioService {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createGain(duration: number, startVolume: number = 0.1) {
    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(startVolume, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx!.currentTime + duration);
    return gain;
  }

  // Kurzer Klick beim Hinzufügen
  playClick() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.1, 0.05);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx!.currentTime);
    osc.connect(gain).connect(this.ctx!.destination);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.1);
  }

  // Tieferer Klick beim Entfernen
  playRemove() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.15, 0.03);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx!.currentTime);
    osc.connect(gain).connect(this.ctx!.destination);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.15);
  }

  // Kaching! Metallisch (Zahlung Cash)
  playKaching() {
    this.init();
    const now = this.ctx!.currentTime;
    [880, 1760].forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.1, now + (i * 0.05));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (i * 0.05) + 0.4);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + (i * 0.05));
      osc.connect(gain).connect(this.ctx!.destination);
      osc.start(now + (i * 0.05));
      osc.stop(now + (i * 0.05) + 0.4);
    });
  }

  // Stempel/Papier-Sound (Rechnung)
  playStamp() {
    this.init();
    const bufferSize = this.ctx!.sampleRate * 0.15;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx!.currentTime);
    const gain = this.createGain(0.15, 0.1);
    noise.connect(filter).connect(gain).connect(this.ctx!.destination);
    noise.start();
  }

  // Fehler/Storno
  playRevert() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.4, 0.05);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx!.currentTime + 0.4);
    osc.connect(gain).connect(this.ctx!.destination);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.4);
  }

  // Notification Ding
  playDing() {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.createGain(0.8, 0.08);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, this.ctx!.currentTime);
    osc.connect(gain).connect(this.ctx!.destination);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.8);
  }
}

export const soundService = new AudioService();
