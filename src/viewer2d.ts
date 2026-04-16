// viewer2d.ts — StackViewport for X-ray / single-image or small DX/CR series.
import { Enums, RenderingEngine, Types, StackViewport } from '@cornerstonejs/core';
import { STACK_VIEWPORT_ID, MPR_VP_IDS } from './main';

export async function show2d(
  engine: RenderingEngine,
  toolGroup: any,
  series: { imageIds: string[]; modality: string }
) {
  document.getElementById('dropzone')?.classList.add('hidden');
  document.getElementById('layout-mpr')?.classList.add('hidden');
  const layout = document.getElementById('layout-2d')!;
  layout.classList.remove('hidden');

  const element = layout.querySelector<HTMLDivElement>('.viewport[data-vp="stack"]')!;
  element.oncontextmenu = (e) => e.preventDefault();

  // Detach any previously-enabled MPR viewports from the engine.
  for (const id of Object.values(MPR_VP_IDS)) {
    try { engine.disableElement(id); } catch {}
  }
  try { engine.disableElement(STACK_VIEWPORT_ID); } catch {}

  engine.enableElement({
    viewportId: STACK_VIEWPORT_ID,
    type: Enums.ViewportType.STACK,
    element,
    defaultOptions: { background: [0, 0, 0] as Types.Point3 },
  });

  toolGroup.addViewport(STACK_VIEWPORT_ID, engine.id);

  const vp = engine.getViewport(STACK_VIEWPORT_ID) as StackViewport;
  await vp.setStack(series.imageIds, 0);

  // Slice indicator + keyboard navigation for multi-slice stacks.
  ensureSliceIndicator(element, vp, series.imageIds.length);

  vp.render();
}

function ensureSliceIndicator(host: HTMLElement, vp: StackViewport, total: number) {
  let badge = host.querySelector<HTMLDivElement>('.slice-indicator');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'slice-indicator';
    host.appendChild(badge);
  }
  const update = () => {
    const idx = vp.getCurrentImageIdIndex?.() ?? 0;
    badge!.textContent = total > 1 ? `${idx + 1} / ${total}` : '';
    badge!.style.display = total > 1 ? 'block' : 'none';
  };
  update();

  // Keep in sync when slice changes (wheel scroll, programmatic).
  const el = vp.element as HTMLElement;
  el.addEventListener('CORNERSTONE_STACK_NEW_IMAGE' as any, update);
  el.addEventListener('wheel', () => setTimeout(update, 0), { passive: true });

  // Arrow keys navigate slices when the stage has focus.
  host.tabIndex = 0;
  host.addEventListener('keydown', (e) => {
    if (total <= 1) return;
    const cur = vp.getCurrentImageIdIndex?.() ?? 0;
    let next = cur;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') next = Math.min(total - 1, cur + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') next = Math.max(0, cur - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = total - 1;
    if (next !== cur) {
      e.preventDefault();
      vp.setImageIdIndex(next);
      update();
    }
  });
}
