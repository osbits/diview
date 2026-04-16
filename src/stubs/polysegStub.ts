// Stub for @icr/polyseg-wasm. We don't use segmentation, so return no-ops.
const noop = () => undefined;
const asyncNoop = async () => undefined;
export default {
  init: asyncNoop,
  convertContourRoisToLabelmapVolume: asyncNoop,
  convertSurfacesToVolumeLabelmap: asyncNoop,
  convertContourRoisToSurfaces: asyncNoop,
  noop,
};
export const init = asyncNoop;
