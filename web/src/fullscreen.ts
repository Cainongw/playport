export interface DisplayResolution { width: number; height: number }

/** Physical fullscreen pixels, bounded by the receiver's even-edge 480..3840 limits. */
export function fullscreenResolution(width: number, height: number, pixelRatio: number): DisplayResolution {
  if (![width, height, pixelRatio].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Could not determine this screen’s resolution');
  }
  const physicalWidth = width * pixelRatio;
  const physicalHeight = height * pixelRatio;
  const scale = Math.min(3840 / Math.max(physicalWidth, physicalHeight),
    Math.max(1, 480 / Math.min(physicalWidth, physicalHeight)));
  const even = (value: number) => Math.max(480, Math.min(3840, Math.round(value / 2) * 2));
  return { width: even(physicalWidth * scale), height: even(physicalHeight * scale) };
}

/** Keep current codec/frame rate/UI size; reconnect only if the dimensions change. */
export async function matchFullscreenDisplay(
  resolution: DisplayResolution, token: string, signal: AbortSignal, request: typeof fetch = fetch,
): Promise<boolean> {
  const response = await request('/api/display', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Could not read display settings');
  const current = await response.json() as DisplayResolution & { fps: number; uiScale: number; hevc: boolean };
  signal.throwIfAborted();
  if (current.width === resolution.width && current.height === resolution.height) return false;
  const result = await request(`/api/display${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...resolution, fps: current.fps, uiScale: current.uiScale, hevc: current.hevc }),
  });
  const body = await result.json() as { ok?: boolean; error?: string };
  if (!result.ok || !body.ok) throw new Error(body.error ?? 'Could not apply the screen resolution');
  return true;
}

/** Browser fullscreen plus a chrome-free viewer, leaving ordinary Focus mode unchanged. */
export class FullscreenViewer {
  private active = false;
  private busy = false;
  private generation = 0;
  private pending: AbortController | null = null;
  private exitTimer = 0;

  constructor(
    private readonly app: HTMLElement,
    private readonly button: HTMLButtonElement,
    private readonly exitButton: HTMLButtonElement,
    private readonly applyResolution: (size: DisplayResolution, signal: AbortSignal) => Promise<boolean>,
    private readonly notify: (message: string) => void,
    private readonly layoutChanged: () => void,
  ) {
    document.addEventListener('fullscreenchange', this.syncFullscreen);
    window.addEventListener('pointermove', this.revealExit, { passive: true });
    window.addEventListener('pointerdown', this.revealExit, { passive: true });
    window.addEventListener('keydown', this.onKeyDown, true);
    exitButton.addEventListener('click', () => void this.exit());
  }

  async enter(): Promise<void> {
    if (this.active) return this.exit();
    if (this.busy) return;
    if (!this.app.requestFullscreen) {
      this.notify('Full screen is unavailable in this browser. Focus mode is still available.');
      return;
    }
    this.busy = true;
    this.button.disabled = true;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.pending = controller;
    try {
      // Must precede any fetch/await that could consume transient user activation.
      await this.app.requestFullscreen({ navigationUI: 'hide' });
      if (generation !== this.generation || document.fullscreenElement !== this.app) return;
      this.syncFullscreen();
      // Measure the fullscreen viewport on this monitor, including page/OS scaling.
      await new Promise<void>(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      if (controller.signal.aborted || !this.active) return;
      const size = fullscreenResolution(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
      const changed = await this.applyResolution(size, controller.signal);
      if (!controller.signal.aborted) {
        this.notify(changed
          ? `Requested ${size.width} × ${size.height}. CarPlay is reconnecting.`
          : `Full screen · ${size.width} × ${size.height}`);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        this.notify(error instanceof Error ? error.message : 'Could not enter full screen');
      }
    } finally {
      this.busy = false;
      this.button.disabled = false;
      if (this.pending === controller) this.pending = null;
    }
  }

  async exit(): Promise<void> {
    try {
      if (document.fullscreenElement === this.app) await document.exitFullscreen();
      this.syncFullscreen();
    } catch {
      this.notify('Use the browser’s exit-fullscreen control to leave full screen.');
    }
  }

  private readonly syncFullscreen = (): void => {
    const active = document.fullscreenElement === this.app;
    const wasActive = this.active;
    this.active = active;
    this.app.classList.toggle('immersive-mode', active);
    this.button.setAttribute('aria-pressed', String(active));
    this.exitButton.hidden = !active;
    if (active) this.revealExit();
    else {
      this.generation++;
      this.pending?.abort();
      window.clearTimeout(this.exitTimer);
      this.app.classList.remove('show-fullscreen-exit');
      if (wasActive) {
        const target = this.app.classList.contains('focus-mode')
          ? document.getElementById('btn-exit-focus') : this.button;
        target?.focus({ preventScroll: true });
      }
    }
    this.layoutChanged();
  };

  private readonly revealExit = (): void => {
    if (!this.active) return;
    window.clearTimeout(this.exitTimer);
    this.app.classList.add('show-fullscreen-exit');
    this.exitTimer = window.setTimeout(() => this.app.classList.remove('show-fullscreen-exit'), 2500);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.active || event.key !== 'Escape') return;
    // Escape exits this mode; it must not also send a Back command to CarPlay.
    event.preventDefault();
    event.stopImmediatePropagation();
    void this.exit();
  };
}
