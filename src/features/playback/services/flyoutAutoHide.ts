interface AutoHideOptions {
  duration: () => number;
  isHeld: () => boolean;
  hide: () => void;
  schedule: (callback: () => void, delay: number) => number;
  cancel: (timer: number) => void;
}

/** Only presentation and user interaction extend the deadline; state sync does not. */
export function createFlyoutAutoHide(options: AutoHideOptions) {
  let visible = false;
  let timer: number | null = null;
  const clear = () => {
    if (timer !== null) options.cancel(timer);
    timer = null;
  };
  const restart = () => {
    clear();
    if (!visible) return;
    timer = options.schedule(() => {
      timer = null;
      // Check the current pointer position instead of retaining a stale enter event.
      if (options.isHeld()) { restart(); return; }
      visible = false;
      options.hide();
    }, options.duration());
  };
  return {
    shown() { visible = true; restart(); },
    activity: restart,
    hidden() { visible = false; clear(); },
  };
}
