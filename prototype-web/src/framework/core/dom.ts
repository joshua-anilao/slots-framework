/** Tiny DOM helper: el('div.cls.other', { text, onclick }, children). */
export function el(
  spec: string,
  props: Partial<Record<string, unknown>> & { text?: string } = {},
  children: (Node | string)[] = [],
): HTMLElement {
  const [tag, ...classes] = spec.split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') node.textContent = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

/**
 * Shrinks a single-line text until it fits `maxWidth` design pixels (720-wide stage).
 * Call after the node is in the document. Pass `sample` to size for the longest text it will show (count-ups).
 */
export function fitText(node: HTMLElement, maxWidth: number, sample?: string): void {
  const text = node.textContent;
  if (sample !== undefined) node.textContent = sample;
  node.style.fontSize = '';
  node.style.whiteSpace = 'nowrap';
  const base = parseFloat(getComputedStyle(node).fontSize);
  const w = node.scrollWidth;
  if (w > maxWidth) node.style.fontSize = `${Math.floor(base * maxWidth / w)}px`;
  if (sample !== undefined) node.textContent = text;
}
