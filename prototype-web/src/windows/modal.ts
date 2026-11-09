import { el } from '../core/dom';

/** One popup at a time, dimmed background, close with X or tap outside. */
export class Modal {
  private static current: Modal | null = null;
  readonly root: HTMLElement;
  readonly body = el('div.modal-body');
  private readonly panel: HTMLElement;
  private closing = false;

  constructor(private host: HTMLElement, title: string, private onClose?: () => void) {
    const panel = el('div.modal-panel', {}, [
      el('div.modal-head', {}, [el('span', { text: title }), el('button.modal-x', { text: '✕', onclick: () => this.close() })]),
      this.body,
    ]);
    this.panel = panel;
    this.root = el('div.modal', { onpointerdown: (e: Event) => { if (e.target === this.root) this.close(); } }, [panel]);
  }

  open(): this {
    Modal.current?.close();
    Modal.current = this;
    this.host.append(this.root);
    // Art guide section 2: popups slide up over a fading dim layer.
    this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
    this.panel.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(-2%)', offset: 0.8 }, { transform: 'none' }],
      { duration: 280, easing: 'cubic-bezier(.2,.8,.3,1)' });
    return this;
  }

  close(): void {
    if (this.closing) return;
    this.closing = true;
    if (Modal.current === this) Modal.current = null;
    this.panel.animate([{ transform: 'none' }, { transform: 'translateY(100%)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' });
    this.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.then(() => this.root.remove());
    this.onClose?.();
  }

  static get isOpen(): boolean { return Modal.current !== null; }
}
