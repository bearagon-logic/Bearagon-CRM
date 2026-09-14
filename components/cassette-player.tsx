"use client";
import { useEffect, useRef, useState } from 'react';
import { Disc3, Pause, Play, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { CassetteTransport, cassetteTracks, initialCassetteState } from '@/lib/cassette-transport';

export function CassettePlayer() {
  const [state, setState] = useState(initialCassetteState);
  const [controlsOpen, setControlsOpen] = useState(false);
  const transport = useRef<CassetteTransport | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!audio.current) return;
    let mounted = true;
    const player = new CassetteTransport(audio.current, next => { if (mounted) setState(next); });
    transport.current = player;
    const watchMode = () => {
      if (document.documentElement.dataset.appearance !== 'plaid') {
        player.pause();
        setControlsOpen(false);
      }
    };
    const observer = new MutationObserver(watchMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-appearance'] });
    const leaving = () => player.pause();
    window.addEventListener('pagehide', leaving);
    return () => { mounted = false; observer.disconnect(); window.removeEventListener('pagehide', leaving); player.dispose(); transport.current = null; };
  }, []);
  const track = cassetteTracks[state.side];
  const active = state.status === 'playing' || state.status === 'loading';
  const toggle = () => {
    if (document.documentElement.dataset.appearance !== 'plaid') return;
    if (active) transport.current?.pause(); else void transport.current?.play();
  };
  return <div className="plaid-cassette">
    <audio ref={audio} preload="none" aria-hidden="true"/>
    <div className="cassette-buttons">
      <button type="button" className="cassette-start" aria-label={`${active ? 'Pause' : 'Play'} ${track.title}`} aria-pressed={active} onClick={toggle}>
        {active ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}
        <span>Side {track.side} / {track.label}<small>{track.title}</small></span>
      </button>
      <Popover open={controlsOpen} onOpenChange={setControlsOpen}><PopoverTrigger asChild><button type="button" className="cassette-settings" aria-label="Music controls" title="Music controls"><SlidersHorizontal aria-hidden="true"/></button></PopoverTrigger>
        <PopoverContent className="cassette-panel" align="end" sideOffset={8} aria-label="Music controls">
          <h2>Neon cassette</h2><p className="cassette-now">Side {track.side} · {track.title}</p>
          <label className="cassette-volume"><span>Volume <b>{state.muted ? 'Muted' : `${Math.round(state.volume * 100)}%`}</b></span><input aria-label="Music volume" type="range" min="0" max="100" step="1" value={Math.round(state.volume * 100)} onChange={e => transport.current?.setVolume(Number(e.target.value) / 100)}/></label>
          <div className="cassette-panel-actions"><button type="button" onClick={() => transport.current?.toggleMute()}>{state.muted ? <VolumeX aria-hidden="true"/> : <Volume2 aria-hidden="true"/>}{state.muted ? 'Unmute' : 'Mute'}</button><button type="button" onClick={() => transport.current?.flip()}><Disc3 aria-hidden="true"/>Flip to side {state.side === 0 ? 'B' : 'A'}</button></div>
          <div className="cassette-credit"><a href={track.source} target="_blank" rel="noreferrer">{track.title}</a> by Kevin MacLeod (incompetech.com). <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Original recording, unchanged.</div>
        </PopoverContent>
      </Popover>
    </div>
    <span className={`cassette-status${state.error ? ' cassette-error' : ''}`} role="status">{state.error || (state.status === 'loading' ? 'Loading music…' : state.status === 'playing' ? 'Playing · Kevin MacLeod' : 'Press Play · Kevin MacLeod')}</span>
  </div>;
}
