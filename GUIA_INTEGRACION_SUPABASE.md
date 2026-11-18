# Guía de integración Supabase - Patitas Felices

## Qué queda conectado

La aplicación usa Supabase Auth para iniciar sesión y PostgreSQL como fuente oficial de datos. Al iniciar sesión se consultan las tablas permitidas por el rol y se cargan los módulos:

- `clientes`: registro, edición y consulta.
- `mascotas`: registro vinculando `cliente_id`.
- `citas`: registro, cambio de estado y reprogramación.
- `atenciones`: registro clínico y actualización del peso de la mascota; las citas relacionadas se marcan atendidas.
- `vacunas`: registro, cálculo de próximo refuerzo y movimiento de stock.
- `productos`: alta de productos.
- `movimientos_stock`: entradas y salidas, con actualización de existencias.
- `ventas`: registro, actualización de stock y movimientos asociados; pago de deudas.
- `gastos`: registro de gastos.
- `recordatorios`: generación y almacenamiento de recordatorios.
- `usuarios_clinica`: consulta de perfiles, activación/desactivación y desbloqueo. Para agregar a un trabajador, primero se crea su cuenta en Auth y después se vincula su UID desde el módulo Usuarios.

Los datos personales ya no se guardan en `localStorage`. Después de iniciar sesión, las listas se cargan desde PostgreSQL y las operaciones muestran error si Supabase las rechaza.

## Requisitos de configuración

1. El SQL principal `supabase_veterinaria_patitas_felices.sql` debe estar ejecutado en el proyecto Supabase.
2. Ejecutar una vez `supabase_ajustes_integracion.sql` en **Supabase → SQL Editor**. Este ajuste permite a Recepción consultar productos y registrar ventas con movimientos de stock, y al personal clínico/Asistente descontar existencias al registrar vacunas o movimientos. El alta y eliminación del catálogo siguen reservadas al Administrador; el permiso de actualización de productos se limita a la columna `stock`.
3. Crear `.env` en la carpeta raíz copiando `.env.example` y completar:

   ```env
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
   ```

   Se acepta la clave **Publishable** (`sb_publishable_...`) o la antigua **anon**. Nunca usar `sb_secret_` ni `service_role` en el navegador.
4. Instalar y ejecutar:

   ```bash
   npm install
   npm run dev
   ```

5. En Vercel, configurar las mismas dos variables de entorno y volver a desplegar.

## Cuentas y perfiles de trabajadores

La contraseña se administra en **Supabase → Authentication → Users**. Para dar de alta a un trabajador:

1. Crear primero la cuenta Auth en Supabase.
2. Copiar el UID de esa cuenta.
3. En la aplicación, abrir Usuarios y completar nombre, RUT, correo, UID y rol para crear el perfil en `usuarios_clinica`.

No se crea una cuenta Auth desde el navegador porque eso requeriría exponer una clave secreta de administración. La aplicación solo vincula perfiles a cuentas Auth ya existentes.

## Notas de operación

- Las políticas RLS siguen siendo la autoridad final. Si un rol intenta una acción no autorizada, Supabase la rechazará y la aplicación mostrará el error.
- Los identificadores de las relaciones son UUID reales de PostgreSQL; ya no se usan los identificadores de demostración (`c1`, `m1`, etc.) una vez que se carga la base de datos.
- Los movimientos compuestos de inventario (por ejemplo, insertar una venta y luego actualizar stock) se ejecutan como varias solicitudes desde el navegador. Si una etapa falla, se muestra un error y se vuelve a cargar el estado desde Supabase; para operación comercial de producción se recomienda encapsular estas operaciones en funciones SQL transaccionales/RPC.
- El sistema de autenticación usa Supabase Auth. El bloqueo por perfil depende de los campos `activo` y `bloqueado` de `usuarios_clinica`; el control de intentos fallidos debe complementarse con límites de Auth o una función de servidor si se exige bloqueo automático por intentos.
