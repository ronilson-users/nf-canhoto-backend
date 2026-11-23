export interface ImageType {
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  ext: 'jpg' | 'png' | 'webp';
}

/** Identifica JPEG, PNG e WebP pelos primeiros bytes. Qualquer outra coisa (inclusive HEIC) retorna null. */
export const detectImageType = (buf: Uint8Array): ImageType | null => {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buf[i] === b)) return { mime: 'image/png', ext: 'png' };
  const ascii = (from: number, s: string) => [...s].every((c, i) => buf[from + i] === c.charCodeAt(0));
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { mime: 'image/webp', ext: 'webp' };
  return null;
};
