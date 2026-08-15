// =============================================
// SISTEMA DE TEMA CLARO/OSCURO
// =============================================
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  body.setAttribute('data-theme', newTheme);
  localStorage.setItem('sismo-theme', newTheme);
}
 
// Cargar tema guardado al inicio
(function loadSavedTheme() {
  const saved = localStorage.getItem('sismo-theme');
  if (saved) {
    document.body.setAttribute('data-theme', saved);
  }
})();

// ==================== CONFIGURACIÓN FIREBASE ===================

// Configuración de Firebase
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDpjVvSG1YqWCPpi7MG3vIHA70pIeQI6yQ",
  authDomain: "tesis-270d3.firebaseapp.com",
  databaseURL: "https://tesis-270d3-default-rtdb.firebaseio.com",
  projectId: "tesis-270d3",
  storageBucket: "tesis-270d3.firebasestorage.app",
  messagingSenderId: "771219459720",
  appId: "1:771219459720:web:fe012e38d968fa0310993d"
};

// INICIALIZAR FIREBASE
firebase.initializeApp(FIREBASE_CONFIG);
const database = firebase.database();
const auth = firebase.auth();
function togglePassword() {
  const passInput = document.getElementById("password");
  const eye = document.getElementById("toggle-eye");
  if (passInput.type === "password") {
    passInput.type = "text";
    eye.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    passInput.type = "password";
    eye.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}
async function changePassword() {
  const newPass = document.getElementById("new-password").value;
  const confirmPass = document.getElementById("confirm-password").value;
  const msgDiv = document.getElementById("password-change-msg");

  msgDiv.style.display = "none";

  if (!newPass || !confirmPass) {
    msgDiv.style.display = "block";
    msgDiv.style.color = "#ff6b6b";
    msgDiv.textContent = "Completa ambos campos";
    return;
  }

  if (newPass !== confirmPass) {
    msgDiv.style.display = "block";
    msgDiv.style.color = "#ff6b6b";
    msgDiv.textContent = "Las contraseñas no coinciden";
    return;
  }

  if (newPass.length < 6) {
    msgDiv.style.display = "block";
    msgDiv.style.color = "#ff6b6b";
    msgDiv.textContent = "La contraseña debe tener al menos 6 caracteres";
    return;
  }

  try {
    await auth.currentUser.updatePassword(newPass);
    msgDiv.style.display = "block";
    msgDiv.style.color = "#51cf66";
    msgDiv.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Contraseña actualizada correctamente';
    document.getElementById("new-password").value = "";
    document.getElementById("confirm-password").value = "";
  } catch (error) {
    msgDiv.style.display = "block";
    msgDiv.style.color = "#ff6b6b";
    if (error.code === "auth/requires-recent-login") {
      msgDiv.textContent = "Sesión expirada. Cierra sesión, vuelve a entrar e intenta de nuevo";
    } else {
      msgDiv.textContent = "Error: " + error.message;
    }
  }
}

// ==================== WEBHOOK DE NOTIFICACIONES ====================

// Cargar URL del webhook desde Firebase
async function loadWebhookConfig() {
  try {
    const snapshot = await database.ref("config/webhookUrl").once("value");
    return snapshot.val() || "";
  } catch (error) {
    console.error("Error cargando webhook:", error);
    return "";
  }
}

// Guardar URL del webhook en Firebase
async function saveWebhookUrl() {
  const url = document.getElementById("webhook-url-input").value.trim();
  const msgDiv = document.getElementById("webhook-save-msg");
  
  try {
    showToast("⏳ Guardando webhook...", "info");
    await database.ref("config").update({ webhookUrl: url });
    showToast(`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Webhook guardado`, "success");
    msgDiv.style.display = "block";
    msgDiv.style.color = "#28a745";
    msgDiv.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Webhook guardado correctamente';
    setTimeout(() => { msgDiv.style.display = "none"; }, 3000);
  } catch (error) {
    msgDiv.style.display = "block";
    msgDiv.style.color = "#dc3545";
    msgDiv.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Error al guardar: ' + error.message;
  }
}

// Enviar notificación al webhook de Make
async function sendWebhookNotification(chipId, eventData) {
  try {
    const webhookUrl = await loadWebhookConfig();
    if (!webhookUrl) {
      console.log("⚠️ No hay webhook configurado, no se envía notificación");
      return;
    }

    // Solo enviar si no es la carga inicial
    if (!window.webhookReady) {
      console.log("⏭️ Carga inicial, no se envía webhook");
      return;
    }

    // Obtener usuarios vinculados a este chip
    const usersSnapshot = await database.ref("users").once("value");
    const allUsers = usersSnapshot.val() || {};
    
    const notifyUsers = [];
    Object.entries(allUsers).forEach(([uid, userData]) => {
      if (userData.chips && userData.chips[chipId] === true && userData.status === "active") {
        notifyUsers.push({
          email: userData.email || "",
          phone: userData.phone || "",
          displayName: userData.displayName || ""
        });
      }
    });

    if (notifyUsers.length === 0) {
      console.log("⚠️ No hay usuarios vinculados a " + chipId);
      return;
    }

    // Enviar al webhook de Make
    const payload = {
      chipId: chipId,
      event_type: eventData.event_type,
      event_value: eventData.event_value,
      message: eventData.message || "",
      timestamp: new Date().toISOString(),
      users: notifyUsers
    };

    console.log("📤 Enviando webhook:", payload);

    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log("✅ Webhook enviado para " + chipId);
  } catch (error) {
    console.error("❌ Error enviando webhook:", error);
  }
}

// ==================== VARIABLES GLOBALES ====================

// Estado global
let currentData = [];
let devicesState = {};
let sensorStates = {};
let selectedChipId = null;
let userPermissions = {}; // Variable global para almacenar permisos
let allEvents = {}; // Guarda TODOS los eventos por chip
let showAllEvents = false; // Controla si mostrar todos o solo últimos
const EVENTS_PER_LOAD = 10; // Eventos por carga
const MAX_EVENTS_TO_KEEP = 100; // Máximo de eventos en memoria

// Variables para listeners
let alarmEventListener = null;
let devicesListener = null;

// ==================== AUTENTICACIÓN CON FIREBASE ====================

// Mostrar/ocultar pantallas
function showLoginScreen() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("main-content").style.display = "none";
  document.getElementById("login-error").style.display = "none";
  var resetEl = document.getElementById("reset-success");
  if (resetEl) resetEl.style.display = "none";
  // Limpiar campos
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
}

function showMainContent() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("main-content").style.display = "block";
}

// ==================== RECUPERAR CONTRASEÑA ====================

async function resetPassword() {
  const email = document.getElementById("email").value.trim();
  const resetSuccess = document.getElementById("reset-success");
  const resetMessage = document.getElementById("reset-message");
  const loginError = document.getElementById("login-error");

  // Ocultar mensajes previos
  resetSuccess.style.display = "none";
  loginError.style.display = "none";

  // Validar que haya un correo
  if (!email) {
    showError("Ingresa tu correo electrónico para recuperar la contraseña");
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    // Mostrar mensaje de éxito
    resetMessage.innerHTML =  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>Se envió un enlace de recuperación a ' + email + ". Revisa tu bandeja de entrada (y spam).";
    resetSuccess.style.display = "block";
    console.log("Correo de recuperación enviado a:", email);
  } catch (error) {
    console.error("Error al enviar correo de recuperación:", error);
    switch (error.code) {
      case "auth/user-not-found":
        showError("No existe una cuenta con ese correo electrónico");
        break;
      case "auth/invalid-email":
        showError("El correo electrónico no es válido");
        break;
      case "auth/too-many-requests":
        showError("Demasiados intentos. Espera unos minutos e intenta de nuevo");
        break;
      default:
        showError("Error al enviar correo de recuperación: " + error.message);
    }
  }
}

// ==================== INICIALIZAR DASHBOARD ====================

// Función para convertir timestamp de Firebase key a fecha legible
function formatFirebaseTimestamp(timestampKey) {
  const timestamp = parseInt(timestampKey);
  if (isNaN(timestamp)) return "Reciente";

  const date = new Date(timestamp);
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// ==================== LISTENERS EN TIEMPO REAL ====================

// Configurar listeners para eventos de alarma por cada chip
function setupAlarmEventListeners() {
  console.log("🔧 Configurando listeners de eventos de alarma...");

  // Limpiar listeners existentes
  if (window.alarmEventListeners) {
    window.alarmEventListeners.forEach((listener) => {
      database.ref(listener.path).off("child_added", listener.handler);
    });
    window.alarmEventListeners = [];
  }

  // Obtener chips autorizados
  const authorizedChips = Object.keys(userPermissions).filter(
    (chipId) => userPermissions[chipId] === true
  );

  if (authorizedChips.length === 0) {
    console.log("⚠️ No hay chips autorizados para escuchar eventos");
    showNotification('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> No tienes acceso a ningún dispositivo', "warning");
    return;
  }

  // Array para almacenar referencias a listeners
  window.alarmEventListeners = [];

  // Configurar listener para cada chip autorizado
  authorizedChips.forEach((chipId) => {
    const chipPath = `alarm_events/${chipId}`;

    console.log(`🎧 Configurando listener para: ${chipPath}`);

    // Handler para nuevos eventos
    const eventHandler = (snapshot) => {
      const eventData = snapshot.val();
      const timestampKey = snapshot.key;

      console.log(`🎯 NUEVO EVENTO en ${chipId}/${timestampKey}:`, eventData);

      if (eventData && eventData.event_type) {
        // Filtrar eventos de prueba
        if (eventData.event_type.includes("test")) {
          console.log("🧪 Evento de prueba ignorado");
          return;
        }

        // Crear objeto de evento
        const newEvent = {
          id: `${chipId}_${timestampKey}`,
          ...eventData,
          device_id: chipId,
          timestamp: parseInt(timestampKey) || Date.now()
        };

        // Agregar a allEvents
        if (!allEvents[chipId]) {
          allEvents[chipId] = [];
        }

        // Evitar duplicados
        const exists = allEvents[chipId].some((e) => e.id === newEvent.id);
        if (!exists) {
          allEvents[chipId].unshift(newEvent); // Agregar al inicio

          // Limitar tamaño
          if (allEvents[chipId].length > MAX_EVENTS_TO_KEEP) {
            allEvents[chipId] = allEvents[chipId].slice(0, MAX_EVENTS_TO_KEEP);
          }

          // Ordenar
          allEvents[chipId].sort((a, b) => b.timestamp - a.timestamp);
        }

        // Actualizar currentData
        updateCurrentDataFromAllEvents();

        // Mostrar notificación
        const eventName = getEventDisplayName(eventData.event_type);
        const state = eventData.event_value ? "ACTIVADO" : "DESACTIVADO";
        const eventType = eventData.event_value ? "danger" : "success";

        let icon = "📢";
        if (eventData.event_type.includes("alarma")) icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        else if (eventData.event_type.includes("armado")) icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7z"/></svg>';
        else if (eventData.event_type.includes("sensores")) icon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>';

        showNotification(
          `${icon} ${chipId}: ${eventName} - ${state}`,
          eventType
        );

        // Actualizar UI
        updateUI();

        // Enviar notificación por webhook
        sendWebhookNotification(chipId, eventData);
      }
    };

    // Configurar el listener
    const ref = database.ref(chipPath);
    ref.limitToLast(1).on("child_added", eventHandler);

    // Guardar referencia para poder limpiarla después
    window.alarmEventListeners.push({
      path: chipPath,
      handler: eventHandler,
      chipId: chipId
    });
  });

  // Activar webhook después de 5 segundos (para ignorar la carga inicial)
  setTimeout(() => {
    window.webhookReady = true;
    console.log("✅ Webhook listo para enviar notificaciones");
  }, 5000);

  console.log(`✅ ${authorizedChips.length} listeners de eventos configurados`);
}

// Iniciar listeners
function startRealtimeListeners() {
  console.log("🎧 Iniciando listeners en tiempo real...");

  // ==================== 1. LISTENER DE PERMISOS DE USUARIO ====================
  // Escuchar cambios en los permisos del usuario actual
  database
    .ref(`users/${auth.currentUser.uid}/chips`)
    .on("value", (snapshot) => {
      const newPermissions = snapshot.val() || {};
      const oldPermissions = userPermissions;
      userPermissions = newPermissions;

      console.log("🔄 Permisos actualizados:", userPermissions);
      console.log(
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Cambios detectados:',
        Object.keys(newPermissions).filter(
          (key) => newPermissions[key] !== oldPermissions[key]
        )
      );

      // Reconfigurar listeners de eventos cuando cambian los permisos
      if (JSON.stringify(oldPermissions) !== JSON.stringify(newPermissions)) {
        console.log("🔄 Reconfigurando listeners de eventos...");
        setupAlarmEventListeners();
      }

      // Actualizar UI si está en una sección que muestra chips
      if (document.getElementById("valores-section").style.display !== "none") {
        updateUI();
      }
      // Si el modal de control está abierto, actualizar solo ese chip
      if (
        document.getElementById("control-modal").style.display === "block" &&
        selectedChipId
      ) {
        showSingleChipControl(selectedChipId);
      }
    });

  // ==================== 2. CONFIGURAR LISTENERS DE EVENTOS DE ALARMA ====================
  setupAlarmEventListeners();

  // ==================== 3. LISTENER DE CAMBIOS EN DISPOSITIVOS ====================
  devicesListener = async (snapshot) => {
    const chipId = snapshot.key;
    const deviceData = snapshot.val();

    console.log(`📱 CAMBIO EN DISPOSITIVO ${chipId}:`, deviceData);

    // Verificar si el usuario tiene acceso a este chip
    if (userPermissions[chipId] !== true) {
      console.log(`🔒 Cambio ignorado: Usuario no tiene acceso a ${chipId}`);
      return;
    }

    if (deviceData && deviceData.state) {
      // Actualizar estado del dispositivo
      devicesState[chipId] = {
        alarm: deviceData.state.alarm_active || false,
        armed: deviceData.state.system_armed || false,
        intrusion: deviceData.state.any_intrusion || false,
        lastSeen: deviceData.last_seen || Date.now(),
        rssi: deviceData.rssi || -90,
        ip: deviceData.ip_address || "N/A",
        mac: deviceData.mac_address || "N/A",
        name: deviceData.name || chipId
      };

      // Actualizar sensores si existen
      if (deviceData.sensors && typeof deviceData.sensors === "object") {
        if (!sensorStates[chipId]) {
          sensorStates[chipId] = {};
        }
        sensorStates[chipId] = {
          ...sensorStates[chipId],
          ...deviceData.sensors
        };
      }

      // Mostrar notificación de cambio si es importante
      if (deviceData.state.alarm_active) {
        showNotification(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${chipId}: ALARMA ACTIVADA`, "danger");
      } else if (deviceData.state.any_intrusion) {
        showNotification(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${chipId}: INTRUSIÓN DETECTADA`, "warning");
      }

      await loadChipConfigs();
      // Actualizar UI
      updateUI();
    }
  };

  // Escuchar cambios en dispositivos
  database.ref("devices").on("child_changed", devicesListener);

  // ==================== 4. LISTENER DE NUEVOS DISPOSITIVOS ====================
  database.ref("devices").on("child_added", async (snapshot) => {
    const newChipId = snapshot.key;
    console.log(`🆕 NUEVO DISPOSITIVO DETECTADO: ${newChipId}`);

    // Agregar este chip a todos los usuarios (en false)
    await addChipToAllUsers(newChipId);
  });

  // ==================== 5. LISTENER DE DISPOSITIVOS ELIMINADOS ====================
  database.ref("devices").on("child_removed", async (snapshot) => {
    const removedChipId = snapshot.key;
    console.log(`🗑️ DISPOSITIVO ELIMINADO: ${removedChipId}`);

    // Eliminar este chip de todos los usuarios
    await removeChipFromAllUsers(removedChipId);
  });

  // ==================== 6. LISTENER DE DATOS INICIALES DE DISPOSITIVOS ====================
  database
    .ref("devices")
    .once("value")
    .then((snapshot) => {
      const devices = snapshot.val();
      if (devices) {
        Object.keys(devices).forEach((chipId) => {
          // Solo cargar dispositivos autorizados
          if (userPermissions[chipId] === true) {
            const deviceData = devices[chipId];
            if (deviceData && deviceData.state) {
              devicesState[chipId] = {
                alarm: deviceData.state.alarm_active || false,
                armed: deviceData.state.system_armed || false,
                intrusion: deviceData.state.any_intrusion || false,
                lastSeen: deviceData.last_seen || Date.now(),
                rssi: deviceData.rssi || -90,
                ip: deviceData.ip_address || "N/A",
                mac: deviceData.mac_address || "N/A",
                name: deviceData.name || chipId
              };
            }
          }
        });
        updateUI();
      }
    });

  console.log("✅ Listeners activados");
  console.log("📊 Estado inicial:", {
    usuario: auth.currentUser.email,
    chipsAutorizados: Object.keys(userPermissions).filter(
      (k) => userPermissions[k] === true
    ),
    totalChips: Object.keys(userPermissions).length
  });
}

async function initializeDashboard() {
  if (!auth.currentUser) {
    console.log("🔒 Usuario no autenticado, no se puede inicializar dashboard");
    return;
  }

  console.log(
    "🚀 Inicializando dashboard para usuario:",
    auth.currentUser.email
  );

  // Mostrar mensaje de carga
  showNotification("🔄 Cargando datos del sistema...", "info");

  try {
    // 1. Cargar permisos y datos del usuario
    await getUserPermissions();

    // Obtener datos completos del usuario incluyendo rol
    const userRef = database.ref("users/" + auth.currentUser.uid);
    const userSnapshot = await userRef.once("value");
    window.userData = userSnapshot.val(); // Guardar en variable global

    // 2. Cargar datos iniciales (ya filtrados por permisos)
    await loadAlarmData();
    await loadDevicesState();
    await loadChipConfigs();

    // 3. Iniciar listeners en tiempo real
    startRealtimeListeners();

    // 4. Mostrar dashboard por defecto
    showSection("dashboard");

    console.log("✅ Dashboard inicializado correctamente");
    showNotification("✅ Sistema conectado y funcionando", "success");
  } catch (error) {
    console.error("❌ Error en inicialización del dashboard:", error);
    showNotification("❌ Error cargando datos del sistema", "danger");
  }
}

// Iniciar sesión con Firebase
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorElement = document.getElementById("login-error");
  const loginButton = document.getElementById("login-button");
  const buttonText = document.getElementById("login-button-text");

  // Validar campos
  if (!email || !password) {
    showError("Por favor completa todos los campos");
    return;
  }

  // Cambiar estado del botón
  loginButton.disabled = true;
  loginButton.style.opacity = "0.7";
  buttonText.innerHTML = "Autenticando...";

  try {
    // Autenticar con Firebase
    const userCredential = await auth.signInWithEmailAndPassword(
      email,
      password
    );
    const user = userCredential.user;

    // Bloqueo especial: si la cuenta fue marcada como borrada, no dejar entrar
    const blockSnap = await database.ref("users/" + user.uid).once("value");
    const blockData = blockSnap.val();
    if (
      blockData &&
      (blockData.deleted === true || blockData.status === "deleted")
    ) {
      await auth.signOut();
      showError("🚫 Cuenta borrada. Contacta al administrador.");
      loginButton.disabled = false;
      loginButton.style.opacity = "1";
      buttonText.innerHTML = "Iniciar Sesión";
      return;
    }

    // Login exitoso
    showNotification("✅ Inicio de sesión exitoso", "success");

    // ==================== CREAR/ACTUALIZAR USUARIO EN BASE DE DATOS ====================
    try {
      const user = userCredential.user;
      const now = new Date().toISOString();

      // Referencia al usuario en la base de datos
      const userRef = database.ref("users/" + user.uid);

      // Verificar si el usuario ya existe
      const snapshot = await userRef.once("value");

      if (snapshot.exists()) {
        // Usuario EXISTE: actualizar solo última conexión
        await userRef.update({
          lastLogin: now,
          loginCount: (snapshot.val().loginCount || 0) + 1,
          updatedAt: now
        });
        console.log("Usuario actualizado en la base de datos:", user.email);
      } else {
        // Usuario NO EXISTE: crear registro completo
        // Primero obtener TODOS los chips existentes en el sistema
        const devicesSnapshot = await database.ref("devices").once("value");
        const allDevices = devicesSnapshot.val() || {};
        const allChipIds = Object.keys(allDevices);

        // Crear objeto con todos los chips en false por defecto
        const defaultChips = {};
        allChipIds.forEach((chipId) => {
          defaultChips[chipId] = false; // Todos los chips comienzan en false
        });

        await userRef.set({
          email: user.email || "",
          displayName: user.displayName || "",
          createdAt: now,
          lastLogin: now,
          loginCount: 1,
          role: "user", // rol por defecto
          status: "active",
          provider: user.providerData?.[0]?.providerId || "email/password",
          chips: defaultChips // Todos los chips en false
        });
        console.log("Nuevo usuario creado en la base de datos:", user.email);
      }
    } catch (dbError) {
      console.error("Error en el registro de usuario:", dbError);
    }
    // ============================================================================

    // Ocultar error si estaba visible
    errorElement.style.display = "none";

    // Actualizar info del usuario
    const userEmailElement = document.getElementById("user-email");
    const userDisplayName = user.displayName || user.email.split("@")[0];

    userEmailElement.innerHTML = `
      <span style="cursor: pointer;" onclick="showUserProfile()" title="Ver perfil">
        ${userDisplayName}
      </span>
    `;

    // Crear HTML con icono y efectos
    userEmailElement.innerHTML = `
  <div style="
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 15px;
    border-radius: 25px;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border: 1px solid #dee2e6;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  ">
    <!-- Avatar circular con gradiente dinámico -->
    <div style="
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);
      transition: all 0.3s;
    ">
      ${userDisplayName.charAt(0).toUpperCase()}
    </div>
    
    <!-- Información del usuario -->
    <div style="flex: 1;">
      <div style="font-weight: 600; color: #333; font-size: 14px;">
        ${userDisplayName}
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 2px;">
        ${user.email}
      </div>
    </div>
    
    <!-- Icono de flecha -->
    <div style="
      color: #667eea;
      font-size: 12px;
      transition: transform 0.3s;
    ">
      ▶
    </div>
    
    <!-- Efecto de resplandor al hover -->
    <div style="
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: conic-gradient(
        transparent, transparent, transparent,
        #667eea, #764ba2, #667eea,
        transparent, transparent, transparent
      );
      opacity: 0;
      transform: rotate(0deg);
      transition: opacity 0.3s, transform 0.6s;
      pointer-events: none;
    "></div>
  </div>
`;

    // Obtener el contenedor principal
    const userContainer = userEmailElement.querySelector("div");

    // Efectos hover
    userContainer.onmouseenter = function () {
      this.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
      this.style.borderColor = "#667eea";
      this.style.transform = "translateY(-2px) scale(1.02)";
      this.style.boxShadow = "0 8px 25px rgba(102, 126, 234, 0.3)";

      // Cambiar colores del texto
      this.querySelector("div:first-child").style.background = "white";
      this.querySelector("div:first-child").style.color = "#667eea";
      this.querySelector("div:nth-child(2) > div:first-child").style.color =
        "white";
      this.querySelector("div:nth-child(2) > div:last-child").style.color =
        "rgba(255,255,255,0.8)";
      this.querySelector("div:last-child").style.color = "white";
      this.querySelector("div:last-child").style.transform = "translateX(3px)";

      // Activar efecto de resplandor
      this.querySelector("div[style*='conic-gradient']").style.opacity = "0.1";
      this.querySelector("div[style*='conic-gradient']").style.transform =
        "rotate(180deg)";
    };

    userContainer.onmouseleave = function () {
      this.style.background = "linear-gradient(135deg, #f8f9fa, #e9ecef)";
      this.style.borderColor = "#dee2e6";
      this.style.transform = "translateY(0) scale(1)";
      this.style.boxShadow = "none";

      // Restaurar colores
      this.querySelector("div:first-child").style.background =
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
      this.querySelector("div:first-child").style.color = "white";
      this.querySelector("div:nth-child(2) > div:first-child").style.color =
        "#333";
      this.querySelector("div:nth-child(2) > div:last-child").style.color =
        "#666";
      this.querySelector("div:last-child").style.color = "#667eea";
      this.querySelector("div:last-child").style.transform = "translateX(0)";

      // Desactivar efecto de resplandor
      this.querySelector("div[style*='conic-gradient']").style.opacity = "0";
      this.querySelector("div[style*='conic-gradient']").style.transform =
        "rotate(0deg)";
    };

    // Al hacer clic, mostrar perfil
    userContainer.onclick = function (e) {
      e.stopPropagation();

      // Efecto de click
      this.style.transform = "scale(0.98)";
      setTimeout(() => {
        this.style.transform = "scale(1)";
        showUserProfile();
      }, 150);
    };

    // Agregar tooltip
    userContainer.title = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Haz clic para ver tu perfil completo';

    // Mostrar contenido principal
    showMainContent();

    // Inicializar el dashboard
    initializeDashboard();

    checkAdminStatus();
  } catch (error) {
    // Manejar errores específicos
    let errorMessage = "Error de autenticación";

    switch (error.code) {
      case "auth/user-not-found":
        errorMessage = "Usuario no encontrado";
        break;
      case "auth/wrong-password":
        errorMessage = "Contraseña incorrecta";
        break;
      case "auth/invalid-email":
        errorMessage = "Correo electrónico inválido";
        break;
      case "auth/user-disabled":
        errorMessage = "Cuenta deshabilitada";
        break;
      case "auth/too-many-requests":
        errorMessage = "Demasiados intentos. Intenta más tarde";
        break;
      default:
        errorMessage = error.message;
    }

    showError(errorMessage);

    // Limpiar campo de contraseña
    document.getElementById("password").value = "";
  } finally {
    // Restaurar botón
    loginButton.disabled = false;
    loginButton.style.opacity = "1";
    buttonText.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> Iniciar Sesión';
  }
}

