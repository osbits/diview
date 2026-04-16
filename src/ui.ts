// ui.ts — toolbar, series list, drag-and-drop, file pickers.
import { ToolGroupManager, WindowLevelTool, LengthTool, AngleTool, PanTool, ZoomTool, CrosshairsTool } from '@cornerstonejs/tools';
import { Enums as csToolsEnums } from '@cornerstonejs/tools';
import type { RenderingEngine } from '@cornerstonejs/core';
import type { SeriesEntry } from './loader';
import { t, applyStaticStrings, onLangChange, toggleLang, getLang } from './i18n';

type Ids = { stackToolGroupId: string; mprToolGroupId: string };

// For raw strings that won't auto-retranslate. Prefer setStatusKey when
// the message is known ahead of time.
export function setStatus(text: string) {
  lastStatus = null;
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

// i18n-aware status setter. Stores the key so a language switch can replay it.
export function setStatusKey(key: string, vars?: Record<string, string | number>) {
  lastStatus = { key, vars };
  const el = document.getElementById('status');
  if (el) el.textContent = t(key, vars);
}
let lastStatus: { key: string; vars?: Record<string, string | number> } | null = null;

export function initUi(engine: RenderingEngine, ids: Ids, onFiles: (files: File[]) => void) {
  const toolbar = document.getElementById('toolbar')!;
  const dropzone = document.getElementById('dropzone')!;

  // mkBtn accepts i18n keys so a language switch can re-translate buttons
  // via applyStaticStrings() without rebuilding the toolbar.
  const mkBtn = (
    labelKey: string,
    onClick: () => void,
    opts: { active?: boolean; titleKey?: string } = {},
  ) => {
    const b = document.createElement('button');
    b.className = 'tool' + (opts.active ? ' active' : '');
    b.textContent = t(labelKey);
    b.dataset.i18n = labelKey;
    if (opts.titleKey) {
      b.title = t(opts.titleKey);
      b.dataset.i18nTitle = opts.titleKey;
    }
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

  const wlBtn = mkBtn('tool.wl', () => setActivePrimary(WindowLevelTool.toolName, wlBtn), { titleKey: 'tool.wl.title' });
  const lenBtn = mkBtn('tool.length', () => setActivePrimary(LengthTool.toolName, lenBtn), { titleKey: 'tool.length.title' });
  const angBtn = mkBtn('tool.angle', () => setActivePrimary(AngleTool.toolName, angBtn), { titleKey: 'tool.angle.title' });
  const xhairBtn = mkBtn('tool.crosshair', () => setActivePrimary(CrosshairsTool.toolName, xhairBtn), { active: true, titleKey: 'tool.crosshair.title' });
  primaryToolButtons.push(wlBtn, lenBtn, angBtn, xhairBtn);
  toolbar.append(xhairBtn, wlBtn, lenBtn, angBtn);

  // Invert.
  toolbar.appendChild(mkBtn('tool.invert', () => {
    for (const vp of engine.getViewports()) {
      try {
        const props: any = (vp as any).getProperties();
        (vp as any).setProperties({ invert: !props?.invert });
        vp.render();
      } catch {}
    }
  }, { titleKey: 'tool.invert.title' }));

  // Reset.
  toolbar.appendChild(mkBtn('tool.reset', () => {
    for (const vp of engine.getViewports()) {
      try { (vp as any).resetCamera?.(); (vp as any).resetProperties?.(); vp.render(); } catch {}
    }
  }, { titleKey: 'tool.reset.title' }));

  // Single "Open" button opens the native file picker. Folders are loaded
  // by dragging them onto the window (handled by the drop listener below).
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  fileInput.addEventListener('change', () => onFiles(Array.from(fileInput.files || [])));

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

  // Language toggle — clicking the footer tag flips EN ↔ DE and re-applies
  // translations to every tagged element in the DOM.
  const langTag = document.getElementById('lang-tag') as HTMLElement | null;
  if (langTag) {
    langTag.classList.add('lang-toggle');
    langTag.title = 'Switch language · Sprache umschalten';
    langTag.addEventListener('click', () => toggleLang());
  }
  onLangChange(() => {
    applyStaticStrings();
    // Rebuild the series list so pluralized / kind labels pick up the new lang.
    reRenderSeriesListFromHost();
    // Replay the last status message in the new language.
    if (lastStatus) {
      const el = document.getElementById('status');
      if (el) el.textContent = t(lastStatus.key, lastStatus.vars);
    }
  });
}

// The series-list render callback is kept here so onLangChange can trigger
// a redraw using the most recent state captured by the host in main.ts.
let lastRender: null | (() => void) = null;
function reRenderSeriesListFromHost() { lastRender?.(); }

export function renderSeriesList(
  series: SeriesEntry[],
  activeId: string | null,
  onSelect: (uid: string) => void
) {
  // Remember the last call so a language switch can re-render without needing
  // the host to plumb through its state again.
  lastRender = () => renderSeriesList(series, activeId, onSelect);

  const list = document.getElementById('series-list')!;
  list.innerHTML = '';
  document.body.classList.toggle('has-data', series.length > 0);
  if (!series.length) {
    const hint = document.createElement('div');
    hint.style.cssText = 'color:var(--muted);padding:10px;font-size:12px;';
    hint.textContent = t('sidebar.empty');
    list.appendChild(hint);
    return;
  }
  for (const s of series) {
    const d = document.createElement('div');
    d.className = 'series' + (s.seriesInstanceUID === activeId ? ' active' : '');
    const imgCount = t(s.slices.length === 1 ? 'series.images.one' : 'series.images.many', { n: s.slices.length });
    const kind = t(s.kind === 'volume' ? 'series.kind.mpr' : 'series.kind.2d');
    d.innerHTML = `
      <div class="title">${escapeHtml(s.description || 'Series')}</div>
      <div class="meta">${escapeHtml(s.modality)} · ${escapeHtml(imgCount)} · ${escapeHtml(kind)}</div>
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
