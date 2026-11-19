const tesseractFiles = new URL('./vendor/tesseract/', import.meta.url);
const pdfFiles = new URL('./vendor/pdfjs/', import.meta.url);

function canvasFor(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

async function imageCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = url;
    });
    const scale = Math.min(1, 2500 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = canvasFor(image.naturalWidth * scale, image.naturalHeight * scale);
    canvas.getContext('2d', {alpha: false}).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readPdfText(page) {
  const {items} = await page.getTextContent();
  const words = items.filter(item => item.str?.trim());
  words.sort((a, b) => b.transform[5] - a.transform[5]);
  const lines = [];
  for (const word of words) {
    const y = word.transform[5];
    if (!lines.length || Math.abs(lines.at(-1).y - y) > 2) lines.push({y, words: []});
    lines.at(-1).words.push(word);
  }
  return lines.map(line => line.words
    .sort((a, b) => a.transform[4] - b.transform[4])
    .map(item => item.str)
    .join(' ')).join('\n');
}

export async function readBulletinFiles(files, {active, onPage, onProgress, onError}) {
  let worker;
  let fileLabel = '';

  async function recognize(canvas) {
    try {
      if (!worker) {
        const {default: tesseract} = await import(new URL('tesseract.esm.min.js', tesseractFiles).href);
        worker = await tesseract.createWorker(['kor', 'eng'], 1, {
          workerPath: new URL('worker.min.js', tesseractFiles).href,
          corePath: new URL('tesseract-core-lstm.wasm.js', tesseractFiles).href,
          langPath: new URL('lang/', tesseractFiles).href.replace(/\/$/, ''),
          workerBlobURL: false,
          logger: ({status, progress}) => {
            if (active() && status === 'recognizing text') {
              onProgress(fileLabel + ' 읽는 중 · ' + Math.round(progress * 100) + '%');
            }
          },
        });
      }
      if (!active()) return '';
      const {data} = await worker.recognize(canvas);
      return data.text;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  async function readPdf(file) {
    const pdfjs = await import(new URL('pdf.min.mjs', pdfFiles).href);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', pdfFiles).href;
    const task = pdfjs.getDocument({
      data: await file.arrayBuffer(),
      cMapUrl: new URL('cmaps/', pdfFiles).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('standard_fonts/', pdfFiles).href,
      wasmUrl: new URL('wasm/', pdfFiles).href,
      isEvalSupported: false,
    });
    try {
      const pdf = await task.promise;
      for (let number = 1; number <= pdf.numPages && active(); number++) {
        fileLabel = file.name + ' · ' + number + '쪽';
        onProgress(fileLabel + ' 읽는 중');
        try {
          const page = await pdf.getPage(number);
          try {
            let text = await readPdfText(page);
            if (!text && active()) {
              const original = page.getViewport({scale: 1});
              const viewport = page.getViewport({scale: 2500 / Math.max(original.width, original.height)});
              const canvas = canvasFor(viewport.width, viewport.height);
              await page.render({canvas, canvasContext: canvas.getContext('2d'), viewport}).promise;
              text = await recognize(canvas);
            }
            if (active()) onPage({label: fileLabel, text});
          } finally {
            page.cleanup();
          }
        } catch {
          if (active()) onError(fileLabel);
        }
      }
    } finally {
      await task.destroy();
    }
  }

  try {
    for (const file of files) {
      if (!active()) break;
      fileLabel = file.name;
      onProgress(fileLabel + ' 읽는 중');
      try {
        if (file.type === 'application/pdf' || /\.pdf$/iu.test(file.name)) {
          await readPdf(file);
        } else {
          const text = await recognize(await imageCanvas(file));
          if (active()) onPage({label: fileLabel, text});
        }
      } catch {
        if (active()) onError(fileLabel);
      }
    }
  } finally {
    if (worker) await worker.terminate();
  }
}