// Cerrar sesión
function logout() {
  if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
    auth
      .signOut()
      .then(() => {
        showNotification("👋 Sesión cerrada correctamente", "info");

        // Limpiar datos
        stopFirebaseListeners();

        // Mostrar pantalla de login
        showLoginScreen();
      })
      .catch((error) => {
        console.error("Error al cerrar sesión:", error);
        showNotification("❌ Error al cerrar sesión", "danger");
      });
  }
}

// Mostrar error de login
function showError(message) {
  const errorElement = document.getElementById("login-error");
  const errorMessage = document.getElementById("error-message");

  errorMessage.textContent = message;
  errorElement.style.display = "block";

  // Animación de error
  errorElement.style.animation = "none";
  setTimeout(() => {
    errorElement.style.animation = "shake 0.5s";
  }, 10);
}

// Verificar estado de autenticación
function checkAuthState() {
  auth.onAuthStateChanged(
    async (user) => {
      if (user) {
        // Usuario autenticado
        console.log("✅ Usuario autenticado:", user.email);

        // Bloqueo especial: si la cuenta fue marcada como borrada, expulsar
        try {
          const blockSnap = await database
            .ref("users/" + user.uid)
            .once("value");
          const blockData = blockSnap.val();
          if (
            blockData &&
            (blockData.deleted === true || blockData.status === "deleted")
          ) {
            console.warn("🚫 Cuenta borrada, cerrando sesión:", user.email);
            await auth.signOut();
            showLoginScreen();
            showError("🚫 Cuenta borrada. Contacta al administrador.");
            return;
          }
        } catch (e) {
          console.error("Error verificando estado de cuenta:", e);
        }
        // Configurar email como clickeable (versión mejorada)
        const userEmailElement = document.getElementById("user-email");
        const userDisplayName = user.displayName || user.email.split("@")[0];

        userEmailElement.innerHTML = `
  <div style="
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 15px;
    border-radius: 25px;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border: 1px solid #dee2e6;
    cursor: pointer;
    transition: all 0.3s;
  ">
    <div style="
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 14px;
    ">
      ${userDisplayName.charAt(0).toUpperCase()}
    </div>
    <div style="flex: 1;">
      <div style="font-weight: 600; color: #333; font-size: 14px;">
        ${userDisplayName}
      </div>
      <div style="font-size: 12px; color: #666; margin-top: 2px;">
        ${user.email}
      </div>
    </div>
    <div style="color: #667eea; font-size: 12px;">▶</div>
  </div>
`;

        const userContainer = userEmailElement.querySelector("div");

        userContainer.onmouseenter = function () {
          this.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
          this.style.borderColor = "#667eea";
          this.style.transform = "translateY(-2px)";
          this.style.boxShadow = "0 5px 15px rgba(102, 126, 234, 0.2)";

          // Cambiar colores del texto
          this.querySelector("div:nth-child(2) > div:first-child").style.color =
            "white";
          this.querySelector("div:nth-child(2) > div:last-child").style.color =
            "rgba(255,255,255,0.8)";
          this.querySelector("div:last-child").style.color = "white";
        };

        userContainer.onmouseleave = function () {
          this.style.background = "linear-gradient(135deg, #f8f9fa, #e9ecef)";
          this.style.borderColor = "#dee2e6";
          this.style.transform = "translateY(0)";
          this.style.boxShadow = "none";

          // Restaurar colores
          this.querySelector("div:nth-child(2) > div:first-child").style.color =
            "#333";
          this.querySelector("div:nth-child(2) > div:last-child").style.color =
            "#666";
          this.querySelector("div:last-child").style.color = "#667eea";
        };

        userContainer.onclick = showUserProfile;
        userContainer.title = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Ver mi perfil';
        showMainContent();

        // Pequeño delay para asegurar que el DOM esté listo
        setTimeout(() => {
          initializeDashboard();
        }, 100);
      } else {
        // No autenticado
        console.log("🔒 Usuario no autenticado");
        showLoginScreen();
      }
    },
    (error) => {
      console.error("❌ Error en checkAuthState:", error);
      showLoginScreen();
    }
  );
}

// Función para detener listeners de Firebase
function stopFirebaseListeners() {
  console.log("🔌 Deteniendo todos los listeners de Firebase...");

  // 1. Detener listener de permisos
  database.ref(`users/${auth.currentUser.uid}/chips`).off();

  // 2. Detener listeners de eventos de alarma
  if (window.alarmEventListeners) {
    window.alarmEventListeners.forEach((listener) => {
      database.ref(listener.path).off("child_added", listener.handler);
    });
    window.alarmEventListeners = [];
  }

  // 3. Detener listeners de dispositivos
  if (devicesListener) {
    database.ref("devices").off("child_changed", devicesListener);
    database.ref("devices").off("child_added");
    database.ref("devices").off("child_removed");
    devicesListener = null;
  }

  // 4. Limpiar datos
  currentData = [];
  devicesState = {};
  sensorStates = {};
  selectedChipId = null;
  userPermissions = {};

  console.log("✅ Todos los listeners han sido detenidos");
}

// ==================== FUNCIONES BÁSICAS ====================

// Función para nombres de eventos
function getEventDisplayName(eventType, chipId) {
   if (chipId && eventType.startsWith("sensores/")) {
     const zoneId = eventType.split("/")[1];
     const customName = getZoneName(chipId, zoneId);
     if (customName !== zoneId.toUpperCase()) return customName;
   }
   const names = {
    "estado/armado": "ARMADO SISTEMA",
    "estado/alarma": "ALARMA",
    "sensores/c1": "CERCO 1",
    "sensores/c2": "CERCO 2",
    "sensores/c3": "CERCO 3",
    "sensores/c4": "CERCO 4",
    "sensores/c5": "CERCO 5",
    "estado/evento": "EVENTO SISTEMA"
  };
   return names[eventType] || eventType;
}

// ==================== MOSTRAR PERFIL DE USUARIO (VERSIÓN SIMPLIFICADA Y EDITABLE) ====================

