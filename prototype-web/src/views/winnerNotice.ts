import type { IWinFeedService, WinFeedItem } from '@slots/game-logic';
import { el, fitText } from '../core/dom';
import { money } from '../strings';

/**
 * Winner notification (feature 13): slides in over the multiplier bar now and then,
 * "gamblingPl*** won ₱55,000". Waits while a win is being shown so it never hides the multiplier.
 * The prototype feed is simulated; production must use real wins from the server.
 */
export class WinnerNotice {
  readonly root = el('div.winner-notice');
  private pending: WinFeedItem | null = null;
  private showing = false;

  constructor(feed: IWinFeedService, private canShow: () => boolean, private demoTag: boolean) {
    feed.subscribe(item => { this.pending = item; this.tryShow(); });
    feed.start();
    setInterval(() => this.tryShow(), 500);
  }

  private tryShow(): void {
    if (!this.pending || this.showing || !this.canShow()) return;
    const item = this.pending;
    this.pending = null;
    this.showing = true;
    const text = el('span.wn-text', {}, [el('b', { text: item.name }), ' won ', el('b.wn-amt', { text: money(item.amount) })]);
    this.root.replaceChildren(el('span.wn-icon', { text: '🏆' }), text, ...(this.demoTag && item.simulated ? [el('span.wn-demo', { text: 'DEMO' })] : []));
    this.root.classList.add('show');
    fitText(text, 520);
    this.root.animate([{ transform: 'translateX(110%)', opacity: 0 }, { transform: 'translateX(-3%)', opacity: 1, offset: 0.8 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 450, easing: 'cubic-bezier(.2,.8,.3,1)' });
    setTimeout(() => {
      this.root.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-110%)', opacity: 0 }], { duration: 350, easing: 'ease-in', fill: 'forwards' })
        .finished.then(() => { this.root.classList.remove('show'); this.root.getAnimations().forEach(a => a.cancel()); this.showing = false; });
    }, 3600);
  }
}
