import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFilename, validateUploadInput } from '../src/validation.js';

test('sanitizeFilename reemplaza caracteres inseguros', () => {
  assert.equal(sanitizeFilename('Informe nómina 2026.pdf'), 'Informe_nomina_2026.pdf');
});

test('validateUploadInput acepta una carga valida', () => {
  const result = validateUploadInput({
    filename: 'reporte.pdf',
    contentType: 'application/pdf',
    size: 1024,
    category: 'Financiero',
    classification: 'CONFIDENTIAL'
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.classification, 'CONFIDENTIAL');
});

test('validateUploadInput rechaza archivos mayores a 10 MB', () => {
  const result = validateUploadInput({
    filename: 'grande.zip',
    size: (10 * 1024 * 1024) + 1
  });

  assert.equal(result.ok, false);
});