async function showUserProfile() {
  if (!auth.currentUser) {
    showNotification('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Debes iniciar sesión para ver tu perfil"', "warning");
    return;
  }

  try {
    // Obtener datos del usuario desde la base de datos
    const userRef = database.ref("users/" + auth.currentUser.uid);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    if (!userData) {
      showNotification("📭 No se encontraron datos de perfil", "info");
      return;
    }

    // Datos del usuario
    const userDisplayName =
      userData.displayName || auth.currentUser.email.split("@")[0];
    const userInitial = userDisplayName.charAt(0).toUpperCase();
    const userRole = userData.role || "user";
    const userPhone = userData.phone || "No registrado";
    const userStatus = userData.status || "active";
    const userChips = userData.chips || {};

    // Contar chips con acceso
    const chipsWithAccess = Object.keys(userChips).filter(
      (chipId) => userChips[chipId] === true
    ).length;
    const totalChips = Object.keys(userChips).length;

    // Formatear fecha de última conexión
    const formatDate = (timestamp) => {
      if (!timestamp) return "No disponible";
      const date = new Date(timestamp);
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    };

    // Crear overlay/modal
    const modal = document.createElement("div");
    modal.id = "user-profile-modal";
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      backdrop-filter: blur(10px);
      animation: fadeIn 0.3s ease;
    `;

    // Variables para modo edición
    let isEditing = false;
    let editName = userDisplayName;
    let editPhone = userPhone;

    // Función para actualizar datos del usuario
    async function updateUserProfile() {
      try {
        const updates = {};

        // Actualizar nombre si cambió
        if (editName !== userDisplayName) {
          updates.displayName = editName;
        }

        // Actualizar teléfono si cambió
        if (editPhone !== userPhone) {
          updates.phone = editPhone;
        }

        updates.updatedAt = new Date().toISOString();

        // Solo actualizar si hay cambios
        if (Object.keys(updates).length > 0) {
          await userRef.update(updates);
          showToast(`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Perfil actualizado`, "success");
          showNotification("✅ Perfil actualizado correctamente", "success");

          // Actualizar la UI del perfil
          renderProfileContent();
        } else {
          showNotification("ℹ️ No hay cambios para guardar", "info");
        }

        // Salir del modo edición
        isEditing = false;
        renderProfileContent();
      } catch (error) {
        console.error("❌ Error actualizando perfil:", error);
        showNotification("❌ Error al actualizar perfil", "danger");
      }
    }

    // Función para renderizar el contenido
    function renderProfileContent() {
      modal.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 20px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.1);
          animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        ">
          <!-- Encabezado -->
          <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            position: relative;
            overflow: hidden;
          ">
            <div style="display: flex; align-items: center; gap: 20px; position: relative; z-index: 1;">
              <!-- Avatar -->
              <div style="
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
                display: flex;
                align-items: center;
                justify-content: center;
                color: #667eea;
                font-weight: bold;
                font-size: 32px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
                border: 3px solid white;
              ">
                ${userInitial}
              </div>
              
              <!-- Información principal -->
              <div style="flex: 1; color: white;">
                <h2 style="margin: 0 0 5px 0; font-size: 24px; font-weight: 700;">
                  ${
                    isEditing
                      ? `<input type="text" id="edit-name-input" 
                      value="${editName}"
                      style="
                        background: rgba(255,255,255,0.9);
                        border: 2px solid white;
                        border-radius: 10px;
                        padding: 8px 12px;
                        font-size: 18px;
                        color: #333;
                        width: 100%;
                        box-sizing: border-box;
                      "
                    >`
                      : userDisplayName
                  }
                  ${
                    userRole === "admin"
                      ? '<span style="font-size: 16px; margin-left: 8px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-5-7-5 7-3-12z"/><path d="M3 20h18"/></svg></span>'
                      : ""
                  }
                </h2>
                <div style="font-size: 14px; opacity: 0.9; margin-bottom: 10px;">
                  ${auth.currentUser.email}
                </div>
                <div style="
                  display: inline-block;
                  background: ${
                    userRole === "admin"
                      ? "rgba(220, 53, 69, 0.9)"
                      : "rgba(40, 167, 69, 0.9)"
                  };
                  color: white;
                  padding: 6px 15px;
                  border-radius: 15px;
                  font-size: 12px;
                  font-weight: 600;
                ">
                  ${userRole === "admin" ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-5-7-5 7-3-12z"/><path d="M3 20h18"/></svg> ADMINISTRADOR' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> USUARIO'}
                </div>
              </div>
            </div>
            
            <!-- Botones de acción -->
            <div style="
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 20px;
              position: relative;
              z-index: 1;
            ">
              ${
                isEditing
                  ? `
                <button type="button" id="save-profile-btn" 
                  style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: all 0.3s;
                  "
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(40, 167, 69, 0.3)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar
                </button>
                <button type="button" id="cancel-edit-btn" 
                  style="
                    background: #6c757d;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: all 0.3s;
                  "
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(108, 117, 125, 0.3)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancelar
                </button>
              `
                  : `
                <button type="button" id="edit-profile-btn" 
                  style="
                    background: #3498db;
                    color: white;
                    border: none;
                    padding: 8px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: all 0.3s;
                  "
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(52, 152, 219, 0.3)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar Perfil
                </button>
                <button type="button" id="close-profile-modal" 
                  style="
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 8px 20px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: all 0.3s;
                  "
                  onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(255,255,255,0.2)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                >
                  ✕ Cerrar
                </button>
              `
              }
            </div>
          </div>

          <!-- Contenido principal -->
          <div style="padding: 25px; background: #0f3460;">
            <!-- Información básica -->
            <div style="
              background: rgba(255,255,255,0.05);
              border-radius: 15px;
              padding: 20px;
              margin-bottom: 20px;
              border: 1px solid rgba(255,255,255,0.1);
            ">
              <h3 style="
                color: white;
                margin: 0 0 15px 0;
                font-size: 16px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
              ">
                <span style="
                  background: linear-gradient(135deg, #4cd964, #28a745);
                  width: 32px;
                  height: 32px;
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 16px;
                "><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                Información Personal
              </h3>
              
              <div style="display: grid; gap: 15px;">
                <!-- Teléfono -->
                <div>
                  <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> TELÉFONO</div>
                  <div style="font-size: 14px; color: white; font-weight: 500;">
                    ${
                      isEditing
                        ? `
                      <input type="tel" id="edit-phone-input" 
                        value="${editPhone}"
                        placeholder="Ingresa tu teléfono"
                        style="
                          background: rgba(255,255,255,0.1);
                          border: 2px solid rgba(255,255,255,0.2);
                          border-radius: 8px;
                          padding: 8px 12px;
                          font-size: 14px;
                          color: white;
                          width: 100%;
                          box-sizing: border-box;
                        "
                      >
                    `
                        : userPhone
                    }
                  </div>
                </div>
                
                <!-- Estado -->
                <div>
                  <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> ESTADO</div>
                  <div style="font-size: 14px; color: ${
                    userStatus === "active" ? "#4cd964" : "#dc3545"
                  }; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                    <span>${userStatus === "active" ? '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#22c55e" stroke="none"/></svg>' : '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#ef4444" stroke="none"/></svg>'}</span> 
                    ${userStatus === "active" ? "ACTIVO" : "INACTIVO"}
                  </div>
                </div>
                
                <!-- Última conexión -->
                <div>
                  <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ÚLTIMA CONEXIÓN</div>
                  <div style="font-size: 14px; color: white; font-weight: 500;">
                    ${formatDate(userData.lastLogin)}
                  </div>
                </div>
              </div>
            </div>

            <!-- Dispositivos con acceso -->
            <div style="
              background: rgba(255,255,255,0.05);
              border-radius: 15px;
              padding: 20px;
              margin-bottom: 20px;
              border: 1px solid rgba(255,255,255,0.1);
            ">
              <h3 style="
                color: white;
                margin: 0 0 15px 0;
                font-size: 16px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
              ">
                <span style="
                  background: linear-gradient(135deg, #3498db, #2980b9);
                  width: 32px;
                  height: 32px;
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 16px;
                "><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></span>
                Dispositivos con Acceso
              </h3>
              
              <div style="margin-bottom: 15px;">
                <div style="font-size: 12px; color: #aaa; margin-bottom: 10px;">ESTADÍSTICAS</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                  <div style="
                    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(76, 201, 240, 0.15));
                    border-radius: 12px;
                    padding: 15px;
                    text-align: center;
                    border: 1px solid rgba(102, 126, 234, 0.3);
                    transition: all 0.3s;
                    cursor: default;
                  " 
                  onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.15)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    <div style="font-size: 28px; font-weight: bold; color: #667eea; margin-bottom: 5px;">
                      ${chipsWithAccess}
                    </div>
                    <div style="font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">
                      Dispositivos
                    </div>
                    <div style="font-size: 10px; color: #4cd964; margin-top: 5px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                      <span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> Acceso autorizado
                    </div>
                  </div>
                  
                  <div style="
                    background: rgba(52, 152, 219, 0.1);
                    border-radius: 12px;
                    padding: 15px;
                    text-align: center;
                    border: 1px solid rgba(52, 152, 219, 0.3);
                    transition: all 0.3s;
                    cursor: default;
                  " 
                  onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 25px rgba(52, 152, 219, 0.15)'"
                  onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    <div style="font-size: 28px; font-weight: bold; color: #3498db; margin-bottom: 5px;">
                      ${totalChips}
                    </div>
                    <div style="font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">
                      Disponibles
                    </div>
                    <div style="font-size: 10px; color: #3498db; margin-top: 5px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                      <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></span> Total en sistema
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Lista de chips CON ACCESO (solo los true) -->
              <div>
                <div style="font-size: 12px; color: #aaa; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                  <span>TUS DISPOSITIVOS AUTORIZADOS</span>
                  <span style="font-size: 10px; color: #4cd964; background: rgba(76, 217, 100, 0.1); padding: 2px 8px; border-radius: 10px;">
                    ${chipsWithAccess} activos
                  </span>
                </div>
                <div style="
                  max-height: 250px;
                  overflow-y: auto;
                  padding-right: 5px;
                  border-radius: 10px;
                  background: rgba(0,0,0,0.2);
                " class="custom-scrollbar">
                  ${
                    chipsWithAccess === 0
                      ? `
                    <div style="
                      text-align: center;
                      padding: 30px 20px;
                      color: #666;
                      background: rgba(255,255,255,0.03);
                      border-radius: 10px;
                    ">
                      <div style="font-size: 36px; margin-bottom: 10px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
                      <div style="font-size: 14px; margin-bottom: 5px; color: #aaa;">No tienes dispositivos autorizados</div>
                      <div style="font-size: 11px; color: #777;">Contacta al administrador para obtener acceso</div>
                    </div>
                  `
                      : `
                    <div style="display: grid; gap: 10px;">
                      ${Object.entries(userChips)
                        .filter(([chipId, hasAccess]) => hasAccess === true)
                        .map(([chipId, hasAccess]) => {
                          // Obtener nombre del dispositivo si existe en devicesState
                          const deviceName =
                            devicesState[chipId]?.name || chipId;
                          const deviceStatus = devicesState[chipId]?.alarm
                            ? "ALARMA"
                            : devicesState[chipId]?.armed
                            ? "ARMADO"
                            : "DESARMADO";
                          const statusColor = devicesState[chipId]?.alarm
                            ? "#dc3545"
                            : devicesState[chipId]?.armed
                            ? "#28a745"
                            : "#6c757d";

                          return `
                            <button type="button" style="
                              background: rgba(255,255,255,0.04);
                              border-radius: 12px;
                              padding: 15px;
                              border-left: 4px solid #28a745;
                              transition: all 0.3s;
                              cursor: pointer;
                              position: relative;
                              overflow: hidden;
                              border: none;
                              text-align: left;
                              color: inherit;
                              font-family: inherit;
                              width: 100%;
                              outline: none;
                            " 
                            onmouseover="
                              this.style.background='rgba(40, 167, 69, 0.08)';
                              this.style.transform='translateX(5px)';
                            " 
                            onmouseout="
                              this.style.background='rgba(255,255,255,0.04)';
                              this.style.transform='translateX(0)';
                            "
                            onclick="openControlForChip('${chipId}'); closeUserProfileModal();"
                            title="Haz clic para controlar este dispositivo">
                              
                              <!-- Indicador de estado -->
                              <div style="
                                position: absolute;
                                top: 10px;
                                right: 10px;
                                width: 8px;
                                height: 8px;
                                border-radius: 50%;
                                background: ${statusColor};
                                box-shadow: 0 0 10px ${statusColor};
                              "></div>
                              
                              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                                <div style="
                                  width: 40px;
                                  height: 40px;
                                  border-radius: 10px;
                                  background: linear-gradient(135deg, #28a745, #20c997);
                                  display: flex;
                                  align-items: center;
                                  justify-content: center;
                                  font-size: 18px;
                                  color: white;
                                  flex-shrink: 0;
                                ">
                                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                                </div>
                                <div style="flex: 1;">
                                  <div style="font-size: 14px; color: white; font-weight: 600; margin-bottom: 2px;">
                                    ${deviceName}
                                  </div>
                                  <div style="font-size: 11px; color: #aaa; display: flex; align-items: center; gap: 5px;">
                                    <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg></span> ${chipId}
                                  </div>
                                </div>
                              </div>
                              
                              <div style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                margin-top: 10px;
                                padding-top: 10px;
                                border-top: 1px solid rgba(255,255,255,0.1);
                              ">
                                <div>
                                  <div style="font-size: 10px; color: #aaa; margin-bottom: 3px;">ESTADO</div>
                                  <div style="
                                    font-size: 11px;
                                    color: ${statusColor};
                                    background: ${statusColor}20;
                                    padding: 3px 10px;
                                    border-radius: 12px;
                                    font-weight: bold;
                                    display: inline-block;
                                  ">
                                    ${deviceStatus}
                                  </div>
                                </div>
                                
                                <div style="text-align: right;">
                                  <div style="font-size: 10px; color: #aaa; margin-bottom: 3px;">ÚLTIMA VEZ</div>
                                  <div style="font-size: 11px; color: white; font-weight: 500;">
                                    ${formatTimestamp(
                                      devicesState[chipId]?.lastSeen ||
                                        Date.now()
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <!-- Efecto de brillo al hover -->
                              <div style="
                                position: absolute;
                                top: 0;
                                left: -100%;
                                width: 100%;
                                height: 100%;
                                background: linear-gradient(90deg, 
                                  transparent, 
                                  rgba(255,255,255,0.05), 
                                  transparent
                                );
                                transition: left 0.6s;
                              "></div>
                            </button>
                          `;
                        })
                        .join("")}
                    </div>
                  `
                  }
                </div>
                
                <!-- Nota informativa -->
                ${
                  chipsWithAccess > 0
                    ? `
                  <div style="
                    margin-top: 15px;
                    padding: 10px;
                    background: rgba(52, 152, 219, 0.08);
                    border-radius: 8px;
                    border-left: 3px solid #3498db;
                  ">
                    <div style="font-size: 11px; color: #89c4f4; display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 12px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg></span>
                      <span>Haz clic en cualquier dispositivo para controlarlo</span>
                    </div>
                  </div>
                `
                    : ""
                }
              </div>
            </div>

            <!-- Cambiar Contraseña -->
            <div style="
              background: rgba(255,255,255,0.05);
              border-radius: 15px;
              padding: 15px;
              border-left: 4px solid #667eea;
            ">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                <div style="
                  background: rgba(102, 126, 234, 0.2);
                  width: 36px;
                  height: 36px;
                  border-radius: 8px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 16px;
                  color: #667eea;
                "><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
                <div>
                  <div style="font-size: 12px; color: #aaa; font-weight: 500;">CAMBIAR CONTRASEÑA</div>
                </div>
              </div>
              <div style="margin-bottom: 10px;">
                <input type="password" id="new-password" placeholder="Nueva contraseña" style="width: 100%; padding: 10px; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 14px; box-sizing: border-box; background: rgba(255,255,255,0.1); color: white;">
              </div>
              <div style="margin-bottom: 12px;">
                <input type="password" id="confirm-password" placeholder="Confirmar contraseña" style="width: 100%; padding: 10px; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 14px; box-sizing: border-box; background: rgba(255,255,255,0.1); color: white;">
              </div>
              <button onclick="changePassword()" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> Cambiar Contraseña
              </button>
              <div id="password-change-msg" style="margin-top: 10px; font-size: 12px; text-align: center; display: none;"></div>
            </div>
          </div>

          <!-- Pie de página -->
          <div style="
            padding: 15px 25px;
            background: rgba(0,0,0,0.3);
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <div style="font-size: 11px; color: #888;">
              <span style="color: #667eea; font-weight: 600;">Sistema de Seguridad</span>
            </div>
            <div style="font-size: 10px; color: #666;">
              Sesiones: ${userData.loginCount || 1}
            </div>
          </div>
        </div>
      `;

      // Agregar animaciones CSS si no existen
      if (!document.querySelector("#profile-animations")) {
        const style = document.createElement("style");
        style.id = "profile-animations";
        style.textContent = `
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          #user-profile-modal * {
            box-sizing: border-box;
          }
          
          #user-profile-modal input {
            outline: none;
          }
          
          #user-profile-modal input:focus {
            border-color: #667eea !important;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
          }

          /* Estilos para scrollbar personalizado */
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: linear-gradient(to bottom, #667eea, #764ba2);
            border-radius: 10px;
          }
          
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(to bottom, #764ba2, #667eea);
          }
          
          /* Efecto al pasar mouse sobre los botones */
          #user-profile-modal button[type="button"]:hover > div[style*="left: -100%"] {
            left: 100%;
          }
          
          /* Estilo para botones en modal */
          #user-profile-modal button[type="button"] {
            outline: none;
          }
        `;
        document.head.appendChild(style);
      }

      // Configurar eventos
      setupProfileEvents();
    }

    // Función para configurar eventos
    function setupProfileEvents() {
      // Botón de cerrar
      const closeBtn = modal.querySelector("#close-profile-modal");
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          closeUserProfileModal();
        };
      }

      // Botón de editar
      const editBtn = modal.querySelector("#edit-profile-btn");
      if (editBtn) {
        editBtn.onclick = () => {
          isEditing = true;
          renderProfileContent();

          // Enfocar el input del nombre
          setTimeout(() => {
            const nameInput = modal.querySelector("#edit-name-input");
            if (nameInput) nameInput.focus();
          }, 100);
        };
      }

      // Botón de guardar
      const saveBtn = modal.querySelector("#save-profile-btn");
      if (saveBtn) {
        saveBtn.onclick = () => {
          // Obtener valores actualizados
          const nameInput = modal.querySelector("#edit-name-input");
          const phoneInput = modal.querySelector("#edit-phone-input");

          if (nameInput) editName = nameInput.value.trim();
          if (phoneInput) editPhone = phoneInput.value.trim();

          // Validaciones básicas
          if (editName === "") {
            showNotification("❌ El nombre no puede estar vacío", "warning");
            if (nameInput) nameInput.focus();
            return;
          }

          // Guardar cambios
          updateUserProfile();
        };
      }

      // Botón de cancelar
      const cancelBtn = modal.querySelector("#cancel-edit-btn");
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          isEditing = false;
          // Restaurar valores originales
          editName = userDisplayName;
          editPhone = userPhone;
          renderProfileContent();
        };
      }

      // Permitir guardar con Enter
      modal.addEventListener("keydown", (e) => {
        if (isEditing && e.key === "Enter") {
          e.preventDefault();
          const saveBtn = modal.querySelector("#save-profile-btn");
          if (saveBtn) saveBtn.click();
        }

        if (e.key === "Escape") {
          if (isEditing) {
            isEditing = false;
            renderProfileContent();
          } else {
            closeUserProfileModal();
          }
        }
      });

      // Cerrar al hacer clic fuera del modal
      modal.onclick = (e) => {
        if (e.target === modal && !isEditing) {
          closeUserProfileModal();
        }
      };
    }

    // Inicializar renderizado
    document.body.appendChild(modal);
    renderProfileContent();
  } catch (error) {
    console.error("Error al cargar perfil:", error);
    showNotification("❌ Error al cargar datos del perfil", "danger");
  }
}

// ==================== SINCRONIZAR CHIPS DE USUARIOS ====================

// Función para agregar un nuevo chip a TODOS los usuarios
async function addChipToAllUsers(newChipId) {
  try {
    // Obtener todos los usuarios
    const usersSnapshot = await database.ref("users").once("value");
    const users = usersSnapshot.val();

    if (!users) return;

    // Para cada usuario, SOLO agregar el chip si no existe
    const updates = {};
    Object.keys(users).forEach((userId) => {
      const userChips = users[userId].chips || {};
      // Solo agregar si el chip NO existe para este usuario
      if (userChips[newChipId] === undefined) {
        updates[`users/${userId}/chips/${newChipId}`] = false;
      }
      // Si ya existe (true o false), NO se modifica
    });

    // Ejecutar todas las actualizaciones
    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
      console.log(`✅ Chip ${newChipId} agregado a usuarios que no lo tenían`);
    } else {
      console.log(`ℹ️ Chip ${newChipId} ya existe para todos los usuarios`);
    }
  } catch (error) {
    console.error("❌ Error agregando chip a usuarios:", error);
  }
}

// Función para eliminar un chip de TODOS los usuarios
async function removeChipFromAllUsers(chipId) {
  try {
    // Obtener todos los usuarios
    const usersSnapshot = await database.ref("users").once("value");
    const users = usersSnapshot.val();

    if (!users) return;

    // Para cada usuario, eliminar el chip
    const updates = {};
    Object.keys(users).forEach((userId) => {
      updates[`users/${userId}/chips/${chipId}`] = null; // null elimina la clave
    });

    // Ejecutar todas las actualizaciones
    await database.ref().update(updates);
    console.log(`✅ Chip ${chipId} eliminado de todos los usuarios`);
  } catch (error) {
    console.error("❌ Error eliminando chip de usuarios:", error);
  }
}

// Función para actualizar chips de un usuario cuando cambian los dispositivos
async function updateUserChips(userId) {
  try {
    const userRef = database.ref(`users/${userId}`);
    const devicesSnapshot = await database.ref("devices").once("value");
    const allDevices = devicesSnapshot.val() || {};
    const allChipIds = Object.keys(allDevices);

    // Obtener chips actuales del usuario
    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.val();

    if (!userData) return;

    const currentChips = userData.chips || {};

    // Verificar si faltan chips nuevos
    const updates = {};
    allChipIds.forEach((chipId) => {
      // SOLO agregar chips que NO existan previamente
      // NO modificar chips que ya existen
      if (currentChips[chipId] === undefined) {
        // Chip nuevo, agregarlo en false (requiere aprobación)
        updates[`chips/${chipId}`] = false;
      }
      // Si el chip ya existe (true o false), NO se modifica
    });

    // Verificar si hay chips obsoletos (que ya no existen en devices)
    Object.keys(currentChips).forEach((chipId) => {
      if (!allChipIds.includes(chipId)) {
        // Chip obsoleto, eliminarlo
        updates[`chips/${chipId}`] = null;
      }
    });

    // Aplicar actualizaciones si hay cambios
    if (Object.keys(updates).length > 0) {
      await userRef.update(updates);
      console.log(`✅ Chips actualizados para usuario ${userId}`);
    } else {
      console.log(`ℹ️ No hay cambios en chips para usuario ${userId}`);
    }
  } catch (error) {
    console.error(`❌ Error actualizando chips para usuario ${userId}:`, error);
  }
}

// Función para cerrar el modal
function closeUserProfileModal() {
  const modal = document.getElementById("user-profile-modal");
  if (modal) {
    // Animación de salida
    modal.style.opacity = "0";
    modal.style.transform = "scale(0.95)";

    setTimeout(() => {
      modal.remove();

      // Remover estilos de animación
      const animationStyle = document.querySelector("#profile-animations");
      if (animationStyle) {
        animationStyle.remove();
      }

      // Limpiar referencia
      window.currentProfileModal = null;
    }, 300);
  }
}

// Formatear timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return "Reciente";

  // Convertir timestamp de Firebase (puede estar en milisegundos o segundos)
  const ts =
    typeof timestamp === "number"
      ? timestamp > 1000000000000
        ? timestamp
        : timestamp * 1000
      : Date.now();

  const now = Date.now();
  const diff = now - ts;

  if (diff < 0) return "Reciente";
  if (diff < 60000) {
    // Menos de 1 minuto
    return "Hace " + Math.floor(diff / 1000) + "s";
  } else if (diff < 3600000) {
    // Menos de 1 hora
    return "Hace " + Math.floor(diff / 60000) + "m";
  } else if (diff < 86400000) {
    // Menos de 1 día
    return "Hace " + Math.floor(diff / 3600000) + "h";
  } else {
    return "Hace " + Math.floor(diff / 86400000) + "d";
  }
}

// Mostrar notificación
function showNotification(message, type) {
  console.log("Notificación:", message);
}

