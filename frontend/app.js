const config = window.APP_CONFIG;

const state = {
  idToken: sessionStorage.getItem('idToken'),
  email: sessionStorage.getItem('email'),
  pendingEmail: localStorage.getItem('pendingEmail') || '',
  recoveryEmail: localStorage.getItem('recoveryEmail') || ''
};

const els = {
  alert: document.querySelector('#alert'),
  authSection: document.querySelector('#authSection'),
  dashboardSection: document.querySelector('#dashboardSection'),
  logoutBtn: document.querySelector('#logoutBtn'),
  loginForm: document.querySelector('#loginForm'),
  signupForm: document.querySelector('#signupForm'),
  confirmForm: document.querySelector('#confirmForm'),
  forgotPasswordForm: document.querySelector('#forgotPasswordForm'),
  resetPasswordForm: document.querySelector('#resetPasswordForm'),
  showRecoveryBtn: document.querySelector('#showRecoveryBtn'),
  cancelRecoveryBtn: document.querySelector('#cancelRecoveryBtn'),
  resendConfirmationBtn: document.querySelector('#resendConfirmationBtn'),
  recoveryPanel: document.querySelector('#recoveryPanel'),
  loginEmail: document.querySelector('#loginEmail'),
  loginPassword: document.querySelector('#loginPassword'),
  signupEmail: document.querySelector('#signupEmail'),
  signupPassword: document.querySelector('#signupPassword'),
  confirmCode: document.querySelector('#confirmCode'),
  recoveryEmail: document.querySelector('#recoveryEmail'),
  recoveryCode: document.querySelector('#recoveryCode'),
  newPassword: document.querySelector('#newPassword'),
  userEmail: document.querySelector('#userEmail'),
  refreshBtn: document.querySelector('#refreshBtn'),
  uploadForm: document.querySelector('#uploadForm'),
  fileInput: document.querySelector('#fileInput'),
  categoryInput: document.querySelector('#categoryInput'),
  classificationInput: document.querySelector('#classificationInput'),
  documentsList: document.querySelector('#documentsList'),
  documentCount: document.querySelector('#documentCount')
};

const CLASSIFICATION_LABELS = {
  PUBLIC: 'Público',
  INTERNAL: 'Interno',
  CONFIDENTIAL: 'Confidencial'
};

function assertConfig() {
  const missing = !config || Object.values(config).some(value => !value || String(value).includes('REPLACE_ME'));
  if (missing) {
    showAlert('Falta configurar frontend/config.js. Despliega el stack y ejecuta el script de configuración.', 'error');
    return false;
  }
  return true;
}

function showAlert(message, type = 'success') {
  els.alert.textContent = message;
  els.alert.className = `alert ${type}`;
  window.clearTimeout(showAlert.timer);
  showAlert.timer = window.setTimeout(() => {
    els.alert.classList.add('hidden');
  }, 6500);
}

function getCognitoErrorMessage(data) {
  const type = String(data?.__type || data?.code || '').split('#').pop();
  const messages = {
    NotAuthorizedException: 'Correo o contraseña incorrectos.',
    UserNotConfirmedException: 'La cuenta todavía no está confirmada. Usa el código enviado a tu correo.',
    UsernameExistsException: 'Ya existe una cuenta registrada con ese correo.',
    InvalidPasswordException: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.',
    CodeMismatchException: 'El código ingresado no es correcto.',
    ExpiredCodeException: 'El código expiró. Solicita uno nuevo e inténtalo de nuevo.',
    LimitExceededException: 'Se alcanzó temporalmente el límite de intentos. Espera unos minutos e inténtalo de nuevo.',
    TooManyRequestsException: 'Se realizaron demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
    PasswordResetRequiredException: 'Debes restablecer tu contraseña antes de iniciar sesión.',
    UserNotFoundException: 'No fue posible completar la operación con ese correo.',
    InvalidParameterException: 'Los datos enviados no cumplen los requisitos de autenticación.'
  };

  return messages[type] || data?.message || 'No fue posible completar la operación de autenticación.';
}

async function cognitoRequest(operation, payload) {
  const response = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getCognitoErrorMessage(data));
  }
  return data;
}

async function api(path, options = {}) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: state.idToken,
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    logout(false);
    throw new Error('La sesión expiró o no tiene permisos. Inicia sesión nuevamente.');
  }
  if (!response.ok) {
    throw new Error(data.message || 'La operación no pudo completarse.');
  }
  return data;
}

function setButtonBusy(button, busy, busyText = 'Procesando...') {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    delete button.dataset.originalText;
  }
}

