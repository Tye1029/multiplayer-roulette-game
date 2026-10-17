// Session-only diagnostics. Reading or copying a report never draws randomness.
export function installDebug(readState) {
  const $ = id => document.getElementById(id);
  const events = [];
  const startedAt = new Date().toISOString();
  let sequence = 0;
  function report() {
    return JSON.stringify({
      capturedAt: new Date().toISOString(), startedAt,
      environment: { path: location.pathname, browser: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
        visibility: document.visibilityState },
      ...readState(),
      log: { totalEvents: sequence, retainedEvents: events.length, events }
    }, null, 2);
  }
  function refresh(force = false) {
    if ($('debug-panel').hidden || (!force && document.activeElement === $('debug-report'))) return;
    const field = $('debug-report'), top = field.scrollTop;
    field.value = report(); field.scrollTop = top;
  }
  function record(type, details = {}) {
    events.push({ sequence: ++sequence, at: new Date().toISOString(), type, ...details });
    if (events.length > 160) events.shift();
    refresh();
  }
  function toggle(open) {
    $('debug-panel').hidden = !open;
    $('debug').setAttribute('aria-expanded', String(open));
    if (open) { refresh(true); $('debug-panel').scrollIntoView({ block: 'nearest' }); }
    else $('debug').focus();
  }
  $('debug').addEventListener('click', () => toggle($('debug-panel').hidden));
  $('close-debug').addEventListener('click', () => toggle(false));
  $('result-debug').addEventListener('click', () => { $('result-dialog').close(); toggle(true); });
  $('refresh-debug').addEventListener('click', () => { refresh(true); $('debug-status').textContent = 'Report refreshed.'; });
  $('copy-debug').addEventListener('click', async () => {
    const text = report(); $('debug-report').value = text;
    try {
      await navigator.clipboard.writeText(text);
      $('debug-status').textContent = 'Copied. Paste this report when describing the issue.';
    } catch {
      $('debug-report').focus(); $('debug-report').select();
      $('debug-status').textContent = 'Copy is unavailable. The report is selected; copy it manually or download it.';
    }
  });
  $('download-debug').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([report()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `roulette-four-debug-${Date.now()}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('debug-status').textContent = 'Report downloaded.';
  });
  window.addEventListener('error', event => record('browser-error', {
    message: event.message, file: event.filename?.split('?')[0], line: event.lineno, column: event.colno,
    stack: String(event.error?.stack || '').slice(0, 4000)
  }));
  window.addEventListener('unhandledrejection', event => record('unhandled-rejection', {
    message: String(event.reason?.message || event.reason).slice(0, 2000),
    stack: String(event.reason?.stack || '').slice(0, 4000)
  }));
  return { record, refresh };
}
