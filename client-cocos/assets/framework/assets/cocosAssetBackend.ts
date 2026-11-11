import { resources, SpriteAtlas } from 'cc';
import type { SpriteFrame } from 'cc';
import type { IAssetBackend, IAtlas } from './assetLoader';

/** Loads atlases from the "resources" folder with the Cocos asset manager. Not unit tested (needs the engine). */
export class CocosAssetBackend implements IAssetBackend<SpriteFrame> {
  loadAtlas(path: string): Promise<IAtlas<SpriteFrame>> {
    return new Promise((resolve, reject) => {
      resources.load(path, SpriteAtlas, (err, atlas) => {
        if (err || !atlas) { reject(err ?? new Error('no asset returned')); return; }
        resolve({ frame: name => atlas.getSpriteFrame(name) ?? undefined });
      });
    });
  }
}
