# Configuración de Yukly Pets

Este sitio ahora tiene tres partes:

- **Sitio público** (`index.html`): servicios, citas, ubicación y reseñas.
- **Panel de administración** (`admin.html`): gestión de servicios, reseñas, trabajadores y asistencia.
- **Página de registro NFC** (`checkin.html`): la abre el teléfono del trabajador al acercarlo al tag NFC.

Todo el frontend es HTML/CSS/JS estático (listo para Netlify), pero ahora depende de un backend en
**Supabase** (base de datos + autenticación + funciones) para guardar datos y enviar correos.

## 1. Crear el proyecto de Supabase

1. Crea una cuenta gratuita en [supabase.com](https://supabase.com) y un nuevo proyecto.
2. Ve a **SQL Editor** y ejecuta el contenido de `supabase/migrations/0001_init.sql`. Esto crea las
   tablas (`services`, `reviews`, `employees`, `attendance_logs`, `appointments`,
   `business_settings`) con sus reglas de seguridad (RLS) y los 6 servicios iniciales.
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public key`
4. Ábre `assets/js/config.js` en el repositorio y reemplaza:

   ```js
   window.YUKLY_CONFIG = {
     SUPABASE_URL: "https://tu-proyecto.supabase.co",
     SUPABASE_ANON_KEY: "tu-anon-key",
     WHATSAPP_NUMBER: "526568596503",
   };
   ```

   La `anon key` está diseñada para usarse en el navegador (no es secreta); la seguridad real la dan
   las políticas RLS ya incluidas en la migración.

## 2. Crear la cuenta del dueño (login del panel)

1. En Supabase, ve a **Authentication → Users → Add user**.
2. Crea un usuario con el correo y contraseña que usará el dueño para entrar a `admin.html`.
3. Ese es el único tipo de cuenta con acceso al panel — los trabajadores **no** inician sesión, solo
   usan su NFC.

## 3. Configurar el envío de correos (Gmail)

1. En tu cuenta de Gmail, activa la verificación en 2 pasos (requisito de Google).
2. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) y genera una
   "Contraseña de aplicación" (elige "Otra" y ponle un nombre como `Yukly Pets`).
3. Guarda ese valor de 16 caracteres, lo necesitas en el siguiente paso.

## 4. Desplegar las funciones (Edge Functions)

Necesitas el [CLI de Supabase](https://supabase.com/docs/guides/cli) instalado.

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF

supabase secrets set GMAIL_USER=tu-correo@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
supabase secrets set OWNER_EMAIL=correo-donde-quieres-recibir-avisos@gmail.com

supabase functions deploy send-appointment-email
supabase functions deploy checkin
```

Con esto:

- Cada cita nueva desde el formulario del sitio envía un correo a `OWNER_EMAIL`.
- Cada vez que un trabajador escanea su NFC (entrada o salida), se registra en `attendance_logs` y se
  envía un correo a `OWNER_EMAIL`.

## 5. Publicar el sitio en Netlify

1. Sube el repositorio a Netlify (o arrastra la carpeta) — no requiere build command, solo el
   directorio raíz como "publish directory".
2. Verifica que `assets/js/config.js` ya tenga tus datos reales de Supabase (Netlify solo sirve
   archivos estáticos, así que las claves deben quedar guardadas en ese archivo antes de publicar).

## 6. Panel de administración

Entra a `https://tu-sitio.netlify.app/admin.html` con el correo y contraseña creados en el paso 2.

- **Resumen**: estadísticas rápidas y últimas citas.
- **Dueño**: nombre del negocio, correo de notificaciones, WhatsApp, dirección, horarios y cambio de
  contraseña.
- **Servicios**: agregar, editar, ocultar o eliminar los servicios que se muestran en el sitio.
- **Reseñas**: aprobar, ocultar o eliminar las reseñas que los clientes envían desde el sitio.
- **Trabajadores**: agregar, editar o eliminar empleados. Cada trabajador tiene dos enlaces únicos
  (entrada / salida) con botón "Copiar".
- **Asistencia**: historial de entradas y salidas registradas por NFC.

## 7. Grabar los tags NFC físicos

Cuando compres los tags NFC (necesitas dos por trabajador: uno de "entrada" y otro de "salida"):

1. Ve a **Trabajadores** en el panel, copia el enlace de "Entrada" del empleado y grábalo en un tag
   NFC usando una app como **NFC Tools** (Android/iOS) — la opción es "Escribir → Agregar registro →
   URL/URI".
2. Repite con el enlace de "Salida" en otro tag.
3. Al acercar el teléfono al tag, se abrirá `checkin.html`, que registra la hora automáticamente y
   notifica al dueño por correo — no requiere apps adicionales ni iniciar sesión.

Mientras no tengas los tags físicos, puedes copiar y abrir esos mismos enlaces manualmente para
probar el flujo.

## 8. Imágenes y logo

El logo real y las fotos del hero / instalaciones ya están integrados en `assets/images/`. Si en el
futuro quieres cambiarlas, solo reemplaza el archivo correspondiente (mismo nombre) o actualiza la
ruta en el `<img>` de `index.html` / `admin.html`.
