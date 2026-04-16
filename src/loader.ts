// loader.ts — accept File objects, register with cornerstone's wadouri loader,
// parse minimal metadata, and group by SeriesInstanceUID.
import dicomParser from 'dicom-parser';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

export interface SliceEntry {
  imageId: string;
  file: File;
  sopInstanceUID: string;
  instanceNumber: number;
  imagePositionPatient?: [number, number, number];
}

export interface SeriesEntry {
  seriesInstanceUID: string;
  studyInstanceUID: string;
  modality: string;
  description: string;
  patientName: string;
  slices: SliceEntry[];
  // Derived:
  kind: '2d' | 'volume';
  imageIds: string[]; // sorted
}

function readU8(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((b) => new Uint8Array(b));
}

function str(ds: any, tag: string): string {
  try { return (ds.string(tag) || '').trim(); } catch { return ''; }
}
function num(ds: any, tag: string): number {
  const v = str(ds, tag); const n = parseFloat(v); return isFinite(n) ? n : 0;
}
function vec3(ds: any, tag: string): [number, number, number] | undefined {
  const v = str(ds, tag); if (!v) return undefined;
  const parts = v.split('\\').map(parseFloat);
  if (parts.length < 3 || parts.some((x) => !isFinite(x))) return undefined;
  return [parts[0], parts[1], parts[2]];
}

export async function loadFiles(files: File[]): Promise<SeriesEntry[]> {
  const bySeries = new Map<string, SeriesEntry>();

  for (const file of files) {
    let bytes: Uint8Array;
    try {
      bytes = await readU8(file);
    } catch {
      continue;
    }
    let ds: any;
    try {
      ds = dicomParser.parseDicom(bytes, { untilTag: 'x7fe00010' });
    } catch {
      continue; // not DICOM, skip
    }

    const seriesUID = str(ds, 'x0020000e');
    if (!seriesUID) continue;

    const imageId = (cornerstoneDICOMImageLoader as any).wadouri.fileManager.add(file);

    const entry: SliceEntry = {
      imageId,
      file,
      sopInstanceUID: str(ds, 'x00080018'),
      instanceNumber: num(ds, 'x00200013') || 0,
      imagePositionPatient: vec3(ds, 'x00200032'),
    };

    let series = bySeries.get(seriesUID);
    if (!series) {
      series = {
        seriesInstanceUID: seriesUID,
        studyInstanceUID: str(ds, 'x0020000d'),
        modality: str(ds, 'x00080060') || 'OT',
        description: str(ds, 'x0008103e') || str(ds, 'x00081030') || 'Series',
        patientName: str(ds, 'x00100010'),
        slices: [],
        kind: '2d',
        imageIds: [],
      };
      bySeries.set(seriesUID, series);
    }
    series.slices.push(entry);
  }

  // Finalize each series: sort slices, classify 2D vs volume.
  const out: SeriesEntry[] = [];
  for (const s of bySeries.values()) {
    s.slices.sort((a, b) => {
      const ap = a.imagePositionPatient?.[2];
      const bp = b.imagePositionPatient?.[2];
      if (ap !== undefined && bp !== undefined && ap !== bp) return ap - bp;
      return a.instanceNumber - b.instanceNumber;
    });
    s.imageIds = s.slices.map((x) => x.imageId);

    const vol = s.slices.length >= 5
      && ['CT', 'MR', 'PT', 'PET', 'NM'].includes(s.modality)
      && s.slices.every((x) => !!x.imagePositionPatient);
    s.kind = vol ? 'volume' : '2d';
    out.push(s);
  }

  out.sort((a, b) => a.description.localeCompare(b.description));
  return out;
}
