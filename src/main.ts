// main.ts — app bootstrap: initialize Cornerstone3D, wire file input + UI.
import {
  RenderingEngine,
  Enums,
  init as csInit,
  volumeLoader,
  imageLoader,
  metaData,
  setUseSharedArrayBuffer,
} from '@cornerstonejs/core';
import { Enums as csCoreEnums } from '@cornerstonejs/core';
import {
  init as csToolsInit,
  addTool,
  ToolGroupManager,
  WindowLevelTool,
  PanTool,
  ZoomTool,
  LengthTool,
  AngleTool,
  StackScrollMouseWheelTool,
  CrosshairsTool,
  Enums as csToolsEnums,
} from '@cornerstonejs/tools';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import dicomParser from 'dicom-parser';
import { cornerstoneStreamingImageVolumeLoader } from '@cornerstonejs/streaming-image-volume-loader';
import * as cornerstone from '@cornerstonejs/core';

import { loadFiles, type SeriesEntry } from './loader';
import { show2d } from './viewer2d';
import { showMpr } from './viewerMpr';
import { initUi, renderSeriesList, setStatus } from './ui';

export const RENDERING_ENGINE_ID = 'diview-engine';
export const STACK_VIEWPORT_ID = 'stack-vp';
export const MPR_VP_IDS = {
  axial: 'mpr-axial',
  sagittal: 'mpr-sagittal',
  coronal: 'mpr-coronal',
} as const;
export const STACK_TOOLGROUP_ID = 'tg-stack';
export const MPR_TOOLGROUP_ID = 'tg-mpr';

async function bootstrap() {
  // Wire dicom-image-loader to cornerstone + dicom-parser.
  (cornerstoneDICOMImageLoader as any).external.cornerstone = cornerstone;
  (cornerstoneDICOMImageLoader as any).external.dicomParser = dicomParser;

  // SharedArrayBuffer requires cross-origin isolation (COOP/COEP) which we
  // can't guarantee when opened from file:// or a plain static host. Force
  // the regular ArrayBuffer path so the streaming volume loader works
  // everywhere.
  setUseSharedArrayBuffer(csCoreEnums.SharedArrayBufferModes.FALSE);

  await csInit();
  await csToolsInit();

  // Configure loader — skip web workers for maximum portability (file://).
  (cornerstoneDICOMImageLoader as any).configure({
    useWebWorkers: false,
    decodeConfig: {
      convertFloatPixelDataToInt: false,
      use16BitDataType: true,
    },
  });

  // Register wadouri scheme for in-memory File objects.
  imageLoader.registerImageLoader(
    'wadouri',
    (cornerstoneDICOMImageLoader as any).wadouri.loadImage
  );
  imageLoader.registerImageLoader(
    'dicomfile',
    (cornerstoneDICOMImageLoader as any).wadouri.loadImage
  );
  // The dicom-image-loader package also registers a wadors handler; we don't need it here.

  // Register volume loader for MPR.
  volumeLoader.registerVolumeLoader(
    'cornerstoneStreamingImageVolume',
    cornerstoneStreamingImageVolumeLoader as any
  );

  // Register tools.
  addTool(WindowLevelTool);
  addTool(PanTool);
  addTool(ZoomTool);
  addTool(LengthTool);
  addTool(AngleTool);
  addTool(StackScrollMouseWheelTool);
  addTool(CrosshairsTool);

  // Create the rendering engine (one for all viewports).
  const engine = new RenderingEngine(RENDERING_ENGINE_ID);

  // Stack (2D) tool group.
  const stackTG = ToolGroupManager.createToolGroup(STACK_TOOLGROUP_ID)!;
  stackTG.addTool(WindowLevelTool.toolName);
  stackTG.addTool(PanTool.toolName);
  stackTG.addTool(ZoomTool.toolName);
  stackTG.addTool(LengthTool.toolName);
  stackTG.addTool(AngleTool.toolName);
  stackTG.addTool(StackScrollMouseWheelTool.toolName);
  stackTG.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
  });
  stackTG.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
  });
  stackTG.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
  });
  stackTG.setToolActive(StackScrollMouseWheelTool.toolName);

  // MPR tool group.
  const mprTG = ToolGroupManager.createToolGroup(MPR_TOOLGROUP_ID)!;
  mprTG.addTool(WindowLevelTool.toolName);
  mprTG.addTool(PanTool.toolName);
  mprTG.addTool(ZoomTool.toolName);
  mprTG.addTool(LengthTool.toolName);
  mprTG.addTool(AngleTool.toolName);
  mprTG.addTool(StackScrollMouseWheelTool.toolName);
  mprTG.addTool(CrosshairsTool.toolName, {
    getReferenceLineColor: (vpId: string) =>
      vpId === MPR_VP_IDS.axial ? 'rgb(255,210,80)'
      : vpId === MPR_VP_IDS.sagittal ? 'rgb(90,190,255)'
      : 'rgb(120,255,140)',
    getReferenceLineControllable: () => true,
    getReferenceLineDraggableRotatable: () => true,
    getReferenceLineSlabThicknessControlsOn: () => false,
  });
  mprTG.setToolActive(CrosshairsTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
  });
  mprTG.setToolActive(PanTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Auxiliary }],
  });
  mprTG.setToolActive(ZoomTool.toolName, {
    bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
  });
  mprTG.setToolActive(StackScrollMouseWheelTool.toolName);

  // App state.
  const state: { series: SeriesEntry[]; activeId: string | null } = {
    series: [],
    activeId: null,
  };

  async function onSeriesSelected(uid: string) {
    const s = state.series.find((x) => x.seriesInstanceUID === uid);
    if (!s) return;
    state.activeId = uid;
    renderSeriesList(state.series, state.activeId, onSeriesSelected);
    setStatus(`Loading ${s.modality} · ${s.slices.length} image${s.slices.length > 1 ? 's' : ''}…`);
    try {
      if (s.kind === 'volume') {
        await showMpr(engine, mprTG, s);
      } else {
        await show2d(engine, stackTG, s);
      }
      setStatus(`${s.modality} · ${s.description} · ${s.slices.length} slice${s.slices.length > 1 ? 's' : ''}`);
    } catch (e: any) {
      console.error(e);
      setStatus(`Error: ${e?.message || e}`);
    }
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setStatus(`Parsing ${files.length} file${files.length > 1 ? 's' : ''}…`);
    const added = await loadFiles(files);
    if (!added.length) {
      setStatus('No DICOM files found.');
      return;
    }
    // Merge with existing state (dedupe by seriesUID).
    const byUid = new Map(state.series.map((s) => [s.seriesInstanceUID, s]));
    for (const s of added) byUid.set(s.seriesInstanceUID, s);
    state.series = [...byUid.values()];
    renderSeriesList(state.series, state.activeId, onSeriesSelected);
    // Auto-open the first series if nothing is selected.
    if (!state.activeId) await onSeriesSelected(state.series[0].seriesInstanceUID);
    else setStatus(`${state.series.length} series loaded`);
  }

  initUi(engine, { stackToolGroupId: STACK_TOOLGROUP_ID, mprToolGroupId: MPR_TOOLGROUP_ID }, handleFiles);
  renderSeriesList(state.series, state.activeId, onSeriesSelected);
  setStatus('Ready. Drop DICOM files or a folder to begin.');
}

bootstrap().catch((e) => {
  console.error(e);
  const el = document.getElementById('status');
  if (el) el.textContent = `Init failed: ${e?.message || e}`;
});
