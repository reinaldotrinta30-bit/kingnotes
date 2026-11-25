export interface PreparedCanvasImage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Converte qualquer imagem (PNG/JPG/WebP/Print) em WebP otimizado
 * e calcula dimensões proporcionais confortáveis para nascer no Canvas.
 */
export async function prepareCanvasImage(file: File): Promise<PreparedCanvasImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });

    // Limite para armazenamento leve em 100k+ itens
    const maxStoreDim = 1600;
    const storeScale = Math.min(1, maxStoreDim / Math.max(img.width, img.height));
    const storeW = Math.max(1, Math.round(img.width * storeScale));
    const storeH = Math.max(1, Math.round(img.height * storeScale));

    const canvas = document.createElement('canvas');
    canvas.width = storeW;
    canvas.height = storeH;
    const ctx = canvas.getContext('2d');

    let blob: Blob = file;
    if (ctx) {
      ctx.drawImage(img, 0, 0, storeW, storeH);
      const encoded = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.88)
      );
      if (encoded) blob = encoded;
    }

    // Tamanho inicial agradável no Canvas (máximo 360px de largura ou 300px de altura)
    const displayScale = Math.min(1, 360 / img.width, 300 / img.height);
    const width = Math.max(140, Math.round(img.width * displayScale));
    const height = Math.max(110, Math.round(img.height * displayScale));

    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}