import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The cornerstoneDICOMImageLoader UMD bundle computes its webpack publicPath
// from document.currentScript.src, which is empty for an inline script, and
// then throws "Automatic publicPath is not supported in this browser". Since
// we don't dynamically load any codec/worker chunks at runtime, patch the
// bundle string to fall back to document.baseURI instead of throwing.
function fixWebpackPublicPath(): Plugin {
  const RE = /throw new Error\("Automatic publicPath is not supported in this browser"\)/g;
  const REPLACE = '(A=typeof document!=="undefined"&&document.baseURI||"")';
  return {
    name: 'diview:fix-webpack-publicpath',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('cornerstoneDICOMImageLoader') && RE.test(code)) {
        RE.lastIndex = 0;
        return { code: code.replace(RE, REPLACE), map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [fixWebpackPublicPath(), viteSingleFile()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 10000,
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  worker: { format: 'es' },
  optimizeDeps: {
    include: ['@cornerstonejs/dicom-image-loader', 'dicom-parser'],
  },
  resolve: {
    alias: [
      // Segmentation is out of scope — stub out the WASM polyseg dep so the
      // single-file build doesn't pull in WebAssembly that Vite can't inline.
      { find: '@icr/polyseg-wasm', replacement: '/src/stubs/polysegStub.ts' },
      // Also stub out the polySeg worker registration so no separate worker
      // chunk is emitted (would break "single file" goal).
      {
        find: /.*registerPolySegWorker.*/,
        replacement: '/src/stubs/empty.ts',
      },
    ],
  },
});