// Notificación visual solo para acciones importantes
function showToast(message, type = "info") {
  const colors = {
    info: 'var(--blue)',
    warning: 'var(--amber)',
    danger: 'var(--red)',
    success: 'var(--green)'
  };

  document.querySelectorAll('.sismo-toast').forEach(n => {
    n.style.opacity = '0';
    n.style.transform = 'translateX(120%)';
    setTimeout(() => n.remove(), 300);
  });

  const notif = document.createElement('div');
  notif.className = 'sismo-toast';
  notif.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    display: flex; align-items: center; gap: 8px;
    background: var(--bg-card); color: var(--text-primary);
    padding: 14px 20px; border-radius: 12px;
    border-left: 4px solid ${colors[type] || colors.info};
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    z-index: 99999; font-size: 14px; font-weight: 500;
    max-width: 380px; word-wrap: break-word;
    transition: all 0.3s ease;
    transform: translateX(0); opacity: 1;
    border: 1px solid var(--border-color);
  `;
  notif.innerHTML = message;
  document.body.appendChild(notif);

  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(120%)';
    setTimeout(() => notif.remove(), 300);
  }, 3500);
}

// ==================== CARGAR DATOS ====================

// Cargar eventos de alarma - PARA NUEVO FORMATO
async function loadAlarmData(loadMore = false) {
  if (!auth.currentUser) {
    console.log("🔒 Usuario no autenticado, omitiendo carga de datos");
    return;
  }

  try {
    console.log(`📥 Cargando datos de eventos... (loadMore: ${loadMore})`);

    // Obtener chips autorizados
    const authorizedChips = Object.keys(userPermissions).filter(
      (chipId) => userPermissions[chipId] === true
    );

    if (authorizedChips.length === 0) {
      console.log("⚠️ Usuario no tiene chips autorizados");
      currentData = [];
      updateUI();
      return;
    }

    // Si loadMore es false, reiniciar allEvents
    if (!loadMore) {
      allEvents = {};
    }

    const newEvents = [];

    // Para cada chip autorizado, leer sus eventos específicos
    for (const chipId of authorizedChips) {
      try {
        const chipPath = `alarm_events/${chipId}`;

        // Determinar cuántos eventos cargar
        const limit = loadMore ? MAX_EVENTS_TO_KEEP : EVENTS_PER_LOAD;

        const snapshot = await database
          .ref(chipPath)
          .orderByKey()
          .limitToLast(limit)
          .once("value");

        const eventsData = snapshot.val();

        if (eventsData) {
          // Inicializar array para este chip si no existe
          if (!allEvents[chipId]) {
            allEvents[chipId] = [];
          }

          // Procesar eventos
          for (const timestampKey in eventsData) {
            const event = eventsData[timestampKey];

            // Validar que sea un evento válido
            if (
              event &&
              event.event_type &&
              !event.event_type.includes("test")
            ) {
              const eventObj = {
                id: `${chipId}_${timestampKey}`,
                ...event,
                device_id: chipId,
                timestamp: parseInt(timestampKey) || Date.now()
              };

              // Agregar al array de todos los eventos
              allEvents[chipId].push(eventObj);
            }
          }

          // Eliminar duplicados y ordenar por timestamp
          allEvents[chipId] = allEvents[chipId].filter(
            (event, index, self) =>
              index === self.findIndex((e) => e.id === event.id)
          );
          allEvents[chipId].sort((a, b) => b.timestamp - a.timestamp);

          // Limitar a máximo permitido
          if (allEvents[chipId].length > MAX_EVENTS_TO_KEEP) {
            allEvents[chipId] = allEvents[chipId].slice(0, MAX_EVENTS_TO_KEEP);
          }
        }

        console.log(
          `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Chip ${chipId}: ${
            allEvents[chipId]?.length || 0
          } eventos en memoria`
        );
      } catch (chipError) {
        console.error(
          `❌ Error cargando eventos para chip ${chipId}:`,
          chipError
        );
      }
    }

    // Actualizar currentData basado en showAllEvents
    updateCurrentDataFromAllEvents();

    // Actualizar estados de sensores
    updateSensorStatesFromEvents(currentData);

    // Actualizar UI
    updateUI();

    console.log(
      `✅ ${currentData.length} eventos listos para mostrar (showAll: ${showAllEvents})`
    );

    if (!loadMore) {
      showNotification(
        `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Se cargaron los últimos ${EVENTS_PER_LOAD} eventos`,
        "info"
      );
    }
  } catch (error) {
    console.error("❌ Error cargando eventos:", error);
    showNotification("❌ Error cargando datos de eventos", "danger");
  }
}

// Función para actualizar currentData desde allEvents
function updateCurrentDataFromAllEvents() {
  currentData = [];

  // Combinar eventos de todos los chips
  for (const chipId in allEvents) {
    const chipEvents = allEvents[chipId] || [];

    if (showAllEvents) {
      // Mostrar todos los eventos
      currentData = [...currentData, ...chipEvents];
    } else {
      // Mostrar solo los últimos N por chip
      const recentEvents = chipEvents.slice(0, EVENTS_PER_LOAD);
      currentData = [...currentData, ...recentEvents];
    }
  }

  // Ordenar todos por timestamp (más reciente primero)
  currentData.sort((a, b) => b.timestamp - a.timestamp);

  // Eliminar duplicados
  currentData = currentData.filter(
    (event, index, self) => index === self.findIndex((e) => e.id === event.id)
  );
}

// Cargar estados de dispositivos
async function loadDevicesState() {
  if (!auth.currentUser) {
    console.log("🔒 Usuario no autenticado, omitiendo carga de dispositivos");
    return;
  }

  try {
    console.log("📱 Cargando estados de dispositivos...");

    const snapshot = await database.ref("devices").once("value");
    const devices = snapshot.val();

    devicesState = {};

    if (devices) {
      // Filtrar solo dispositivos autorizados
      const authorizedChips = Object.keys(userPermissions).filter(
        (chipId) => userPermissions[chipId] === true
      );

      console.log(
        `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/></svg> Cargando ${authorizedChips.length} dispositivos autorizados`
      );

      for (const chipId in devices) {
        // Solo cargar si el usuario tiene permiso
        if (!authorizedChips.includes(chipId)) {
          continue;
        }

        const device = devices[chipId];

        // Validar datos del dispositivo
        if (!device || typeof device !== "object") continue;

        // Extraer estados importantes con valores por defecto
        devicesState[chipId] = {
          alarm: device.state?.alarm_active || false,
          armed: device.state?.system_armed || false,
          intrusion: device.state?.any_intrusion || false,
          lastSeen: device.last_seen || Date.now(),
          rssi: device.rssi || -90,
          ip: device.ip_address || "N/A",
          mac: device.mac_address || "N/A",
          name: device.name || chipId
        };

        // También actualizar sensores desde el estado del dispositivo
        if (device.sensors && typeof device.sensors === "object") {
          if (!sensorStates[chipId]) {
            sensorStates[chipId] = {};
          }
          sensorStates[chipId] = {
            ...sensorStates[chipId],
            ...device.sensors
          };
        }
      }
    }

    console.log(
      `✅ ${
        Object.keys(devicesState).length
      } dispositivos cargados (solo autorizados)`
    );
  } catch (error) {
    console.error("❌ Error cargando estados:", error);
  }
}

// Actualizar estados de sensores desde eventos
function updateSensorStatesFromEvents(events) {
  // Primero limpiar estados anteriores para mantener solo chips autorizados
  const authorizedChips = Object.keys(userPermissions).filter(
    (chipId) => userPermissions[chipId] === true
  );

  // Limpiar sensorStates para mantener solo chips autorizados
  const authorizedSensorStates = {};
  authorizedChips.forEach((chipId) => {
    if (sensorStates[chipId]) {
      authorizedSensorStates[chipId] = sensorStates[chipId];
    }
  });
  sensorStates = authorizedSensorStates;

  // Para cada dispositivo autorizado, mantener solo el estado más reciente
  const latestSensorStates = {};

  events.forEach((event) => {
    const chipId = event.device_id;
    if (!chipId || !authorizedChips.includes(chipId)) return;

    if (!latestSensorStates[chipId]) {
      latestSensorStates[chipId] = {};
    }

    const eventType = event.event_type;
    const eventValue = event.event_value;

    // Solo procesar eventos de sensores y estados
    if (eventType && typeof eventValue !== "undefined") {
      if (eventType.includes("sensores/")) {
        const sensorName = eventType.split("/")[1]; // Ej: 'c1'
        latestSensorStates[chipId][sensorName] = Boolean(eventValue);
      } else if (eventType.includes("estado/")) {
        const stateName = eventType.split("/")[1]; // Ej: 'armado', 'alarma'
        latestSensorStates[chipId][stateName] = Boolean(eventValue);
      }
    }
  });

  // Combinar con estados existentes
  for (const chipId in latestSensorStates) {
    if (!sensorStates[chipId]) {
      sensorStates[chipId] = {};
    }

    // Actualizar solo estados de sensores autorizados
    for (const key in latestSensorStates[chipId]) {
      sensorStates[chipId][key] = latestSensorStates[chipId][key];
    }
  }
}

// ==================== UI Y VISUALIZACIÓN ====================

// Función para cambiar modo de visualización
function toggleViewMode() {
  showAllEvents = !showAllEvents;
  updateCurrentDataFromAllEvents();
  updateUI();
  showNotification(
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Modo cambiado: ${
      showAllEvents
        ? "Mostrando todos los eventos"
        : "Mostrando últimos eventos"
    }`,
    "info"
  );
}

// Función para refrescar eventos
function refreshEvents() {
  showNotification("🔄 Actualizando eventos...", "info");
  loadAlarmData(false); // Cargar últimos eventos
}

// Función para cargar más eventos
function loadMoreEvents() {
  if (showAllEvents) {
    showNotification("ℹ️ Ya estás en modo ver todos", "info");
    return;
  }

  showNotification("📥 Cargando más eventos...", "info");
  loadAlarmData(true); // Cargar con loadMore = true
}

// Modificar el intervalo automático para no recargar todo
setInterval(async () => {
  if (auth.currentUser) {
    await getUserPermissions(); // Actualizar permisos
    await loadDevicesState();
    await loadChipConfigs();

    // Solo actualizar eventos si NO estamos en modo "ver todos"
    if (!showAllEvents) {
      await loadAlarmData(false);
    }

    updateUI();
  }
}, 15000);

// Actualizar toda la UI
function updateUI() {
  if (!auth.currentUser) return;

  updateDashboard();
  updateValoresEnVivo();
  updateSidebarStatus();
}

// Actualizar indicador de estado en el sidebar
function updateSidebarStatus() {
  const authorizedChips = Object.keys(userPermissions).filter(
    (chipId) => userPermissions[chipId] === true
  );
  const ahora = Date.now();
  const totalDispositivos = authorizedChips.length;
  const dispositivosConectados = authorizedChips.filter(chipId => {
    const lastSeen = devicesState[chipId]?.lastSeen || 0;
    return (ahora - lastSeen) < 300000;
  }).length;
  
  const countEl = document.getElementById('sidebar-devices-count');
  const progressEl = document.getElementById('sidebar-progress');
  if (countEl) {
    countEl.textContent = `${dispositivosConectados}/${totalDispositivos} online`;
    countEl.style.color = dispositivosConectados === totalDispositivos ? '#22c55e' : '#f59e0b';
  }
  if (progressEl) {
    const pct = totalDispositivos > 0 ? (dispositivosConectados / totalDispositivos * 100) : 0;
    progressEl.style.width = pct + '%';
  }
}

