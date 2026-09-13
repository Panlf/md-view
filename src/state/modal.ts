export function modalFocus(node: HTMLElement) {
  const previous = document.activeElement as HTMLElement | null;
  const selector =
    'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]';
  const first = () => node.querySelector<HTMLElement>(selector)?.focus();
  queueMicrotask(first);
  function key(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = [...node.querySelectorAll<HTMLElement>(selector)];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey && index <= 0) {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (!event.shiftKey && (index === items.length - 1 || index < 0)) {
      event.preventDefault();
      items[0]?.focus();
    }
  }
  node.addEventListener('keydown', key);
  return {
    destroy() {
      node.removeEventListener('keydown', key);
      if (previous?.isConnected) previous.focus();
    }
  };
}