function showRecovery(show = true) {
  els.recoveryPanel.classList.toggle('hidden', !show);
  if (show) {
    const email = state.recoveryEmail || els.loginEmail.value.trim().toLowerCase() || state.pendingEmail;
    if (email) els.recoveryEmail.value = email;
    els.resetPasswordForm.classList.toggle('hidden', !state.recoveryEmail);
  }
}

function updateView() {
  const loggedIn = Boolean(state.idToken);
  els.authSection.classList.toggle('hidden', loggedIn);
  els.dashboardSection.classList.toggle('hidden', !loggedIn);
  els.logoutBtn.classList.toggle('hidden', !loggedIn);
  els.userEmail.textContent = loggedIn ? state.email || 'Usuario autenticado' : '';

  if (state.pendingEmail) {
    els.signupEmail.value = state.pendingEmail;
  }

  if (!loggedIn && state.recoveryEmail) {
    showRecovery(true);
  }
}

function logout(showMessage = true) {
  state.idToken = null;
  state.email = null;
  sessionStorage.removeItem('idToken');
  sessionStorage.removeItem('email');
  updateView();
  els.documentsList.innerHTML = '<div class="empty-state">Todavía no hay documentos.</div>';
  els.documentCount.textContent = '0';
  if (showMessage) showAlert('Sesión cerrada correctamente.');
}

function formatBytes(bytes) {
  if (!Number.isFinite(Number(bytes))) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Number(bytes);
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso));
}

function renderDocuments(items) {
  els.documentCount.textContent = String(items.length);

  if (!items.length) {
    els.documentsList.innerHTML = '<div class="empty-state">Todavía no hay documentos.</div>';
    return;
  }

  els.documentsList.innerHTML = '';
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'document-row';

    const info = document.createElement('div');
    info.className = 'document-info';

    const title = document.createElement('p');
    title.className = 'document-name';
    title.textContent = item.filename;

    const meta = document.createElement('div');
    meta.className = 'document-meta';
    const classification = item.classification || 'INTERNAL';
    meta.innerHTML = `
      <span class="pill">${escapeHtml(item.category || 'General')}</span>
      <span class="pill ${escapeHtml(classification)}">${escapeHtml(CLASSIFICATION_LABELS[classification] || classification)}</span>
      <span>${formatBytes(item.size)}</span>
      <span>${formatDate(item.createdAt)}</span>
      ${item.status !== 'READY' ? '<span class="status-pending">Carga pendiente</span>' : ''}
    `;

    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'document-actions';

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.textContent = 'Descargar';
    downloadBtn.disabled = item.status !== 'READY';
    downloadBtn.addEventListener('click', () => downloadDocument(item.documentId));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Eliminar';
    deleteBtn.addEventListener('click', () => deleteDocument(item.documentId, item.filename));

    actions.append(downloadBtn, deleteBtn);
    row.append(info, actions);
    els.documentsList.append(row);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadDocuments() {
  setButtonBusy(els.refreshBtn, true, 'Actualizando...');
  try {
    const data = await api('/documents');
    renderDocuments(data.items || []);
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(els.refreshBtn, false);
  }
}

async function downloadDocument(documentId) {
  try {
    const data = await api(`/documents/${encodeURIComponent(documentId)}/download`);
    window.location.assign(data.downloadUrl);
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

async function deleteDocument(documentId, filename) {
  if (!window.confirm(`¿Eliminar "${filename}"? Esta acción no se puede deshacer.`)) return;

  try {
    await api(`/documents/${encodeURIComponent(documentId)}`, { method: 'DELETE' });
    showAlert('Documento eliminado correctamente.');
    await loadDocuments();
  } catch (error) {
    showAlert(error.message, 'error');
  }
}

els.loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!assertConfig()) return;

  const submitButton = els.loginForm.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Ingresando...');

  try {
    const email = els.loginEmail.value.trim().toLowerCase();
    const result = await cognitoRequest('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.userPoolClientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: els.loginPassword.value
      }
    });

    state.idToken = result.AuthenticationResult.IdToken;
    state.email = email;
    sessionStorage.setItem('idToken', state.idToken);
    sessionStorage.setItem('email', state.email);
    els.loginPassword.value = '';
    showRecovery(false);
    updateView();
    showAlert('Inicio de sesión correcto.');
    await loadDocuments();
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(submitButton, false);
  }
});

els.signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!assertConfig()) return;

  const submitButton = els.signupForm.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Creando cuenta...');

  try {
    const email = els.signupEmail.value.trim().toLowerCase();
    await cognitoRequest('SignUp', {
      ClientId: config.userPoolClientId,
      Username: email,
      Password: els.signupPassword.value,
      UserAttributes: [{ Name: 'email', Value: email }]
    });

    state.pendingEmail = email;
    localStorage.setItem('pendingEmail', email);
    els.signupPassword.value = '';
    showAlert('Cuenta creada. Revisa tu correo e ingresa el código de confirmación. Si no aparece, revisa Spam.');
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(submitButton, false);
  }
});