// Actualizar Dashboard
function updateDashboard() {
  const displayElement = document.getElementById("data-display");
  if (!displayElement) return;

  // Verificar si el usuario es admin
  const isAdmin = userData?.role === "admin";

  // Obtener chips autorizados
  const authorizedChips = Object.keys(userPermissions).filter(
    (chipId) => userPermissions[chipId] === true && isChipEnabled(chipId)
  );

  // Si no tiene acceso a ningún chip
  if (authorizedChips.length === 0) {
    displayElement.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #666;">
        <div style="font-size: 64px; margin-bottom: 20px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
        <div style="font-size: 18px; margin-bottom: 10px;">No tienes acceso a dispositivos</div>
        <div style="font-size: 14px; opacity: 0.7; margin-bottom: 20px;">
          No puedes ver eventos porque no tienes permisos para ningún dispositivo
        </div>
        <div style="
          background: #f8f9fa;
          padding: 15px;
          border-radius: 10px;
          display: inline-block;
          max-width: 400px;
          text-align: left;
        ">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <span style="color: #ffc107;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
            <span style="font-weight: bold;">Información:</span>
          </div>
          <div style="font-size: 13px; color: #666;">
            1. Contacta al administrador para obtener permisos<br>
            2. Los permisos se asignan por dispositivo individual<br>
            3. Actualmente tienes ${
              Object.keys(userPermissions).length
            } dispositivos registrados<br>
            4. Dispositivos con acceso: ${
              Object.keys(userPermissions).filter(
                (k) => userPermissions[k] === true
              ).length
            }
          </div>
        </div>
      </div>
    `;
    return;
  }

  // ==================== CÁLCULOS PARA RESUMEN ====================
  
  // 1. Dispositivos autorizados
  const totalDispositivos = authorizedChips.length;
  
  // 2. Alarmas activas
  const alarmasActivas = authorizedChips.filter(
    chipId => devicesState[chipId]?.alarm === true
  ).length;
  
  // 3. Sistemas armados
  const sistemasArmados = authorizedChips.filter(
    chipId => devicesState[chipId]?.armed === true
  ).length;
  
  // 4. Sensores activos (cercos)
  let sensoresActivos = 0;
  let totalSensores = authorizedChips.length * 5; // 5 sensores por chip
  
  authorizedChips.forEach(chipId => {
    const sensors = sensorStates[chipId] || {};
    for (let i = 1; i <= 5; i++) {
      if (sensors[`c${i}`]) sensoresActivos++;
    }
  });
  
  // 5. Intrusiones detectadas
  const intrusiones = authorizedChips.filter(
    chipId => devicesState[chipId]?.intrusion === true
  ).length;
  
  // 6. Dispositivos conectados (últimos 5 minutos)
  const ahora = Date.now();
  const dispositivosConectados = authorizedChips.filter(
    chipId => {
      const lastSeen = devicesState[chipId]?.lastSeen || 0;
      return (ahora - lastSeen) < 300000; // 5 minutos
    }
  ).length;
  
  // ==================== HTML PARA NO ADMIN ====================
  
  if (true) {  // Tanto admin como usuario ven la misma vista de dispositivos
    let html = `
      <!-- Stats Grid -->
      <div class="sismo-stats-grid">
        <div class="sismo-stat-card">
          <div class="sismo-stat-header">
            <div class="sismo-stat-icon" style="background: rgba(14,165,233,0.12);">
              <svg viewBox="0 0 24 24" stroke="#0ea5e9"><rect x="5" y="2" width="14" height="20" rx="2"/></svg>
            </div>
            <span class="sismo-stat-label">Dispositivos</span>
          </div>
          <div class="sismo-stat-value" style="color: var(--blue);">${totalDispositivos}</div>
          <div class="sismo-stat-sub" style="color: ${dispositivosConectados === totalDispositivos ? 'var(--green)' : 'var(--amber)'};">
            <span class="mini-led" style="background: ${dispositivosConectados === totalDispositivos ? 'var(--green)' : 'var(--amber)'}"></span>
            ${dispositivosConectados}/${totalDispositivos} conectados
          </div>
        </div>
 
        <div class="sismo-stat-card">
          <div class="sismo-stat-header">
            <div class="sismo-stat-icon" style="background: rgba(34,197,94,0.12);">
              <svg viewBox="0 0 24 24" stroke="${alarmasActivas > 0 ? '#ef4444' : '#22c55e'}"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7z"/></svg>
            </div>
            <span class="sismo-stat-label">Alarmas</span>
          </div>
          <div class="sismo-stat-value" style="color: ${alarmasActivas > 0 ? 'var(--red)' : 'var(--green)'};">${alarmasActivas}</div>
          <div class="sismo-stat-sub" style="color: var(--text-secondary);">
            ${alarmasActivas > 0 ? 'Atención requerida' : 'Todo en orden'}
          </div>
        </div>
 
        <div class="sismo-stat-card">
          <div class="sismo-stat-header">
            <div class="sismo-stat-icon" style="background: rgba(0,201,167,0.12);">
              <svg viewBox="0 0 24 24" stroke="#00c9a7"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </div>
            <span class="sismo-stat-label">Armados</span>
          </div>
          <div class="sismo-stat-value" style="color: var(--teal);">${sistemasArmados}</div>
          <div class="sismo-stat-sub" style="color: var(--text-secondary);">
            ${sistemasArmados > 0 ? 'Vigilando' : 'Inactivos'}
          </div>
        </div>
 
        <div class="sismo-stat-card">
          <div class="sismo-stat-header">
            <div class="sismo-stat-icon" style="background: rgba(245,158,11,0.12);">
              <svg viewBox="0 0 24 24" stroke="#f59e0b"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <span class="sismo-stat-label">Cercos</span>
          </div>
          <div class="sismo-stat-value" style="color: ${sensoresActivos > 0 ? 'var(--amber)' : 'var(--green)'};">${sensoresActivos}/${totalSensores}</div>
          <div class="sismo-stat-sub" style="color: var(--text-secondary);">
            ${sensoresActivos > 0 ? sensoresActivos + ' activos' : 'Todos normales'}
          </div>
        </div>
      </div>
 
      <!-- Section title -->
      <div class="sismo-section-title">
        <span>Estado detallado del sistema</span>
        <span>Tiempo real</span>
      </div>
 
      <!-- Devices grid -->
      <div class="sismo-devices-grid">
    `;
 
    // Detalles por dispositivo
    authorizedChips.forEach((chipId, index) => {
      const device = devicesState[chipId] || {};
      const sensors = sensorStates[chipId] || {};
      const deviceName = device.name || chipId;
 
      let estado = "DESCONOCIDO";
      let statusClass = "disarmed";
      
      if (device.alarm) {
        estado = "Alarma";
        statusClass = "alarm";
      } else if (device.intrusion) {
        estado = "Intrusión";
        statusClass = "intrusion";
      } else if (device.armed) {
        estado = "Armado";
        statusClass = "armed";
      } else {
        estado = "Desarmado";
        statusClass = "disarmed";
      }
 
      const sensoresActivosChip = [1,2,3,4,5].filter(i => sensors[`c${i}`]).length;
      const ultimaConexion = device.lastSeen || Date.now();
      const conectado = (ahora - ultimaConexion) < 300000;
      const ledClass = conectado ? 'online' : ((ahora - ultimaConexion) < 600000 ? 'intermittent' : 'offline');
      const ledText = conectado ? 'Conectado' : ((ahora - ultimaConexion) < 600000 ? 'Intermitente' : 'Desconectado');
 
      html += `
        <div class="sismo-device-card" data-status="${statusClass}" 
             onclick="openControlForChip('${chipId}')" 
             title="Controlar ${deviceName}">
          <div class="device-header">
            <div>
              <div class="device-name">${deviceName}</div>
              <div class="device-id">${chipId}</div>
            </div>
            <span class="sismo-badge ${statusClass}">${estado}</span>
          </div>
 
          <div class="device-connection">
            <div class="sismo-led ${ledClass}"></div>
            <span>${ledText}</span>
            <span class="time">${formatTimestamp(ultimaConexion)}</span>
          </div>
 
          <div class="fence-container">
            <div class="fence-label">Cercos</div>
            <div class="fence-bars">
      `;
 
      for (let i = 1; i <= 5; i++) {
        if (!isZoneEnabled(chipId, `c${i}`)) continue;
        const isActive = sensors[`c${i}`] || false;
        const zoneName = getZoneName(chipId, `c${i}`);
        html += `<div class="fence-bar ${isActive ? 'alert' : 'ok'}" title="${zoneName}: ${isActive ? 'ACTIVO' : 'Normal'}"></div>`;
      }
 
      html += `
            </div>
          </div>
 
          <div class="device-footer">
            <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg> ${device.rssi || -90} dBm</span>
            <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${device.ip || 'N/A'}</span>
          </div>
        </div>
      `;
    });
 
    html += `</div>`;
 
    // Status bar al final
    html += `
      <div class="sismo-status-bar ${alarmasActivas > 0 ? 'alert' : 'ok'}">
        <div class="status-icon-wrap">
          ${alarmasActivas > 0 
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
          }
        </div>
        <div>
          <div class="status-text-main">${alarmasActivas > 0 ? 'Atención requerida — ' + alarmasActivas + ' alarma(s) activa(s)' : 'Sistema operativo — sin alertas críticas'}</div>
          <div class="status-text-sub">Haz clic en cualquier dispositivo para controlarlo</div>
        </div>
      </div>
    `;
 
    displayElement.innerHTML = html;
    return;
  }
  
  // ==================== CÓDIGO PARA ADMIN ====================
  
  // Contar eventos totales y mostrados
  const totalEventsInMemory = Object.values(allEvents).reduce(
    (total, chipEvents) => total + (chipEvents?.length || 0),
    0
  );
  const eventsShown = currentData.length;

  // Crear HTML del dashboard para admin
    let html = `
    <div class="sismo-stats-grid">
      <div class="sismo-stat-card">
        <div class="sismo-stat-header">
          <div class="sismo-stat-icon" style="background: rgba(14,165,233,0.12);">
            <svg viewBox="0 0 24 24" stroke="#0ea5e9"><rect x="5" y="2" width="14" height="20" rx="2"/></svg>
          </div>
          <span class="sismo-stat-label">Eventos Visibles</span>
        </div>
        <div class="sismo-stat-value" style="color: var(--text-primary);">${eventsShown}</div>
        <div class="sismo-stat-sub" style="color: var(--text-secondary);">
          ${showAllEvents ? 'Todos cargados' : 'Últimos ' + EVENTS_PER_LOAD}
        </div>
      </div>
 
      <div class="sismo-stat-card">
        <div class="sismo-stat-header">
          <div class="sismo-stat-icon" style="background: rgba(34,197,94,0.12);">
            <svg viewBox="0 0 24 24" stroke="#22c55e"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7z"/></svg>
          </div>
          <span class="sismo-stat-label">En Memoria</span>
        </div>
        <div class="sismo-stat-value" style="color: var(--green);">${totalEventsInMemory}</div>
        <div class="sismo-stat-sub" style="color: var(--text-secondary);">Eventos cargados</div>
      </div>
 
      <div class="sismo-stat-card">
        <div class="sismo-stat-header">
          <div class="sismo-stat-icon" style="background: rgba(0,201,167,0.12);">
            <svg viewBox="0 0 24 24" stroke="#00c9a7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <span class="sismo-stat-label">Dispositivos</span>
        </div>
        <div class="sismo-stat-value" style="color: var(--teal);">${authorizedChips.length}</div>
        <div class="sismo-stat-sub" style="color: var(--text-secondary);">Con acceso</div>
      </div>
 
      <div class="sismo-stat-card">
        <div class="sismo-stat-header">
          <div class="sismo-stat-icon" style="background: rgba(245,158,11,0.12);">
            <svg viewBox="0 0 24 24" stroke="#f59e0b"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span class="sismo-stat-label">Modo</span>
        </div>
        <div class="sismo-stat-value" style="color: ${showAllEvents ? 'var(--amber)' : 'var(--green)'}; font-size: 16px;">
          ${showAllEvents ? 'COMPLETA' : 'RECIENTE'}
        </div>
        <div class="sismo-stat-sub" style="color: var(--text-secondary);">Clic para cambiar</div>
      </div>
    </div>
  `;

  // Botones de control para admin
  html += `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 10px;
      border-left: 4px solid #667eea;
    ">
      <div>
        <div style="font-size: 16px; font-weight: bold; color: #333;">
          📝 EVENTOS DEL SISTEMA
        </div>
        <div style="font-size: 12px; color: #666;">
          ${
            showAllEvents
              ? "Mostrando todos los eventos"
              : `Mostrando últimos ${EVENTS_PER_LOAD} eventos por dispositivo`
          }
        </div>
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button onclick="toggleViewMode()" style="
          padding: 8px 15px;
          background: ${showAllEvents ? "#6c757d" : "#28a745"};
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
        " 
        onmouseover="this.style.transform='translateY(-2px)'" 
        onmouseout="this.style.transform='translateY(0)'">
          ${showAllEvents ? "📖 Ver recientes" : "📚 Ver todos"}
        </button>
        
        <button onclick="loadAlarmData(true)" style="
          padding: 8px 15px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
        " 
        onmouseover="this.style.transform='translateY(-2px)'" 
        onmouseout="this.style.transform='translateY(0)'"
        ${showAllEvents ? "disabled" : ""}
        ${showAllEvents ? 'style="opacity: 0.5; cursor: not-allowed;"' : ""}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Cargar más
        </button>
        
        <button onclick="refreshEvents()" style="
          padding: 8px 15px;
          background: #ffc107;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
        " 
        onmouseover="this.style.transform='translateY(-2px)'" 
        onmouseout="this.style.transform='translateY(0)'">
          ⚡ Actualizar
        </button>
      </div>
    </div>
  `;

  // Mostrar eventos para admin
  if (currentData.length === 0) {
    html += `
      <div style="text-align: center; padding: 40px 20px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 15px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg></div>
        <div style="font-size: 16px; margin-bottom: 10px;">No hay eventos en el sistema</div>
        <div style="font-size: 14px; opacity: 0.7;">
          Los eventos aparecerán aquí automáticamente
        </div>
      </div>
    `;
  } else {
    html += '<div style="max-height: 450px; overflow-y: auto; padding-right: 5px;" class="admin-scrollbar">';

    currentData.forEach((event, index) => {
      const eventName = getEventDisplayName(event.event_type);
      const isActive = Boolean(event.event_value);
      const eventColor = isActive ? "#dc3545" : "#28a745";
      const eventIcon = isActive ? '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#ef4444" stroke="none"/></svg>' : '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#22c55e" stroke="none"/></svg>';
      const chipName = event.device_id || "Desconocido";

      // Determinar si el admin tiene acceso a este chip
      const adminHasAccess = userPermissions[chipName] === true;
      const borderLeft = adminHasAccess
        ? `4px solid ${eventColor}`
        : "4px solid #6c757d";

      html += `
        <button type="button" style="
          border: 1px solid #e8e8e8;
          padding: 15px;
          margin-bottom: 12px;
          border-radius: 10px;
          border-left: ${borderLeft};
          background: white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          transition: transform 0.2s;
          cursor: pointer;
          opacity: ${adminHasAccess ? "1" : "0.8"};
          width: 100%;
          text-align: left;
          border-right: none;
          border-top: none;
          border-bottom: none;
          outline: none;
          font-family: inherit;
        " 
        onmouseover="this.style.transform='translateX(5px)'" 
        onmouseout="this.style.transform='translateX(0)'"
        onclick="showEventDetails('${event.id}')"
        title="${
          adminHasAccess
            ? "Evento de dispositivo con acceso"
            : "Evento de dispositivo sin acceso"
        }">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; margin-bottom: 5px;">
                <span style="font-size: 18px; margin-right: 10px;">${eventIcon}</span>
                <strong style="color: #333; font-size: 15px;">${eventName}</strong>
                <span style="
                  background: ${eventColor}20;
                  color: ${eventColor};
                  padding: 3px 10px;
                  border-radius: 15px;
                  font-size: 11px;
                  font-weight: bold;
                  margin-left: 10px;
                ">
                  ${isActive ? "ACTIVADO" : "DESACTIVADO"}
                </span>
                ${
                  adminHasAccess
                    ? '<span style="margin-left: 8px; font-size: 10px; color: #28a745; background: #e8f5e8; padding: 2px 6px; border-radius: 10px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ACCESO</span>'
                    : '<span style="margin-left: 8px; font-size: 10px; color: #888; background: #f8f9fa; padding: 2px 6px; border-radius: 10px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> SOLO VISTA</span>'
                }
              </div>
              <div style="font-size: 12px; color: #666; margin-left: 28px;">
                ${event.message || "Evento del sistema"}
              </div>
            </div>
            <div style="text-align: right; min-width: 100px;">
              <div style="font-size: 12px; color: #666; font-weight: bold;">
                ${formatTimestamp(event.timestamp)}
              </div>
              <div style="font-size: 11px; color: ${
                adminHasAccess ? "#28a745" : "#888"
              }; margin-top: 5px;">
                ${adminHasAccess ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> '}${chipName}
              </div>
            </div>
          </div>
        </button>
      `;
    });

    html += `</div>`;

    // Footer con estadísticas
    html += `
      <div style="
        margin-top: 15px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
        font-size: 12px;
        color: #666;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div>
          <span style="color: #28a745;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span> 
          Mostrando ${currentData.length} eventos 
          ${
            showAllEvents
              ? "(todos)"
              : `(últimos ${EVENTS_PER_LOAD} por dispositivo)`
          }
        </div>
        <div>
          Total en memoria: <strong>${totalEventsInMemory}</strong> eventos
        </div>
      </div>
    `;
  }

  displayElement.innerHTML = html;
}

// Actualizar Valores en Vivo
function updateValoresEnVivo() {
  const valoresSection = document.getElementById("valores-section");
  if (!valoresSection) return;

  const chips = Object.keys(devicesState).filter((chipId) => {
    return userPermissions[chipId] === true && isChipEnabled(chipId);
  });

  if (chips.length === 0) {
    valoresSection.innerHTML = `
      <div style="text-align: center; padding: 60px 20px;">
        <div style="width: 64px; height: 64px; border-radius: 16px; background: rgba(245,158,11,0.12); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
        <div style="font-size: 18px; color: var(--text-primary); font-weight: 500; margin-bottom: 8px;">No tienes acceso a dispositivos</div>
        <div style="font-size: 14px; color: var(--text-muted);">Contacta al administrador para obtener permisos</div>
      </div>
    `;
    return;
  }

  let html = `
    <h1 style="margin-bottom: 10px; color: var(--text-primary);">Valores en Vivo</h1>
    <div style="margin-bottom: 20px; color: var(--text-secondary); font-size: 14px;">
      <span style="background: rgba(14,165,233,0.1); color: var(--blue); padding: 5px 12px; border-radius: 15px; font-size: 13px;">
        Tienes acceso a ${chips.length} dispositivo(s)
      </span>
      <span style="margin-left: 10px; font-size: 12px; color: var(--text-muted);">
        Haz clic en cualquier tarjeta para controlar el dispositivo
      </span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
  `;

  chips.forEach((chipId) => {
    const device = devicesState[chipId];
    const sensors = sensorStates[chipId] || {};
    const deviceName = device.name || chipId;

    let statusColor = "var(--gray-accent)";
    let statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
    let statusText = "DESCONOCIDO";
    let statusDesc = "Estado no disponible";

    const hasActiveSensors = sensors.c1 || sensors.c2 || sensors.c3 || sensors.c4 || sensors.c5;
    const hasAlarm = sensors.alarma || device.alarm;

    if (hasAlarm) {
      statusColor = "var(--red)";
      statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      statusText = "ALARMA ACTIVA";
      statusDesc = "¡Se requiere atención inmediata!";
    } else if (hasActiveSensors) {
      statusColor = "var(--amber)";
      statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      statusText = "INTRUSIÓN";
      statusDesc = "Intrusión detectada";
    } else if (sensors.armado || device.armed) {
      statusColor = "var(--green)";
      statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7z"/></svg>';
      statusText = "ARMADO";
      statusDesc = "Sistema vigilando";
    } else {
      statusColor = "var(--gray-accent)";
      statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
      statusText = "DESARMADO";
      statusDesc = "Sistema inactivo";
    }

    let signalQuality = "Débil";
    let signalColor = "var(--red)";
    if (device.rssi >= -50) { signalQuality = "Excelente"; signalColor = "var(--green)"; }
    else if (device.rssi >= -65) { signalQuality = "Buena"; signalColor = "var(--green)"; }
    else if (device.rssi >= -75) { signalQuality = "Regular"; signalColor = "var(--amber)"; }

    let activeSensors = 0;
    for (let i = 1; i <= 5; i++) { if (sensors[`c${i}`]) activeSensors++; }

    html += `
      <div class="sismo-device-card" data-status="${hasAlarm ? 'alarm' : hasActiveSensors ? 'intrusion' : (sensors.armado || device.armed) ? 'armed' : 'disarmed'}"
           onclick="openControlForChip('${chipId}')"
           title="Controlar ${deviceName}"
           style="padding: 20px; cursor: pointer;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0; color: var(--text-primary); font-size: 17px; font-weight: 600;">${deviceName}</h3>
          <span class="sismo-badge ${hasAlarm ? 'alarm' : hasActiveSensors ? 'intrusion' : (sensors.armado || device.armed) ? 'armed' : 'disarmed'}">
            ${statusIcon} ${statusText}
          </span>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <div style="
            width: 90px; height: 90px; border-radius: 50%;
            background: linear-gradient(135deg, ${statusColor}, ${statusColor}80);
            margin: 0 auto;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 6px 20px ${statusColor}40;
          ">
            <span style="color: white; font-size: 36px;">${statusIcon}</span>
          </div>
          <div style="color: var(--text-muted); margin-top: 10px; font-size: 13px;">${statusDesc}</div>
        </div>
        
        <div style="margin: 20px 0;">
          <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px; font-weight: 600;">
            ESTADO DE CERCOS:
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 6px;">
    `;

    for (let i = 1; i <= 5; i++) {
      if (!isZoneEnabled(chipId, `c${i}`)) continue;
      const isActive = sensors[`c${i}`] || false;
      html += `
        <div style="
          flex: 1; padding: 10px 0; border-radius: 8px;
          background: ${isActive ? 'var(--red)' : 'var(--green)'};
          color: white; text-align: center; font-weight: bold; font-size: 13px;
        " title="${getZoneName(chipId, `c${i}`)}: ${isActive ? 'ACTIVO' : 'NORMAL'}">
          ${getZoneName(chipId, `c${i}`)}<br><span style="font-size: 14px;">${isActive ? '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#ef4444" stroke="none"/></svg>' : '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#22c55e" stroke="none"/></svg>'}</span>
        </div>
      `;
    }

    html += `
          </div>
        </div>
        
        <div style="
          background: var(--bg-inset);
          padding: 14px;
          border-radius: 10px;
          margin-bottom: 14px;
          border: 1px solid var(--border-color);
        ">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
            <div>
              <div style="color: var(--text-muted); margin-bottom: 3px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg> Señal WiFi</div>
              <div style="font-weight: bold; color: ${signalColor};">${signalQuality}</div>
              <div style="font-size: 11px; color: var(--text-faint);">${device.rssi} dBm</div>
            </div>
            <div>
              <div style="color: var(--text-muted); margin-bottom: 3px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg> Sensores</div>
              <div style="font-weight: bold; color: ${activeSensors > 0 ? 'var(--red)' : 'var(--green)'}">
                ${activeSensors}/5 activos
              </div>
              <div style="font-size: 11px; color: var(--text-faint);">${activeSensors > 0 ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Atención' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Normal'}</div>
            </div>
          </div>
        </div>
        
        <div style="
          border-top: 1px solid var(--border-color);
          padding-top: 12px;
          display: flex; justify-content: space-between;
          font-size: 12px; color: var(--text-faint);
        ">
          <div><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${formatTimestamp(device.lastSeen)}</div>
          <div>${device.ip}</div>
        </div>
      </div>
    `;
  });

  html += "</div>";
  valoresSection.innerHTML = html;
}

// ==================== CONTROL DE CERCOS (MODAL) ====================
// Mostrar control para un solo chip específico
function showSingleChipControl(chipId) {
  const modal = document.getElementById("control-modal");
  const controlContent = document.getElementById("control-cercos-content");
 
  if (!controlContent || !modal) return;
 
  if (!devicesState[chipId]) {
    controlContent.innerHTML = `
      <div style="text-align: center; padding: 30px 20px; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 15px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
        <div style="font-size: 16px; margin-bottom: 10px; color: var(--text-primary);">Dispositivo no encontrado</div>
        <div style="font-size: 14px;">El dispositivo ${chipId} no está disponible</div>
      </div>
    `;
    modal.style.display = "block";
    return;
  }
 
  const device = devicesState[chipId];
  const sensors = sensorStates[chipId] || {};
  const deviceName = device.name || chipId;
 
  let statusColor = "var(--gray-accent)";
  let statusRawColor = "#6c757d";
  let statusText = "DESCONOCIDO";
  let statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
 
  if (device.alarm) {
    statusColor = "var(--red)"; statusRawColor = "#ef4444";
    statusText = "ALARMA ACTIVA"; statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else if (device.intrusion) {
    statusColor = "var(--amber)"; statusRawColor = "#f59e0b";
    statusText = "INTRUSIÓN"; statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else if (device.armed) {
    statusColor = "var(--green)"; statusRawColor = "#22c55e";
    statusText = "ARMADO"; statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7z"/></svg>';
  } else {
    statusColor = "var(--gray-accent)"; statusRawColor = "#64748b";
    statusText = "DESARMADO"; statusIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>';
  }
 
  let activeSensors = 0;
  for (let i = 1; i <= 5; i++) { if (sensors[`c${i}`]) activeSensors++; }
 
  let signalQuality = "Débil";
  let signalColor = "var(--red)";
  if (device.rssi >= -50) { signalQuality = "Excelente"; signalColor = "var(--green)"; }
  else if (device.rssi >= -65) { signalQuality = "Buena"; signalColor = "var(--green)"; }
  else if (device.rssi >= -75) { signalQuality = "Regular"; signalColor = "var(--amber)"; }
 
  let html = `
    <div style="
      background: var(--bg-inset);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
      border-top: 3px solid ${statusColor};
    ">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
        <div style="text-align: left;">
          <h3 style="margin: 0 0 4px 0; color: var(--text-primary); font-size: 17px; font-weight: 600;">${deviceName}</h3>
          <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">ID: ${chipId}</div>
        </div>
        <span class="sismo-badge ${device.alarm ? 'alarm' : device.intrusion ? 'intrusion' : device.armed ? 'armed' : 'disarmed'}">
          ${statusIcon} ${statusText}
        </span>
      </div>
      
      <div style="margin: 20px 0;">
        <div style="
          width: 80px; height: 80px; border-radius: 50%;
          background: linear-gradient(135deg, ${statusRawColor}, ${statusRawColor}80);
          margin: 0 auto;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px ${statusRawColor}40;
        ">
          <span style="color: white; font-size: 32px;">${statusIcon}</span>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="
          background: var(--bg-card);
          padding: 14px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
        ">
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg> SEÑAL WIFI</div>
          <div style="font-size: 18px; font-weight: bold; color: ${signalColor};">${signalQuality}</div>
          <div style="font-size: 11px; color: var(--text-faint);">${device.rssi} dBm</div>
        </div>
        <div style="
          background: var(--bg-card);
          padding: 14px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
        ">
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg> SENSORES</div>
          <div style="font-size: 18px; font-weight: bold; color: ${activeSensors > 0 ? 'var(--red)' : 'var(--green)'};">${activeSensors}/5</div>
          <div style="font-size: 11px; color: var(--text-faint);">${activeSensors > 0 ? 'Activos' : 'Normales'}</div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: 20px;">
      <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 14px; display: flex; align-items: center; gap: 8px;">
        CONTROL DE CERCOS
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); gap: 8px; margin-bottom: 16px;">
  `;
 
  for (let i = 1; i <= 5; i++) {
    if (!isZoneEnabled(chipId, `c${i}`)) continue;
    const isActive = sensors[`c${i}`] || false;
    html += `
      <button type="button" style="
        background: ${isActive ? 'var(--red)' : 'var(--green)'};
        color: white; padding: 14px 4px; border-radius: 8px;
        text-align: center; font-weight: bold; cursor: pointer;
        transition: all 0.2s; border: none; outline: none;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
      "
      onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
      onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'"
      onclick="toggleSensor('${chipId}', 'c${i}')"
      title="${getZoneName(chipId, `c${i}`)}: ${isActive ? 'ACTIVADO' : 'NORMAL'}">
        <div style="font-size: 13px; font-weight: bold;">${getZoneName(chipId, `c${i}`)}</div>
        <div style="font-size: 18px;">${isActive ? '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#ef4444" stroke="none"/></svg>' : '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#22c55e" stroke="none"/></svg>'}</div>
        <div style="font-size: 10px; opacity: 0.9;">${isActive ? 'ACTIVO' : 'NORMAL'}</div>
      </button>
    `;
  }
 
  html += `
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <button type="button" onclick="sendCommand('${chipId}', '${device.alarm ? 'DESACTIVAR_ALARMA' : 'ACTIVAR_ALARMA'}')"
        class="btn" style="
          padding: 14px; background: ${device.alarm ? 'var(--red)' : 'var(--green)'};
          color: white; border-radius: 10px; font-size: 13px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        ">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> ${device.alarm ? 'DESACTIVAR ALARMA' : 'ACTIVAR ALARMA'}
      </button>
      <button type="button" onclick="sendCommand('${chipId}', '${device.armed ? 'DESARMAR_SISTEMA' : 'ARMAR_SISTEMA'}')"
        class="btn" style="
          padding: 14px; background: ${device.armed ? 'var(--green)' : 'var(--gray-accent)'};
          color: white; border-radius: 10px; font-size: 13px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        ">
        ${device.armed ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> DESARMAR SISTEMA' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg> ARMAR SISTEMA'}
      </button>
    </div>
    
    <div style="
      background: var(--bg-inset);
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 14px;
      border: 1px solid var(--border-color);
    ">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ÚLTIMA CONEXIÓN</div>
          <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${formatTimestamp(device.lastSeen)}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> DIRECCIÓN IP</div>
          <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${device.ip}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 0118 0"/><path d="M5 12a7 7 0 0114 0"/><path d="M8 12a4 4 0 018 0"/><circle cx="12" cy="12" r="1"/></svg> DIRECCIÓN MAC</div>
          <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); font-family: monospace;">${device.mac}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h6"/><path d="M22 12h-6"/><circle cx="12" cy="12" r="4"/></svg> ESTADO</div>
          <div style="font-weight: 600; font-size: 13px; color: ${Date.now() - device.lastSeen < 300000 ? 'var(--green)' : 'var(--red)'};">
            ${Date.now() - device.lastSeen < 300000 ? 'CONECTADO' : 'DESCONECTADO'}
          </div>
        </div>
      </div>
    </div>
    
    <div style="
      padding: 12px;
      background: rgba(14,165,233,0.08);
      border-radius: 8px;
      border-left: 3px solid var(--blue);
      font-size: 12px;
      color: var(--text-secondary);
    ">
      Haz clic en cualquier cerco para cambiar su estado. Los cambios se aplicarán inmediatamente.
    </div>
  `;
 
  controlContent.innerHTML = html;
  modal.style.display = "block";
  setTimeout(() => { modal.style.opacity = "1"; }, 10);
}

function openControlForChip(chipId) {
  // Verificar que el usuario tiene permiso para este chip
  if (userPermissions[chipId] !== true) {
    showNotification(`🔒 No tienes acceso al dispositivo ${chipId}`, "warning");
    return;
  }

  selectedChipId = chipId;
  showSingleChipControl(chipId); // Nueva función para mostrar solo un chip
}

function openControlModal() {
  const modal = document.getElementById("control-modal");
  modal.style.display = "block";
  updateControlCercos();
}

function closeControlModal() {
  const modal = document.getElementById("control-modal");
  if (modal) {
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.style.display = "none";
      modal.style.opacity = "1";
      selectedChipId = null;
    }, 300);
  }
}

function updateControlCercos() {
  // Esta función ya NO se usa, pero la mantenemos para evitar errores
  console.log(
    "ℹ️ updateControlCercos está desactivada - usando showSingleChipControl"
  );
}

// ==================== ENVIAR COMANDOS ====================

async function sendCommand(chipId, command) {
  if (!auth.currentUser) {
    showNotification("🔒 Debes iniciar sesión para enviar comandos", "warning");
    return;
  }

  // Verificar que el usuario tiene permiso para este chip
  if (userPermissions[chipId] !== true) {
    showNotification(`🔒 No tienes acceso al dispositivo ${chipId}`, "warning");
    return;
  }

  try {
    showToast(`⏳ Enviando: ${command}...`, "info");
    console.log(`📤 Enviando comando a devices_commands/${chipId}: ${command}`);

    // Construir la ruta específica para este chip: devices_commands/chip_XX
    const commandPath = `devices_commands/${chipId}`;

    const commandData = {
      command: command,
      timestamp: Date.now(),
      executed: false,
      status: "pending",
      sent_by: auth.currentUser.email || "usuario"
    };

    // Enviar a devices_commands/chip_XX con ID único generado por push()
    await database.ref(commandPath).push().set(commandData);
    showToast(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/></svg> Comando enviado: ${command}`, "success");

    showNotification(`📤 Comando enviado a ${chipId}: ${command}`, "success");
  } catch (error) {
    console.error("❌ Error enviando comando:", error);
    showNotification("❌ Error enviando comando", "danger");
  }
}

