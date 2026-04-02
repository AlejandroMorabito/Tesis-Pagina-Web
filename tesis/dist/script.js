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
  // Limpiar campos
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
}

function showMainContent() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("main-content").style.display = "block";
}

// ==================== OBTENER PERMISOS DE USUARIO ====================

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
      return userPermissions;
    }
    return {};
  } catch (error) {
    console.error("❌ Error obteniendo permisos:", error);
    return {};
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
    showNotification("🔒 No tienes acceso a ningún dispositivo", "warning");
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
        if (eventData.event_type.includes("alarma")) icon = "🚨";
        else if (eventData.event_type.includes("armado")) icon = "🛡️";
        else if (eventData.event_type.includes("sensores")) icon = "🔔";

        showNotification(
          `${icon} ${chipId}: ${eventName} - ${state}`,
          eventType
        );

        // Actualizar UI
        updateUI();
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
        "🔍 Cambios detectados:",
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
  devicesListener = (snapshot) => {
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
        showNotification(`🚨 ${chipId}: ALARMA ACTIVADA`, "danger");
      } else if (deviceData.state.any_intrusion) {
        showNotification(`⚠️ ${chipId}: INTRUSIÓN DETECTADA`, "warning");
      }

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

    // 3. Iniciar listeners en tiempo real
    startRealtimeListeners();

    // 4. Mostrar dashboard por defecto
    showSection("dashboard");

    // Configurar actualización automática cada 15 segundos
    setInterval(async () => {
      if (auth.currentUser) {
        await getUserPermissions(); // Actualizar permisos
        await loadDevicesState();
        await loadAlarmData(); // Recargar eventos filtrados
        updateUI();
      }
    }, 15000);

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
  buttonText.textContent = "⏳ Autenticando...";

  try {
    // Autenticar con Firebase
    const userCredential = await auth.signInWithEmailAndPassword(
      email,
      password
    );
    const user = userCredential.user;

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

    // Actualizar info del usuario - VERSIÓN MEJORADA
    const userEmailElement = document.getElementById("user-email");
    const userDisplayName = user.displayName || user.email.split("@")[0];

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
    userContainer.title = "👤 Haz clic para ver tu perfil completo";

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
    buttonText.textContent = "🔑 Iniciar Sesión";
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
    (user) => {
      if (user) {
        // Usuario autenticado
        console.log("✅ Usuario autenticado:", user.email);
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
        userContainer.title = "👤 Ver mi perfil";
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
function getEventDisplayName(eventType) {
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
    showNotification("🔒 Debes iniciar sesión para ver tu perfil", "warning");
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
                      ? '<span style="font-size: 16px; margin-left: 8px;">👑</span>'
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
                  ${userRole === "admin" ? "👑 ADMINISTRADOR" : "👤 USUARIO"}
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
                  💾 Guardar
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
                  ❌ Cancelar
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
                  ✏️ Editar Perfil
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
                ">👤</span>
                Información Personal
              </h3>
              
              <div style="display: grid; gap: 15px;">
                <!-- Teléfono -->
                <div>
                  <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">📱 TELÉFONO</div>
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
                  <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">📊 ESTADO</div>
                  <div style="font-size: 14px; color: ${
                    userStatus === "active" ? "#4cd964" : "#dc3545"
                  }; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                    <span>${userStatus === "active" ? "🟢" : "🔴"}</span> 
                    ${userStatus === "active" ? "ACTIVO" : "INACTIVO"}
                  </div>
                </div>
                
                <!-- Última conexión -->
                <div>
                  <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">🕒 ÚLTIMA CONEXIÓN</div>
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
                ">📱</span>
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
                      <span>✅</span> Acceso autorizado
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
                      <span>📋</span> Total en sistema
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
                      <div style="font-size: 36px; margin-bottom: 10px;">🔒</div>
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
                                  📱
                                </div>
                                <div style="flex: 1;">
                                  <div style="font-size: 14px; color: white; font-weight: 600; margin-bottom: 2px;">
                                    ${deviceName}
                                  </div>
                                  <div style="font-size: 11px; color: #aaa; display: flex; align-items: center; gap: 5px;">
                                    <span>🔑</span> ${chipId}
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
                      <span style="font-size: 12px;">💡</span>
                      <span>Haz clic en cualquier dispositivo para controlarlo</span>
                    </div>
                  </div>
                `
                    : ""
                }
              </div>
            </div>

            <!-- Información de cuenta -->
            <div style="
              background: rgba(255,255,255,0.05);
              border-radius: 15px;
              padding: 15px;
              border-left: 4px solid #667eea;
            ">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
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
                ">🔑</div>
                <div>
                  <div style="font-size: 12px; color: #aaa; font-weight: 500;">ID DE USUARIO</div>
                  <div style="font-size: 10px; color: white; font-family: 'Courier New', monospace; letter-spacing: 0.5px; word-break: break-all;">
                    ${auth.currentUser.uid}
                  </div>
                </div>
              </div>
              <div style="font-size: 11px; color: #777; text-align: center;">
                Este ID es único para tu cuenta en el sistema
              </div>
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
function showNotification(message, type = "info") {
  // Agregar prefijo de usuario si está autenticado
  const userPrefix = auth.currentUser
    ? `[${auth.currentUser.email.split("@")[0]}] `
    : "";
  const fullMessage = userPrefix + message;

  const colors = {
    info: "#3498db",
    warning: "#ffc107",
    danger: "#dc3545",
    success: "#28a745"
  };

  // Eliminar notificaciones anteriores
  const oldNotifications = document.querySelectorAll(".auto-notification");
  oldNotifications.forEach((notif) => {
    if (notif.style.opacity !== "0") {
      notif.style.opacity = "0";
      notif.style.transform = "translateX(100px)";
      setTimeout(() => notif.remove(), 300);
    }
  });

  const notification = document.createElement("div");
  notification.className = "auto-notification";
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-weight: bold;
        max-width: 350px;
        word-wrap: break-word;
        transition: all 0.3s ease;
        transform: translateX(0);
        opacity: 1;
    `;
  notification.textContent = fullMessage;
  document.body.appendChild(notification);

  // Auto-remover después de 4 segundos
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100px)";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
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
          `📊 Chip ${chipId}: ${
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
        `📊 Se cargaron los últimos ${EVENTS_PER_LOAD} eventos`,
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
        `🔐 Cargando ${authorizedChips.length} dispositivos autorizados`
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
    `📊 Modo cambiado: ${
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
}

// Actualizar Dashboard
function updateDashboard() {
  const displayElement = document.getElementById("data-display");
  if (!displayElement) return;

  // Verificar si el usuario es admin
  const isAdmin = userData?.role === "admin";

  // Obtener chips autorizados
  const authorizedChips = Object.keys(userPermissions).filter(
    (chipId) => userPermissions[chipId] === true
  );

  // Si no tiene acceso a ningún chip
  if (authorizedChips.length === 0) {
    displayElement.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: #666;">
        <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
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
            <span style="color: #ffc107;">⚠️</span>
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
  
  if (!isAdmin) {
    let html = `
      <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 16px; font-weight: 600;">📊 RESUMEN DE TUS DISPOSITIVOS</div>
          <div style="
            background: rgba(255,255,255,0.2);
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 12px;
            backdrop-filter: blur(10px);
          ">
            🏠 ${totalDispositivos} dispositivo(s) bajo tu control
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
    `;
    
    // Tarjeta 1: Dispositivos Totales
    html += `
      <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
        <div style="font-size: 14px; opacity: 0.9;">📱 DISPOSITIVOS</div>
        <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: #3498db;">
          ${totalDispositivos}
        </div>
        <div style="font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 5px;">
          <span style="color: ${dispositivosConectados === totalDispositivos ? '#4cd964' : '#ffc107'}">
            ${dispositivosConectados === totalDispositivos ? '🟢' : '⚠️'}
          </span>
          ${dispositivosConectados}/${totalDispositivos} conectados
        </div>
      </div>
    `;
    
    // Tarjeta 2: Alarmas Activas
    html += `
      <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
        <div style="font-size: 14px; opacity: 0.9;">🚨 ALARMAS</div>
        <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: ${alarmasActivas > 0 ? '#dc3545' : '#4cd964'}">
          ${alarmasActivas} ${alarmasActivas > 0 ? '🔴' : '🟢'}
        </div>
        <div style="font-size: 12px;">
          ${alarmasActivas > 0 ? '¡ATENCIÓN REQUERIDA!' : 'Todo en orden'}
        </div>
      </div>
    `;
    
    // Tarjeta 3: Sistemas Armados
    html += `
      <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
        <div style="font-size: 14px; opacity: 0.9;">🛡️ SISTEMAS</div>
        <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: ${sistemasArmados > 0 ? '#28a745' : '#6c757d'}">
          ${sistemasArmados} ${sistemasArmados > 0 ? '🔒' : '🔓'}
        </div>
        <div style="font-size: 12px;">
          ${sistemasArmados > 0 ? 'Vigilando' : 'Inactivos'}
        </div>
      </div>
    `;
    
    // Tarjeta 4: Cercos/Sensores
    html += `
      <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
        <div style="font-size: 14px; opacity: 0.9;">🔋 CERCOS</div>
        <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: ${sensoresActivos > 0 ? '#dc3545' : '#28a745'}">
          ${sensoresActivos}/${totalSensores}
        </div>
        <div style="font-size: 12px;">
          ${sensoresActivos > 0 ? `${sensoresActivos} activos` : 'Todos normales'}
        </div>
      </div>
    `;
    
    html += `
        </div>
      </div>
      
      <!-- Sección de estado detallado -->
      <div style="
        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        border-radius: 15px;
        padding: 25px;
        margin-bottom: 25px;
        border: 2px solid #e0e0e0;
      ">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: linear-gradient(135deg, #3498db, #2980b9);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
          ">
            📈
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 600; color: #333;">Estado Detallado del Sistema</div>
            <div style="font-size: 12px; color: #666;">Información en tiempo real de todos tus dispositivos</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
    `;
    
    // Detalles por dispositivo
    authorizedChips.forEach((chipId, index) => {
      const device = devicesState[chipId] || {};
      const sensors = sensorStates[chipId] || {};
      const deviceName = device.name || chipId;
      
      // Estado del dispositivo
      let estado = "DESCONOCIDO";
      let estadoColor = "#6c757d";
      let estadoIcon = "❓";
      
      if (device.alarm) {
        estado = "ALARMA";
        estadoColor = "#dc3545";
        estadoIcon = "🚨";
      } else if (device.intrusion) {
        estado = "INTRUSIÓN";
        estadoColor = "#ff9500";
        estadoIcon = "⚠️";
      } else if (device.armed) {
        estado = "ARMADO";
        estadoColor = "#28a745";
        estadoIcon = "🛡️";
      } else {
        estado = "DESARMADO";
        estadoColor = "#6c757d";
        estadoIcon = "🔓";
      }
      
      // Sensores activos
      const sensoresActivosChip = [1,2,3,4,5].filter(i => sensors[`c${i}`]).length;
      
      // Conexión
      const ultimaConexion = device.lastSeen || Date.now();
      const conectado = (ahora - ultimaConexion) < 300000;
      
      html += `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          border-left: 4px solid ${estadoColor};
          transition: transform 0.3s;
          cursor: pointer;
        " 
        onmouseover="this.style.transform='translateY(-5px)'" 
        onmouseout="this.style.transform='translateY(0)'"
        onclick="openControlForChip('${chipId}')"
        title="Haz clic para controlar ${deviceName}">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
            <div>
              <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 5px;">${deviceName}</div>
              <div style="font-size: 11px; color: #666; font-family: 'Courier New', monospace;">${chipId}</div>
            </div>
            <span style="
              background: ${estadoColor};
              color: white;
              padding: 4px 10px;
              border-radius: 15px;
              font-size: 11px;
              font-weight: bold;
              display: flex;
              align-items: center;
              gap: 5px;
            ">
              ${estadoIcon} ${estado}
            </span>
          </div>
          
          <div style="margin: 15px 0;">
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">📡 CONEXIÓN</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  background: ${conectado ? '#4cd964' : '#dc3545'};
                  box-shadow: 0 0 10px ${conectado ? '#4cd964' : '#dc3545'};
                "></span>
                <span style="font-size: 13px; color: ${conectado ? '#28a745' : '#dc3545'}; font-weight: 500;">
                  ${conectado ? 'CONECTADO' : 'DESCONECTADO'}
                </span>
              </div>
              <div style="font-size: 11px; color: #888;">
                ${formatTimestamp(ultimaConexion)}
              </div>
            </div>
          </div>
          
          <div style="margin: 15px 0;">
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">🔋 ESTADO DE CERCOS</div>
            <div style="display: flex; justify-content: space-between;">
              <div>
                <div style="font-size: 20px; font-weight: bold; color: ${sensoresActivosChip > 0 ? '#dc3545' : '#28a745'}">
                  ${sensoresActivosChip}/5
                </div>
                <div style="font-size: 11px; color: #666;">${sensoresActivosChip > 0 ? 'activados' : 'normales'}</div>
              </div>
              <div style="display: flex; gap: 3px;">
      `;
      
      // Mostrar estado de cada cerco (mini indicadores)
      for (let i = 1; i <= 5; i++) {
        const isActive = sensors[`c${i}`] || false;
        html += `
          <div style="
            width: 8px;
            height: 20px;
            background: ${isActive ? '#dc3545' : '#28a745'};
            border-radius: 2px;
            transition: all 0.2s;
          " title="Cerco ${i}: ${isActive ? 'ACTIVO' : 'NORMAL'}"></div>
        `;
      }
      
      html += `
              </div>
            </div>
          </div>
          
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="font-size: 11px; color: #666;">
                <span>📶</span> ${device.rssi || -90} dBm
              </div>
              <div style="font-size: 11px; color: #666;">
                <span>📍</span> ${device.ip || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
        
        <!-- Nota informativa -->
        <div style="
          margin-top: 25px;
          padding: 15px;
          background: ${alarmasActivas > 0 ? '#fff5f5' : '#e8f5e8'};
          border-radius: 10px;
          border-left: 4px solid ${alarmasActivas > 0 ? '#dc3545' : '#28a745'};
        ">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="
              width: 36px;
              height: 36px;
              border-radius: 8px;
              background: ${alarmasActivas > 0 ? '#dc3545' : '#28a745'};
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 18px;
              flex-shrink: 0;
            ">
              ${alarmasActivas > 0 ? '⚠️' : '✅'}
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #333; margin-bottom: 5px;">
                ${alarmasActivas > 0 ? '¡ATENCIÓN REQUERIDA!' : 'TODO EN ORDEN'}
              </div>
              <div style="font-size: 13px; color: #666;">
                ${alarmasActivas > 0 
                  ? `Tienes ${alarmasActivas} alarma(s) activa(s) que requieren atención inmediata.` 
                  : 'Todos tus dispositivos están funcionando correctamente y no hay alertas activas.'}
              </div>
              <div style="font-size: 11px; color: #888; margin-top: 8px;">
                💡 Haz clic en cualquier dispositivo para controlarlo directamente
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Información de eventos recientes (solo últimos 5) -->
      <div style="
        background: white;
        border-radius: 15px;
        padding: 25px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        border: 1px solid #e8e8e8;
      ">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: linear-gradient(135deg, #ffc107, #ff9800);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
          ">
            📝
          </div>
          <div>
            <div style="font-size: 18px; font-weight: 600; color: #333;">Eventos Recientes</div>
            <div style="font-size: 12px; color: #666;">Últimas actividades detectadas en tus dispositivos</div>
          </div>
        </div>
    `;
    
    // Mostrar últimos 5 eventos del usuario
    const eventosRecientes = currentData
      .filter(event => authorizedChips.includes(event.device_id))
      .slice(0, 5);
    
    if (eventosRecientes.length === 0) {
      html += `
        <div style="text-align: center; padding: 30px 20px; color: #666;">
          <div style="font-size: 36px; margin-bottom: 10px;">📭</div>
          <div style="font-size: 14px;">No hay eventos recientes</div>
          <div style="font-size: 12px; color: #888; margin-top: 5px;">
            Los eventos aparecerán aquí cuando ocurran
          </div>
        </div>
      `;
    } else {
      html += '<div style="max-height: 300px; overflow-y: auto; padding-right: 5px;">';
      
      eventosRecientes.forEach((event, index) => {
        const eventName = getEventDisplayName(event.event_type);
        const isActive = Boolean(event.event_value);
        const eventColor = isActive ? "#dc3545" : "#28a745";
        const eventIcon = isActive ? "🔴" : "🟢";
        const chipName = event.device_id || "Desconocido";
        const deviceName = devicesState[chipName]?.name || chipName;
        
        html += `
          <div style="
            border: 1px solid #e8e8e8;
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 10px;
            border-left: 4px solid ${eventColor};
            background: white;
            transition: transform 0.2s;
          " 
          onmouseover="this.style.transform='translateX(3px)'" 
          onmouseout="this.style.transform='translateX(0)'">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; margin-bottom: 3px;">
                  <span style="font-size: 16px; margin-right: 8px;">${eventIcon}</span>
                  <span style="font-weight: 500; color: #333; font-size: 14px;">${eventName}</span>
                  <span style="
                    background: ${eventColor}20;
                    color: ${eventColor};
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                    margin-left: 8px;
                  ">
                    ${isActive ? "ACTIVADO" : "DESACTIVADO"}
                  </span>
                </div>
                <div style="font-size: 11px; color: #666; margin-left: 24px;">
                  ${deviceName} • ${event.message || "Evento del sistema"}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px; color: #666; font-weight: 500;">
                  ${formatTimestamp(event.timestamp)}
                </div>
              </div>
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
      
      // Footer de eventos
      html += `
        <div style="
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #666;
        ">
          <div>
            Mostrando ${eventosRecientes.length} eventos más recientes
          </div>
          <div>
            <button onclick="showSection('valores')" style="
              background: #667eea;
              color: white;
              border: none;
              padding: 6px 12px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 11px;
              font-weight: bold;
              display: flex;
              align-items: center;
              gap: 5px;
            ">
              📈 Ver Valores en Vivo
            </button>
          </div>
        </div>
      `;
    }
    
    html += `
      </div>
    `;
    
    displayElement.innerHTML = html;
    return; // Salir de la función para usuarios no admin
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
    <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white;">
      <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
        <div style="font-size: 16px; font-weight: 600;">📊 RESUMEN DE EVENTOS</div>
        <div style="
          background: rgba(255,255,255,0.2);
          padding: 5px 12px;
          border-radius: 15px;
          font-size: 12px;
          backdrop-filter: blur(10px);
        ">
          ${showAllEvents ? "📚 Vista completa" : "📖 Vista reciente"}
          <span style="margin-left: 8px; color: ${
            showAllEvents ? "#ffd93d" : "#4cd964"
          }">
            ${
              showAllEvents
                ? `(${eventsShown} eventos)`
                : `(${eventsShown}/${totalEventsInMemory})`
            }
          </span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
        <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
          <div style="font-size: 14px; opacity: 0.9;">EVENTOS VISIBLES</div>
          <div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${eventsShown}</div>
          <div style="font-size: 12px;">${
            showAllEvents ? "Todos cargados" : "Últimos " + EVENTS_PER_LOAD
          }</div>
        </div>
        <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
          <div style="font-size: 14px; opacity: 0.9;">EN MEMORIA</div>
          <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: #4cd964;">
            ${totalEventsInMemory}
          </div>
          <div style="font-size: 12px;">Eventos cargados</div>
        </div>
        <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
          <div style="font-size: 14px; opacity: 0.9;">DISPOSITIVOS</div>
          <div style="font-size: 32px; font-weight: bold; margin: 10px 0; color: #3498db;">
            ${authorizedChips.length}
          </div>
          <div style="font-size: 12px;">Con acceso</div>
        </div>
        <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 10px; backdrop-filter: blur(10px);">
          <div style="font-size: 14px; opacity: 0.9;">MODO VISUALIZACIÓN</div>
          <div style="font-size: 18px; font-weight: bold; margin: 10px 0; color: ${
            showAllEvents ? "#ffd93d" : "#4cd964"
          };">
            ${showAllEvents ? "📚 COMPLETA" : "📖 RECIENTE"}
          </div>
          <div style="font-size: 12px;">Haz clic para cambiar</div>
        </div>
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
          🔄 Cargar más
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
        <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
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
      const eventIcon = isActive ? "🔴" : "🟢";
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
                    ? '<span style="margin-left: 8px; font-size: 10px; color: #28a745; background: #e8f5e8; padding: 2px 6px; border-radius: 10px;">✅ ACCESO</span>'
                    : '<span style="margin-left: 8px; font-size: 10px; color: #888; background: #f8f9fa; padding: 2px 6px; border-radius: 10px;">👁️ SOLO VISTA</span>'
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
                ${adminHasAccess ? "✅ " : "👁️ "}${chipName}
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
          <span style="color: #28a745;">✅</span> 
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

  // Filtrar chips por permisos (solo los que tienen true)
  const chips = Object.keys(devicesState).filter((chipId) => {
    return userPermissions[chipId] === true; // SOLO chips con permiso true
  });

  if (chips.length === 0) {
    valoresSection.innerHTML = `
            <h1 style="margin-bottom: 20px; color: #333;">📈 Valores en Vivo</h1>
            <div style="text-align: center; padding: 60px 20px; color: #666;">
                <div style="font-size: 64px; margin-bottom: 20px;">🔒</div>
                <div style="font-size: 18px; margin-bottom: 10px;">No tienes acceso a dispositivos</div>
                <div style="font-size: 14px; opacity: 0.7;">
                    Contacta al administrador para obtener permisos
                </div>
                <div style="font-size: 12px; margin-top: 20px; color: #888;">
                    Permisos actuales: ${
                      Object.keys(userPermissions).length
                    } dispositivos registrados
                </div>
            </div>
        `;
    return;
  }

  let html = `
        <h1 style="margin-bottom: 10px; color: #333;">📈 Valores en Vivo</h1>
        <div style="margin-bottom: 25px; color: #666; font-size: 14px;">
            <span style="background: #e8f4fd; padding: 5px 10px; border-radius: 15px;">
                Tienes acceso a ${chips.length} dispositivo(s)
            </span>
            <span style="margin-left: 10px; font-size: 12px; color: #888;">
                💡 Haz clic en cualquier tarjeta para controlar el dispositivo
            </span>
            <div style="font-size: 11px; color: #28a745; margin-top: 5px; background: #e8f5e8; padding: 5px 10px; border-radius: 10px;">
                ✅ Mostrando solo dispositivos con acceso autorizado
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px;">
    `;

  chips.forEach((chipId) => {
    const device = devicesState[chipId];
    const sensors = sensorStates[chipId] || {};
    const deviceName = device.name || chipId;

    // Determinar estado principal
    let statusColor = "#6c757d";
    let statusIcon = "❓";
    let statusText = "DESCONOCIDO";
    let statusDesc = "Estado no disponible";

    const hasActiveSensors =
      sensors.c1 || sensors.c2 || sensors.c3 || sensors.c4 || sensors.c5;
    const hasAlarm = sensors.alarma || device.alarm;

    if (hasAlarm) {
      statusColor = "#dc3545";
      statusIcon = "🚨";
      statusText = "ALARMA ACTIVA";
      statusDesc = "¡Se requiere atención inmediata!";
    } else if (hasActiveSensors) {
      statusColor = "#ff9500";
      statusIcon = "⚠️";
      statusText = "INTRUSIÓN";
      statusDesc = "Intrusión detectada - Alarma silenciosa";
    } else if (sensors.armado || device.armed) {
      statusColor = "#28a745";
      statusIcon = "🛡️";
      statusText = "ARMADO";
      statusDesc = "Sistema vigilando";
    } else {
      statusColor = "#6c757d";
      statusIcon = "🔓";
      statusText = "DESARMADO";
      statusDesc = "Sistema inactivo";
    }

    // Calcular calidad de señal
    let signalQuality = "Débil";
    let signalColor = "#dc3545";
    if (device.rssi >= -50) {
      signalQuality = "Excelente";
      signalColor = "#28a745";
    } else if (device.rssi >= -65) {
      signalQuality = "Buena";
      signalColor = "#4cd964";
    } else if (device.rssi >= -75) {
      signalQuality = "Regular";
      signalColor = "#ffc107";
    }

    // Contar sensores activos
    let activeSensors = 0;
    for (let i = 1; i <= 5; i++) {
      if (sensors[`c${i}`]) activeSensors++;
    }

    html += `
            <button type="button" class="valores-card" style="
                border: 2px solid ${statusColor}40;
                border-radius: 15px;
                padding: 20px;
                background: white;
                box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                transition: transform 0.3s, box-shadow 0.3s;
                cursor: pointer;
                position: relative;
                width: 100%;
                text-align: left;
                border-right: none;
                border-top: none;
                border-bottom: none;
                outline: none;
                font-family: inherit;
            " 
            onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 8px 25px rgba(0,0,0,0.12)'"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.08)'"
            onclick="openControlForChip('${chipId}')"
            title="Haz clic para controlar este dispositivo">
                <div style="
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: ${statusColor};
                    color: white;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    opacity: 0.8;
                ">⚙️</div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #333; font-size: 18px; font-weight: 600;">${deviceName}</h3>
                    <span style="
                        background: ${statusColor};
                        color: white;
                        padding: 6px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: bold;
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    ">
                        ${statusIcon} ${statusText}
                    </span>
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <div style="
                        width: 100px;
                        height: 100px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, ${statusColor}, ${statusColor}80);
                        margin: 0 auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 6px 20px ${statusColor}40;
                    ">
                        <span style="color: white; font-size: 40px;">
                            ${statusIcon}
                        </span>
                    </div>
                    <div style="color: #666; margin-top: 10px; font-size: 14px;">
                        ${statusDesc}
                    </div>
                </div>
                
                <div style="margin: 25px 0;">
                    <div style="font-size: 14px; color: #666; margin-bottom: 10px; font-weight: 600;">
                        📊 ESTADO DE CERCOS:
                    </div>
                    <div style="display: flex; justify-content: space-between; gap: 8px;">
        `;

    // Sensores
    for (let i = 1; i <= 5; i++) {
      const sensorName = `c${i}`;
      const isActive = sensors[sensorName] || false;

      html += `
                <div style="
                    flex: 1;
                    padding: 12px 0;
                    border-radius: 8px;
                    background: ${isActive ? "#dc3545" : "#28a745"};
                    color: white;
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                    transition: all 0.2s;
                    cursor: default;
                " 
                title="Cerco ${i}: ${isActive ? "ACTIVO" : "NORMAL"}"
                onmouseover="this.style.filter='brightness(1.1)'"
                onmouseout="this.style.filter='brightness(1)'">
                    C${i}<br>
                    <span style="font-size: 16px;">${
                      isActive ? "🔴" : "🟢"
                    }</span>
                </div>
            `;
    }

    html += `
                    </div>
                </div>
                
                <div style="
                    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 15px;
                ">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 13px;">
                        <div>
                            <div style="color: #666; margin-bottom: 3px;">📶 Señal WiFi</div>
                            <div style="font-weight: bold; color: ${signalColor};">${signalQuality}</div>
                            <div style="font-size: 11px; color: #888;">${
                              device.rssi
                            } dBm</div>
                        </div>
                        <div>
                            <div style="color: #666; margin-bottom: 3px;">🔋 Sensores</div>
                            <div style="font-weight: bold; color: ${
                              activeSensors > 0 ? "#dc3545" : "#28a745"
                            }">
                                ${activeSensors}/5 activos
                            </div>
                            <div style="font-size: 11px; color: #888;">${
                              activeSensors > 0 ? "⚠️ Atención" : "✅ Normal"
                            }</div>
                        </div>
                    </div>
                </div>
                
                <div style="
                    border-top: 1px solid #eee;
                    padding-top: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    color: #888;
                ">
                    <div>
                        <span style="color: #666;">🕒</span> ${formatTimestamp(
                          device.lastSeen
                        )}
                    </div>
                    <div>
                        ${device.ip}
                    </div>
                </div>
            </button>
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

  // Verificar que el chip existe en devicesState
  if (!devicesState[chipId]) {
    controlContent.innerHTML = `
      <div style="text-align: center; padding: 30px 20px; color: #666;">
        <div style="font-size: 36px; margin-bottom: 15px;">❌</div>
        <div style="font-size: 16px; margin-bottom: 10px;">Dispositivo no encontrado</div>
        <div style="font-size: 14px; opacity: 0.7;">
          El dispositivo ${chipId} no está disponible
        </div>
      </div>
    `;
    modal.style.display = "block";
    return;
  }

  const device = devicesState[chipId];
  const sensors = sensorStates[chipId] || {};
  const deviceName = device.name || chipId;

  // Determinar color del estado
  let statusColor = "#6c757d";
  let statusText = "DESCONOCIDO";
  let statusBg = "#f8f9fa";
  let statusIcon = "❓";

  if (device.alarm) {
    statusColor = "#dc3545";
    statusText = "ALARMA ACTIVA";
    statusBg = "#fff5f5";
    statusIcon = "🚨";
  } else if (device.intrusion) {
    statusColor = "#ff9500";
    statusText = "INTRUSIÓN";
    statusBg = "#fffaf0";
    statusIcon = "⚠️";
  } else if (device.armed) {
    statusColor = "#28a745";
    statusText = "ARMADO";
    statusBg = "#f0fff4";
    statusIcon = "🛡️";
  } else {
    statusColor = "#6c757d";
    statusText = "DESARMADO";
    statusBg = "#f8f9fa";
    statusIcon = "🔓";
  }

  // Contar sensores activos
  let activeSensors = 0;
  for (let i = 1; i <= 5; i++) {
    if (sensors[`c${i}`]) activeSensors++;
  }

  // Calcular calidad de señal
  let signalQuality = "Débil";
  let signalColor = "#dc3545";
  if (device.rssi >= -50) {
    signalQuality = "Excelente";
    signalColor = "#28a745";
  } else if (device.rssi >= -65) {
    signalQuality = "Buena";
    signalColor = "#4cd964";
  } else if (device.rssi >= -75) {
    signalQuality = "Regular";
    signalColor = "#ffc107";
  }

  const html = `
    <div style="
      background: ${statusBg};
      border: 2px solid ${statusColor}40;
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    ">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
        <div style="text-align: left;">
          <h3 style="margin: 0 0 5px 0; color: #333; font-size: 18px; font-weight: 600;">${deviceName}</h3>
          <div style="font-size: 12px; color: #666;">ID: ${chipId}</div>
        </div>
        <span style="
          background: ${statusColor};
          color: white;
          padding: 6px 15px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 5px;
        ">
          ${statusIcon} ${statusText}
        </span>
      </div>
      
      <div style="margin: 20px 0;">
        <div style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${statusColor}, ${statusColor}80);
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 20px ${statusColor}40;
        ">
          <span style="color: white; font-size: 32px;">
            ${statusIcon}
          </span>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
        <div style="
          background: white;
          padding: 15px;
          border-radius: 10px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        ">
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">📶 SEÑAL WIFI</div>
          <div style="font-size: 20px; font-weight: bold; color: ${signalColor};">${signalQuality}</div>
          <div style="font-size: 11px; color: #888;">${device.rssi} dBm</div>
        </div>
        
        <div style="
          background: white;
          padding: 15px;
          border-radius: 10px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        ">
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">🔋 SENSORES</div>
          <div style="font-size: 20px; font-weight: bold; color: ${
            activeSensors > 0 ? "#dc3545" : "#28a745"
          };">${activeSensors}/5</div>
          <div style="font-size: 11px; color: #888;">${
            activeSensors > 0 ? "Activos" : "Normales"
          }</div>
        </div>
      </div>
    </div>
    
    <div style="margin-bottom: 25px;">
      <div style="font-size: 16px; font-weight: 600; color: #333; margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
        <span>📡</span> CONTROL DE CERCOS
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px;">
  `;

  // Agregar botones para cada cerco
  let cercoButtons = "";
  for (let i = 1; i <= 5; i++) {
    const sensorName = `c${i}`;
    const isActive = sensors[sensorName] || false;
    const cercoColor = isActive ? "#dc3545" : "#28a745";

    cercoButtons += `
      <button type="button" style="
        background: ${cercoColor};
        color: white;
        padding: 15px 5px;
        border-radius: 8px;
        text-align: center;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
        outline: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
      " 
      onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" 
      onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'"
      onclick="toggleSensor('${chipId}', 'c${i}')"
      title="Cerco ${i}: ${isActive ? "ACTIVADO" : "NORMAL"}">
        <div style="font-size: 14px; font-weight: bold;">C${i}</div>
        <div style="font-size: 20px;">
          ${isActive ? "🔴" : "🟢"}
        </div>
        <div style="font-size: 11px; opacity: 0.9;">
          ${isActive ? "ACTIVO" : "NORMAL"}
        </div>
      </button>
    `;
  }

  const finalHtml =
    html +
    cercoButtons +
    `
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
      <button type="button" onclick="sendCommand('${chipId}', '${
      device.alarm ? "DESACTIVAR_ALARMA" : "ACTIVAR_ALARMA"
    }')" 
        style="
          padding: 15px;
          background: ${device.alarm ? "#dc3545" : "#28a745"};
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          outline: none;
        "
        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.15)'"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
        🚨 ${device.alarm ? "DESACTIVAR ALARMA" : "ACTIVAR ALARMA"}
      </button>
      
      <button type="button" onclick="sendCommand('${chipId}', '${
      device.armed ? "DESARMAR_SISTEMA" : "ARMAR_SISTEMA"
    }')" 
        style="
          padding: 15px;
          background: ${device.armed ? "#28a745" : "#6c757d"};
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          outline: none;
        "
        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.15)'"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
        ${device.armed ? "🔒 DESARMAR SISTEMA" : "🔓 ARMAR SISTEMA"}
      </button>
    </div>
    
    <div style="
      background: #f8f9fa;
      border-radius: 10px;
      padding: 15px;
      margin-bottom: 15px;
    ">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">🕒 ÚLTIMA CONEXIÓN</div>
          <div style="font-weight: bold; font-size: 14px; color: #333;">${formatTimestamp(
            device.lastSeen
          )}</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">📍 DIRECCIÓN IP</div>
          <div style="font-weight: bold; font-size: 14px; color: #333;">${
            device.ip
          }</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">📡 DIRECCIÓN MAC</div>
          <div style="font-weight: bold; font-size: 14px; color: #333; font-family: 'Courier New', monospace;">${
            device.mac
          }</div>
        </div>
        <div>
          <div style="font-size: 12px; color: #666; margin-bottom: 5px;">🔌 ESTADO</div>
          <div style="font-weight: bold; font-size: 14px; color: ${
            Date.now() - device.lastSeen < 300000 ? "#28a745" : "#dc3545"
          };">
            ${
              Date.now() - device.lastSeen < 300000
                ? "CONECTADO"
                : "DESCONECTADO"
            }
          </div>
        </div>
      </div>
    </div>
    
    <div style="
      padding: 12px;
      background: #e8f4fd;
      border-radius: 8px;
      border-left: 4px solid #3498db;
      font-size: 12px;
      color: #2c3e50;
    ">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 14px;">💡</span>
        <span>Haz clic en cualquier cerco para cambiar su estado. Los cambios se aplicarán inmediatamente.</span>
      </div>
    </div>
  `;

  controlContent.innerHTML = finalHtml;
  modal.style.display = "block";

  // Agregar animación de entrada
  setTimeout(() => {
    modal.style.opacity = "1";
  }, 10);
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

window.onclick = function (event) {
  const modal = document.getElementById("control-modal");
  if (event.target == modal) {
    closeControlModal();
  }
};

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

    showNotification(
      `🔧 ${chipId}: ${sensorName.toUpperCase()} ${
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
    `📋 DETALLES DEL EVENTO\n\n` +
      `📝 Tipo: ${eventName}\n` +
      `📊 Estado: ${isActive ? "ACTIVADO" : "DESACTIVADO"}\n` +
      `🕒 Fecha: ${new Date(event.timestamp).toLocaleString()}\n` +
      `📱 Dispositivo: ${event.device_id || "Desconocido"}\n` +
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
  const sections = ["dashboard", "valores", "admin"];
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
                <div style="font-size: 48px; margin-bottom: 15px; animation: spin 1s linear infinite;">🔄</div>
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
                    <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                    <div style="font-size: 16px;">No hay usuarios registrados</div>
                </div>
            `;
      return;
    }

    // Convertir a array y ordenar
    const usersArray = Object.entries(users).map(([uid, userData]) => ({
      uid,
      ...userData
    }));

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
                    <div class="stat-label">👥 Usuarios</div>
                    <div class="stat-value">${totalUsers}</div>
                    <div style="font-size: 11px; color: #28a745;">${activeUsers} activos</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">👑 Admins</div>
                    <div class="stat-value">${adminUsers}</div>
                    <div style="font-size: 11px; color: #667eea;">${Math.round(
                      (adminUsers / totalUsers) * 100
                    )}%</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">📱 Dispositivos</div>
                    <div class="stat-value">${totalDevices}</div>
                    <div style="font-size: 11px; color: #ffc107;">Disponibles</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">🔐 Permisos</div>
                    <div class="stat-value">${allChipIds.length}</div>
                    <div style="font-size: 11px; color: #6c757d;">Chips totales</div>
                </div>
            </div>
            
            <div class="search-box">
                <span class="search-icon">🔍</span>
                <input type="text" id="admin-search" placeholder="Buscar usuarios por email o nombre..." onkeyup="filterUsers()">
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
                            ${user.role === "admin" ? "👑 ADMIN" : "👤 USER"}
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
                                ? "🟢 ACTIVO"
                                : "🔴 INACTIVO"
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
                            ✏️ Editar
                        </button>
                    </td>
                </tr>
            `;
    });

    html += `
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                <div style="font-size: 12px; color: #666; display: flex; justify-content: space-between;">
                    <div>
                        <strong>💡 Notas:</strong>
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
                            📊 Exportar Datos
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
                <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
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
                    🔄 Reintentar
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
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">👑 Rol</label>
                        <select id="edit-user-role" style="
                            width: 100%;
                            padding: 10px;
                            border: 2px solid #e0e0e0;
                            border-radius: 8px;
                            font-size: 14px;
                        ">
                            <option value="user" ${
                              userData.role === "user" ? "selected" : ""
                            }>👤 Usuario</option>
                            <option value="admin" ${
                              userData.role === "admin" ? "selected" : ""
                            }>👑 Administrador</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">📊 Estado</label>
                        <select id="edit-user-status" style="
                            width: 100%;
                            padding: 10px;
                            border: 2px solid #e0e0e0;
                            border-radius: 8px;
                            font-size: 14px;
                        ">
                            <option value="active" ${
                              userData.status === "active" ? "selected" : ""
                            }>🟢 Activo</option>
                            <option value="inactive" ${
                              userData.status === "inactive" ? "selected" : ""
                            }>🔴 Inactivo</option>
                            <option value="suspended" ${
                              userData.status === "suspended" ? "selected" : ""
                            }>⚠️ Suspendido</option>
                        </select>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <label style="font-weight: bold; color: #333; font-size: 16px;">📱 Permisos de Dispositivos</label>
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
                    <div style="font-size: 36px; margin-bottom: 10px;">📭</div>
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
                                <span>📶</span> ${device?.rssi || -90} dBm
                                <span style="margin-left: 10px;">🕒</span> ${formatTimestamp(
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
                    <div style="font-size: 12px; color: #666;">
                        <strong>💡 Nota:</strong> Los cambios se aplican inmediatamente
                    </div>
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
                            ❌ Cancelar
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
                            💾 Guardar Cambios
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

// Guardar cambios del usuario
async function saveUserChanges(userId) {
  try {
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

    showNotification(`✅ Usuario actualizado correctamente`, "success");
    closeEditUserModal();

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
};

// También puedes agregar tecla ESC para cerrar modales:
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeControlModal();
    closeEditUserModal();
  }
});