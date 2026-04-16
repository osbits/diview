// ui.ts — toolbar, series list, drag-and-drop, file pickers.
import { ToolGroupManager, WindowLevelTool, LengthTool, AngleTool, PanTool, ZoomTool, CrosshairsTool } from '@cornerstonejs/tools';
import { Enums as csToolsEnums } from '@cornerstonejs/tools';
import type { RenderingEngine } from '@cornerstonejs/core';
import type { SeriesEntry } from './loader';

type Ids = { stackToolGroupId: string; mprToolGroupId: string };

export function setStatus(text: string) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

export function initUi(engine: RenderingEngine, ids: Ids, onFiles: (files: File[]) => void) {
  const toolbar = document.getElementById('toolbar')!;
  const dropzone = document.getElementById('dropzone')!;

  const mkBtn = (label: string, onClick: () => void, opts: { active?: boolean; title?: string } = {}) => {
    const b = document.createElement('button');
    b.className = 'tool' + (opts.active ? ' active' : '');
    b.textContent = label;
    if (opts.title) b.title = opts.title;
    b.addEventListener('click', onClick);
    return b;
  };

  const primaryToolButtons: HTMLButtonElement[] = [];
  function setActivePrimary(toolName: string, btn: HTMLButtonElement) {
    for (const b of primaryToolButtons) b.classList.remove('active');
    btn.classList.add('active');
    for (const gid of [ids.stackToolGroupId, ids.mprToolGroupId]) {
      const tg = ToolGroupManager.getToolGroup(gid);
      if (!tg) continue;
      // Deactivate the other primary tools, keep them available as passive.
      for (const t of [WindowLevelTool.toolName, LengthTool.toolName, AngleTool.toolName, PanTool.toolName, ZoomTool.toolName, CrosshairsTool.toolName]) {
        try { tg.setToolPassive(t); } catch {}
      }
      try {
        tg.setToolActive(toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
        });
      } catch {}
      // Always keep pan/zoom on aux/secondary.
      try {
        tg.setToolActive(PanTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
        });
      } catch {}
      try {
        tg.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
        });
      } catch {}
    }
  }

  const wlBtn = mkBtn('W/L', () => setActivePrimary(WindowLevelTool.toolName, wlBtn), { title: 'Window/Level — primary drag' });
  const lenBtn = mkBtn('Length', () => setActivePrimary(LengthTool.toolName, lenBtn), { title: 'Length measurement' });
  const angBtn = mkBtn('Angle', () => setActivePrimary(AngleTool.toolName, angBtn), { title: 'Angle measurement' });
  const xhairBtn = mkBtn('Crosshair', () => setActivePrimary(CrosshairsTool.toolName, xhairBtn), { active: true, title: 'MPR crosshair / reslice (volume only)' });
  primaryToolButtons.push(wlBtn, lenBtn, angBtn, xhairBtn);
  toolbar.append(xhairBtn, wlBtn, lenBtn, angBtn);

  // Invert.
  toolbar.appendChild(mkBtn('Invert', () => {
    for (const vp of engine.getViewports()) {
      try {
        const props: any = (vp as any).getProperties();
        (vp as any).setProperties({ invert: !props?.invert });
        vp.render();
      } catch {}
    }
  }, { title: 'Invert grayscale' }));

  // Reset.
  toolbar.appendChild(mkBtn('Reset', () => {
    for (const vp of engine.getViewports()) {
      try { (vp as any).resetCamera?.(); (vp as any).resetProperties?.(); vp.render(); } catch {}
    }
  }, { title: 'Reset view & W/L' }));

  // File + folder inputs.
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const folderInput = document.getElementById('folder-input') as HTMLInputElement;
  fileInput.addEventListener('change', () => onFiles(Array.from(fileInput.files || [])));
  folderInput.addEventListener('change', () => onFiles(Array.from(folderInput.files || [])));

  // Drag & drop on the stage / dropzone.
  const stage = document.getElementById('stage')!;
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  };
  const onDragLeave = () => dropzone.classList.remove('dragover');
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = await collectFiles(e.dataTransfer);
    onFiles(files);
  };
  stage.addEventListener('dragover', onDragOver);
  stage.addEventListener('dragleave', onDragLeave);
  stage.addEventListener('drop', onDrop);
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

export function renderSeriesList(
  series: SeriesEntry[],
  activeId: string | null,
  onSelect: (uid: string) => void
) {
  const list = document.getElementById('series-list')!;
  list.innerHTML = '';
  if (!series.length) {
    const hint = document.createElement('div');
    hint.style.cssText = 'color:var(--muted);padding:10px;font-size:12px;';
    hint.textContent = 'No series loaded.';
    list.appendChild(hint);
    return;
  }
  for (const s of series) {
    const d = document.createElement('div');
    d.className = 'series' + (s.seriesInstanceUID === activeId ? ' active' : '');
    d.innerHTML = `
      <div class="title">${escapeHtml(s.description || 'Series')}</div>
      <div class="meta">${s.modality} · ${s.slices.length} image${s.slices.length > 1 ? 's' : ''} · ${s.kind === 'volume' ? 'MPR' : '2D'}</div>
    `;
    d.addEventListener('click', () => onSelect(s.seriesInstanceUID));
    list.appendChild(d);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

// Recursively walk dropped DataTransferItems (files + directories).
async function collectFiles(dt: DataTransfer | null): Promise<File[]> {
  if (!dt) return [];
  const items = Array.from(dt.items || []);
  const out: File[] = [];
  if (items.length && 'webkitGetAsEntry' in items[0]) {
    const walk = async (entry: any): Promise<void> => {
      if (!entry) return;
      if (entry.isFile) {
        await new Promise<void>((res) => entry.file((f: File) => { out.push(f); res(); }, () => res()));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readAll = (): Promise<any[]> => new Promise((res) => reader.readEntries((ents: any[]) => res(ents || []), () => res([])));
        let batch = await readAll();
        while (batch.length) {
          await Promise.all(batch.map(walk));
          batch = await readAll();
        }
      }
    };
    await Promise.all(items.map((it) => walk((it as any).webkitGetAsEntry?.())));
    if (out.length) return out;
  }
  return Array.from(dt.files || []);
}