els.confirmForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!assertConfig()) return;

  const email = state.pendingEmail || els.signupEmail.value.trim().toLowerCase();
  if (!email) {
    showAlert('Primero indica el correo con el que te registraste.', 'error');
    return;
  }

  const submitButton = els.confirmForm.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Confirmando...');

  try {
    await cognitoRequest('ConfirmSignUp', {
      ClientId: config.userPoolClientId,
      Username: email,
      ConfirmationCode: els.confirmCode.value.trim()
    });

    localStorage.removeItem('pendingEmail');
    state.pendingEmail = '';
    els.confirmCode.value = '';
    els.loginEmail.value = email;
    showAlert('Cuenta confirmada. Ya puedes iniciar sesión.');
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(submitButton, false);
  }
});

els.resendConfirmationBtn.addEventListener('click', async () => {
  if (!assertConfig()) return;
  const email = state.pendingEmail || els.signupEmail.value.trim().toLowerCase();
  if (!email) {
    showAlert('Indica primero el correo de la cuenta que deseas confirmar.', 'error');
    return;
  }

  setButtonBusy(els.resendConfirmationBtn, true, 'Enviando...');
  try {
    await cognitoRequest('ResendConfirmationCode', {
      ClientId: config.userPoolClientId,
      Username: email
    });
    state.pendingEmail = email;
    localStorage.setItem('pendingEmail', email);
    showAlert('Código reenviado. Revisa también la carpeta de Spam.');
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(els.resendConfirmationBtn, false);
  }
});

els.showRecoveryBtn.addEventListener('click', () => showRecovery(true));
els.cancelRecoveryBtn.addEventListener('click', () => showRecovery(false));

els.forgotPasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!assertConfig()) return;

  const email = els.recoveryEmail.value.trim().toLowerCase();
  const submitButton = els.forgotPasswordForm.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Enviando...');

  try {
    await cognitoRequest('ForgotPassword', {
      ClientId: config.userPoolClientId,
      Username: email
    });

    state.recoveryEmail = email;
    localStorage.setItem('recoveryEmail', email);
    els.resetPasswordForm.classList.remove('hidden');
    showAlert('Código de recuperación enviado. Revisa tu correo y, si es necesario, la carpeta de Spam.');
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(submitButton, false);
  }
});

els.resetPasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!assertConfig()) return;

  const email = state.recoveryEmail || els.recoveryEmail.value.trim().toLowerCase();
  if (!email) {
    showAlert('Primero solicita un código de recuperación.', 'error');
    return;
  }

  const submitButton = els.resetPasswordForm.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Actualizando...');

  try {
    await cognitoRequest('ConfirmForgotPassword', {
      ClientId: config.userPoolClientId,
      Username: email,
      ConfirmationCode: els.recoveryCode.value.trim(),
      Password: els.newPassword.value
    });

    localStorage.removeItem('recoveryEmail');
    state.recoveryEmail = '';
    els.loginEmail.value = email;
    els.recoveryCode.value = '';
    els.newPassword.value = '';
    els.resetPasswordForm.classList.add('hidden');
    showRecovery(false);
    showAlert('Contraseña actualizada correctamente. Ya puedes iniciar sesión.');
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(submitButton, false);
  }
});

els.uploadForm.addEventListener('submit', async event => {
  event.preventDefault();

  const file = els.fileInput.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showAlert('El archivo supera el límite de 10 MB.', 'error');
    return;
  }

  const submitButton = els.uploadForm.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Subiendo...');

  try {
    const contentType = file.type || 'application/octet-stream';
    const presigned = await api('/documents/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        contentType,
        size: file.size,
        category: els.categoryInput.value.trim() || 'General',
        classification: els.classificationInput.value
      })
    });

    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error('S3 no pudo completar la carga del archivo.');
    }

    await api(`/documents/${encodeURIComponent(presigned.documentId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({})
    });

    els.uploadForm.reset();
    els.categoryInput.value = 'General';
    els.classificationInput.value = 'INTERNAL';
    showAlert('Documento almacenado correctamente en AWS.');
    await loadDocuments();
  } catch (error) {
    showAlert(error.message, 'error');
  } finally {
    setButtonBusy(submitButton, false);
  }
});

els.refreshBtn.addEventListener('click', loadDocuments);
els.logoutBtn.addEventListener('click', () => logout(true));

updateView();
if (state.idToken && assertConfig()) {
  loadDocuments();
}
