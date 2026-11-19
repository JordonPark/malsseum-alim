# Browser OCR dependencies

- `tesseract/` contains the browser and worker builds from [Tesseract.js 7.0.0](https://github.com/naptha/tesseract.js/releases/tag/v7.0.0) and the LSTM WebAssembly build from `tesseract.js-core@7.0.0`. The Korean and English models are the `4.0.0_best_int` files distributed by `@tesseract.js-data/kor@1.0.0` and `@tesseract.js-data/eng@1.0.0`. Their upstream model license is in `tesseract/lang/LICENSE`.
- `pdfjs/` contains the legacy browser and worker builds, CMaps, standard fonts, and image decoders from [PDF.js 6.5.438](https://www.npmjs.com/package/pdfjs-dist/v/6.5.438). Distribution license files are kept alongside the corresponding assets.

The app loads these files from its own origin when a bulletin is analyzed.
