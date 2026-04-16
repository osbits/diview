// viewerMpr.ts — build a volume from a CT/MR series and show 3 orthogonal MPR viewports.
import {
  Enums,
  RenderingEngine,
  Types,
  volumeLoader,
  setVolumesForViewports,
  cache,
  imageLoader,
} from '@cornerstonejs/core';
import { STACK_VIEWPORT_ID, MPR_VP_IDS } from './main';
import { setStatus } from './ui';

const { ViewportType, OrientationAxis } = Enums;

function makeVolumeId(seriesUid: string) {
  return `cornerstoneStreamingImageVolume:${seriesUid}`;
}

export async function showMpr(
  engine: RenderingEngine,
  toolGroup: any,
  series: { seriesInstanceUID: string; imageIds: string[] }
) {
  document.getElementById('dropzone')?.classList.add('hidden');
  document.getElementById('layout-2d')?.classList.add('hidden');
  const layout = document.getElementById('layout-mpr')!;
  layout.classList.remove('hidden');

  // Tear down any previous viewports.
  try { engine.disableElement(STACK_VIEWPORT_ID); } catch {}
  for (const id of Object.values(MPR_VP_IDS)) {
    try { engine.disableElement(id); } catch {}
  }

  const axEl = layout.querySelector<HTMLDivElement>('.viewport[data-vp="axial"]')!;
  const sgEl = layout.querySelector<HTMLDivElement>('.viewport[data-vp="sagittal"]')!;
  const coEl = layout.querySelector<HTMLDivElement>('.viewport[data-vp="coronal"]')!;
  for (const el of [axEl, sgEl, coEl]) el.oncontextmenu = (e) => e.preventDefault();

  const vpInputs: Types.PublicViewportInput[] = [
    {
      viewportId: MPR_VP_IDS.axial,
      type: ViewportType.ORTHOGRAPHIC,
      element: axEl,
      defaultOptions: { orientation: OrientationAxis.AXIAL, background: [0, 0, 0] as Types.Point3 },
    },
    {
      viewportId: MPR_VP_IDS.sagittal,
      type: ViewportType.ORTHOGRAPHIC,
      element: sgEl,
      defaultOptions: { orientation: OrientationAxis.SAGITTAL, background: [0, 0, 0] as Types.Point3 },
    },
    {
      viewportId: MPR_VP_IDS.coronal,
      type: ViewportType.ORTHOGRAPHIC,
      element: coEl,
      defaultOptions: { orientation: OrientationAxis.CORONAL, background: [0, 0, 0] as Types.Point3 },
    },
  ];
  engine.setViewports(vpInputs);

  for (const id of Object.values(MPR_VP_IDS)) {
    toolGroup.addViewport(id, engine.id);
  }

  const volumeId = makeVolumeId(series.seriesInstanceUID);
  // Re-use cached volume when possible.
  let volume = cache.getVolume(volumeId);
  if (!volume) {
    // The streaming volume loader reads per-slice metadata (spacing,
    // orientation, position) during createAndCacheVolume. The dicom-image-loader
    // only registers that metadata after an image has been loaded once, so
    // prefetch every slice first. This is cheap for local files and also
    // populates the image cache the streaming loader will then reuse.
    setStatus(`Indexing ${series.imageIds.length} slices…`);
    let loaded = 0;
    await Promise.all(
      series.imageIds.map((id) =>
        imageLoader
          .loadAndCacheImage(id)
          .then(() => {
            loaded++;
            if (loaded % 20 === 0 || loaded === series.imageIds.length) {
              setStatus(`Indexing ${loaded}/${series.imageIds.length} slices…`);
            }
          })
          .catch((e) => console.warn('slice load failed', id, e))
      )
    );
    volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: series.imageIds });
  }
  // Kick off async slice→volume copy (fast since images are cached).
  (volume as any).load?.();

  await setVolumesForViewports(
    engine,
    [{ volumeId }],
    Object.values(MPR_VP_IDS)
  );

  engine.renderViewports(Object.values(MPR_VP_IDS));
}
