import { useState } from 'react'

// Contenido de las Actividades 4 (SaaS) y 5 (OWASP) de la EV03.
// Fuente: docs/ACTIVIDAD4_SaaS.md y docs/ACTIVIDAD5_OWASP.md

const SAAS = [
  { icono: '☁️', cat: 'Plataforma de despliegue', tec: 'Vercel', modelo: 'PaaS', txt: 'Compila el proyecto Vite desde GitHub y lo publica en una CDN global con HTTPS automático. Cada git push genera un despliegue (CI/CD).' },
  { icono: '🗄️', cat: 'Base de datos en la nube', tec: 'Supabase PostgreSQL', modelo: 'DBaaS', txt: 'PostgreSQL administrado con respaldos. Modelo relacional con integridad referencial y columna clinica_id para multi-clínica.' },
  { icono: '🔐', cat: 'Autenticación y acceso', tec: 'Supabase Auth + RLS', modelo: 'PaaS', txt: 'JWT, hash bcrypt, MFA y políticas RLS por rol (Administrador, Veterinario, Recepcionista, Asistente).' },
  { icono: '📁', cat: 'Almacenamiento de archivos', tec: 'Supabase Storage', modelo: 'PaaS / IaaS', txt: 'Exámenes, radiografías y fotos de mascotas con URLs firmadas y las mismas políticas de acceso por rol.' },
  { icono: '💳', cat: 'Facturación y suscripciones', tec: 'Stripe Billing', modelo: 'SaaS terceros', txt: 'Planes mensuales por clínica, cobro recurrente y webhooks que activan o suspenden cuentas. No se almacenan datos de tarjeta.' },
  { icono: '📈', cat: 'Monitoreo y seguridad', tec: 'Sentry + UptimeRobot', modelo: 'SaaS terceros', txt: 'Errores, disponibilidad y logs de auditoría; HTTPS/HSTS, respaldos diarios y gestión de secretos por variables de entorno.' }
]

const TOP10 = [
  ['A01', 'Broken Access Control', 'Acceso a datos o funciones sin autorización (IDOR, escalamiento de privilegios).', true],
  ['A02', 'Security Misconfiguration', 'Configuraciones inseguras o por defecto, cabeceras ausentes, errores detallados.'],
  ['A03', 'Software Supply Chain Failures', 'Dependencias, compilación o distribución comprometidas.'],
  ['A04', 'Cryptographic Failures', 'Cifrado ausente o débil; contraseñas sin hash.'],
  ['A05', 'Injection', 'Datos no confiables interpretados como código (SQL, comandos, XSS).'],
  ['A06', 'Insecure Design', 'Fallos de diseño y de lógica de negocio; falta de modelado de amenazas.', true],
  ['A07', 'Authentication Failures', 'Fuerza bruta, contraseñas débiles, sesiones sin expiración.', true],
  ['A08', 'Software or Data Integrity Failures', 'Código o datos aceptados sin verificar su integridad.'],
  ['A09', 'Security Logging & Alerting Failures', 'Sin registros ni alertas para detectar y responder ataques.'],
  ['A10', 'Mishandling of Exceptional Conditions', 'Manejo inadecuado de errores y condiciones anómalas.']
]

const RELEVANTES = [
  ['A01', 'Broken Access Control', 'Cuatro roles con datos muy distintos: finanzas y usuarios son solo del Administrador.', 'Matriz de roles, guardia de ruta, selector de rol solo para Administrador y políticas RLS por rol.'],
  ['A07', 'Authentication Failures', 'Sistema expuesto en internet con cuentas del personal: la fuerza bruta es el ataque más probable.', 'Bloqueo tras 3 intentos fallidos (RF04), cuentas desactivables (RF03) y Supabase Auth.'],
  ['A06', 'Insecure Design', 'La lógica de stock, cobros y agenda puede manipularse (stock negativo, doble reserva).', 'Validación de colisión de horarios (RF11) y restricciones CHECK en la base de datos.']
]

