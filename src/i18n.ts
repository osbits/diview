// i18n.ts — minimal two-language (EN / DE) string table with simple {var}
// interpolation. Language is picked from navigator.language at startup.

type Dict = Record<string, string>;

const EN: Dict = {
  'app.title': 'diview — DICOM viewer',

  'tool.crosshair': 'Crosshair',
  'tool.crosshair.title': 'MPR crosshair / reslice (volume only)',
  'tool.wl': 'W/L',
  'tool.wl.title': 'Window/Level — primary drag',
  'tool.length': 'Length',
  'tool.length.title': 'Length measurement',
  'tool.angle': 'Angle',
  'tool.angle.title': 'Angle measurement',
  'tool.invert': 'Invert',
  'tool.invert.title': 'Invert grayscale',
  'tool.reset': 'Reset',
  'tool.reset.title': 'Reset view & W/L',

  'open.top': 'Open',
  'open.top.title': 'Pick a folder of DICOM slices, or drag files / a folder onto the window',
  'open.dz': 'Open…',
  'open.dz.title': 'Pick a folder of DICOM slices',

  'dz.title': 'Drop DICOM files or a folder',
  'dz.subtitle': '2D X-ray · CT with axial / sagittal / coronal MPR',

  'sidebar.empty': 'No series loaded.',
  'series.images.one': '{n} image',
  'series.images.many': '{n} images',
  'series.slices.one': '{n} slice',
  'series.slices.many': '{n} slices',
  'series.kind.mpr': 'MPR',
  'series.kind.2d': '2D',

  'status.ready': 'Ready. Drop DICOM files or a folder to begin.',
  'status.parsing.one': 'Parsing 1 file…',
  'status.parsing.many': 'Parsing {n} files…',
  'status.loading': 'Loading {modality} · {count}…',
  'status.indexing': 'Indexing {loaded}/{total} slices…',
  'status.indexStart': 'Indexing {total} slices…',
  'status.loaded': '{modality} · {desc} · {count}',
  'status.seriesLoaded': '{n} series loaded',
  'status.noDicom': 'No DICOM files found.',
  'status.error': 'Error: {msg}',
  'status.initFail': 'Init failed: {msg}',

  'credit.prefix': 'contributed by',
};

const DE: Dict = {
  'app.title': 'diview — DICOM-Viewer',

  'tool.crosshair': 'Fadenkreuz',
  'tool.crosshair.title': 'MPR-Fadenkreuz / Neuschnitt (nur Volumen)',
  'tool.wl': 'F/Z',
  'tool.wl.title': 'Fenster/Zentrum — Ziehen mit linker Maustaste',
  'tool.length': 'Länge',
  'tool.length.title': 'Längenmessung',
  'tool.angle': 'Winkel',
  'tool.angle.title': 'Winkelmessung',
  'tool.invert': 'Invertieren',
  'tool.invert.title': 'Graustufen invertieren',
  'tool.reset': 'Zurücks.',
  'tool.reset.title': 'Ansicht & F/Z zurücksetzen',

  'open.top': 'Öffnen',
  'open.top.title': 'Ordner mit DICOM-Schichten auswählen oder Dateien / Ordner ins Fenster ziehen',
  'open.dz': 'Öffnen…',
  'open.dz.title': 'Ordner mit DICOM-Schichten auswählen',

  'dz.title': 'DICOM-Dateien oder einen Ordner ablegen',
  'dz.subtitle': '2D-Röntgen · CT mit axialer / sagittaler / koronaler MPR',

  'sidebar.empty': 'Keine Serie geladen.',
  'series.images.one': '{n} Bild',
  'series.images.many': '{n} Bilder',
  'series.slices.one': '{n} Schicht',
  'series.slices.many': '{n} Schichten',
  'series.kind.mpr': 'MPR',
  'series.kind.2d': '2D',

  'status.ready': 'Bereit. Ziehen Sie DICOM-Dateien oder einen Ordner hinein, um zu beginnen.',
  'status.parsing.one': '1 Datei wird gelesen…',
  'status.parsing.many': '{n} Dateien werden gelesen…',
  'status.loading': 'Lade {modality} · {count}…',
  'status.indexing': 'Indiziere {loaded}/{total} Schichten…',
  'status.indexStart': 'Indiziere {total} Schichten…',
  'status.loaded': '{modality} · {desc} · {count}',
  'status.seriesLoaded': '{n} Serien geladen',
  'status.noDicom': 'Keine DICOM-Dateien gefunden.',
  'status.error': 'Fehler: {msg}',
  'status.initFail': 'Initialisierung fehlgeschlagen: {msg}',

  'credit.prefix': 'beigetragen von',
};

const DICTS: Record<string, Dict> = { en: EN, de: DE };

function detectLang(): 'en' | 'de' {
  const raw = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return raw.startsWith('de') ? 'de' : 'en';
}

let lang: 'en' | 'de' = detectLang();
const listeners = new Set<() => void>();

export function getLang() { return lang; }
export function setLang(l: 'en' | 'de') {
  if (l === lang) return;
  lang = l;
  applyStaticStrings();
  for (const cb of listeners) { try { cb(); } catch (e) { console.error(e); } }
}
export function onLangChange(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function toggleLang() { setLang(lang === 'en' ? 'de' : 'en'); }

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[lang] || EN;
  let s = dict[key] ?? EN[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}

// Apply translations to every element with [data-i18n] / [data-i18n-title].
export function applyStaticStrings() {
  document.title = t('app.title');
  document.documentElement.lang = lang;
  const tag = document.getElementById('lang-tag');
  if (tag) tag.textContent = lang.toUpperCase();
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n!);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle!);
  }
}