async function toggleSensor(chipId, sensorName) {
  if (!auth.currentUser) {
    showNotification(
      "🔒 Debes iniciar sesión para modificar sensores",
      "warning"
    );
    return;
  }

  // Verificar que el usuario tiene permiso para este chip
  if (userPermissions[chipId] !== true) {
    showNotification(`🔒 No tienes acceso al dispositivo ${chipId}`, "warning");
    return;
  }

  const currentState = sensorStates[chipId]?.[sensorName] || false;
  const command = currentState ? "DESACTIVAR_SENSOR" : "ACTIVAR_SENSOR";

  try {
    showToast(
      `⏳ ${getZoneName(chipId, sensorName)}: ${currentState ? "desactivando" : "activando"}...`,
      "info"
    );
    // Construir la ruta específica para este chip: devices_commands/chip_XX
    const commandPath = `devices_commands/${chipId}`;

    const commandData = {
      device_id: chipId,
      command: command,
      sensor: sensorName,
      timestamp: Date.now(),
      executed: false,
      status: "pending",
      sent_by: auth.currentUser.email || "usuario"
    };

    await database.ref(commandPath).push().set(commandData);
    showToast(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> ${getZoneName(chipId, sensorName)} ${currentState ? 'desactivado' : 'activado'}`, "info");

    showNotification(
      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg> ${chipId}: ${sensorName.toUpperCase()} ${
        currentState ? "desactivado" : "activado"
      }`,
      "info"
    );

    // Feedback visual local (solo para UI, sin afectar Firebase)
    if (!sensorStates[chipId]) {
      sensorStates[chipId] = {};
    }
    sensorStates[chipId][sensorName] = !currentState;

    updateControlCercos();
  } catch (error) {
    console.error("❌ Error cambiando sensor:", error);
    showNotification("❌ Error cambiando sensor", "danger");
  }
}

// ==================== FUNCIONES AUXILIARES ====================

function showEventDetails(eventId) {
  const event = currentData.find((e) => e.id === eventId);
  if (!event) return;

  const eventName = getEventDisplayName(event.event_type);
  const isActive = Boolean(event.event_value);

  alert(
    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> DETALLES DEL EVENTO\n\n` +
      `📝 Tipo: ${eventName}\n` +
      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Estado: ${isActive ? "ACTIVADO" : "DESACTIVADO"}\n` +
      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Fecha: ${new Date(event.timestamp).toLocaleString()}\n` +
      `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Dispositivo: ${event.device_id || "Desconocido"}\n` +
      `📄 Mensaje: ${event.message || "Sin mensaje adicional"}\n\n` +
      `ID: ${event.id}`
  );
}

function checkRealtimeStatus() {
  console.log("📊 ESTADO DEL SISTEMA:");
  console.log(
    "- Usuario:",
    auth.currentUser ? auth.currentUser.email : "No autenticado"
  );
  console.log("- Eventos registrados:", currentData.length);
  console.log("- Dispositivos conectados:", Object.keys(devicesState).length);
  console.log("- Estados de dispositivos:", devicesState);
  console.log("- Estados de sensores:", sensorStates);

  showNotification(
    "📊 Estado del sistema verificado - Ver consola para detalles",
    "info"
  );
}

function testManualUpdate() {
  if (!auth.currentUser) {
    showNotification("🔒 Debes iniciar sesión para ejecutar tests", "warning");
    return;
  }

  const testEvent = {
    id: "test_" + Date.now(),
    device_id: Object.keys(devicesState)[0] || "chip_01",
    event_type: "sensores/c1",
    event_value: Math.random() > 0.5,
    timestamp: Date.now(),
    message: "Test manual - Cerco 1"
  };

  currentData.unshift(testEvent);

  if (!sensorStates[testEvent.device_id]) {
    sensorStates[testEvent.device_id] = {};
  }
  sensorStates[testEvent.device_id].c1 = testEvent.event_value;

  updateUI();
  showNotification("🧪 Test manual ejecutado", "warning");
}

function forceReconnect() {
  if (!auth.currentUser) {
    showNotification("🔒 Debes iniciar sesión para reconectar", "warning");
    return;
  }

  showNotification("🔄 Reconectando...", "info");
  loadAlarmData();
  loadDevicesState();
}

async function manualRefresh() {
  if (!auth.currentUser) {
    showNotification("🔒 Debes iniciar sesión para actualizar", "warning");
    return;
  }

  showNotification("🔄 Actualizando manualmente...", "info");
  await loadAlarmData();
  await loadDevicesState();
  updateUI();
  showNotification("✅ Actualización completada", "success");
}

// ==================== NAVEGACIÓN ====================

function showSection(section) {
  console.log(`📌 Mostrando sección: ${section}`);

  // Ocultar todas las secciones
  const sections = ["dashboard", "valores", "admin", "eventos"];
  sections.forEach((sec) => {
    const el = document.getElementById(`${sec}-section`);
    if (el && el.id !== `${section}-section`) {
      el.style.display = "none";
    }
  });

  // Quitar active de todos los botones
  document.querySelectorAll(".sidebar-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Mostrar la sección seleccionada
  const targetSection = document.getElementById(`${section}-section`);
  if (targetSection) {
    targetSection.style.display = "block";
    console.log(`✅ Sección ${section} mostrada`);
  }

  // Activar el botón correspondiente
  const activeButton = Array.from(
    document.querySelectorAll(".sidebar-button")
  ).find((btn) => btn.textContent.trim().toLowerCase().includes(section));
  if (activeButton) {
    activeButton.classList.add("active");
  }

  if (section === "eventos") {
    if (userData?.role === "admin") {
      loadEventosData();
    } else {
      showNotification("🚫 No tienes permisos", "danger");
      showSection("dashboard");
    }
  }

  // Si es la sección admin, cargar datos SOLO si es admin
  if (section === "admin") {
    // Verificar permisos primero
    if (userData?.role === "admin") {
      console.log("👑 Cargando datos de administración...");
      loadAdminData();
    } else {
      console.log("🚫 No es admin, redirigiendo a dashboard");
      showNotification("🚫 No tienes permisos de administrador", "danger");
      showSection("dashboard");
    }
  } else {
    // Para otras secciones, actualizar UI normalmente
    updateUI();
  }

  // Actualizar botones activos del sidebar
  document.querySelectorAll('.sidebar-button').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('btn-' + section) || (section === 'admin' ? document.getElementById('admin-button') : null);
  if (activeBtn) activeBtn.classList.add('active');
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener("DOMContentLoaded", function () {
  // Configurar evento de login
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Verificar estado de autenticación
  checkAuthState();

  // Permitir login con Enter
  document
    .getElementById("password")
    ?.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        handleLogin(e);
      }
    });

  // Agregar animación shake si no existe
  if (!document.querySelector("#shake-style")) {
    const shakeStyle = document.createElement("style");
    shakeStyle.id = "shake-style";
    shakeStyle.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }
        `;
    document.head.appendChild(shakeStyle);
  }
});

// Agregar esto al final si no existe
if (!document.querySelector("#slideIn-style")) {
  const slideInStyle = document.createElement("style");
  slideInStyle.id = "slideIn-style";
  slideInStyle.textContent = `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(slideInStyle);
}

// ==================== FUNCIONES DE ADMINISTRACIÓN ====================

// Verificar si es admin y mostrar/ocultar botón
function checkAdminStatus() {
  if (!auth.currentUser || !userData) {
    document.getElementById("admin-button").style.display = "none";
    return;
  }

  const isAdmin = userData.role === "admin";
  document.getElementById("admin-button").style.display = isAdmin
    ? "block"
    : "none";

  const eventosBtn = document.getElementById("btn-eventos");
  if (eventosBtn) eventosBtn.style.display = isAdmin ? "block" : "none";

  // Si está en sección admin y pierde permisos, redirigir
  if (
    !isAdmin &&
    document.getElementById("admin-section").style.display !== "none"
  ) {
    showSection("dashboard");
  }
}

// Mostrar sección de administración
async function showAdminSection() {
  if (!auth.currentUser) {
    showNotification("🔒 Debes iniciar sesión", "warning");
    return;
  }

  // Verificar si es admin
  if (userData.role !== "admin") {
    showNotification("🚫 No tienes permisos de administrador", "danger");
    showSection("dashboard");
    return;
  }

  showSection("admin");
  await loadAdminData();
}

// Cargar datos de administración
async function loadAdminData() {
  try {
    console.log("🔄 Iniciando carga de datos admin...");

    // Mostrar estado de carga
    document.getElementById("admin-content").innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px; animation: spin 1s linear infinite;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg></div>
                <div style="font-size: 16px; margin-bottom: 10px;">Cargando datos de administración...</div>
            </div>
        `;

    // Agregar animación de spinner si no existe
    if (!document.querySelector("#spin-style")) {
      const style = document.createElement("style");
      style.id = "spin-style";
      style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
      document.head.appendChild(style);
    }

    // Obtener todos los usuarios
    const usersSnapshot = await database.ref("users").once("value");
    const users = usersSnapshot.val();

    // Obtener todos los dispositivos
    const devicesSnapshot = await database.ref("devices").once("value");
    const devices = devicesSnapshot.val() || {};
    const allChipIds = Object.keys(devices);

    if (!users) {
      document.getElementById("admin-content").innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg></div>
                    <div style="font-size: 16px;">No hay usuarios registrados</div>
                </div>
            `;
      return;
    }

    // Convertir a array y ordenar (ocultando cuentas eliminadas/bloqueadas)
    const usersArray = Object.entries(users)
      .map(([uid, userData]) => ({
        uid,
        ...userData
      }))
      .filter((u) => u.deleted !== true && u.status !== "deleted");

    // Ordenar por fecha de creación (más reciente primero)
    usersArray.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    // Estadísticas
    const totalUsers = usersArray.length;
    const activeUsers = usersArray.filter((u) => u.status === "active").length;
    const adminUsers = usersArray.filter((u) => u.role === "admin").length;
    const totalDevices = allChipIds.length;

    let html = `
            <div class="admin-stats">
                <div class="stat-card">
                    <div class="stat-label"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> Usuarios</div>
                    <div class="stat-value">${totalUsers}</div>
                    <div style="font-size: 11px; color: #28a745;">${activeUsers} activos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-5-7-5 7-3-12z"/><path d="M3 20h18"/></svg> Admins</div>
                    <div class="stat-value">${adminUsers}</div>
                    <div style="font-size: 11px; color: #667eea;">${Math.round(
                      (adminUsers / totalUsers) * 100
                    )}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Dispositivos</div>
                    <div class="stat-value">${totalDevices}</div>
                    <div style="font-size: 11px; color: #ffc107;">Disponibles</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/></svg> Permisos</div>
                    <div class="stat-value">${allChipIds.length}</div>
                    <div style="font-size: 11px; color: #6c757d;">Chips totales</div>
                </div>
            </div>

            <!-- Configuración de Webhook -->
            <div style="background: #1a1a2e; border: 1px solid rgba(102,126,234,0.3); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                <span style="font-size: 24px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg></span>
                <div>
                  <div style="font-size: 16px; font-weight: bold; color: white;">Webhook de Notificaciones</div>
                  <div style="font-size: 12px; color: #aaa;">Make → Wasend (WhatsApp) + Correo</div>
                </div>
              </div>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="text" id="webhook-url-input" placeholder="https://hook.make.com/..." value="${await loadWebhookConfig()}" style="flex: 1; padding: 10px; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 14px; background: rgba(255,255,255,0.1); color: white;">
                <button onclick="saveWebhookUrl()" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: bold; cursor: pointer; white-space: nowrap;">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar
                </button>
              </div>
              <div id="webhook-save-msg" style="margin-top: 10px; font-size: 13px; text-align: center; display: none;"></div>
              <div style="margin-top: 10px; font-size: 11px; color: #777;">
                Cuando se active una alarma, se enviará la info del evento y los datos de los usuarios vinculados al chip.
              </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
                <div class="search-box" style="flex: 1; min-width: 220px; margin-bottom: 0;">
                    <span class="search-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                    <input type="text" id="admin-search" placeholder="Buscar usuarios por email o nombre..." onkeyup="filterUsers()">
                </div>
                <button onclick="openCreateUserModal()" style="padding: 12px 20px; background: linear-gradient(135deg, var(--teal), var(--blue)); color: white; border: none; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    Crear Usuario
                </button>
            </div>
            
            <div style="max-height: 500px; overflow-y: auto;">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th>Última Conexión</th>
                            <th>Chips Autorizados</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="admin-users-list">
        `;

    // Para cada usuario
    usersArray.forEach((user, index) => {
      const chips = user.chips || {};

      // Contar chips con acceso
      const chipsWithAccess = Object.keys(chips).filter(
        (chipId) => chips[chipId] === true
      ).length;
      const totalUserChips = Object.keys(chips).length;

      // Formatear fecha
      const formatDate = (timestamp) => {
        if (!timestamp) return "Nunca";
        const date = new Date(timestamp);
        return date.toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        });
      };

      html += `
                <tr data-user-id="${user.uid}" data-user-email="${
        user.email || ""
      }">
                    <td>
                        <div style="font-weight: bold;">${
                          user.displayName ||
                          user.email?.split("@")[0] ||
                          "Usuario"
                        }</div>
                        <div style="font-size: 11px; color: #666;">${
                          user.email || "Sin email"
                        }</div>
                        <div style="font-size: 10px; color: #888; margin-top: 3px;">ID: ${user.uid.substring(
                          0,
                          8
                        )}...</div>
                    </td>
                    <td>
                        <span style="
                            display: inline-block;
                            padding: 4px 10px;
                            border-radius: 12px;
                            font-size: 12px;
                            font-weight: bold;
                            background: ${
                              user.role === "admin"
                                ? "rgba(220, 53, 69, 0.1)"
                                : "rgba(40, 167, 69, 0.1)"
                            };
                            color: ${
                              user.role === "admin" ? "#dc3545" : "#28a745"
                            };
                        ">
                            ${user.role === "admin" ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-5-7-5 7-3-12z"/><path d="M3 20h18"/></svg> ADMIN' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> USER'}
                        </span>
                    </td>
                    <td>
                        <span style="
                            display: inline-block;
                            padding: 4px 10px;
                            border-radius: 12px;
                            font-size: 12px;
                            font-weight: bold;
                            background: ${
                              user.status === "active"
                                ? "rgba(40, 167, 69, 0.1)"
                                : "rgba(108, 117, 125, 0.1)"
                            };
                            color: ${
                              user.status === "active" ? "#28a745" : "#6c757d"
                            };
                        ">
                            ${
                              user.status === "active"
                                ? '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#22c55e" stroke="none"/></svg> ACTIVO'
                                : '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#ef4444" stroke="none"/></svg> INACTIVO'
                            }
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 500;">${formatDate(
                          user.lastLogin
                        )}</div>
                        <div style="font-size: 11px; color: #666;">Sesiones: ${
                          user.loginCount || 1
                        }</div>
                    </td>
                    <td>
                        <div style="font-weight: bold; color: #333;">${chipsWithAccess}/${totalUserChips}</div>
                        <div style="font-size: 11px; color: #666;">
                            ${Math.round(
                              (chipsWithAccess / totalUserChips) * 100
                            )}% autorizados
                        </div>
                    </td>
                    <td>
                        <button class="edit-user-btn" onclick="openEditUserModal('${
                          user.uid
                        }')">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar
                        </button>
                    </td>
                </tr>
            `;
    });  // ← cierre del forEach de usersArray

    html += `
                    </tbody>
                </table>
            </div>
    `;

    // GESTIÓN DE NODOS - DESPUÉS de la tabla
    html += `
      <div style="margin-top: 30px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div>
            <div style="font-size: 16px; font-weight: 500; color: var(--text-primary);">Gestión de Nodos</div>
            <div style="font-size: 12px; color: var(--text-muted);">Configura nombres, zonas y estado de cada dispositivo</div>
          </div>
        </div>
        ${renderNodesSection()}
      </div>
    `;

    html += `
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                <div style="font-size: 12px; color: #666; display: flex; justify-content: space-between;">
                    <div>
                        <strong><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg> Notas:</strong>
                        <div style="margin-top: 5px;">
                            1. Solo usuarios admin pueden ver esta sección<br>
                            2. Los chips se sincronizan automáticamente con dispositivos<br>
                            3. Los permisos se asignan por dispositivo individual
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <button onclick="exportUsersData()" style="
                            padding: 8px 15px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 12px;
                        ">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Exportar Datos
                        </button>
                    </div>
                </div>
            </div>
        `;

    document.getElementById("admin-content").innerHTML = html;
    console.log("✅ Datos de admin cargados correctamente");
  } catch (error) {
    console.error("❌ Error cargando datos de admin:", error);
    document.getElementById("admin-content").innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                <div style="font-size: 16px; margin-bottom: 10px;">Error cargando datos</div>
                <div style="font-size: 14px; color: #dc3545;">${error.message}</div>
                <button onclick="loadAdminData()" style="
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                ">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Reintentar
                </button>
            </div>
        `;
  }
}

