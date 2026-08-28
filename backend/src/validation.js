const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CLASSIFICATIONS = new Set(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL']);

export function sanitizeFilename(filename = '') {
  return filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 180);
}

export function validateUploadInput(input = {}) {
  const filename = typeof input.filename === 'string' ? input.filename.trim() : '';
  const contentType = typeof input.contentType === 'string' && input.contentType.trim()
    ? input.contentType.trim()
    : 'application/octet-stream';
  const category = typeof input.category === 'string' && input.category.trim()
    ? input.category.trim().slice(0, 80)
    : 'General';
  const classification = String(input.classification || 'INTERNAL').toUpperCase();
  const size = Number(input.size || 0);

  if (!filename) {
    return { ok: false, message: 'El nombre del archivo es obligatorio.' };
  }

  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, message: 'El tamaño del archivo no es válido.' };
  }

  if (size > MAX_FILE_SIZE) {
    return { ok: false, message: 'El archivo supera el límite de 10 MB.' };
  }

  if (!ALLOWED_CLASSIFICATIONS.has(classification)) {
    return { ok: false, message: 'Clasificación no permitida.' };
  }

  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) {
    return { ok: false, message: 'El nombre del archivo no contiene caracteres válidos.' };
  }

  return {
    ok: true,
    value: {
      filename,
      safeFilename,
      contentType,
      category,
      classification,
      size
    }
  };
}

export { MAX_FILE_SIZE, ALLOWED_CLASSIFICATIONS };
