import test from 'node:test';
import assert from 'node:assert/strict';
import {CassetteTransport,cassetteTracks} from '../lib/cassette-transport.ts';

class FakeAudio extends EventTarget {
  src='';paused=true;volume=1;muted=false;preload='';loop=false;plays=0;loads=0;
  getAttribute(name){return this[name]||null;}
  removeAttribute(name){this[name]='';}
  play(){this.plays++;this.paused=false;return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  load(){this.loads++;}
}
const setup=()=>{const audio=new FakeAudio();const updates=[];const player=new CassetteTransport(audio,s=>updates.push(s));return {audio,player,updates};};
test('starts paused without assigning or loading any music',()=>{const {audio,player}=setup();assert.equal(audio.src,'');assert.equal(audio.plays,0);assert.equal(audio.preload,'none');assert.equal(audio.volume,.25);assert.equal(player.state.status,'paused');});
test('explicit play loads side A and settles as playing',async()=>{const {audio,player}=setup();const pending=player.play();assert.equal(audio.src,cassetteTracks[0].src);assert.equal(player.state.status,'loading');audio.resolve();await pending;assert.equal(player.state.status,'playing');});
test('pause cancels pending playback without reporting a stale promise as playing',async()=>{const {audio,player}=setup();const pending=player.play();player.pause();audio.resolve();await pending;assert.equal(player.state.status,'paused');assert.equal(audio.paused,true);});
test('flipping a paused cassette changes sides without starting music',()=>{const {audio,player}=setup();player.flip();assert.equal(player.state.side,1);assert.equal(audio.src,cassetteTracks[1].src);assert.equal(audio.plays,0);player.flip();assert.equal(player.state.side,0);});
test('flipping a playing cassette starts the other track and cancels stale results',async()=>{const {audio,player}=setup();const first=player.play();const staleReject=audio.reject;player.flip();staleReject(Error('interrupted'));await first;assert.equal(player.state.side,1);assert.equal(player.state.status,'loading');assert.equal(audio.plays,2);audio.resolve();await Promise.resolve();assert.equal(player.state.status,'playing');});
test('failed play exposes an error; explicit retry can recover',async()=>{const {audio,player}=setup();const pending=player.play();audio.reject(Error('network'));await pending;assert.equal(player.state.status,'error');assert.ok(player.state.error.includes('retry'));assert.equal(audio.paused,true);const retry=player.play();audio.resolve();await retry;assert.equal(player.state.status,'playing');assert.equal(player.state.error,'');});
test('volume is bounded; mute and unmute preserve the chosen level',()=>{const {audio,player}=setup();player.setVolume(.6);player.toggleMute();assert.equal(audio.muted,true);assert.equal(audio.volume,.6);player.toggleMute();assert.equal(audio.muted,false);player.setVolume(2);assert.equal(audio.volume,1);player.setVolume(-1);assert.equal(audio.volume,0);player.setVolume(NaN);assert.equal(audio.volume,.25);});
test('dispose stops audio, releases its source and ignores late callbacks',async()=>{const {audio,player,updates}=setup();const pending=player.play();player.dispose();const count=updates.length;audio.reject(Error('unmounted'));await pending;audio.dispatchEvent(new Event('error'));assert.equal(updates.length,count);assert.equal(audio.paused,true);assert.equal(audio.src,'');});
