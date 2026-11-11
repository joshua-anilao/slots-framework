import { AudioClip, AudioSource, Node, resources, sys } from 'cc';
import type { IAudioBackend, IKeyValueStore } from './audioManager';

/** Plays AudioClips from resources/audio/<clipKey>. Not unit tested (needs the engine). */
export class CocosAudioBackend implements IAudioBackend {
  private readonly clips = new Map<string, AudioClip>();
  private readonly source: AudioSource;

  /** host: any node in the scene; the AudioSource lives on it. */
  constructor(host: Node) {
    this.source = host.addComponent(AudioSource);
  }

  /** Loads every clip in resources/audio. Call it after the boot screen, it is not needed to show the first frame. */
  load(): Promise<void> {
    return new Promise((resolve, reject) => {
      resources.loadDir('audio', AudioClip, (err, clips) => {
        if (err) { reject(err); return; }
        for (const c of clips) this.clips.set(c.name, c);
        resolve();
      });
    });
  }

  unlock(): void {
    // Cocos resumes the browser audio context itself on the first touch; nothing else to do.
  }

  play(clipKey: string): void {
    const clip = this.clips.get(clipKey);
    if (!clip) { console.warn(`Sound clip "${clipKey}" is not loaded`); return; }
    this.source.playOneShot(clip, 1);
  }
}

/** Mute setting storage through the engine's localStorage wrapper. */
export class CocosKeyValueStore implements IKeyValueStore {
  get(key: string): string | null { try { return sys.localStorage.getItem(key); } catch { return null; } }
  set(key: string, value: string): void { try { sys.localStorage.setItem(key, value); } catch { /* storage blocked */ } }
}