// Filtrar usuarios en la tabla
function filterUsers() {
  const searchInput = document.getElementById("admin-search");
  const filter = searchInput.value.toLowerCase();
  const rows = document.querySelectorAll("#admin-users-list tr");

  rows.forEach((row) => {
    const email = row.getAttribute("data-user-email").toLowerCase();
    const text = row.textContent.toLowerCase();

    if (email.includes(filter) || text.includes(filter)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

// Abrir modal para editar usuario
async function openEditUserModal(userId) {
  try {
    const userRef = database.ref("users/" + userId);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    if (!userData) {
      showNotification("❌ Usuario no encontrado", "danger");
      return;
    }

    // Obtener todos los dispositivos
    const devicesSnapshot = await database.ref("devices").once("value");
    const devices = devicesSnapshot.val() || {};
    const allChipIds = Object.keys(devices);

    // Preparar chips del usuario
    const userChips = userData.chips || {};

    // Asegurar que tenga todos los chips del sistema
    const completeChips = {};
    allChipIds.forEach((chipId) => {
      completeChips[chipId] = userChips[chipId] === true;
    });

    let html = `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px;">
                    <div style="
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 24px;
                    ">
                        ${(
                          userData.displayName ||
                          userData.email?.charAt(0) ||
                          "U"
                        ).toUpperCase()}
                    </div>
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: #333;">${
                          userData.displayName ||
                          userData.email?.split("@")[0] ||
                          "Usuario"
                        }</h3>
                        <div style="color: #666; font-size: 14px;">${
                          userData.email || "Sin email"
                        }</div>
                        <div style="font-size: 12px; color: #888; margin-top: 3px;">ID: ${userId.substring(
                          0,
                          12
                        )}...</div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-5-7-5 7-3-12z"/><path d="M3 20h18"/></svg> Rol</label>
                        <select id="edit-user-role" style="
                            width: 100%;
                            padding: 10px;
                            border: 2px solid #e0e0e0;
                            border-radius: 8px;
                            font-size: 14px;
                        ">
                            <option value="user" ${
                              userData.role === "user" ? "selected" : ""
                            }><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Usuario</option>
                            <option value="admin" ${
                              userData.role === "admin" ? "selected" : ""
                            }><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-5-7-5 7-3-12z"/><path d="M3 20h18"/></svg> Administrador</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Estado</label>
                        <select id="edit-user-status" style="
                            width: 100%;
                            padding: 10px;
                            border: 2px solid #e0e0e0;
                            border-radius: 8px;
                            font-size: 14px;
                        ">
                            <option value="active" ${
                              userData.status === "active" ? "selected" : ""
                            }><svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#22c55e" stroke="none"/></svg> Activo</option>
                            <option value="inactive" ${
                              userData.status === "inactive" ? "selected" : ""
                            }><svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="8" fill="#ef4444" stroke="none"/></svg> Inactivo</option>
                            <option value="suspended" ${
                              userData.status === "suspended" ? "selected" : ""
                            }><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Suspendido</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <label style="font-weight: bold; color: #333; font-size: 16px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> Permisos de Dispositivos</label>
                        <div style="font-size: 12px; color: #666;">
                            <span id="chips-count">0/${
                              allChipIds.length
                            }</span> seleccionados
                        </div>
                    </div>
        `;

    if (allChipIds.length === 0) {
      html += `
                <div style="text-align: center; padding: 30px 20px; background: #f8f9fa; border-radius: 10px;">
                    <div style="font-size: 36px; margin-bottom: 10px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg></div>
                    <div style="color: #666;">No hay dispositivos en el sistema</div>
                </div>
            `;
    } else {
      html += `
                <div style="
                    max-height: 300px;
                    overflow-y: auto;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    padding: 15px;
                    background: #f8f9fa;
                ">
                    <div style="display: grid; gap: 12px;">
            `;

      allChipIds.forEach((chipId) => {
        const device = devices[chipId];
        const deviceName = device?.name || chipId;
        const isChecked = completeChips[chipId] === true;

        html += `
                    <div class="chip-toggle">
                        <label class="toggle-switch">
                            <input type="checkbox" 
                                   id="chip-${chipId}" 
                                   ${isChecked ? "checked" : ""}
                                   onchange="updateChipsCount()">
                            <span class="toggle-slider"></span>
                        </label>
                        <div>
                            <div style="font-weight: 500; color: #333;">${deviceName}</div>
                            <div style="font-size: 11px; color: #666;">ID: ${chipId}</div>
                            <div style="font-size: 10px; color: #888; display: flex; align-items: center; gap: 5px;">
                                <span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg></span> ${device?.rssi || -90} dBm
                                <span style="margin-left: 10px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span> ${formatTimestamp(
                                  device?.last_seen || Date.now()
                                )}
                            </div>
                        </div>
                    </div>
                `;
      });

      html += `
                    </div>
                </div>
            `;
    }

    html += `
                </div>
                
                <div style="
                    margin-top: 25px;
                    padding-top: 20px;
                    border-top: 2px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <button onclick="deleteUser('${userId}', '${(userData.email || "").replace(/'/g, "\\'")}')" style="
                        padding: 10px 18px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: bold;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    ">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg> Eliminar
                    </button>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="closeEditUserModal()" style="
                            padding: 10px 20px;
                            background: #6c757d;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancelar
                        </button>
                        <button onclick="saveUserChanges('${userId}')" style="
                            padding: 10px 20px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        `;

    document.getElementById("edit-user-content").innerHTML = html;
    document.getElementById("edit-user-modal").style.display = "block";
    updateChipsCount();
  } catch (error) {
    console.error("❌ Error abriendo modal de edición:", error);
    showNotification("❌ Error cargando datos del usuario", "danger");
  }
}

// Actualizar contador de chips seleccionados
function updateChipsCount() {
  const allChips = document.querySelectorAll(
    '#edit-user-content input[type="checkbox"]'
  );
  const checkedChips = document.querySelectorAll(
    '#edit-user-content input[type="checkbox"]:checked'
  );

  const countElement = document.getElementById("chips-count");
  if (countElement) {
    countElement.textContent = `${checkedChips.length}/${allChips.length}`;
  }
}

// Cerrar modal de edición
function closeEditUserModal() {
  document.getElementById("edit-user-modal").style.display = "none";
  document.getElementById("edit-user-content").innerHTML = "";
}

// Eliminar usuario (borra su registro de la base de datos)
async function deleteUser(userId, email) {
  const ok = confirm(
    `¿Eliminar al usuario ${email || userId}?\n\n` +
      `La cuenta quedará bloqueada: si intenta entrar verá "Cuenta borrada" y no podrá acceder. ` +
      `Se le quitan todos los permisos.`
  );
  if (!ok) return;
  try {
    showToast("⏳ Bloqueando cuenta...", "info");
    // No se puede borrar la cuenta de Auth desde el cliente (plan gratuito),
    // así que se marca como borrada; el login la rechaza y la expulsa.
    await database.ref("users/" + userId).update({
      deleted: true,
      status: "deleted",
      chips: {},
      deletedAt: new Date().toISOString(),
      deletedBy: auth.currentUser ? auth.currentUser.email : "admin"
    });
    closeEditUserModal();
    showToast(`🗑️ Usuario eliminado: ${email || userId}`, "success");

    // Si el admin se eliminó a sí mismo, cerrar su sesión
    if (auth.currentUser && userId === auth.currentUser.uid) {
      await auth.signOut();
      showLoginScreen();
      return;
    }
    await loadAdminData();
  } catch (error) {
    console.error("❌ Error eliminando usuario:", error);
    showToast("❌ No se pudo eliminar: " + error.message, "danger");
  }
}

// Guardar cambios del usuario
async function saveUserChanges(userId) {
  try {
    showToast("⏳ Guardando cambios...", "info");
    const role = document.getElementById("edit-user-role").value;
    const status = document.getElementById("edit-user-status").value;

    // Obtener todos los chips seleccionados
    const checkboxes = document.querySelectorAll(
      '#edit-user-content input[type="checkbox"]'
    );
    const updatedChips = {};

    checkboxes.forEach((checkbox) => {
      const chipId = checkbox.id.replace("chip-", "");
      updatedChips[chipId] = checkbox.checked;
    });

    // Actualizar en Firebase
    const updates = {
      role: role,
      status: status,
      chips: updatedChips,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser.email
    };

    await database.ref("users/" + userId).update(updates);

    closeEditUserModal();
    showToast(`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Usuario actualizado`, "success");

    // Recargar datos de admin
    await loadAdminData();

    // Si es el usuario actual, recargar permisos
    if (userId === auth.currentUser.uid) {
      await getUserPermissions();
      checkAdminStatus();
      updateUI();
    }
  } catch (error) {
    console.error("❌ Error guardando cambios:", error);
    showNotification("❌ Error al guardar cambios", "danger");
  }
}

// Exportar datos de usuarios
async function exportUsersData() {
  try {
    const usersSnapshot = await database.ref("users").once("value");
    const users = usersSnapshot.val();

    if (!users) {
      showNotification("❌ No hay datos para exportar", "warning");
      return;
    }

    // Crear CSV
    let csv =
      "ID,Email,Nombre,Rol,Estado,Última Conexión,Chips Totales,Chips Autorizados\n";

    Object.entries(users).forEach(([uid, user]) => {
      const chips = user.chips || {};
      const chipsWithAccess = Object.keys(chips).filter(
        (chipId) => chips[chipId] === true
      ).length;
      const totalChips = Object.keys(chips).length;

      csv += `"${uid}","${user.email || ""}","${user.displayName || ""}","${
        user.role || ""
      }","${user.status || ""}","${
        user.lastLogin || ""
      }",${totalChips},${chipsWithAccess}\n`;
    });

    // Descargar archivo - VERSIÓN CORREGIDA
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usuarios_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    showNotification("📊 Datos exportados correctamente", "success");
  } catch (error) {
    console.error("❌ Error exportando datos:", error);
    showNotification("❌ Error al exportar datos", "danger");
  }
}

// ==================== NAVEGACIÓN ====================

// También actualizar getUserPermissions para llamar a checkAdminStatus:
async function getUserPermissions() {
  if (!auth.currentUser) {
    console.log("🔒 Usuario no autenticado");
    return {};
  }

  try {
    const userRef = database.ref("users/" + auth.currentUser.uid);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    // Guardar userData globalmente
    window.userData = userData;

    if (userData && userData.chips) {
      userPermissions = userData.chips;
      console.log(
        "✅ Permisos del usuario cargados. Rol:",
        userData.role || "user"
      );

      // Verificar estado de admin
      checkAdminStatus(); // <-- AGREGAR ESTA LÍNEA

      return userPermissions;
    }
    return {};
  } catch (error) {
    console.error("❌ Error obteniendo permisos:", error);
    return {};
  }
}

// ==================== EVENTOS DEL SISTEMA (SOLO ADMIN) ====================

function loadEventosData() {
  const container = document.getElementById("eventos-content");
  if (!container) return;

  const totalEventsInMemory = Object.values(allEvents).reduce(
    (total, chipEvents) => total + (chipEvents?.length || 0),
    0
  );
  const eventsShown = currentData.length;

  let html = `
    <div class="sismo-stats-grid" style="margin-bottom: 20px;">
      <div class="sismo-stat-card">
        <div class="sismo-stat-header">
          <div class="sismo-stat-icon" style="background: rgba(14,165,233,0.12);">
            <svg viewBox="0 0 24 24" stroke="#0ea5e9"><rect x="5" y="2" width="14" height="20" rx="2"/></svg>
          </div>
          <span class="sismo-stat-label">Eventos visibles</span>
        </div>
        <div class="sismo-stat-value" style="color: var(--text-primary);">${eventsShown}</div>
        <div class="sismo-stat-sub" style="color: var(--text-secondary);">
          ${showAllEvents ? 'Todos cargados' : 'Últimos ' + EVENTS_PER_LOAD}
        </div>
      </div>
      <div class="sismo-stat-card">
        <div class="sismo-stat-header">
          <div class="sismo-stat-icon" style="background: rgba(34,197,94,0.12);">
            <svg viewBox="0 0 24 24" stroke="#22c55e"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7z"/></svg>
          </div>
          <span class="sismo-stat-label">En memoria</span>
        </div>
        <div class="sismo-stat-value" style="color: var(--green);">${totalEventsInMemory}</div>
        <div class="sismo-stat-sub" style="color: var(--text-secondary);">Eventos cargados</div>
      </div>
      <div class="sismo-stat-card">
        <div class="sismo-stat-header">
          <div class="sismo-stat-icon" style="background: rgba(245,158,11,0.12);">
            <svg viewBox="0 0 24 24" stroke="#f59e0b"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span class="sismo-stat-label">Modo</span>
        </div>
        <div class="sismo-stat-value" style="color: ${showAllEvents ? 'var(--amber)' : 'var(--green)'}; font-size: 16px;">
          ${showAllEvents ? 'COMPLETA' : 'RECIENTE'}
        </div>
        <div class="sismo-stat-sub" style="color: var(--text-secondary);">Clic para cambiar</div>
      </div>
    </div>

    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 15px;
      background: var(--bg-card);
      border-radius: 12px;
      border: 1px solid var(--border-color);
      border-left: 4px solid var(--teal);
    ">
      <div>
        <div style="font-size: 15px; font-weight: 500; color: var(--text-primary);">
          Eventos del sistema
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">
          ${showAllEvents
            ? "Mostrando todos los eventos"
            : 'Mostrando últimos ' + EVENTS_PER_LOAD + ' eventos por dispositivo'}
        </div>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-success" onclick="toggleViewMode(); loadEventosData();" style="font-size: 12px;">
          ${showAllEvents ? "Ver recientes" : "Ver todos"}
        </button>
        <button class="btn btn-primary" onclick="loadAlarmData(true).then(() => loadEventosData());" style="font-size: 12px;"
          ${showAllEvents ? "disabled" : ""}>
          Cargar más
        </button>
        <button class="btn btn-warning" onclick="refreshEvents(); setTimeout(() => loadEventosData(), 1000);" style="font-size: 12px;">
          Actualizar
        </button>
      </div>
    </div>
  `;

  if (currentData.length === 0) {
    html += '<div style="text-align: center; padding: 40px 20px; color: var(--text-muted);"><div style="font-size: 40px; margin-bottom: 12px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg></div><div style="font-size: 15px;">No hay eventos en el sistema</div></div>';
  } else {
    html += '<div style="max-height: 500px; overflow-y: auto; padding-right: 5px;">';

    currentData.forEach((event) => {
      const eventName = getEventDisplayName(event.event_type);
      const isActive = Boolean(event.event_value);
      const eventColor = isActive ? "var(--red)" : "var(--green)";
      const chipName = event.device_id || "Desconocido";
      const adminHasAccess = userPermissions[chipName] === true;

      html += `
        <div style="
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          padding: 14px;
          margin-bottom: 10px;
          border-radius: 10px;
          border-left: 4px solid ${adminHasAccess ? eventColor : 'var(--gray-accent)'};
          cursor: pointer;
          transition: transform 0.2s;
        "
        onmouseover="this.style.transform='translateX(4px)'"
        onmouseout="this.style.transform='translateX(0)'"
        onclick="showEventDetails('${event.id}')">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                <strong style="color: var(--text-primary); font-size: 14px;">${eventName}</strong>
                <span class="sismo-badge ${isActive ? 'alarm' : 'armed'}" style="font-size: 10px;">
                  ${isActive ? "ACTIVADO" : "DESACTIVADO"}
                </span>
                ${adminHasAccess
                  ? '<span style="font-size: 10px; color: var(--green); background: rgba(34,197,94,0.1); padding: 2px 8px; border-radius: 8px;">ACCESO</span>'
                  : '<span style="font-size: 10px; color: var(--text-muted); background: var(--bg-inset); padding: 2px 8px; border-radius: 8px;">SOLO VISTA</span>'}
              </div>
              <div style="font-size: 12px; color: var(--text-muted);">
                ${event.message || "Evento del sistema"}
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0; margin-left: 12px;">
              <div style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">
                ${formatTimestamp(event.timestamp)}
              </div>
              <div style="font-size: 11px; color: ${adminHasAccess ? 'var(--green)' : 'var(--text-muted)'}; margin-top: 3px;">
                ${chipName}
              </div>
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';

    html += `
      <div style="
        margin-top: 14px;
        padding: 12px;
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        font-size: 12px;
        color: var(--text-muted);
        display: flex;
        justify-content: space-between;
      ">
        <span>Mostrando ${currentData.length} eventos ${showAllEvents ? '(todos)' : '(últimos ' + EVENTS_PER_LOAD + ' por dispositivo)'}</span>
        <span>Total en memoria: <strong style="color: var(--text-primary);">${totalEventsInMemory}</strong></span>
      </div>
    `;
  }

  container.innerHTML = html;
}

// Agregar al final de tu código JavaScript, después de window.onclick:
window.onclick = function (event) {
  const modal = document.getElementById("control-modal");
  if (event.target == modal) {
    closeControlModal();
  }

  const editUserModal = document.getElementById("edit-user-modal");
  if (event.target == editUserModal) {
    closeEditUserModal();
  }

  const createUserModal = document.getElementById("create-user-modal");
  if (event.target == createUserModal) {
    closeCreateUserModal();
  }
};

// También puedes agregar tecla ESC para cerrar modales:
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeControlModal();
    closeEditUserModal();
    closeCreateUserModal();
  }
});

// ==================== CREAR USUARIO (SOLO ADMIN) ====================

// App secundaria de Firebase: crea al usuario SIN cerrar la sesión del admin.
// (Con el plan gratuito no hay Cloud Functions, así que se hace desde el cliente.)
let _userCreatorApp = null;
function getUserCreatorApp() {
  if (_userCreatorApp) return _userCreatorApp;
  const existing = firebase.apps.find((a) => a.name === "userCreator");
  _userCreatorApp =
    existing || firebase.initializeApp(FIREBASE_CONFIG, "userCreator");
  return _userCreatorApp;
}

async function openCreateUserModal() {
  const modal = document.getElementById("create-user-modal");
  document.getElementById("create-user-content").innerHTML =
    '<div style="text-align:center; padding:30px; color: var(--text-muted);">Cargando...</div>';
  modal.style.display = "block";

  // Cargar dispositivos para los permisos de chips
  let _devices = {};
  try {
    const _snap = await database.ref("devices").once("value");
    _devices = _snap.val() || {};
  } catch (e) {
    console.error("Error cargando dispositivos:", e);
  }
  const _allChipIds = Object.keys(_devices);

  let chipsHtml = "";
  if (_allChipIds.length === 0) {
    chipsHtml =
      '<div style="text-align:center; padding:16px; color: var(--text-muted); font-size:13px;">No hay dispositivos en el sistema.</div>';
  } else {
    chipsHtml =
      '<div style="max-height:200px; overflow-y:auto; border:1px solid var(--border-color); border-radius:10px; padding:12px; background: var(--bg-inset); display:grid; gap:10px;">';
    _allChipIds.forEach((chipId) => {
      const device = _devices[chipId];
      const deviceName = (device && device.name) || chipId;
      chipsHtml +=
        '<div class="chip-toggle">' +
        '<label class="toggle-switch">' +
        '<input type="checkbox" id="create-chip-' +
        chipId +
        '" onchange="updateCreateChipsCount()">' +
        '<span class="toggle-slider"></span>' +
        "</label>" +
        "<div>" +
        '<div style="font-weight:500; color: var(--text-primary);">' +
        deviceName +
        "</div>" +
        '<div style="font-size:11px; color: var(--text-muted);">ID: ' +
        chipId +
        "</div>" +
        "</div>" +
        "</div>";
    });
    chipsHtml += "</div>";
  }

  const inputStyle =
    "width: 100%; padding: 11px 12px; border: 1px solid var(--border-color); border-radius: 10px; font-size: 14px; background: var(--bg-inset); color: var(--text-primary); box-sizing: border-box; font-family: inherit;";
  const labelStyle =
    "display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-primary); font-size: 13px;";

  document.getElementById("create-user-content").innerHTML = `
    <div style="margin-bottom: 18px;">
      <label style="${labelStyle}">Email *</label>
      <input type="email" id="create-user-email" placeholder="usuario@ejemplo.com" autocomplete="off" style="${inputStyle}">
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
      <div>
        <label style="${labelStyle}">Contraseña *</label>
        <input type="password" id="create-user-password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" style="${inputStyle}">
      </div>
      <div>
        <label style="${labelStyle}">Confirmar contraseña *</label>
        <input type="password" id="create-user-password2" placeholder="Repite la contraseña" autocomplete="new-password" style="${inputStyle}">
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
      <div>
        <label style="${labelStyle}">Nombre</label>
        <input type="text" id="create-user-name" placeholder="Nombre a mostrar" style="${inputStyle}">
      </div>
      <div>
        <label style="${labelStyle}">Teléfono</label>
        <input type="text" id="create-user-phone" placeholder="+58..." style="${inputStyle}">
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
      <div>
        <label style="${labelStyle}">Rol</label>
        <select id="create-user-role" style="${inputStyle}">
          <option value="user" selected>Usuario</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <div>
        <label style="${labelStyle}">Estado</label>
        <select id="create-user-status" style="${inputStyle}">
          <option value="active" selected>Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>
    </div>
    <div style="margin-bottom: 20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <label style="${labelStyle} margin-bottom:0;">Permisos de dispositivos</label>
        <span style="font-size:12px; color: var(--text-muted);"><span id="create-chips-count">0/${_allChipIds.length}</span> seleccionados</span>
      </div>
      ${chipsHtml}
    </div>
    <div id="create-user-error" style="display: none; color: var(--red); font-size: 13px; margin-bottom: 14px;"></div>
    <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-color); padding-top: 18px;">
      <button onclick="closeCreateUserModal()" style="padding: 10px 20px; background: var(--bg-inset); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 10px; cursor: pointer; font-weight: 600; font-family: inherit;">Cancelar</button>
      <button id="create-user-submit" onclick="submitCreateUser()" style="padding: 10px 20px; background: linear-gradient(135deg, var(--teal), var(--blue)); color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-family: inherit;">Crear Usuario</button>
    </div>
  `;
  document.getElementById("create-user-modal").style.display = "block";
  setTimeout(() => document.getElementById("create-user-email")?.focus(), 50);
}

function closeCreateUserModal() {
  const modal = document.getElementById("create-user-modal");
  if (modal) modal.style.display = "none";
  const content = document.getElementById("create-user-content");
  if (content) content.innerHTML = "";
}

function showCreateUserError(msg) {
  const el = document.getElementById("create-user-error");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  }
}

// Actualizar contador de chips seleccionados en el modal de creación
function updateCreateChipsCount() {
  const all = document.querySelectorAll(
    '#create-user-content input[id^="create-chip-"]'
  );
  const checked = document.querySelectorAll(
    '#create-user-content input[id^="create-chip-"]:checked'
  );
  const el = document.getElementById("create-chips-count");
  if (el) el.textContent = `${checked.length}/${all.length}`;
}

async function submitCreateUser() {
  const email = document.getElementById("create-user-email").value.trim();
  const password = document.getElementById("create-user-password").value;
  const password2 = document.getElementById("create-user-password2").value;
  const displayName = document.getElementById("create-user-name").value.trim();
  const phone = document.getElementById("create-user-phone").value.trim();
  const role = document.getElementById("create-user-role").value;
  const status = document.getElementById("create-user-status").value;

  // Validaciones
  if (!email || !password || !password2) {
    showToast("❌ Completa email y contraseña.", "danger");
    return;
  }
  if (password.length < 6) {
    showToast("❌ La contraseña debe tener al menos 6 caracteres.", "danger");
    return;
  }
  if (password !== password2) {
    showToast("❌ Las contraseñas no coinciden.", "danger");
    return;
  }

  const btn = document.getElementById("create-user-submit");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.style.opacity = "0.7";
  btn.textContent = "Creando...";

  try {
    showToast("⏳ Creando usuario...", "info");
    // 1) Crear la cuenta en una app secundaria para no desconectar al admin
    const secondary = getUserCreatorApp();
    const cred = await secondary
      .auth()
      .createUserWithEmailAndPassword(email, password);
    const newUid = cred.user.uid;

    if (displayName) {
      try {
        await cred.user.updateProfile({ displayName });
      } catch (_) {}
    }

    // 2) Escribir el registro en la BD con la sesión del admin (misma estructura que el auto-registro)
    const chipCheckboxes = document.querySelectorAll(
      '#create-user-content input[id^="create-chip-"]'
    );
    const chipsPermissions = {};
    chipCheckboxes.forEach((cb) => {
      const chipId = cb.id.replace("create-chip-", "");
      chipsPermissions[chipId] = cb.checked;
    });

    const now = new Date().toISOString();
    await database.ref("users/" + newUid).set({
      email: email,
      displayName: displayName || "",
      phone: phone || "",
      createdAt: now,
      loginCount: 0,
      role: role,
      status: status,
      provider: "email/password",
      chips: chipsPermissions,
      createdBy: auth.currentUser ? auth.currentUser.email : "admin"
    });

    // 3) Cerrar la sesión de la app secundaria (el admin sigue conectado en la principal)
    await secondary.auth().signOut();

    closeCreateUserModal();
    showToast(
      `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Usuario creado: ${email}`,
      "success"
    );
    await loadAdminData();
  } catch (error) {
    console.error("❌ Error creando usuario:", error);

    // Caso especial: el email ya existe en Firebase Auth.
    if (error.code === "auth/email-already-in-use") {
      try {
        // ¿Corresponde a una cuenta bloqueada por eliminación? Si sí, reactivar.
        const usersSnap = await database.ref("users").once("value");
        const allUsers = usersSnap.val() || {};
        const match = Object.entries(allUsers).find(
          ([, u]) => (u.email || "").toLowerCase() === email.toLowerCase()
        );

        if (
          match &&
          (match[1].deleted === true || match[1].status === "deleted")
        ) {
          const uid = match[0];
          const chipCheckboxes = document.querySelectorAll(
            '#create-user-content input[id^="create-chip-"]'
          );
          const chipsPermissions = {};
          chipCheckboxes.forEach((cb) => {
            chipsPermissions[cb.id.replace("create-chip-", "")] = cb.checked;
          });

          // Reactivar (mantiene su contraseña anterior; la cuenta de Auth ya existe)
          await database.ref("users/" + uid).update({
            deleted: false,
            status: status,
            role: role,
            displayName: displayName || match[1].displayName || "",
            phone: phone || match[1].phone || "",
            chips: chipsPermissions,
            reactivatedAt: new Date().toISOString(),
            reactivatedBy: auth.currentUser ? auth.currentUser.email : "admin"
          });

          closeCreateUserModal();
          showToast(
            `♻️ Usuario reactivado: ${email} (mantiene su contraseña anterior)`,
            "success"
          );
          await loadAdminData();
          return;
        }

        // Email en uso por una cuenta activa → mensaje normal, arriba
        showToast("❌ Ese email ya está registrado.", "danger");
      } catch (lookupError) {
        console.error("Error verificando el email:", lookupError);
        showToast("❌ Ese email ya está registrado.", "danger");
      }
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.textContent = originalText;
      }
      return;
    }

    // Otros errores → notificación arriba
    const map = {
      "auth/invalid-email": "El email no es válido.",
      "auth/weak-password": "La contraseña es demasiado débil (mínimo 6 caracteres).",
      "auth/operation-not-allowed":
        "El registro con email/contraseña está deshabilitado en Firebase."
    };
    showToast(
      "❌ " + (map[error.code] || error.message || "No se pudo crear el usuario."),
      "danger"
    );
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = originalText;
    }
  }
}

// ==================== GESTIÓN DE NODOS (SOLO ADMIN) ====================

// Cache de configuración de chips
window._chipZones = {};
window._chipEnabled = {};

// Cargar configuración de todos los chips
async function loadChipConfigs() {
  try {
    const snap = await database.ref("devices").once("value");
    if (!snap.exists()) return;
    window._chipZones = {};
    window._chipEnabled = {};
    const devices = snap.val();
    for (const chipId in devices) {
      const device = devices[chipId];
      window._chipEnabled[chipId] = device.enabled !== false;
      window._chipZones[chipId] = device.zones || {};
    }
  } catch (e) {
    console.error("Error cargando configs de chips:", e);
  }
}

// Obtener nombre de zona (devuelve nombre custom o CX por defecto)
function getZoneName(chipId, zoneId) {
  const zones = window._chipZones?.[chipId];
  if (zones && zones[zoneId]?.name) return zones[zoneId].name;
  return zoneId.toUpperCase();
}

// Verificar si una zona está habilitada
function isZoneEnabled(chipId, zoneId) {
  const zones = window._chipZones?.[chipId];
  if (!zones || !zones[zoneId]) return true;
  return zones[zoneId].enabled !== false;
}

// Verificar si un chip está habilitado
function isChipEnabled(chipId) {
  if (!window._chipEnabled || window._chipEnabled[chipId] === undefined) return true;
  return window._chipEnabled[chipId] !== false;
}

// Abrir modal para editar un nodo/chip
async function openEditNodeModal(chipId) {
  let config;
  try {
    const snap = await database.ref(`devices/${chipId}`).once("value");
    if (!snap.exists()) { showNotification('<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Dispositivo no encontrado', "danger"); return; }
    const data = snap.val();
    config = {
      name: data.name || chipId,
      enabled: data.enabled !== false,
      zones: data.zones || {},
      rssi: data.rssi || -90,
      ip: data.ip_address || 'N/A',
    };
  } catch (e) {
    showNotification("❌ Error cargando dispositivo", "danger");
    return;
  }

  const defaultZones = {};
  for (let i = 1; i <= 5; i++) {
    const zId = `c${i}`;
    defaultZones[zId] = {
      name: config.zones[zId]?.name || `Zona ${i}`,
      enabled: config.zones[zId]?.enabled !== false,
    };
  }

  const modal = document.getElementById("edit-user-modal");
  const content = document.getElementById("edit-user-content");
  const modalTitle = modal.querySelector(".modal-header h2");
  if (modalTitle) modalTitle.textContent = "Configurar Nodo";

  let html = `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg, var(--teal), var(--blue)); display: flex; align-items: center; justify-content: center; font-size: 24px; color: white;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 0118 0"/><path d="M5 12a7 7 0 0114 0"/><path d="M8 12a4 4 0 018 0"/><circle cx="12" cy="12" r="1"/></svg></div>
        <div>
          <h3 style="margin: 0 0 4px 0; color: var(--text-primary); font-size: 18px;">${config.name}</h3>
          <div style="color: var(--text-muted); font-size: 12px; font-family: monospace;">${chipId}</div>
          <div style="font-size: 11px; color: var(--text-faint); margin-top: 2px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg> ${config.rssi} dBm | <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${config.ip}</div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-primary); font-size: 14px;">Nombre del dispositivo</label>
        <input type="text" id="node-name-input" value="${config.name}" placeholder="Ej: Casa Principal" style="width: 100%; padding: 12px; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 10px; font-size: 14px; background: var(--bg-inset); color: var(--text-primary); font-family: inherit;">
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; margin-bottom: 20px; background: var(--bg-inset); border-radius: 10px; border: 1px solid var(--border-color);">
        <div>
          <div style="font-weight: 500; color: var(--text-primary); font-size: 14px;">Dispositivo habilitado</div>
          <div style="font-size: 12px; color: var(--text-muted);">Si lo desactivas, no aparecerá en el dashboard</div>
        </div>
        <label class="toggle-switch"><input type="checkbox" id="node-enabled-toggle" ${config.enabled ? 'checked' : ''}><span class="toggle-slider"></span></label>
      </div>

      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <label style="font-weight: 500; color: var(--text-primary); font-size: 15px;">Configuración de Zonas</label>
          <span style="font-size: 12px; color: var(--text-muted);">5 zonas</span>
        </div>
        <div style="border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden; background: var(--bg-inset);">
  `;

  for (let i = 1; i <= 5; i++) {
    const zId = `c${i}`;
    const zone = defaultZones[zId];
    html += `
      <div style="padding: 14px 16px; display: flex; align-items: center; gap: 12px; ${i < 5 ? 'border-bottom: 1px solid var(--border-color);' : ''}">
        <div style="width: 36px; height: 36px; border-radius: 8px; background: ${zone.enabled ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)'}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: ${zone.enabled ? 'var(--green)' : 'var(--text-muted)'}; flex-shrink: 0;">${zId.toUpperCase()}</div>
        <div style="flex: 1;">
          <input type="text" id="zone-name-${zId}" value="${zone.name}" placeholder="Nombre zona ${i}" style="width: 100%; padding: 8px 10px; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px; background: var(--bg-card); color: var(--text-primary); font-family: inherit;">
        </div>
        <label class="toggle-switch" style="flex-shrink: 0;"><input type="checkbox" id="zone-enabled-${zId}" ${zone.enabled ? 'checked' : ''}><span class="toggle-slider"></span></label>
      </div>
    `;
  }

  html += `
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid var(--border-color);">
        <div style="font-size: 12px; color: var(--text-muted);">Los cambios se aplican inmediatamente</div>
        <div style="display: flex; gap: 10px;">
          <button onclick="closeEditUserModal()" class="btn btn-secondary" style="padding: 10px 20px;">Cancelar</button>
          <button onclick="saveNodeConfig('${chipId}')" class="btn btn-success" style="padding: 10px 20px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar</button>
        </div>
      </div>
    </div>
  `;

  content.innerHTML = html;
  modal.style.display = "block";
}

// Guardar configuración del nodo
async function saveNodeConfig(chipId) {
  try {
    showToast("⏳ Guardando configuración...", "info");
    const name = document.getElementById("node-name-input").value.trim() || chipId;
    const enabled = document.getElementById("node-enabled-toggle").checked;
    const zones = {};
    for (let i = 1; i <= 5; i++) {
      const zId = `c${i}`;
      zones[zId] = {
        name: document.getElementById(`zone-name-${zId}`).value.trim() || `Zona ${i}`,
        enabled: document.getElementById(`zone-enabled-${zId}`).checked,
      };
    }
    await database.ref(`devices/${chipId}`).update({ name, enabled, zones });
    window._chipEnabled[chipId] = enabled;
    window._chipZones[chipId] = zones;
    closeEditUserModal();
    showToast(`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${name} guardado`, "success");
    await loadDevicesState();
    await loadChipConfigs();
    updateUI();
    if (document.getElementById("admin-section").style.display !== "none") loadAdminData();
  } catch (e) {
    console.error("Error guardando config:", e);
    showNotification("❌ Error al guardar configuración", "danger");
  }
}

// Renderizar sección de nodos para admin
function renderNodesSection() {
  const enabledMap = window._chipEnabled || {};
  const zonesMap = window._chipZones || {};
  const chipIds = Object.keys(enabledMap);
  if (chipIds.length === 0) {
    return '<div style="text-align: center; padding: 30px; color: var(--text-muted);"><div style="font-size: 36px; margin-bottom: 10px;"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 0118 0"/><path d="M5 12a7 7 0 0114 0"/><path d="M8 12a4 4 0 018 0"/><circle cx="12" cy="12" r="1"/></svg></div><div>No hay nodos registrados</div></div>';
  }
  let html = '<div style="display: grid; gap: 10px;">';
  chipIds.forEach(chipId => {
    const enabled = enabledMap[chipId] !== false;
    const chipZones = zonesMap[chipId] || {};
    const device = devicesState[chipId] || {};
    const chipName = device.name || chipId;
    let zonasHab = 0;
    for (let i = 1; i <= 5; i++) { if (chipZones[`c${i}`]?.enabled !== false) zonasHab++; }
    const conectado = device.lastSeen && (Date.now() - device.lastSeen) < 300000;
    html += `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; opacity: ${enabled ? '1' : '0.5'}; cursor: pointer; transition: transform 0.2s;"
        onclick="openEditNodeModal('${chipId}')" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: ${enabled ? 'linear-gradient(135deg, var(--teal), var(--blue))' : 'var(--bg-inset)'}; display: flex; align-items: center; justify-content: center; font-size: 20px;">${enabled ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a10 10 0 0118 0"/><path d="M5 12a7 7 0 0114 0"/><path d="M8 12a4 4 0 018 0"/><circle cx="12" cy="12" r="1"/></svg>' : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'}</div>
          <div>
            <div style="font-weight: 500; color: var(--text-primary); font-size: 14px;">${chipName} ${!enabled ? '<span style="color: var(--red); font-size: 11px; margin-left: 6px;">DESHABILITADO</span>' : ''}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${chipId}</div>
            <div style="font-size: 11px; color: var(--text-faint); margin-top: 2px;">${zonasHab}/5 zonas activas <span style="margin-left: 8px; color: ${conectado ? 'var(--green)' : 'var(--text-faint)'};">${conectado ? '● Online' : '● Offline'}</span></div>
          </div>
        </div>
        <div style="color: var(--text-muted); font-size: 18px;">›</div>
      </div>
    `;
  });
  html += '</div>';
  return html;
}