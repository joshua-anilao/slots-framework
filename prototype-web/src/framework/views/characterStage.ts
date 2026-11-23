import { el } from '../core/dom';
import { createCharacterRig, type CharacterRig, type CharacterSpec } from '../character/characterRig';
import { createEmptyRig } from '../character/puppetRig';

/**
 * The scene at the top of the screen (feature 22): a backdrop, the character, and a slot for the
 * game logo / FREE SPINS title on top. Draws only; the reaction controller drives the rig.
 * With no character spec the stage is an empty scene and everything else still works.
 */
export class CharacterStage {
  readonly root = el('div.char-stage');
  readonly rig: CharacterRig;

  constructor(spec: CharacterSpec | undefined, logoSlot: HTMLElement) {
    this.rig = spec ? createCharacterRig(spec) : createEmptyRig();
    if (spec?.sceneBg) this.root.style.background = spec.sceneBg;
    const actor = el('div.char-actor', {}, [this.rig.root]);
    this.root.append(actor, logoSlot);
  }
}