const ASVS = [
  ['V6 Authentication', 'Contraseñas robustas y defensa contra fuerza bruta.', 'Bloqueo tras 3 intentos (RF04) y Supabase Auth.'],
  ['V8 Authorization', 'Control de acceso en el servidor, mínimo privilegio y denegación por defecto.', 'Políticas RLS por rol; sin rol, sin acceso.'],
  ['V16 Logging and Error Handling', 'Registrar eventos de seguridad y no revelar detalles internos.', 'Movimientos con responsable y fecha; errores genéricos.'],
  ['V1 / V2 Encoding y Validation', 'Validar entradas y evitar inyección.', 'React escapa la salida; consultas parametrizadas; validaciones y CHECK.'],
  ['V13 Configuration', 'Secretos fuera del código.', 'Variables en .env (ignorado por Git); service_role nunca en el frontend.']
]

export default function Seguridad() {
  const [tab, setTab] = useState('saas')

  return (
    <div className="sec-page">
      <div className="sec-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'saas'} className={tab === 'saas' ? 'on' : ''} onClick={() => setTab('saas')}>
          Actividad 4 · Tecnologías SaaS
        </button>
        <button type="button" role="tab" aria-selected={tab === 'owasp'} className={tab === 'owasp' ? 'on' : ''} onClick={() => setTab('owasp')}>
          Actividad 5 · OWASP
        </button>
      </div>

      {tab === 'saas' && (
        <>
          <p className="sec-intro">
            El sistema se ofrecería como <strong>SaaS multi-clínica</strong>: una plataforma en la nube administrada por el proveedor, a la que cada veterinaria accede por navegador mediante una suscripción.
          </p>
          <div className="sec-grid">
            {SAAS.map((s, i) => (
              <article className="sec-card" key={s.cat}>
                <div className="sec-card-top">
                  <span className="sec-icon" aria-hidden="true">{s.icono}</span>
                  <span className="sec-num">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h4>{s.cat}</h4>
                <div className="sec-tec">{s.tec}</div>
                <p>{s.txt}</p>
                <span className="tag tag-teal">{s.modelo}</span>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'owasp' && (
        <>
          <div className="card-panel">
            <h3><span>¿Qué es OWASP?</span><span className="tag tag-blue">Fundación sin fines de lucro</span></h3>
            <p className="sec-intro" style={{ margin: 0 }}>
              <strong>Open Worldwide Application Security Project</strong>. Fundada en 2001 y constituida como fundación en 2004. Su objetivo es mejorar la seguridad del software con proyectos, documentación y herramientas abiertas (Top 10, ASVS, Cheat Sheets, ZAP, SAMM). Aquí se aplicó, por ejemplo, en el control de acceso por rol (A01) y en el bloqueo tras intentos fallidos (A07).
            </p>
          </div>

          <div className="card-panel">
            <h3><span>OWASP Top 10 · edición 2025</span><span className="tag tag-red">3 relevantes destacadas</span></h3>
            <div className="top10-grid">
              {TOP10.map(([id, nombre, desc, rel]) => (
                <div className={`top10-item ${rel ? 'rel' : ''}`} key={id}>
                  <span className="top10-id">{id}</span>
                  <div>
                    <strong>{nombre}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-panel">
            <h3><span>Riesgos más relevantes para Patitas Felices</span></h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Riesgo</th><th>Por qué es relevante</th><th>Mitigación en el prototipo</th></tr></thead>
                <tbody>
                  {RELEVANTES.map(([id, nombre, por, mit]) => (
                    <tr key={id}>
                      <td><span className="tag tag-red">{id}</span> <strong>{nombre}</strong></td>
                      <td>{por}</td>
                      <td>{mit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-panel">
            <h3><span>OWASP ASVS 5.0 · controles aplicables</span><span className="tag tag-teal">Nivel objetivo: 2</span></h3>
            <p className="sec-intro">
              El <strong>Application Security Verification Standard</strong> es una lista de requisitos de seguridad verificables, organizada en capítulos y tres niveles de rigor. Sirve como lista de chequeo para diseñar, probar y auditar.
            </p>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Capítulo</th><th>Control</th><th>Cómo se aplica</th></tr></thead>
                <tbody>
                  {ASVS.map(([cap, ctl, app]) => (
                    <tr key={cap}><td><strong>{cap}</strong></td><td>{ctl}</td><td>{app}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
