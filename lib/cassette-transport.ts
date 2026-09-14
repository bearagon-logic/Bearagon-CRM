export const cassetteTracks = [
  { side: 'A', label: 'Neon dreams', title: 'Neon Laser Horizon', src: '/music/neon-laser-horizon.mp3', source: 'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN2000023' },
  { side: 'B', label: 'Midnight run', title: 'Brain Dance', src: '/music/brain-dance.mp3', source: 'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN2300006' },
] as const;

export type CassetteState = { side: number; volume: number; muted: boolean; status: 'paused' | 'loading' | 'playing' | 'error'; error: string };
export const initialCassetteState: CassetteState = { side: 0, volume: .25, muted: false, status: 'paused', error: '' };

/** One transport per visible player. Playback intent is never persisted. */
export class CassetteTransport {
  state: CassetteState = { ...initialCassetteState };
  private request = 0;
  private wantsPlayback = false;
  private disposed = false;
  private audio: HTMLAudioElement;
  private notify: (state: CassetteState) => void;

  constructor(audio: HTMLAudioElement, notify: (state: CassetteState) => void) {
    this.audio = audio;
    this.notify = notify;
    audio.preload = 'none';
    audio.loop = true;
    audio.volume = this.state.volume;
    audio.addEventListener('error', this.failed);
    audio.addEventListener('waiting', this.waiting);
    audio.addEventListener('playing', this.playing);
    audio.addEventListener('pause', this.paused);
  }
  private update(next: Partial<CassetteState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...next };
    this.notify(this.state);
  }
  private failed = () => {
    this.request++;
    this.wantsPlayback = false;
    this.audio.pause();
    this.update({ status: 'error', error: 'Music could not load. Press Play to retry or try the other side.' });
  };
  private waiting = () => { if (this.wantsPlayback) this.update({ status: 'loading' }); };
  private playing = () => { if (this.wantsPlayback) this.update({ status: 'playing', error: '' }); else this.audio.pause(); };
  private paused = () => { if (this.audio.paused && this.wantsPlayback && this.state.status === 'playing') this.pause(); };

  async play() {
    if (this.disposed) return;
    const request = ++this.request;
    this.wantsPlayback = true;
    if (!this.audio.getAttribute('src') || this.state.status === 'error') this.audio.src = cassetteTracks[this.state.side].src;
    this.update({ status: 'loading', error: '' });
    try {
      await this.audio.play();
      if (!this.disposed && request === this.request && this.wantsPlayback) this.update({ status: 'playing' });
    } catch {
      if (!this.disposed && request === this.request) this.failed();
    }
  }
  pause() {
    this.request++;
    this.wantsPlayback = false;
    this.audio.pause();
    this.update({ status: 'paused', error: '' });
  }
  flip() {
    const resume = this.wantsPlayback;
    this.pause();
    this.update({ side: this.state.side === 0 ? 1 : 0 });
    this.audio.src = cassetteTracks[this.state.side].src;
    this.audio.load();
    if (resume) void this.play();
  }
  setVolume(value: number) {
    const volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : .25;
    this.audio.volume = volume;
    this.audio.muted = false;
    this.update({ volume, muted: false });
  }
  toggleMute() {
    this.audio.muted = !this.state.muted;
    this.update({ muted: this.audio.muted });
  }
  dispose() {
    this.pause();
    this.disposed = true;
    this.audio.removeEventListener('error', this.failed);
    this.audio.removeEventListener('waiting', this.waiting);
    this.audio.removeEventListener('playing', this.playing);
    this.audio.removeEventListener('pause', this.paused);
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
