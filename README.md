# TaskSync: Aplicación Colaborativa de Tareas Segura

## 📘 Descripción del Proyecto

**TaskSync** es una aplicación web de gestión de tareas diseñada para ser colaborativa y segura. Esta versión del proyecto ha sido fortalecida mediante la integración de **JSON Web Tokens (JWT)** para la autenticación y el control de acceso, y **Socket.IO** para la comunicación en tiempo real. La seguridad se gestiona tanto en las peticiones REST (Backend) como en la comunicación bidireccional (Frontend).

---

## 🔒 Mecanismos de Seguridad Implementados

### 1. Autenticación y Autorización con JWT

Hemos implementado un flujo de autenticación robusto basado en tokens JWT para proteger todos los recursos del Backend.

* **Registro y Almacenamiento Seguro:** Las contraseñas se almacenan de forma segura utilizando **Bcrypt** en el servidor.
* **Generación de Tokens:** Al iniciar sesión, el servidor genera un **token JWT** con una fecha de expiración definida.
* **Protección de Rutas REST:** Un *middleware* en el Backend valida el token JWT en cada petición a las rutas `/tasks` (GET, POST, PUT, DELETE). Si el token es inválido o está ausente, la petición es rechazada.
* **Frontend (Angular):** El token se adjunta automáticamente a todas las peticiones salientes (`HttpClient`) a través de un **Interceptor** implícito en la configuración de la aplicación.
* **Protección de Rutas Cliente:** El **`AuthGuard`** en Angular protege las rutas del Frontend (`/tasks`), asegurando que solo los usuarios con un token válido puedan acceder.

### 2. Integración de Seguridad en Tiempo Real (Socket.IO)

La comunicación en tiempo real también está asegurada.

* **Autenticación de Socket:** Al establecer la conexión con Socket.IO, el **token JWT es enviado** desde el Frontend.
* **Validación en el Servidor:** El servidor de Socket.IO valida este token antes de permitir la conexión y la suscripción a eventos de tareas. Solo los usuarios autenticados pueden recibir actualizaciones en tiempo real.

---

## ⭐ Opción de Seguridad Avanzada Seleccionada

Se eligió e implementó la **Opción C: Manejo Avanzado de Sesiones**.

### Justificación de Opción C

Esta opción es fundamental para la seguridad, ya que aborda una de las vulnerabilidades más comunes de JWT: la **revocación de tokens**.

* **Mecanismo Implementado (Lista Negra/Blacklisting):**
    * Al hacer **`logout`**, el token JWT activo es enviado al servidor.
    * El servidor coloca este token en una **Lista Negra** (generalmente almacenada en caché como Redis o, en su defecto, en memoria por la duración de la sesión).
    * Si un usuario malicioso intenta usar el token "revocado" antes de que expire naturalmente, el middleware de autenticación consulta la Lista Negra y **bloquea la solicitud**, invalidando el token inmediatamente.

---

## 🚀 Pasos para Ejecutar la Aplicación

Asegúrate de tener **Node.js** y **Angular CLI** instalados globalmente. La aplicación debe ejecutarse con el Backend y el Frontend funcionando simultáneamente.

### 1. Iniciar el Backend (Servidor)

1.  Abre una terminal y navega a la carpeta del servidor:
    ```bash
    cd tasksync-app-project/server
    ```
2.  Instala las dependencias del Backend (si es la primera vez):
    ```bash
    npm install
    ```
3.  Inicia el servidor. El servidor se ejecutará en **http://localhost:3000** (o el puerto que configuraste):
    ```bash
    node index.js
    ```
    *(Verás el mensaje "Servidor de tareas/auth escuchando en http://localhost:3000")*

### 2. Iniciar el Frontend (Angular)

1.  Abre una **segunda terminal** y navega a la carpeta del Frontend:
    ```bash
    cd tasksync-app-project/tasksync
    ```
2.  Instala las dependencias del Frontend (si es la primera vez):
    ```bash
    npm install
    ```
3.  Inicia la aplicación Angular. Usaremos el puerto **4201** para evitar conflictos:
    ```bash
    ng serve --open --port 4201
    ```

La aplicación se abrirá automáticamente en tu navegador en **http://localhost:4201/login**.

---

