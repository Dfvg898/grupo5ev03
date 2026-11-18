import { Fragment, useEffect, useState } from 'react'
import { supabase } from './supabase'
import {
  ROLES_PERMISOS,
  INITIAL_CLIENTES,
  INITIAL_MASCOTAS,
  INITIAL_CITAS,
  INITIAL_ATENCIONES,
  INITIAL_VACUNAS,
  INITIAL_PRODUCTOS,
  INITIAL_MOVIMIENTOS,
  INITIAL_VENTAS,
  INITIAL_GASTOS,
  INITIAL_RECORDATORIOS
} from './data/seedVeterinaria'
import Seguridad from './Seguridad'
import './App.css'
import './theme.css'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/figtree'


// Validaciones reutilizables de formularios
function validarRutChile(rut) {
  const limpio = String(rut || '').replace(/[.\s]/g, '').toUpperCase()
  if (!/^\d{7,8}-[\dK]$/.test(limpio)) return false
  const [numero, dv] = limpio.split('-')
  let suma = 0
  let factor = 2
  for (let i = numero.length - 1; i >= 0; i--) {
    suma += Number(numero[i]) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const resto = 11 - (suma % 11)
  const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto)
  return dv === esperado
}
function correoValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor || '').trim())
}
function telefonoValido(valor) {
  const limpio = String(valor || '').replace(/[\s()-]/g, '')
  return /^\+569\d{8}$/.test(limpio) || /^9\d{8}$/.test(limpio)
}
function fechaValida(valor) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = new Date(valor + 'T12:00:00')
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
}
function numeroEnRango(valor, minimo, maximo) {
  const n = Number(valor)
  return valor !== '' && Number.isFinite(n) && n >= minimo && n <= maximo
}

const HORARIOS_BASE = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00']

// Iconos de línea (24x24) para el menú lateral
const ICONOS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  clientes: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
  citas: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  recordatorios: 'M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2zm-4 4a2 2 0 0 1-4 0',
  fichas: 'M7 3h8l4 4v14H7V3zm8 0v4h4M10 12h6M10 16h6',
  inventario: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  finanzas: 'M3 7h18v12H3V7zm0 4h18M7 15h3',
  reportes: 'M5 21V10m5 11V4m5 17v-8m5 8V7',
  usuarios: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zm-3 9l2 2 4-4',
  seguridad: 'M12 2l9 4v6c0 5.5-3.8 9.3-9 10-5.2-.7-9-4.5-9-10V6l9-4zm0 7v4m0 3h.01'
}
function Icono({ id }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONOS[id] || ICONOS.dashboard} />
    </svg>
  )
}


function App() {
  // 1. Estado de Autenticación Supabase + Rol Activo (CU01, CU02 | RF01-RF04)
  const [supabaseSession, setSupabaseSession] = useState(null)
  const [usuarioActivo, setUsuarioActivo] = useState(null)
  const [correoLogin, setCorreoLogin] = useState('')
  const [passLogin, setPassLogin] = useState('')
  const [alertaGlobal, setAlertaGlobal] = useState(null)
  const [modoOffline, setModoOffline] = useState(false)
  const [moduloActual, setModuloActual] = useState('dashboard')
  // Rol con el que realmente se autenticó la sesión (el selector de rol demo no puede ampliarlo)
  const [rolSesion, setRolSesion] = useState(null)

  // 2. Estado de Datos Clínicos con Caché Local Sincronizado (RNF04, RNF07)
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState(INITIAL_CLIENTES)
  const [mascotas, setMascotas] = useState(INITIAL_MASCOTAS)
  const [citas, setCitas] = useState(INITIAL_CITAS)
  const [atenciones, setAtenciones] = useState(INITIAL_ATENCIONES)
  const [vacunas, setVacunas] = useState(INITIAL_VACUNAS)
  const [productos, setProductos] = useState(INITIAL_PRODUCTOS)
  const [movimientos, setMovimientos] = useState(INITIAL_MOVIMIENTOS)
  const [ventas, setVentas] = useState(INITIAL_VENTAS)
  const [gastos, setGastos] = useState(INITIAL_GASTOS)
  const [recordatorios, setRecordatorios] = useState(INITIAL_RECORDATORIOS)

  // Formularios por módulo
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [formCliente, setFormCliente] = useState({ id: '', rut: '', nombre: '', telefono: '', correo: '', direccion: '' })
  const [formMascota, setFormMascota] = useState({ clienteId: 'c1', nombre: '', especie: 'Perro', raza: '', sexo: 'Macho', fechaNacimiento: '2024-01-15', peso: '', alergias: '' })

  const [filtroFechaCita, setFiltroFechaCita] = useState('2026-11-16')
  const [filtroVetCita, setFiltroVetCita] = useState('Todos')
  const [vistaAgenda, setVistaAgenda] = useState('diaria')
  const [formCita, setFormCita] = useState({ mascotaId: 'm1', servicio: 'Consulta General', veterinario: 'Dra. Camila Rojas', fecha: '2026-11-18', hora: '10:00', esUrgencia: false, gravedad: 'Normal', motivo: '' })

  const [mascotaFichaSel, setMascotaFichaSel] = useState('m1')
  const [formAtencion, setFormAtencion] = useState({ motivo: '', pesoKg: '31.4', temperaturaC: '38.5', diagnostico: '', tratamiento: '', observaciones: '', estadoRegistro: 'Finalizada' })
  const [formVacuna, setFormVacuna] = useState({ tipo: 'Vacuna', productoId: 'p1', fechaAplicacion: '2026-11-16', lote: 'NBV-8841A' })

  const [formProducto, setFormProducto] = useState({ sku: '', nombre: '', categoria: 'Medicamentos', stock: 10, stockMinimo: 5, precio: 12000, fechaVencimiento: '2027-06-30', lote: '' })
  const [formMovStock, setFormMovStock] = useState({ productoId: 'p1', tipo: 'Entrada', cantidad: 5, motivo: 'Reposición de inventario' })

  const [formVenta, setFormVenta] = useState({ clienteId: 'c1', mascotaId: 'm1', servicioMonto: 18000, servicioNombre: 'Consulta General ($18.000)', productoId: 'p5', cantidadProd: 1, medioPago: 'Tarjeta', estadoPago: 'Pagado', abonoInicial: 0 })
  const [formGasto, setFormGasto] = useState({ proveedor: '', categoria: 'Insumos y Vacunas', descripcion: '', monto: 45000, estado: 'Pagado' })

  const [tipoReporte, setTipoReporte] = useState('ventas')
  const [rangoInicio, setRangoInicio] = useState('2026-11-01')
  const [rangoFin, setRangoFin] = useState('2026-11-30')

  const [formUsuario, setFormUsuario] = useState({ nombre: '', rut: '', correo: '', authUserId: '', rol: 'Asistente', especialidad: '' })

  // Supabase PostgreSQL es la fuente oficial; no se almacenan datos personales en localStorage.

  // Escuchar sesión de Supabase Auth
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) {
        setSupabaseSession(data.session)
        const { data: perfil } = await supabase.from('usuarios_clinica').select('id,nombre,rut,correo,rol,especialidad,activo,intentos_fallidos,bloqueado,auth_user_id').eq('auth_user_id', data.session.user.id).maybeSingle()
        if (perfil && perfil.activo && !perfil.bloqueado) {
          const usuario = { id:perfil.id, authUserId:perfil.auth_user_id, nombre:perfil.nombre, rut:perfil.rut, correo:perfil.correo, rol:perfil.rol, especialidad:perfil.especialidad || '', activo:perfil.activo, intentos:perfil.intentos_fallidos || 0, bloqueado:!!perfil.bloqueado }
          setUsuarioActivo(usuario); setRolSesion(usuario.rol)
          await cargarDatosSupabase(usuario)
        } else {
          await supabase.auth.signOut()
          setSupabaseSession(null)
        }
      }
    }).catch(() => setModoOffline(true))

    const { data } = supabase.auth.onAuthStateChange((_ev, session) => {
      setSupabaseSession(session)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  function notificar(tipo, texto) {
    setAlertaGlobal({ tipo, texto })
    setTimeout(() => setAlertaGlobal(null), 5500)
  }

  // Carga la información oficial desde PostgreSQL.
  async function cargarDatosSupabase(usuario) {
    const tablas = ['clientes', 'mascotas', 'citas', 'atenciones', 'vacunas', 'productos', 'movimientos_stock', 'ventas', 'gastos', 'recordatorios', 'usuarios_clinica']
    const resultados = await Promise.all(tablas.map(async tabla => {
      const { data, error } = await supabase.from(tabla).select('*')
      if (error) {
        // RLS puede impedir que un rol consulte módulos que no le corresponden.
        if (error.code !== '42501' && !String(error.message || '').toLowerCase().includes('permission')) {
          console.warn(`No se pudo cargar ${tabla}:`, error.message)
        }
        return [tabla, []]
      }
      return [tabla, data || []]
    }))
    const db = Object.fromEntries(resultados)
    setClientes(db.clientes.map(x => ({ id:x.id, rut:x.rut || '', nombre:x.nombre || '', telefono:x.telefono || '', correo:x.correo || '', direccion:x.direccion || '' })))
    setMascotas(db.mascotas.map(x => ({ id:x.id, fichaCodigo:x.ficha_codigo, clienteId:x.cliente_id, nombre:x.nombre, especie:x.especie, raza:x.raza || '', sexo:x.sexo || '', fechaNacimiento:x.fecha_nacimiento || '', peso:Number(x.peso || 0), alergias:x.alergias || '' })))
    setCitas(db.citas.map(x => ({ id:x.id, mascotaId:x.mascota_id, servicio:x.servicio, veterinario:x.veterinario, fecha:x.fecha, hora:x.hora, estado:x.estado, esUrgencia:!!x.es_urgencia, gravedad:x.gravedad || 'Normal', motivo:x.motivo || '' })))
    setAtenciones(db.atenciones.map(x => ({ id:x.id, mascotaId:x.mascota_id, fecha:x.fecha, veterinario:x.veterinario, motivo:x.motivo, pesoKg:Number(x.peso_kg || 0), temperaturaC:Number(x.temperatura_c || 0), diagnostico:x.diagnostico, tratamiento:x.tratamiento, observaciones:x.observaciones || '', estadoRegistro:x.estado_registro })))
    setVacunas(db.vacunas.map(x => ({ id:x.id, mascotaId:x.mascota_id, tipo:x.tipo, productoNombre:x.producto_nombre, fechaAplicacion:x.fecha_aplicacion, lote:x.lote, proximoRefuerzo:x.proximo_refuerzo, responsable:x.responsable })))
    setProductos(db.productos.map(x => ({ id:x.id, sku:x.sku, nombre:x.nombre, categoria:x.categoria, stock:Number(x.stock), stockMinimo:Number(x.stock_minimo), precio:Number(x.precio), fechaVencimiento:x.fecha_vencimiento, lote:x.lote || '' })))
    setMovimientos(db.movimientos_stock.map(x => ({ id:x.id, productoId:x.producto_id, productoNombre:x.producto_nombre, tipo:x.tipo, cantidad:Number(x.cantidad), motivo:x.motivo, responsable:x.responsable, fecha:x.fecha })))
    setVentas(db.ventas.map(x => ({ id:x.id, folio:x.folio, fecha:x.fecha, clienteNombre:x.cliente_nombre, mascotaNombre:x.mascota_nombre || '', detalleItems:x.detalle_items, total:Number(x.total), medioPago:x.medio_pago, estadoPago:x.estado_pago, saldoPendiente:Number(x.saldo_pendiente || 0), responsable:x.responsable })))
    setGastos(db.gastos.map(x => ({ id:x.id, fecha:x.fecha, proveedor:x.proveedor, categoria:x.categoria, descripcion:x.descripcion, monto:Number(x.monto), estado:x.estado, responsable:x.responsable })))
    setRecordatorios(db.recordatorios.map(x => ({ id:x.id, fechaEnvio:x.fecha_envio, clienteNombre:x.cliente_nombre, mascotaNombre:x.mascota_nombre, contacto:x.contacto || '', canal:x.canal, tipo:x.tipo, mensaje:x.mensaje, estadoEntrega:x.estado_entrega })))
    setUsuarios(db.usuarios_clinica.map(x => ({ id:x.id, authUserId:x.auth_user_id, nombre:x.nombre, rut:x.rut, correo:x.correo, rol:x.rol, especialidad:x.especialidad || '', activo:x.activo, intentos:x.intentos_fallidos || 0, bloqueado:!!x.bloqueado })))
    // Los IDs de PostgreSQL son UUID; actualizar los valores iniciales de los selectores demo.
    if (db.clientes.length) {
      setFormMascota(prev => ({ ...prev, clienteId: db.clientes.some(x => x.id === prev.clienteId) ? prev.clienteId : db.clientes[0].id }))
      setFormVenta(prev => ({ ...prev, clienteId: db.clientes.some(x => x.id === prev.clienteId) ? prev.clienteId : db.clientes[0].id }))
    }
    if (db.mascotas.length) {
      setFormCita(prev => ({ ...prev, mascotaId: db.mascotas.some(x => x.id === prev.mascotaId) ? prev.mascotaId : db.mascotas[0].id }))
      setMascotaFichaSel(prev => db.mascotas.some(x => x.id === prev) ? prev : db.mascotas[0].id)
      setFormVenta(prev => ({ ...prev, mascotaId: db.mascotas.some(x => x.id === prev.mascotaId) ? prev.mascotaId : db.mascotas[0].id }))
    }
    if (db.productos.length) {
      setFormVacuna(prev => ({ ...prev, productoId: db.productos.some(x => x.id === prev.productoId) ? prev.productoId : db.productos[0].id }))
      setFormMovStock(prev => ({ ...prev, productoId: db.productos.some(x => x.id === prev.productoId) ? prev.productoId : db.productos[0].id }))
      setFormVenta(prev => ({ ...prev, productoId: db.productos.some(x => x.id === prev.productoId) ? prev.productoId : db.productos[0].id }))
    }
    else {
      setFormVenta(prev => ({ ...prev, productoId:'', cantidadProd:0 }))
    }
  }

  async function insertarTabla(tabla, valores) {
    if (!supabaseSession?.user?.id) throw new Error('No hay una sesión autenticada activa.')
    const { data, error } = await supabase.from(tabla).insert({ ...valores, user_id: supabaseSession.user.id }).select('*').single()
    if (error) throw error
    return data
  }

  async function actualizarTabla(tabla, id, valores) {
    const { data, error } = await supabase.from(tabla).update(valores).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }

  // Login principal (RF01, RF02, RF04: Bloqueo tras 3 intentos fallidos + Supabase Auth)
  async function manejarLogin(e) {
    e.preventDefault()
    const emailNorm = correoLogin.trim().toLowerCase()

    if (!correoValido(emailNorm)) {
      notificar('error', 'Ingrese un correo electrónico válido.')
      return
    }
    if (!passLogin || passLogin.length < 8) {
      notificar('error', 'Ingrese una contraseña de al menos 8 caracteres.')
      return
    }

    // La autenticación siempre se realiza en Supabase Auth.
    // No se aceptan contraseñas guardadas en el navegador ni usuarios de demostración.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailNorm,
      password: passLogin
    })

    if (error) {
      notificar('error', `No se pudo iniciar sesión: ${error.message}`)
      return
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('usuarios_clinica')
      .select('id, nombre, rut, correo, rol, especialidad, activo, intentos_fallidos, bloqueado, auth_user_id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    if (perfilError || !perfil) {
      await supabase.auth.signOut()
      notificar('error', perfilError
        ? `No se pudo consultar el perfil: ${perfilError.message}`
        : 'La cuenta inició sesión, pero no tiene un perfil autorizado en usuarios_clinica. Contacte al administrador.')
      return
    }

    if (!perfil.activo || perfil.bloqueado) {
      await supabase.auth.signOut()
      notificar('error', perfil.bloqueado
        ? 'La cuenta está bloqueada. Solicite el desbloqueo al administrador.'
        : 'La cuenta está desactivada. Contacte al administrador.')
      return
    }

    const usuario = {
      id: perfil.id,
      authUserId: perfil.auth_user_id,
      nombre: perfil.nombre,
      rut: perfil.rut,
      correo: perfil.correo,
      rol: perfil.rol,
      especialidad: perfil.especialidad || '',
      activo: perfil.activo,
      intentos: perfil.intentos_fallidos || 0,
      bloqueado: perfil.bloqueado || false
    }

    // Cargar todos los módulos desde PostgreSQL; no se usan los datos semilla como fuente oficial.
    setSupabaseSession(data.session)
    await cargarDatosSupabase(usuario)

    setUsuarioActivo(usuario)
    setRolSesion(usuario.rol)
    setModuloActual('dashboard')
    notificar('success', `Sesión iniciada como ${usuario.nombre}. Rol: ${usuario.rol}.`)
  }

  function loginRapidoRol() {
    notificar('warning', 'El acceso rápido de demostración está deshabilitado. Ingrese con una cuenta creada en Supabase Auth.')
  }

  function simularBloqueoRF04() {
    notificar('warning', 'La simulación local de bloqueo está deshabilitada para no modificar permisos fuera de Supabase. Use el panel de usuarios para administrar el estado real.')
  }



  async function cerrarSesionCompleta() {
    await supabase.auth.signOut().catch(() => {})
    setUsuarioActivo(null)
    setRolSesion(null)
    setCorreoLogin('')
    setPassLogin('')
  }

  function cambiarRolEnVivo(nuevoRol) {
    // Control de acceso: solo una sesión autenticada como Administrador puede previsualizar otros roles
    if (rolSesion !== 'Administrador' || !ROLES_PERMISOS[nuevoRol]) {
      notificar('error', 'RESTRICCIÓN (OWASP A01): solo el Administrador puede previsualizar otros roles.')
      return
    }
    const encontrado = usuarios.find(u => u.rol === nuevoRol) || {
      ...usuarioActivo,
      rol: nuevoRol,
      nombre: `${usuarioActivo.nombre.split(' (')[0]} (${nuevoRol})`
    }
    setUsuarioActivo(encontrado)
    const permisosNuevo = ROLES_PERMISOS[nuevoRol]
    if (!permisosNuevo.modulos.includes(moduloActual)) {
      setModuloActual('dashboard')
    }
    notificar('success', `Vista cambiada al Rol: ${nuevoRol}. Menús y permisos actualizados según matriz RBAC (RF02).`)
  }

  // ===========================================================================
  // FUNCIONES OPERATIVAS DE LOS MÓDULOS (CU02 a CU17 | RF03 a RF34)
  // ===========================================================================

  // CU03: Registrar o editar Cliente (RF05, RF08) - persistencia en Supabase
  async function guardarCliente(e) {
    e.preventDefault()

    if (!supabaseSession?.user?.id) {
      notificar('error', 'No existe una sesión activa de Supabase. Cierre sesión e ingrese nuevamente.')
      return
    }
    if (!['Administrador', 'Recepcionista'].includes(rolSesion)) {
      notificar('error', 'Su rol no tiene permiso para registrar o editar clientes.')
      return
    }
    if (!formCliente.rut.trim() || !formCliente.nombre.trim() || !formCliente.telefono.trim()) {
      notificar('error', 'RUT, Nombre completo y Teléfono son obligatorios (CU03).')
      return
    }
    if (!validarRutChile(formCliente.rut)) {
      notificar('error', 'El RUT no tiene un formato o dígito verificador válido. Ejemplo: 12.345.678-5.')
      return
    }
    if (formCliente.nombre.trim().length < 3 || /\d/.test(formCliente.nombre)) {
      notificar('error', 'El nombre debe tener al menos 3 caracteres y no contener números.')
      return
    }
    if (!telefonoValido(formCliente.telefono)) {
      notificar('error', 'Ingrese un teléfono chileno válido: +56912345678 o 912345678.')
      return
    }
    if (formCliente.correo.trim() && !correoValido(formCliente.correo)) {
      notificar('error', 'Ingrese un correo electrónico válido.')
      return
    }

    const rutNormalizado = formCliente.rut.replace(/[.\\s]/g, '').toUpperCase()
    if (clientes.some(c => c.id !== formCliente.id && String(c.rut || '').replace(/[.\\s]/g, '').toUpperCase() === rutNormalizado)) {
      notificar('warning', 'El RUT ingresado ya está asociado a otro cliente.')
      return
    }

    const datosCliente = {
      rut: formCliente.rut.trim(),
      nombre: formCliente.nombre.trim(),
      telefono: formCliente.telefono.trim(),
      correo: formCliente.correo.trim() || null,
      direccion: formCliente.direccion.trim() || null
    }

    let clienteGuardado
    if (formCliente.id) {
      const { data, error } = await supabase
        .from('clientes')
        .update(datosCliente)
        .eq('id', formCliente.id)
        .select('id, rut, nombre, telefono, correo, direccion')
        .single()

      if (error) {
        notificar('error', `No se pudo actualizar el cliente en Supabase: ${error.message}`)
        return
      }
      clienteGuardado = data
      setClientes(clientes.map(c => c.id === clienteGuardado.id ? {
        id: clienteGuardado.id,
        rut: clienteGuardado.rut,
        nombre: clienteGuardado.nombre,
        telefono: clienteGuardado.telefono,
        correo: clienteGuardado.correo || '',
        direccion: clienteGuardado.direccion || ''
      } : c))
      notificar('success', `Datos del cliente ${clienteGuardado.nombre} actualizados en Supabase.`)
    } else {
      const { data, error } = await supabase
        .from('clientes')
        .insert({ ...datosCliente, user_id: supabaseSession.user.id })
        .select('id, rut, nombre, telefono, correo, direccion')
        .single()

      if (error) {
        const mensaje = error.code === '23505'
          ? 'Ya existe un cliente registrado con ese RUT.'
          : `No se pudo registrar el cliente en Supabase: ${error.message}`
        notificar('error', mensaje)
        return
      }

      clienteGuardado = data
      const nuevo = {
        id: clienteGuardado.id,
        rut: clienteGuardado.rut,
        nombre: clienteGuardado.nombre,
        telefono: clienteGuardado.telefono,
        correo: clienteGuardado.correo || '',
        direccion: clienteGuardado.direccion || ''
      }
      setClientes(prev => [nuevo, ...prev])
      setFormMascota(prev => ({ ...prev, clienteId: nuevo.id }))
      notificar('success', `Cliente ${nuevo.nombre} registrado correctamente en Supabase.`)
    }

    setFormCliente({ id: '', rut: '', nombre: '', telefono: '', correo: '', direccion: '' })
  }

  // CU03: Registrar Mascota + Ficha Clínica Digital única (RF06, RF09, RF16)
  async function guardarMascota(e) {
    e.preventDefault()
    if (!formMascota.nombre.trim() || !formMascota.peso) return notificar('error', 'Debe indicar el nombre y peso actual de la mascota.')
    if (!clientes.some(c => c.id === formMascota.clienteId)) return notificar('error', 'Seleccione un cliente registrado.')
    if (formMascota.nombre.trim().length < 2 || formMascota.nombre.trim().length > 40) return notificar('error', 'El nombre debe tener entre 2 y 40 caracteres.')
    if (!numeroEnRango(formMascota.peso, 0.1, 200)) return notificar('error', 'El peso debe estar entre 0,1 y 200 kg.')
    if (formMascota.fechaNacimiento && (!fechaValida(formMascota.fechaNacimiento) || formMascota.fechaNacimiento > new Date().toISOString().slice(0,10))) return notificar('error', 'La fecha de nacimiento no puede ser futura ni inválida.')
    const fichaCodigo = `FC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
    try {
      const row = await insertarTabla('mascotas', { ficha_codigo:fichaCodigo, cliente_id:formMascota.clienteId, nombre:formMascota.nombre.trim(), especie:formMascota.especie, raza:formMascota.raza.trim() || 'Mestizo', sexo:formMascota.sexo, fecha_nacimiento:formMascota.fechaNacimiento || null, peso:Number(formMascota.peso), alergias:formMascota.alergias.trim() || 'Sin alergias registradas' })
      const nueva = { id:row.id, fichaCodigo:row.ficha_codigo, clienteId:row.cliente_id, nombre:row.nombre, especie:row.especie, raza:row.raza, sexo:row.sexo, fechaNacimiento:row.fecha_nacimiento, peso:Number(row.peso), alergias:row.alergias }
      setMascotas(prev => [nueva, ...prev]); setFormMascota(prev => ({ ...prev, nombre:'', raza:'', peso:'', alergias:'' }))
      notificar('success', `Mascota ${nueva.nombre} guardada en Supabase.`)
    } catch (error) { notificar('error', `No se pudo guardar la mascota: ${error.message}`) }
  }

  // CU04 & CU11: Agendar Cita validando no cruce de horario (RF10, RF11, RF12, RF21)
  async function guardarCita(e) {
    e.preventDefault()
    if (!mascotas.some(m => m.id === formCita.mascotaId)) return notificar('error', 'Debe seleccionar una mascota registrada.')
    if (!fechaValida(formCita.fecha) || formCita.fecha < new Date().toISOString().slice(0,10)) return notificar('error', 'La fecha de la cita no puede estar en el pasado.')
    if (!HORARIOS_BASE.includes(formCita.hora)) return notificar('error', 'Seleccione un horario disponible.')
    if (formCita.esUrgencia && !String(formCita.motivo || '').trim()) return notificar('error', 'Describa el motivo de la urgencia.')
    const colision = citas.find(c => c.fecha === formCita.fecha && c.hora === formCita.hora && c.veterinario === formCita.veterinario && c.estado !== 'Cancelada')
    if (colision && !formCita.esUrgencia) return notificar('error', `El veterinario ya tiene una cita a las ${formCita.hora}.`)
    try {
      const row = await insertarTabla('citas', { mascota_id:formCita.mascotaId, servicio:formCita.esUrgencia ? `URGENCIA: ${formCita.servicio}` : formCita.servicio, veterinario:formCita.veterinario, fecha:formCita.fecha, hora:formCita.hora, estado:formCita.esUrgencia ? 'En espera' : 'Pendiente', es_urgencia:!!formCita.esUrgencia, gravedad:formCita.esUrgencia ? formCita.gravedad : 'Normal', motivo:formCita.motivo.trim() || 'Atención programada' })
      const nueva = { id:row.id, mascotaId:row.mascota_id, servicio:row.servicio, veterinario:row.veterinario, fecha:row.fecha, hora:row.hora, estado:row.estado, esUrgencia:row.es_urgencia, gravedad:row.gravedad, motivo:row.motivo }
      setCitas(prev => formCita.esUrgencia ? [nueva,...prev] : [...prev,nueva]); setFormCita(prev => ({ ...prev, motivo:'', esUrgencia:false }))
      notificar('success', `Cita guardada en Supabase para ${nueva.fecha} a las ${nueva.hora}.`)
    } catch (error) { notificar('error', `No se pudo guardar la cita: ${error.message}`) }
  }

  // CU05: Cambiar estado / Reprogramar o Cancelar cita liberando horario (RF13, RF15)
  async function cambiarEstadoCita(idCita, nuevoEstado) {
    try { await actualizarTabla('citas', idCita, { estado:nuevoEstado }); setCitas(prev => prev.map(c => c.id === idCita ? { ...c, estado:nuevoEstado } : c)); notificar('success', `Estado actualizado a ${nuevoEstado} en Supabase.`) }
    catch (error) { notificar('error', `No se pudo actualizar la cita: ${error.message}`) }
  }


  async function reprogramarCita(citaObj) {
    const ocupados = citas.filter(c => c.fecha === citaObj.fecha && c.veterinario === citaObj.veterinario && c.estado !== 'Cancelada' && c.id !== citaObj.id).map(c => c.hora)
    const siguienteLibre = HORARIOS_BASE.find(h => !ocupados.includes(h))
    if (!siguienteLibre) return notificar('error', 'No hay otro horario disponible para ese veterinario.')
    try { await actualizarTabla('citas', citaObj.id, { hora:siguienteLibre, estado:'Pendiente' }); setCitas(prev => prev.map(c => c.id === citaObj.id ? { ...c, hora:siguienteLibre, estado:'Pendiente' } : c)); notificar('success', `Cita reprogramada a ${siguienteLibre} en Supabase.`) }
    catch (error) { notificar('error', `No se pudo reprogramar: ${error.message}`) }
  }


  // CU07: Registrar Atención Clínica en Ficha Digital (RF17, RF18)
  async function guardarAtencionClinica(e) {
    e.preventDefault()
    if (!formAtencion.motivo.trim() || !formAtencion.diagnostico.trim()) return notificar('error', 'Ingrese motivo y diagnóstico.')
    if (!mascotas.some(m => m.id === mascotaFichaSel)) return notificar('error', 'Seleccione una mascota válida.')
    if (formAtencion.pesoKg && !numeroEnRango(formAtencion.pesoKg,0.1,200)) return notificar('error', 'Peso fuera de rango.')
    if (formAtencion.temperaturaC && !numeroEnRango(formAtencion.temperaturaC,30,45)) return notificar('error', 'Temperatura fuera de rango.')
    try {
      const row = await insertarTabla('atenciones', { mascota_id:mascotaFichaSel, fecha:new Date().toISOString().slice(0,10), veterinario:usuarioActivo.nombre, motivo:formAtencion.motivo.trim(), peso_kg:formAtencion.pesoKg ? Number(formAtencion.pesoKg) : null, temperatura_c:formAtencion.temperaturaC ? Number(formAtencion.temperaturaC) : null, diagnostico:formAtencion.diagnostico.trim(), tratamiento:formAtencion.tratamiento.trim() || 'Indicaciones generales en consulta', observaciones:formAtencion.observaciones.trim(), estado_registro:formAtencion.estadoRegistro })
      const nueva = { id:row.id, mascotaId:row.mascota_id, fecha:row.fecha, veterinario:row.veterinario, motivo:row.motivo, pesoKg:Number(row.peso_kg || 0), temperaturaC:Number(row.temperatura_c || 0), diagnostico:row.diagnostico, tratamiento:row.tratamiento, observaciones:row.observaciones || '', estadoRegistro:row.estado_registro }
      setAtenciones(prev => [nueva,...prev])
      if (formAtencion.pesoKg) { try { await actualizarTabla('mascotas', mascotaFichaSel, { peso:Number(formAtencion.pesoKg) }); setMascotas(prev => prev.map(m => m.id === mascotaFichaSel ? { ...m, peso:Number(formAtencion.pesoKg) } : m)) } catch (e) { console.warn('No se actualizó el peso de la mascota:', e.message) } }
      if (formAtencion.estadoRegistro === 'Finalizada') {
        const pendientes = citas.filter(c => c.mascotaId === mascotaFichaSel && c.estado !== 'Cancelada')
        for (const c of pendientes) { try { await actualizarTabla('citas', c.id, { estado:'Atendida' }) } catch (e) { console.warn(e.message) } }
        setCitas(prev => prev.map(c => c.mascotaId === mascotaFichaSel && c.estado !== 'Cancelada' ? { ...c, estado:'Atendida' } : c))
      }
      setFormAtencion(prev => ({ ...prev, motivo:'', diagnostico:'', tratamiento:'', observaciones:'' }))
      notificar('success', 'Atención clínica guardada en Supabase.')
    } catch (error) { notificar('error', `No se pudo guardar la atención: ${error.message}`) }
  }


  // CU09: Registrar Vacuna/Desparasitación + Cálculo próximo refuerzo (RF19, RF20) + Descuento Stock (RF26)
  async function guardarVacunacion(e) {
    e.preventDefault()
    const prod = productos.find(p => p.id === formVacuna.productoId)
    if (!prod) return notificar('error', 'Seleccione un producto válido.')
    if (!mascotas.some(m => m.id === mascotaFichaSel)) return notificar('error', 'Seleccione una mascota válida.')
    if (!fechaValida(formVacuna.fechaAplicacion) || formVacuna.fechaAplicacion > new Date().toISOString().slice(0,10)) return notificar('error', 'Fecha de aplicación inválida.')
    if (!String(formVacuna.lote || prod.lote || '').trim()) return notificar('error', 'Debe indicar el lote.')
    if (prod.stock < 1) return notificar('error', `No hay stock de ${prod.nombre}.`)
    const fechaBase = new Date(formVacuna.fechaAplicacion + 'T12:00:00')
    if (formVacuna.tipo === 'Vacuna') fechaBase.setFullYear(fechaBase.getFullYear()+1); else fechaBase.setMonth(fechaBase.getMonth()+3)
    const proximoRefuerzo = fechaBase.toISOString().slice(0,10)
    try {
      const row = await insertarTabla('vacunas', { mascota_id:mascotaFichaSel, tipo:formVacuna.tipo, producto_nombre:prod.nombre, fecha_aplicacion:formVacuna.fechaAplicacion, lote:formVacuna.lote || prod.lote, proximo_refuerzo:proximoRefuerzo, responsable:usuarioActivo.nombre })
      const nuevo = { id:row.id, mascotaId:row.mascota_id, tipo:row.tipo, productoNombre:row.producto_nombre, fechaAplicacion:row.fecha_aplicacion, lote:row.lote, proximoRefuerzo:row.proximo_refuerzo, responsable:row.responsable }
      setVacunas(prev => [nuevo,...prev])
      await actualizarTabla('productos', prod.id, { stock:prod.stock-1 })
      setProductos(prev => prev.map(p => p.id === prod.id ? { ...p, stock:p.stock-1 } : p))
      const mov = await insertarTabla('movimientos_stock', { producto_id:prod.id, producto_nombre:prod.nombre, tipo:'Salida', cantidad:1, motivo:`Aplicación clínica ${formVacuna.tipo}`, responsable:usuarioActivo.nombre })
      setMovimientos(prev => [{ id:mov.id, productoId:mov.producto_id, productoNombre:mov.producto_nombre, tipo:mov.tipo, cantidad:mov.cantidad, motivo:mov.motivo, responsable:mov.responsable, fecha:mov.fecha },...prev])
      notificar('success', `Registro de ${formVacuna.tipo} guardado. Próximo refuerzo: ${proximoRefuerzo}.`)
    } catch (error) { notificar('error', `No se pudo completar la vacunación/actualización de stock: ${error.message}. Revise permisos y stock en Supabase.`); await cargarDatosSupabase(usuarioActivo) }
  }


  // CU10: Generar barrido de recordatorios automáticos (RF22, RF23, RF24)
  async function ejecutarBarridoRecordatorios() {
    const nuevos = []
    citas.filter(c => c.estado === 'Pendiente').forEach(c => {
      const m = mascotas.find(x => x.id === c.mascotaId); const cli = clientes.find(x => x.id === m?.clienteId)
      if (m && cli) { const contactoValido = cli.telefono && cli.telefono.startsWith('+569') && cli.telefono.length >= 11; nuevos.push({ fecha_envio:new Date().toISOString().slice(0,10), cliente_nombre:cli.nombre, mascota_nombre:`${m.nombre} (${m.fichaCodigo})`, contacto:cli.telefono || 'Sin teléfono', canal:'WhatsApp / Correo Automático', tipo:'Cita Próxima 24h (RF23)', mensaje:`Recordatorio automático: ${m.nombre} tiene cita (${c.servicio}) el ${c.fecha} a las ${c.hora} con ${c.veterinario}.`, estado_entrega:contactoValido ? 'Entregado' : 'No entregado (Contacto inválido)' }) }
    })
    if (!nuevos.length) return notificar('warning', 'No hay citas pendientes para generar recordatorios.')
    try { const { data, error } = await supabase.from('recordatorios').insert(nuevos.map(x => ({ ...x, user_id:supabaseSession.user.id }))).select('*'); if (error) throw error; const mapped=data.map(x=>({ id:x.id, fechaEnvio:x.fecha_envio, clienteNombre:x.cliente_nombre, mascotaNombre:x.mascota_nombre, contacto:x.contacto, canal:x.canal, tipo:x.tipo, mensaje:x.mensaje, estadoEntrega:x.estado_entrega })); setRecordatorios(prev=>[...mapped,...prev]); const fallidos=mapped.filter(x=>x.estadoEntrega.includes('No entregado')).length; notificar('success', `${mapped.length} recordatorios guardados en Supabase; ${fallidos} requieren revisar el contacto.`) }
    catch (error) { notificar('error', `No se pudieron guardar los recordatorios: ${error.message}`) }
  }


  // CU12 & CU13: Inventario y Movimientos de Stock (RF25-RF30)
  async function guardarProducto(e) {
    e.preventDefault()
    if (!formProducto.sku.trim() || !formProducto.nombre.trim()) return notificar('error', 'SKU y nombre son obligatorios.')
    if (!/^[A-Z0-9-]{3,20}$/i.test(formProducto.sku.trim())) return notificar('error', 'SKU inválido.')
    if (![formProducto.stock,formProducto.stockMinimo,formProducto.precio].every(v=>numeroEnRango(v,0,100000000) && Number.isInteger(Number(v)))) return notificar('error', 'Stock, mínimo y precio deben ser enteros no negativos.')
    if (!fechaValida(formProducto.fechaVencimiento) || formProducto.fechaVencimiento < new Date().toISOString().slice(0,10)) return notificar('error', 'Fecha de vencimiento inválida.')
    if (productos.some(p => p.sku.toLowerCase() === formProducto.sku.trim().toLowerCase())) return notificar('warning', 'El SKU ya existe.')
    try { const row=await insertarTabla('productos',{ sku:formProducto.sku.trim().toUpperCase(), nombre:formProducto.nombre.trim(), categoria:formProducto.categoria, stock:Number(formProducto.stock), stock_minimo:Number(formProducto.stockMinimo), precio:Number(formProducto.precio), fecha_vencimiento:formProducto.fechaVencimiento, lote:formProducto.lote.trim() || null }); const prod={ id:row.id, sku:row.sku, nombre:row.nombre, categoria:row.categoria, stock:row.stock, stockMinimo:row.stock_minimo, precio:row.precio, fechaVencimiento:row.fecha_vencimiento, lote:row.lote || '' }; setProductos(prev=>[prod,...prev]); setFormProducto({ sku:'', nombre:'', categoria:'Medicamentos', stock:10, stockMinimo:5, precio:12000, fechaVencimiento:'2027-06-30', lote:'' }); notificar('success', `Producto ${prod.nombre} guardado en Supabase.`) }
    catch(error) { notificar('error', `No se pudo guardar el producto: ${error.message}`) }
  }



  async function registrarMovimientoManual(e) {
    e.preventDefault(); const prod=productos.find(p=>p.id===formMovStock.productoId); if(!prod) return notificar('error','Seleccione un producto.')
    const cant=Number(formMovStock.cantidad); if(!Number.isInteger(cant)||cant<=0||cant>100000) return notificar('error','Cantidad inválida.')
    if(!String(formMovStock.motivo||'').trim()) return notificar('error','Indique el motivo del movimiento.')
    if(formMovStock.tipo==='Salida'&&cant>prod.stock) return notificar('error',`Stock insuficiente. Disponible: ${prod.stock}.`)
    const nuevoStock=formMovStock.tipo==='Entrada'?prod.stock+cant:prod.stock-cant
    try { await actualizarTabla('productos',prod.id,{stock:nuevoStock}); const row=await insertarTabla('movimientos_stock',{producto_id:prod.id,producto_nombre:prod.nombre,tipo:formMovStock.tipo,cantidad:cant,motivo:formMovStock.motivo.trim(),responsable:usuarioActivo.nombre}); setProductos(prev=>prev.map(p=>p.id===prod.id?{...p,stock:nuevoStock}:p)); setMovimientos(prev=>[{id:row.id,productoId:row.producto_id,productoNombre:row.producto_nombre,tipo:row.tipo,cantidad:row.cantidad,motivo:row.motivo,responsable:row.responsable,fecha:row.fecha},...prev]); notificar('success',`Movimiento guardado en Supabase. Nuevo stock: ${nuevoStock}.`) }
    catch(error) { notificar('error',`No se pudo guardar el movimiento: ${error.message}`); await cargarDatosSupabase(usuarioActivo) }
  }



  // CU15 & CU16: Ventas/Cobros y Gastos a Proveedores (RF26, RF31, RF32, RF33)
  async function registrarVentaCobro(e) {
    e.preventDefault(); const cli=clientes.find(c=>c.id===formVenta.clienteId); const masc=mascotas.find(m=>m.id===formVenta.mascotaId); const prod=productos.find(p=>p.id===formVenta.productoId)
    if(!cli) return notificar('error','Seleccione un cliente válido.'); if(!masc) return notificar('error','Seleccione una mascota válida.')
    if(!numeroEnRango(formVenta.servicioMonto,0,100000000)) return notificar('error','Monto de servicio inválido.')
    const cant=Number(formVenta.cantidadProd); if(!Number.isInteger(cant)||cant<0||cant>10000) return notificar('error','Cantidad de producto inválida.')
    if(cant>0&&!prod) return notificar('error','Seleccione un producto o deje la cantidad en cero.')
    if(prod&&cant>prod.stock) return notificar('error',`Stock insuficiente de ${prod.nombre}.`)
    const subtotal=prod?prod.precio*cant:0; const total=Number(formVenta.servicioMonto)+subtotal
    if(formVenta.estadoPago==='Deuda pendiente'&&(!numeroEnRango(formVenta.abonoInicial,0,100000000)||Number(formVenta.abonoInicial)>=total)) return notificar('error','El abono debe ser menor al total.')
    const saldo=formVenta.estadoPago==='Deuda pendiente'?Math.max(0,total-Number(formVenta.abonoInicial||0)):0; const folio=`BOL-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`
    const detalle=`${formVenta.servicioNombre}${prod&&cant>0?` + ${cant}x ${prod.nombre} ($${subtotal.toLocaleString('es-CL')})`:''}`
    try { const row=await insertarTabla('ventas',{folio,fecha:new Date().toISOString().slice(0,10),cliente_nombre:cli.nombre,mascota_nombre:`${masc.nombre} (${masc.fichaCodigo})`,detalle_items:detalle,total,medio_pago:formVenta.medioPago,estado_pago:formVenta.estadoPago,saldo_pendiente:saldo,responsable:usuarioActivo.nombre}); const venta={id:row.id,folio:row.folio,fecha:row.fecha,clienteNombre:row.cliente_nombre,mascotaNombre:row.mascota_nombre,detalleItems:row.detalle_items,total:row.total,medioPago:row.medio_pago,estadoPago:row.estado_pago,saldoPendiente:row.saldo_pendiente,responsable:row.responsable}; setVentas(prev=>[venta,...prev]);
      if(prod&&cant>0){ await actualizarTabla('productos',prod.id,{stock:prod.stock-cant}); const mov=await insertarTabla('movimientos_stock',{producto_id:prod.id,producto_nombre:prod.nombre,tipo:'Salida',cantidad:cant,motivo:`Venta ${folio}`,responsable:usuarioActivo.nombre}); setProductos(prev=>prev.map(p=>p.id===prod.id?{...p,stock:p.stock-cant}:p)); setMovimientos(prev=>[{id:mov.id,productoId:mov.producto_id,productoNombre:mov.producto_nombre,tipo:mov.tipo,cantidad:mov.cantidad,motivo:mov.motivo,responsable:mov.responsable,fecha:mov.fecha},...prev]) }
      notificar('success',`Venta ${folio} guardada en Supabase por $${total.toLocaleString('es-CL')}.`)
    } catch(error) { notificar('error',`No se pudo completar la venta o el movimiento de stock: ${error.message}`); await cargarDatosSupabase(usuarioActivo) }
  }



  async function saldarDeudaVenta(idVenta) {
    try { await actualizarTabla('ventas',idVenta,{estado_pago:'Pagado',saldo_pendiente:0}); setVentas(prev=>prev.map(v=>v.id===idVenta?{...v,estadoPago:'Pagado',saldoPendiente:0}:v)); notificar('success','Pago de deuda actualizado en Supabase.') }
    catch(error) { notificar('error',`No se pudo actualizar el pago: ${error.message}`) }
  }



  async function registrarGastoProveedor(e) {
    e.preventDefault(); if(!formGasto.proveedor.trim()||!formGasto.descripcion.trim()) return notificar('error','Proveedor y descripción son obligatorios.')
    if(formGasto.proveedor.trim().length<2||formGasto.descripcion.trim().length<5) return notificar('error','Proveedor o descripción demasiado cortos.')
    if(!numeroEnRango(formGasto.monto,1,100000000)||!Number.isInteger(Number(formGasto.monto))) return notificar('error','Monto inválido.')
    try { const row=await insertarTabla('gastos',{fecha:new Date().toISOString().slice(0,10),proveedor:formGasto.proveedor.trim(),categoria:formGasto.categoria,descripcion:formGasto.descripcion.trim(),monto:Number(formGasto.monto),estado:formGasto.estado,responsable:usuarioActivo.nombre}); const nuevo={id:row.id,fecha:row.fecha,proveedor:row.proveedor,categoria:row.categoria,descripcion:row.descripcion,monto:row.monto,estado:row.estado,responsable:row.responsable}; setGastos(prev=>[nuevo,...prev]); setFormGasto({proveedor:'',categoria:'Insumos y Vacunas',descripcion:'',monto:45000,estado:'Pagado'}); notificar('success',`Gasto de ${nuevo.proveedor} guardado en Supabase.`) }
    catch(error) { notificar('error',`No se pudo guardar el gasto: ${error.message}`) }
  }



  // CU17: Exportar Reportes a Excel (CSV UTF-8 BOM) o PDF/Impresión (RF34)
  function exportarReporteCSV() {
    let filas = []
    if (tipoReporte === 'ventas') {
      filas = [['Folio', 'Fecha', 'Cliente', 'Mascota', 'Detalle', 'Total CLP', 'Medio Pago', 'Estado Pago', 'Saldo Pendiente']]
      ventas.forEach(v => filas.push([v.folio, v.fecha, v.clienteNombre, v.mascotaNombre, v.detalleItems, v.total, v.medioPago, v.estadoPago, v.saldoPendiente]))
    } else if (tipoReporte === 'gastos') {
      filas = [['Fecha', 'Proveedor', 'Categoria', 'Descripcion', 'Monto CLP', 'Estado', 'Responsable']]
      gastos.forEach(g => filas.push([g.fecha, g.proveedor, g.categoria, g.descripcion, g.monto, g.estado, g.responsable]))
    } else if (tipoReporte === 'stock') {
      filas = [['SKU', 'Producto', 'Categoria', 'Stock Actual', 'Stock Minimo', 'Precio CLP', 'Vencimiento', 'Lote']]
      productos.forEach(p => filas.push([p.sku, p.nombre, p.categoria, p.stock, p.stockMinimo, p.precio, p.fechaVencimiento, p.lote]))
    } else {
      filas = [['Fecha', 'Hora', 'Mascota ID', 'Servicio', 'Veterinario', 'Estado', 'Urgencia']]
      citas.forEach(c => filas.push([c.fecha, c.hora, c.mascotaId, c.servicio, c.veterinario, c.estado, c.esUrgencia ? 'SI' : 'NO']))
    }
    const csvContent = '\uFEFF' + filas.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Reporte_${tipoReporte}_PatitasFelices_${rangoInicio}_${rangoFin}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notificar('success', `Reporte de ${tipoReporte.toUpperCase()} exportado a archivo Excel (.csv) correctamente (CU17, RF34).`)
  }

  // CU02: Gestión de Usuarios y Desbloqueo de Cuentas (RF02, RF03, RF04)
  async function crearNuevoUsuarioClinica(e) {
    e.preventDefault()
    if (!formUsuario.nombre.trim() || !formUsuario.correo.trim() || !formUsuario.rut.trim() || !formUsuario.authUserId.trim()) return notificar('error', 'Complete nombre, RUT, correo y UID de Supabase Auth.')
    if (formUsuario.nombre.trim().length < 3 || /\d/.test(formUsuario.nombre)) return notificar('error', 'El nombre debe tener al menos 3 caracteres y no contener números.')
    if (!validarRutChile(formUsuario.rut)) return notificar('error', 'El RUT ingresado no es válido.')
    if (!correoValido(formUsuario.correo)) return notificar('error', 'Ingrese un correo electrónico válido.')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(formUsuario.authUserId.trim())) return notificar('error', 'El UID debe ser el UUID de la cuenta creada en Supabase Auth.')
    if (usuarios.some(u => u.correo.toLowerCase() === formUsuario.correo.trim().toLowerCase() || u.rut.replace(/[.\s]/g, '').toUpperCase() === formUsuario.rut.replace(/[.\s]/g, '').toUpperCase() || u.authUserId === formUsuario.authUserId.trim())) return notificar('error', 'El correo, RUT o UID ya está asociado a un perfil.')
    try {
      const { data, error } = await supabase.from('usuarios_clinica').insert({ nombre:formUsuario.nombre.trim(), rut:formUsuario.rut.trim(), correo:formUsuario.correo.trim().toLowerCase(), rol:formUsuario.rol, especialidad:formUsuario.especialidad.trim() || null, activo:true, intentos_fallidos:0, bloqueado:false, auth_user_id:formUsuario.authUserId.trim() }).select('*').single()
      if (error) throw error
      const nuevo = { id:data.id, authUserId:data.auth_user_id, nombre:data.nombre, rut:data.rut, correo:data.correo, rol:data.rol, especialidad:data.especialidad || '', activo:data.activo, intentos:data.intentos_fallidos || 0, bloqueado:!!data.bloqueado }
      setUsuarios(prev => [...prev,nuevo]); setFormUsuario({ nombre:'', rut:'', correo:'', authUserId:'', rol:'Asistente', especialidad:'' }); notificar('success', `Perfil de ${nuevo.nombre} creado en usuarios_clinica. La cuenta Auth ya debe existir.`)
    } catch (error) { notificar('error', `No se pudo crear el perfil: ${error.message}`) }
  }

  async function alternarEstadoUsuario(idUser) {
    const objetivo=usuarios.find(u=>u.id===idUser); if(!objetivo) return
    try { await actualizarTabla('usuarios_clinica',idUser,{activo:!objetivo.activo}); setUsuarios(prev=>prev.map(u=>u.id===idUser?{...u,activo:!u.activo}:u)); notificar('success','Estado del usuario actualizado en Supabase.') }
    catch(error) { notificar('error',`No se pudo actualizar el usuario: ${error.message}`) }
  }

  async function desbloquearUsuario(idUser) {
    try { await actualizarTabla('usuarios_clinica',idUser,{intentos_fallidos:0,bloqueado:false}); setUsuarios(prev=>prev.map(u=>u.id===idUser?{...u,intentos:0,bloqueado:false}:u)); notificar('success','Cuenta desbloqueada en Supabase.') }
    catch(error) { notificar('error',`No se pudo desbloquear: ${error.message}`) }
  }



  // Cálculos derivados para alertas y KPIs
  const productosStockBajo = productos.filter(p => p.stock <= p.stockMinimo)
  const hoyDate = new Date('2026-11-16T00:00:00')
  const productosPorVencer = productos.filter(p => {
    const f = new Date(p.fechaVencimiento + 'T00:00:00')
    const diffDias = (f - hoyDate) / (1000 * 60 * 60 * 24)
    return diffDias <= 30
  })
  const totalIngresos = ventas.reduce((acc, v) => acc + v.total, 0)
  const totalDeudas = ventas.reduce((acc, v) => acc + (v.saldoPendiente || 0), 0)
  const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0)

  // ===========================================================================
  // VISTA 0: PANTALLA DE ACCESO (SI NO HAY USUARIO ACTIVO)
  // ===========================================================================
  if (!usuarioActivo) {
    return (
      <div className="login-wrapper">
        <div className="login-grid">
          <div className="login-brand">
            <div className="login-brand-text">
              <span className="brand-badge">INACAP Sede Arica · Ingeniería de Software</span>
              <h1>Patitas Felices</h1>
              <p>
                Agenda, fichas clínicas, inventario y caja de la clínica en un solo lugar.
              </p>

              <div className="role-demo-box">
                <h3>Acceso de demostración deshabilitado</h3>
                <div className="role-demo-buttons">
                  <button type="button" className="btn-role-demo" onClick={() => loginRapidoRol('Administrador')}>
                    Administrador
                    <span>Dr. Fernando Soto</span>
                  </button>
                  <button type="button" className="btn-role-demo" onClick={() => loginRapidoRol('Veterinario')}>
                    Veterinario
                    <span>Dra. Camila Rojas</span>
                  </button>
                  <button type="button" className="btn-role-demo" onClick={() => loginRapidoRol('Recepcionista')}>
                    Recepcionista
                    <span>Carla Morales</span>
                  </button>
                  <button type="button" className="btn-role-demo" onClick={() => loginRapidoRol('Asistente')}>
                    Asistente
                    <span>Tomás Araya</span>
                  </button>
                </div>
              </div>
            </div>

            <svg className="login-art" viewBox="0 0 600 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
              <defs>
                <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#0B3A4A" />
                  <stop offset="1" stopColor="#1B6A78" />
                </linearGradient>
              </defs>
              <rect width="600" height="260" fill="url(#cielo)" />
              <circle cx="455" cy="118" r="52" fill="#F5B335" />
              <g fill="#0B3A4A" transform="translate(455 124) scale(1.25)">
                <ellipse cx="-11" cy="-4" rx="3.6" ry="5" /><ellipse cx="11" cy="-4" rx="3.6" ry="5" />
                <ellipse cx="-4.6" cy="-12" rx="3.6" ry="5" /><ellipse cx="4.6" cy="-12" rx="3.6" ry="5" />
                <path d="M0 0c-7 0-12 5-12 10 0 3.4 2.8 5 5.8 5 2.2 0 3.8-1 6.2-1s4 1 6.2 1c3 0 5.8-1.6 5.8-5 0-5-5-10-12-10z" />
              </g>
              <path d="M0 168 C70 150 120 120 190 112 C240 106 262 128 300 140 C330 150 350 160 380 164 L600 172 L600 260 L0 260 Z" fill="#12505F" />
              <path d="M0 196 C80 184 150 202 230 192 C320 180 400 204 600 188 L600 260 L0 260 Z" fill="#0F8B8D" opacity=".85" />
              <path d="M0 220 C90 208 170 228 270 218 C370 208 470 230 600 214 L600 260 L0 260 Z" fill="#0A6C6E" />
              <path d="M0 242 C100 232 190 248 300 240 C400 232 500 248 600 238 L600 260 L0 260 Z" fill="#074F52" />
            </svg>

            <div className="login-brand-footer">
              <div className="stack-pills">
                <span className="stack-pill">React 19 + Vite</span>
                <span className="stack-pill">Supabase Auth</span>
                <span className="stack-pill">PostgreSQL + RLS</span>
                <span className="stack-pill">Grupo 5: G. Aguayo · D. Quispe</span>
              </div>
            </div>
          </div>

          <div className="login-form-side">
            <h2>Iniciar sesión</h2>
            <p className="login-subtitle">
              Ingresa con tu cuenta del personal o con una cuenta de prueba de Supabase Auth (<code>Credenciales de demostración</code>).
            </p>

            {alertaGlobal && (
              <div className={`alert-box alert-${alertaGlobal.tipo === 'error' ? 'error' : alertaGlobal.tipo === 'warning' ? 'warning' : 'success'}`}>
                {alertaGlobal.texto}
              </div>
            )}

            <form onSubmit={manejarLogin}>
              <div className="form-group">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  className="form-control"
                  value={correoLogin}
                  onChange={(e) => setCorreoLogin(e.target.value)}
                  placeholder="Ej: admin@patitasfelices.cl o alumno1@prueba.cl"
                  required
                />
              </div>

              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  className="form-control"
                  value={passLogin}
                  onChange={(e) => setPassLogin(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                />
              </div>

              <button type="submit" className="btn-primary-vet" style={{ width: '100%', marginBottom: '10px' }}>
                Ingresar
              </button>

              <button
                type="button"
                className="btn-outline-vet"
                style={{ width: '100%' }}
                onClick={simularBloqueoRF04}
              >
                Probar bloqueo tras 3 intentos fallidos (RF04)
              </button>
            </form>

            <div style={{ marginTop: '16px', fontSize: '12px', color: '#475569', background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <strong>Credenciales de demostración:</strong><br />
              • Admin: <code>admin@patitasfelices.cl</code> / <code>abcd.123</code><br />
              • Veterinario: <code>veterinario@patitasfelices.cl</code> / <code>Vet2026!</code><br />
              • Recepcionista: <code>recepcion@patitasfelices.cl</code> / <code>Recep2026!</code><br />
              • Asistente: <code>asistente@patitasfelices.cl</code> / <code>Asist2026!</code>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const permisosRol = ROLES_PERMISOS[usuarioActivo.rol] || ROLES_PERMISOS.Asistente
  const mascotaActivaObj = mascotas.find(m => m.id === mascotaFichaSel) || mascotas[0]
  const clienteMascotaActiva = clientes.find(c => c.id === mascotaActivaObj?.clienteId)

  // Guardia de ruta: nunca se renderiza un módulo que el rol no tenga permitido (OWASP A01)
  const moduloVisible = permisosRol.modulos.includes(moduloActual) ? moduloActual : 'dashboard'

  const MENU_ITEMS = [
    { grupo: 'Atención', id: 'dashboard', label: 'Panel general', badge: '' },
    { grupo: 'Atención', id: 'clientes', label: 'Clientes y mascotas', badge: `${mascotas.length}` },
    { grupo: 'Atención', id: 'citas', label: 'Agenda y urgencias', badge: `${citas.filter(c => c.estado !== 'Cancelada').length}` },
    { grupo: 'Atención', id: 'recordatorios', label: 'Recordatorios', badge: `${recordatorios.length}` },
    { grupo: 'Clínica', id: 'fichas', label: 'Fichas y vacunas', badge: '' },
    { grupo: 'Clínica', id: 'inventario', label: 'Inventario', badge: `${productosStockBajo.length + productosPorVencer.length}`, alerta: productosStockBajo.length + productosPorVencer.length > 0 },
    { grupo: 'Gestión', id: 'finanzas', label: 'Ventas y gastos', badge: '' },
    { grupo: 'Gestión', id: 'reportes', label: 'Reportes', badge: '' },
    { grupo: 'Gestión', id: 'usuarios', label: 'Usuarios y roles', badge: '' },
    { grupo: 'Sistema', id: 'seguridad', label: 'Seguridad y SaaS', badge: '' }
  ]

  return (
    <div className="app-shell">
      {/* BARRA LATERAL CON CONTROL DE ACCESO POR ROL */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <div className="sidebar-logo" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="6.5" cy="10" rx="2" ry="2.7"/><ellipse cx="17.5" cy="10" rx="2" ry="2.7"/><ellipse cx="10" cy="5.8" rx="2" ry="2.7"/><ellipse cx="14" cy="5.8" rx="2" ry="2.7"/><path d="M12 12c-3 0-5.5 2.6-5.5 5 0 1.6 1.3 2.4 2.7 2.4 1 0 1.8-.5 2.8-.5s1.8.5 2.8.5c1.4 0 2.7-.8 2.7-2.4 0-2.4-2.5-5-5.5-5z"/></svg>
            </div>
            <div>
              <h2>Patitas Felices</h2>
              <span>Sede Arica</span>
            </div>
          </div>

          <div className="sesion-box">
            <small>Sesión activa</small>
            <strong>{usuarioActivo.nombre}</strong>
            <span className="tag">{usuarioActivo.rol}</span>
          </div>

          <nav className="nav-menu">
            {MENU_ITEMS.map((item, idx) => {
              const habilitado = permisosRol.modulos.includes(item.id)
              const nuevoGrupo = idx === 0 || MENU_ITEMS[idx - 1].grupo !== item.grupo
              return (
                <Fragment key={item.id}>
                  {nuevoGrupo && <div className="nav-grupo">{item.grupo}</div>}
                  <button
                    type="button"
                    className={`nav-btn ${moduloVisible === item.id ? 'active' : ''} ${!habilitado ? 'disabled-role' : ''}`}
                    aria-current={moduloVisible === item.id ? 'page' : undefined}
                    onClick={() => {
                      if (!habilitado) {
                        notificar('error', `RESTRICCIÓN DE ROL (RF02 / OWASP A01): El rol "${usuarioActivo.rol}" no tiene autorización para acceder al módulo "${item.label}".`)
                        return
                      }
                      setModuloActual(item.id)
                    }}
                  >
                    <Icono id={item.id} />
                    <span className="nav-text">{item.label}</span>
                    {!habilitado
                      ? <span className="nav-badge">Sin acceso</span>
                      : item.badge !== '' && <span className={`nav-badge ${item.alerta ? 'alerta' : ''}`}>{item.badge}</span>}
                  </button>
                </Fragment>
              )
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div>Backend: <strong>Supabase (PostgreSQL + Auth)</strong></div>
          <div>Protección: <strong>RLS + JWT + Ley 21.719</strong></div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <h1>{(MENU_ITEMS.find(m => m.id === moduloVisible)?.label || '').replace(/^\d+\.\s*/, '')}</h1>
            <p>{permisosRol.descripcion}</p>
          </div>

          <div className="topbar-right">
            <span className={`status-pill ${modoOffline ? 'status-offline' : 'status-online'}`} onClick={() => setModoOffline(!modoOffline)} style={{ cursor: 'pointer' }} title="Haz clic para simular caída/recuperación de internet (RNF04)">
              {modoOffline ? '⚡ Modo Sin Conexión Activo (Caché Local RNF04)' : '🟢 Supabase Cloud + RLS Sincronizado'}
            </span>

            {rolSesion === 'Administrador' && (
            <div className="role-switcher-bar">
              <strong>Cambiar Rol (Demo):</strong>
              <select value={usuarioActivo.rol} onChange={(e) => cambiarRolEnVivo(e.target.value)}>
                <option value="Administrador">Administrador (Acceso Total)</option>
                <option value="Veterinario">Veterinario (Clínica y Fichas)</option>
                <option value="Recepcionista">Recepcionista (Citas y Caja)</option>
                <option value="Asistente">Asistente (Vacunas y Stock)</option>
              </select>
            </div>
            )}

            <button type="button" className="btn-danger-vet" onClick={cerrarSesionCompleta}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <main className="content-body">
          {alertaGlobal && (
            <div className={`alert-box alert-${alertaGlobal.tipo === 'error' ? 'error' : alertaGlobal.tipo === 'warning' ? 'warning' : 'success'}`}>
              {alertaGlobal.texto}
            </div>
          )}

          {/* ===============================================================
              MÓDULO 1: DASHBOARD GENERAL
              =============================================================== */}
          {moduloVisible === 'dashboard' && (
            <div>
              <div className="kpi-grid">
                <div className="kpi-card urgent">
                  <div className="kpi-title">Citas y Urgencias Hoy</div>
                  <div className="kpi-value">{citas.filter(c => c.estado !== 'Cancelada').length}</div>
                  <div className="kpi-sub">{citas.filter(c => c.esUrgencia).length} urgencia(s) con prioridad alta (RF21)</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">Fichas Clínicas Digitales</div>
                  <div className="kpi-value">{mascotas.length}</div>
                  <div className="kpi-sub">{clientes.length} tutores registrados en Arica (RF16)</div>
                </div>
                <div className="kpi-card warn">
                  <div className="kpi-title">Alertas de Farmacia</div>
                  <div className="kpi-value">{productosStockBajo.length + productosPorVencer.length}</div>
                  <div className="kpi-sub">{productosStockBajo.length} stock crítico (RF28) · {productosPorVencer.length} por vencer (RF29)</div>
                </div>
                <div className="kpi-card finance">
                  <div className="kpi-title">Ingresos Registrados</div>
                  <div className="kpi-value">${totalIngresos.toLocaleString('es-CL')}</div>
                  <div className="kpi-sub">Deudas por cobrar: ${totalDeudas.toLocaleString('es-CL')} (RF32)</div>
                </div>
              </div>

              <div className="panel-grid-2">
                <div className="card-panel">
                  <h3>
                    <span>Agenda Prioritaria de Hoy (16 Nov 2026)</span>
                    <span className="tag tag-teal">CU06 · RF14 · RF21</span>
                  </h3>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Paciente</th>
                          <th>Servicio / Motivo</th>
                          <th>Veterinario</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {citas.slice(0, 5).map(c => {
                          const m = mascotas.find(x => x.id === c.mascotaId)
                          return (
                            <tr key={c.id}>
                              <td><strong>{c.hora}</strong></td>
                              <td>
                                <strong>{m?.nombre}</strong> ({m?.especie})
                                {c.esUrgencia && <span className="tag tag-red" style={{ marginLeft: '6px' }}>URGENCIA</span>}
                              </td>
                              <td>{c.servicio}</td>
                              <td>{c.veterinario}</td>
                              <td>
                                <span className={`tag ${c.estado === 'Atendida' ? 'tag-green' : c.estado === 'En espera' ? 'tag-red' : 'tag-amber'}`}>
                                  {c.estado}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card-panel">
                  <h3>
                    <span>Alertas Activas de Stock y Vencimiento (CU14)</span>
                    <span className="tag tag-red">RF28 · RF29</span>
                  </h3>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Stock</th>
                          <th>Vencimiento</th>
                          <th>Tipo de Alerta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.filter(p => p.stock <= p.stockMinimo || productosPorVencer.some(v => v.id === p.id)).map(p => (
                          <tr key={p.id}>
                            <td><strong>{p.nombre}</strong><br /><small>{p.sku}</small></td>
                            <td><strong>{p.stock} u.</strong> (Mín: {p.stockMinimo})</td>
                            <td>{p.fechaVencimiento}</td>
                            <td>
                              {p.stock <= p.stockMinimo && <span className="tag tag-red" style={{ marginRight: '4px' }}>Stock Bajo (RF28)</span>}
                              {productosPorVencer.some(v => v.id === p.id) && <span className="tag tag-amber">Próx. a Vencer (RF29)</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card-panel">
                <h3>
                  <span>Matriz de Permisos y Restricciones por Rol en el Prototipo (Actividad 2 EV03)</span>
                  <span className="tag tag-blue">RBAC + Supabase RLS</span>
                </h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rol del Sistema</th>
                        <th>Dotación (EV02)</th>
                        <th>Módulos Habilitados</th>
                        <th>Restricciones de Seguridad Aplicadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Administrador</strong></td>
                        <td>1 (Propietario)</td>
                        <td>Todos los módulos (Usuarios, Clientes, Citas, Fichas, Recordatorios, Inventario, Finanzas, Reportes)</td>
                        <td>Único rol autorizado para crear/desactivar cuentas (RF03), gestionar catálogo (RF25), registrar gastos (RF33) y exportar reportes (RF34).</td>
                      </tr>
                      <tr>
                        <td><strong>Veterinario</strong></td>
                        <td>3 profesionales</td>
                        <td>Panel General, Clientes/Mascotas, Agenda, Fichas Clínicas/Vacunas, Consulta Inventario</td>
                        <td>Bloqueado para administrar usuarios, registrar cobros de caja, ingresar gastos a proveedores o exportar balances financieros.</td>
                      </tr>
                      <tr>
                        <td><strong>Recepcionista</strong></td>
                        <td>1 administrativo</td>
                        <td>Panel General, Clientes/Mascotas, Agenda de Citas, Recordatorios Automáticos, Ventas y Cobros</td>
                        <td>Bloqueado para alterar diagnósticos/tratamientos en Fichas Clínicas (Ley 21.719), administrar inventario o gestionar usuarios.</td>
                      </tr>
                      <tr>
                        <td><strong>Asistente</strong></td>
                        <td>3 asistentes</td>
                        <td>Panel General, Consulta Agenda, Consulta Fichas y Vacunación/Urgencias, Movimientos de Stock</td>
                        <td>Bloqueado para cobros de caja, gastos a proveedores, reportes gerenciales y administración de cuentas de usuario.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 2: CLIENTES Y MASCOTAS (CU03 | RF05-RF09, RF16, RNF03)
              =============================================================== */}
          {moduloVisible === 'clientes' && (
            <div>
              <div className="card-panel">
                <h3>
                  <span>Buscador Rápido de Clientes y Mascotas (&lt; 3 segundos – RNF03)</span>
                  <span className="tag tag-teal">RF07 · RNF01 · RNF03</span>
                </h3>
                <input
                  type="text"
                  className="form-control"
                  value={busquedaCliente}
                  onChange={(e) => setBusquedaCliente(e.target.value)}
                  placeholder="Buscar instantáneamente por nombre del tutor, RUT, teléfono o nombre/ficha de mascota..."
                />
              </div>

              <div className="panel-grid-2">
                <div className="card-panel">
                  <h3>
                    <span>{formCliente.id ? 'Editar Cliente (RF08)' : 'Registrar Nuevo Cliente (RF05)'}</span>
                    <span className="tag tag-blue">CU03</span>
                  </h3>
                  <form onSubmit={guardarCliente}>
                    <div className="form-group">
                      <label>RUT del Cliente</label>
                      <input className="form-control" value={formCliente.rut} onChange={e => setFormCliente({ ...formCliente, rut: e.target.value })} placeholder="Ej: 16.432.110-8" required />
                    </div>
                    <div className="form-group">
                      <label>Nombre Completo</label>
                      <input className="form-control" value={formCliente.nombre} onChange={e => setFormCliente({ ...formCliente, nombre: e.target.value })} placeholder="Nombre y Apellidos" required />
                    </div>
                    <div className="form-group">
                      <label>Teléfono Móvil (WhatsApp Recordatorios)</label>
                      <input className="form-control" value={formCliente.telefono} onChange={e => setFormCliente({ ...formCliente, telefono: e.target.value })} placeholder="+56987654321" required />
                    </div>
                    <div className="form-group">
                      <label>Correo Electrónico y Dirección en Arica</label>
                      <input className="form-control" value={formCliente.direccion} onChange={e => setFormCliente({ ...formCliente, direccion: e.target.value })} placeholder="Av. 18 de Septiembre #1230, Arica" />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className="btn-primary-vet">{formCliente.id ? 'Guardar Cambios (RF08)' : 'Registrar Cliente (RF05)'}</button>
                      {formCliente.id && (
                        <button type="button" className="btn-secondary-vet" onClick={() => setFormCliente({ id: '', rut: '', nombre: '', telefono: '', correo: '', direccion: '' })}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                <div className="card-panel">
                  <h3>
                    <span>Vincular Mascota y Abrir Ficha Digital (RF06, RF09, RF16)</span>
                    <span className="tag tag-teal">Multi-Mascota</span>
                  </h3>
                  <form onSubmit={guardarMascota}>
                    <div className="form-group">
                      <label>Cliente Titular (Permite varias mascotas por cliente - RF09)</label>
                      <select className="form-control" value={formMascota.clienteId} onChange={e => setFormMascota({ ...formMascota, clienteId: e.target.value })}>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre} ({c.rut})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Nombre de la Mascota</label>
                        <input className="form-control" value={formMascota.nombre} onChange={e => setFormMascota({ ...formMascota, nombre: e.target.value })} placeholder="Ej: Toby" required />
                      </div>
                      <div className="form-group">
                        <label>Especie</label>
                        <select className="form-control" value={formMascota.especie} onChange={e => setFormMascota({ ...formMascota, especie: e.target.value })}>
                          <option value="Perro">Perro</option>
                          <option value="Gato">Gato</option>
                          <option value="Conejo">Conejo</option>
                          <option value="Ave">Ave</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Raza</label>
                        <input className="form-control" value={formMascota.raza} onChange={e => setFormMascota({ ...formMascota, raza: e.target.value })} placeholder="Ej: Labrador" />
                      </div>
                      <div className="form-group">
                        <label>Sexo</label>
                        <select className="form-control" value={formMascota.sexo} onChange={e => setFormMascota({ ...formMascota, sexo: e.target.value })}>
                          <option value="Macho">Macho</option>
                          <option value="Hembra">Hembra</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Peso (kg)</label>
                        <input type="number" step="0.1" className="form-control" value={formMascota.peso} onChange={e => setFormMascota({ ...formMascota, peso: e.target.value })} placeholder="12.5" required />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary-vet">Registrar Mascota y Generar Ficha Clínica (RF16)</button>
                  </form>
                </div>
              </div>

              <div className="card-panel">
                <h3>Directorio de Clientes y sus Mascotas Asociadas</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>RUT / Cliente</th>
                        <th>Teléfono / Dirección</th>
                        <th>Mascotas Asociadas y Código de Ficha (RF09, RF16)</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.filter(c => {
                        const q = busquedaCliente.toLowerCase()
                        if (!q) return true
                        const mascotasCli = mascotas.filter(m => m.clienteId === c.id)
                        return c.nombre.toLowerCase().includes(q) ||
                               c.rut.toLowerCase().includes(q) ||
                               c.telefono.toLowerCase().includes(q) ||
                               mascotasCli.some(m => m.nombre.toLowerCase().includes(q) || m.fichaCodigo.toLowerCase().includes(q))
                      }).map(c => {
                        const mascotasCli = mascotas.filter(m => m.clienteId === c.id)
                        return (
                          <tr key={c.id}>
                            <td><strong>{c.nombre}</strong><br /><span className="tag tag-blue">{c.rut}</span></td>
                            <td>{c.telefono}<br /><small>{c.direccion}</small></td>
                            <td>
                              {mascotasCli.map(m => (
                                <div key={m.id} style={{ marginBottom: '4px' }}>
                                  <span className="tag tag-teal">{m.fichaCodigo}</span> <strong>{m.nombre}</strong> ({m.especie} · {m.raza} · {m.peso} kg)
                                </div>
                              ))}
                            </td>
                            <td>
                              <button type="button" className="btn-outline-vet" onClick={() => setFormCliente(c)}>
                                Editar (RF08)
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 3: AGENDA DE CITAS Y URGENCIAS (CU04, CU05, CU06, CU11)
              =============================================================== */}
          {moduloVisible === 'citas' && (
            <div className="panel-grid-sidebar">
              <div className="card-panel">
                <h3>
                  <span>Agendar Cita / Urgencia</span>
                  <span className="tag tag-teal">CU04 · CU11</span>
                </h3>
                <form onSubmit={guardarCita}>
                  <div className="form-group">
                    <label>Paciente (Mascota y Tutor)</label>
                    <select className="form-control" value={formCita.mascotaId} onChange={e => setFormCita({ ...formCita, mascotaId: e.target.value })}>
                      {mascotas.map(m => {
                        const cli = clientes.find(c => c.id === m.clienteId)
                        return <option key={m.id} value={m.id}>{m.nombre} ({m.fichaCodigo}) - Tutor: {cli?.nombre}</option>
                      })}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Médico Veterinario Asignado</label>
                    <select className="form-control" value={formCita.veterinario} onChange={e => setFormCita({ ...formCita, veterinario: e.target.value })}>
                      <option value="Dra. Camila Rojas">Dra. Camila Rojas (Medicina Interna)</option>
                      <option value="Dr. Martín Vega">Dr. Martín Vega (Dermatología y Exóticos)</option>
                      <option value="Dra. Valentina Ríos">Dra. Valentina Ríos (Preventiva y Felinos)</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label>Fecha</label>
                      <input type="date" className="form-control" value={formCita.fecha} onChange={e => setFormCita({ ...formCita, fecha: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Hora seleccionada</label>
                      <select className="form-control" value={formCita.hora} onChange={e => setFormCita({ ...formCita, hora: e.target.value })}>
                        {HORARIOS_BASE.map(h => <option key={h} value={h}>{h} hrs</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Horarios Disponibles para {formCita.veterinario} (RF12):</label>
                    <div className="slot-grid">
                      {HORARIOS_BASE.map(h => {
                        const ocupado = citas.some(c => c.fecha === formCita.fecha && c.hora === h && c.veterinario === formCita.veterinario && c.estado !== 'Cancelada')
                        return (
                          <span
                            key={h}
                            className={`slot-chip ${ocupado ? 'slot-busy' : 'slot-free'}`}
                            onClick={() => !ocupado && setFormCita({ ...formCita, hora: h })}
                          >
                            {h} {ocupado ? 'Ocupado' : 'Libre'}
                          </span>
                        )
                      })}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Servicio Requerido</label>
                    <select className="form-control" value={formCita.servicio} onChange={e => setFormCita({ ...formCita, servicio: e.target.value })}>
                      <option value="Consulta General">Consulta General</option>
                      <option value="Vacunación / Control Sano">Vacunación / Control Sano</option>
                      <option value="Desparasitación Interna/Externa">Desparasitación Interna/Externa</option>
                      <option value="Control Dermatológico">Control Dermatológico</option>
                      <option value="Cirugía Menor / Procedimiento">Cirugía Menor / Procedimiento</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ background: '#FDECEF', padding: '10px', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#991B1B', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formCita.esUrgencia} onChange={e => setFormCita({ ...formCita, esUrgencia: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                      🚨 Ingresar como Atención de Urgencia Prioritaria (CU11 / RF21)
                    </label>
                  </div>

                  <button type="submit" className={formCita.esUrgencia ? 'btn-danger-vet' : 'btn-primary-vet'} style={{ width: '100%' }}>
                    {formCita.esUrgencia ? 'Registrar Urgencia con Prioridad Inmediata (RF21)' : 'Confirmar y Agendar Cita (RF10, RF11)'}
                  </button>
                </form>
              </div>

              <div className="card-panel">
                <h3>
                  <span>Agenda {vistaAgenda === 'diaria' ? 'Diaria' : 'Semanal'} Consolidada por Veterinario (RF14)</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn-outline-vet" onClick={() => setVistaAgenda(vistaAgenda === 'diaria' ? 'semanal' : 'diaria')}>
                      Cambiar a Vista {vistaAgenda === 'diaria' ? 'Semanal' : 'Diaria'}
                    </button>
                  </div>
                </h3>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <select className="form-control" style={{ maxWidth: '260px' }} value={filtroVetCita} onChange={e => setFiltroVetCita(e.target.value)}>
                    <option value="Todos">Todos los Veterinarios (3)</option>
                    <option value="Dra. Camila Rojas">Dra. Camila Rojas</option>
                    <option value="Dr. Martín Vega">Dr. Martín Vega</option>
                    <option value="Dra. Valentina Ríos">Dra. Valentina Ríos</option>
                  </select>
                  {vistaAgenda === 'diaria' && (
                    <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={filtroFechaCita} onChange={e => setFiltroFechaCita(e.target.value)} />
                  )}
                </div>

                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha / Hora</th>
                        <th>Mascota / Ficha</th>
                        <th>Servicio</th>
                        <th>Veterinario</th>
                        <th>Estado (RF15)</th>
                        <th>Acciones (CU05 / RF13)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citas.filter(c => {
                        if (filtroVetCita !== 'Todos' && c.veterinario !== filtroVetCita) return false
                        if (vistaAgenda === 'diaria' && c.fecha !== filtroFechaCita) return false
                        return true
                      }).map(c => {
                        const m = mascotas.find(x => x.id === c.mascotaId)
                        return (
                          <tr key={c.id}>
                            <td><strong>{c.fecha}</strong><br />{c.hora} hrs</td>
                            <td>
                              <strong>{m?.nombre}</strong> ({m?.fichaCodigo})
                              {c.esUrgencia && <span className="tag tag-red" style={{ display: 'block', marginTop: '3px' }}>🚨 Prioridad Urgencia</span>}
                            </td>
                            <td>{c.servicio}</td>
                            <td>{c.veterinario}</td>
                            <td>
                              <span className={`tag ${c.estado === 'Atendida' ? 'tag-green' : c.estado === 'Cancelada' ? 'tag-red' : 'tag-amber'}`}>
                                {c.estado}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button type="button" className="btn-outline-vet" onClick={() => reprogramarCita(c)}>Reprogramar</button>
                                {c.estado !== 'Cancelada' && (
                                  <button type="button" className="btn-danger-vet" onClick={() => cambiarEstadoCita(c.id, 'Cancelada')}>Cancelar</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 4: FICHAS CLÍNICAS Y VACUNAS (CU07, CU08, CU09 | RF16-RF20)
              =============================================================== */}
          {moduloVisible === 'fichas' && (
            <div>
              <div className="card-panel">
                <h3>
                  <span>Seleccionar Ficha Clínica Digital de Mascota (CU08 · RF16 · RF18)</span>
                  <span className="tag tag-teal">Búsqueda &lt; 1 seg</span>
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select className="form-control" style={{ maxWidth: '420px' }} value={mascotaFichaSel} onChange={e => setMascotaFichaSel(e.target.value)}>
                    {mascotas.map(m => {
                      const cli = clientes.find(c => c.id === m.clienteId)
                      return <option key={m.id} value={m.id}>{m.fichaCodigo} — {m.nombre} ({m.especie} · {m.raza}) — Tutor: {cli?.nombre}</option>
                    })}
                  </select>
                  {mascotaActivaObj && (
                    <div style={{ fontSize: '13.5px', color: '#1E293B' }}>
                      <strong>Sexo:</strong> {mascotaActivaObj.sexo} | <strong>Peso actual:</strong> {mascotaActivaObj.peso} kg | <strong>Alergias/Alertas:</strong> <span className="tag tag-red">{mascotaActivaObj.alergias}</span> | <strong>Tutor:</strong> {clienteMascotaActiva?.nombre} ({clienteMascotaActiva?.telefono})
                    </div>
                  )}
                </div>
              </div>

              <div className="panel-grid-2">
                {/* Registrar Atención Clínica (CU07) */}
                <div className="card-panel">
                  <h3>
                    <span>Registrar Atención Clínica (CU07 · RF17)</span>
                    <span className="tag tag-blue">{permisosRol.puedeRegistrarAtencion ? 'Veterinario Habilitado' : 'Solo Lectura para Asistente'}</span>
                  </h3>
                  {permisosRol.puedeRegistrarAtencion ? (
                    <form onSubmit={guardarAtencionClinica}>
                      <div className="form-group">
                        <label>Motivo de Consulta / Anamnesis</label>
                        <input className="form-control" value={formAtencion.motivo} onChange={e => setFormAtencion({ ...formAtencion, motivo: e.target.value })} placeholder="Ej: Decaimiento, control post-operatorio, otitis..." required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label>Peso (kg)</label>
                          <input type="number" step="0.1" className="form-control" value={formAtencion.pesoKg} onChange={e => setFormAtencion({ ...formAtencion, pesoKg: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Temp (°C)</label>
                          <input type="number" step="0.1" className="form-control" value={formAtencion.temperaturaC} onChange={e => setFormAtencion({ ...formAtencion, temperaturaC: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Estado Registro</label>
                          <select className="form-control" value={formAtencion.estadoRegistro} onChange={e => setFormAtencion({ ...formAtencion, estadoRegistro: e.target.value })}>
                            <option value="Finalizada">Finalizada (Cierra Cita)</option>
                            <option value="Borrador">Guardar Borrador (CU07)</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Diagnóstico Clínico</label>
                        <input className="form-control" value={formAtencion.diagnostico} onChange={e => setFormAtencion({ ...formAtencion, diagnostico: e.target.value })} placeholder="Diagnóstico presuntivo o definitivo" required />
                      </div>
                      <div className="form-group">
                        <label>Tratamiento / Prescripción y Observaciones</label>
                        <input className="form-control" value={formAtencion.tratamiento} onChange={e => setFormAtencion({ ...formAtencion, tratamiento: e.target.value })} placeholder="Fármacos, dosis, posología y cuidados" required />
                      </div>
                      <button type="submit" className="btn-primary-vet">Guardar Atención en Ficha Clínica (RF17)</button>
                    </form>
                  ) : (
                    <div className="alert-box alert-warning">
                      Tu rol actual ({usuarioActivo.rol}) puede consultar el historial clínico y registrar vacunaciones/desparasitaciones (CU08, CU09), pero el diagnóstico médico formal es exclusivo del rol Veterinario.
                    </div>
                  )}
                </div>

                {/* Registrar Vacunación y Desparasitación (CU09) */}
                <div className="card-panel">
                  <h3>
                    <span>Registrar Vacuna o Desparasitación (CU09 · RF19 · RF20)</span>
                    <span className="tag tag-green">Descuenta Stock (RF26)</span>
                  </h3>
                  <form onSubmit={guardarVacunacion}>
                    <div className="form-group">
                      <label>Tipo de Procedimiento Preventivo</label>
                      <select className="form-control" value={formVacuna.tipo} onChange={e => setFormVacuna({ ...formVacuna, tipo: e.target.value })}>
                        <option value="Vacuna">Vacuna (+1 año próximo refuerzo automático)</option>
                        <option value="Desparasitación">Desparasitación (+3 meses próximo control automático)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Producto Utilizado del Inventario (Descuenta 1 unidad - RF26)</label>
                      <select className="form-control" value={formVacuna.productoId} onChange={e => setFormVacuna({ ...formVacuna, productoId: e.target.value })}>
                        {productos.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre} (Stock actual: {p.stock} u. · Lote: {p.lote})</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Fecha de Aplicación</label>
                        <input type="date" className="form-control" value={formVacuna.fechaAplicacion} onChange={e => setFormVacuna({ ...formVacuna, fechaAplicacion: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label>N° de Lote</label>
                        <input className="form-control" value={formVacuna.lote} onChange={e => setFormVacuna({ ...formVacuna, lote: e.target.value })} placeholder="Ej: NBV-8841A" required />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary-vet">Registrar Procedimiento y Calcular Próximo Refuerzo (RF20)</button>
                  </form>
                </div>
              </div>

              <div className="panel-grid-2">
                <div className="card-panel">
                  <h3>Historial de Atenciones Clínicas de {mascotaActivaObj?.nombre} (RF18)</h3>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha / Vet</th>
                          <th>Motivo y Signos</th>
                          <th>Diagnóstico y Tratamiento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atenciones.filter(a => a.mascotaId === mascotaFichaSel).map(a => (
                          <tr key={a.id}>
                            <td><strong>{a.fecha}</strong><br /><small>{a.veterinario}</small><br /><span className="tag tag-green">{a.estadoRegistro}</span></td>
                            <td>{a.motivo}<br /><small>Peso: {a.pesoKg} kg · T°: {a.temperaturaC} °C</small></td>
                            <td><strong>Dx:</strong> {a.diagnostico}<br /><strong>Tx:</strong> {a.tratamiento}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card-panel">
                  <h3>Carnet de Vacunas y Próximos Refuerzos de {mascotaActivaObj?.nombre} (RF19, RF20)</h3>
                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tipo / Producto</th>
                          <th>Aplicación / Lote</th>
                          <th>Próximo Refuerzo (RF20)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vacunas.filter(v => v.mascotaId === mascotaFichaSel).map(v => (
                          <tr key={v.id}>
                            <td><span className="tag tag-teal">{v.tipo}</span><br /><strong>{v.productoNombre}</strong></td>
                            <td>{v.fechaAplicacion}<br /><small>Lote: {v.lote}</small></td>
                            <td><span className="tag tag-amber">📅 {v.proximoRefuerzo}</span><br /><small>{v.responsable}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 5: RECORDATORIOS AUTOMÁTICOS (CU10 | RF22-RF24)
              =============================================================== */}
          {moduloVisible === 'recordatorios' && (
            <div>
              <div className="card-panel">
                <h3>
                  <span>Motor de Recordatorios Automáticos a Clientes (CU10 · RF22 · RF23 · RF24)</span>
                  <button type="button" className="btn-primary-vet" onClick={ejecutarBarridoRecordatorios}>
                    ⚡ Ejecutar Barrido Diario de Recordatorios Ahora
                  </button>
                </h3>
                <p style={{ margin: 0, fontSize: '13.5px', color: '#475569' }}>
                  Revisa automáticamente las fechas próximas de vacunas, controles pendientes (RF22) y citas a 24 horas (RF23), registrando tanto los envíos exitosos como los fallidos por contacto inválido (RF24).
                </p>
              </div>

              <div className="card-panel">
                <h3>Bitácora de Auditoría de Recordatorios Enviados y No Entregados (RF24)</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cliente / Contacto</th>
                        <th>Mascota</th>
                        <th>Tipo</th>
                        <th>Mensaje Generado</th>
                        <th>Estado de Entrega (RF24)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordatorios.map(r => (
                        <tr key={r.id}>
                          <td>{r.fechaEnvio}</td>
                          <td><strong>{r.clienteNombre}</strong><br /><code>{r.contacto}</code></td>
                          <td>{r.mascotaNombre}</td>
                          <td><span className="tag tag-blue">{r.tipo}</span></td>
                          <td>{r.mensaje}</td>
                          <td>
                            <span className={`tag ${r.estadoEntrega === 'Entregado' ? 'tag-green' : 'tag-red'}`}>
                              {r.estadoEntrega}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 6: INVENTARIO, KARDEX Y ALERTAS (CU12, CU13, CU14 | RF25-RF30)
              =============================================================== */}
          {moduloVisible === 'inventario' && (
            <div>
              <div className="panel-grid-2">
                <div className="card-panel">
                  <h3>
                    <span>Catalogar Nuevo Producto (CU12 · RF25)</span>
                    <span className="tag tag-red">Solo Administrador</span>
                  </h3>
                  {permisosRol.puedeGestionarCatalogo ? (
                    <form onSubmit={guardarProducto}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label>Código SKU</label>
                          <input className="form-control" value={formProducto.sku} onChange={e => setFormProducto({ ...formProducto, sku: e.target.value })} placeholder="Ej: FAR-AMX-007" required />
                        </div>
                        <div className="form-group">
                          <label>Categoría</label>
                          <select className="form-control" value={formProducto.categoria} onChange={e => setFormProducto({ ...formProducto, categoria: e.target.value })}>
                            <option value="Vacunas">Vacunas</option>
                            <option value="Medicamentos">Medicamentos</option>
                            <option value="Antiparasitarios">Antiparasitarios</option>
                            <option value="Alimentos">Alimentos</option>
                            <option value="Insumos">Insumos Clínicos</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Nombre del Producto</label>
                        <input className="form-control" value={formProducto.nombre} onChange={e => setFormProducto({ ...formProducto, nombre: e.target.value })} placeholder="Nombre comercial y presentación" required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                        <div className="form-group">
                          <label>Stock Inicial</label>
                          <input type="number" className="form-control" value={formProducto.stock} onChange={e => setFormProducto({ ...formProducto, stock: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>Stock Mínimo</label>
                          <input type="number" className="form-control" value={formProducto.stockMinimo} onChange={e => setFormProducto({ ...formProducto, stockMinimo: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>Precio ($)</label>
                          <input type="number" className="form-control" value={formProducto.precio} onChange={e => setFormProducto({ ...formProducto, precio: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label>Vencimiento</label>
                          <input type="date" className="form-control" value={formProducto.fechaVencimiento} onChange={e => setFormProducto({ ...formProducto, fechaVencimiento: e.target.value })} required />
                        </div>
                      </div>
                      <button type="submit" className="btn-primary-vet">Guardar Producto en Catálogo (RF25)</button>
                    </form>
                  ) : (
                    <div className="alert-box alert-warning">
                      El alta de nuevos productos en el catálogo (CU12) está reservada al Administrador.
                    </div>
                  )}
                </div>

                <div className="card-panel">
                  <h3>
                    <span>Registrar Entrada / Salida Manual de Stock (CU13 · RF27)</span>
                    <span className="tag tag-amber">Admin y Asistente</span>
                  </h3>
                  {permisosRol.puedeMoverStock ? (
                    <form onSubmit={registrarMovimientoManual}>
                      <div className="form-group">
                        <label>Producto</label>
                        <select className="form-control" value={formMovStock.productoId} onChange={e => setFormMovStock({ ...formMovStock, productoId: e.target.value })}>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stock} u.)</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label>Tipo de Movimiento</label>
                          <select className="form-control" value={formMovStock.tipo} onChange={e => setFormMovStock({ ...formMovStock, tipo: e.target.value })}>
                            <option value="Entrada">Entrada (Compra / Reposición)</option>
                            <option value="Salida">Salida (Uso Interno / Merma)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Cantidad de Unidades</label>
                          <input type="number" min="1" className="form-control" value={formMovStock.cantidad} onChange={e => setFormMovStock({ ...formMovStock, cantidad: e.target.value })} required />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Motivo / Respaldo del Movimiento</label>
                        <input className="form-control" value={formMovStock.motivo} onChange={e => setFormMovStock({ ...formMovStock, motivo: e.target.value })} required />
                      </div>
                      <button type="submit" className="btn-primary-vet">Registrar Movimiento y Actualizar Kardex (RF27, RF30)</button>
                    </form>
                  ) : (
                    <div className="alert-box alert-warning">
                      Modo consulta de stock para Veterinario. Los ajustes manuales de bodega los realiza el Administrador o Asistente (CU13).
                    </div>
                  )}
                </div>
              </div>

              <div className="card-panel">
                <h3>Catálogo de Productos y Estado de Alertas (RF25, RF28, RF29)</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Producto / Categoría</th>
                        <th>Stock Actual</th>
                        <th>Stock Mínimo</th>
                        <th>Precio Venta</th>
                        <th>Vencimiento</th>
                        <th>Estado / Alertas (CU14)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map(p => {
                        const bajo = p.stock <= p.stockMinimo
                        const porVencer = productosPorVencer.some(x => x.id === p.id)
                        return (
                          <tr key={p.id}>
                            <td><code>{p.sku}</code></td>
                            <td><strong>{p.nombre}</strong><br /><small>{p.categoria}</small></td>
                            <td><strong>{p.stock} u.</strong></td>
                            <td>{p.stockMinimo} u.</td>
                            <td>${p.precio.toLocaleString('es-CL')}</td>
                            <td>{p.fechaVencimiento}</td>
                            <td>
                              {bajo && <span className="tag tag-red" style={{ marginRight: '4px' }}>⚠️ Stock Bajo (RF28)</span>}
                              {porVencer && <span className="tag tag-amber">⏳ Próx. Vencer (RF29)</span>}
                              {!bajo && !porVencer && <span className="tag tag-green">Óptimo</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card-panel">
                <h3>Historial de Movimientos de Stock – Kardex de Trazabilidad (RF30)</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha y Hora</th>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Motivo</th>
                        <th>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map(mv => (
                        <tr key={mv.id}>
                          <td>{mv.fecha}</td>
                          <td><strong>{mv.productoNombre}</strong></td>
                          <td><span className={`tag ${mv.tipo === 'Entrada' ? 'tag-green' : 'tag-amber'}`}>{mv.tipo}</span></td>
                          <td><strong>{mv.cantidad} u.</strong></td>
                          <td>{mv.motivo}</td>
                          <td>{mv.responsable}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 7: VENTAS, COBROS Y GASTOS (CU15, CU16 | RF31-RF33)
              =============================================================== */}
          {moduloVisible === 'finanzas' && (
            <div>
              <div className="panel-grid-2">
                <div className="card-panel">
                  <h3>
                    <span>Registrar Venta y Cobro en Recepción (CU15 · RF31 · RF32)</span>
                    <span className="tag tag-blue">Cálculo Automático</span>
                  </h3>
                  <form onSubmit={registrarVentaCobro}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Cliente</label>
                        <select className="form-control" value={formVenta.clienteId} onChange={e => setFormVenta({ ...formVenta, clienteId: e.target.value })}>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Mascota Atendida</label>
                        <select className="form-control" value={formVenta.mascotaId} onChange={e => setFormVenta({ ...formVenta, mascotaId: e.target.value })}>
                          {mascotas.map(m => <option key={m.id} value={m.id}>{m.nombre} ({m.fichaCodigo})</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Servicio Clínico Realizado</label>
                      <select
                        className="form-control"
                        value={formVenta.servicioMonto}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10)
                          const label = e.target.options[e.target.selectedIndex].text
                          setFormVenta({ ...formVenta, servicioMonto: val, servicioNombre: label })
                        }}
                      >
                        <option value="18000">Consulta General ($18.000)</option>
                        <option value="32000">Atención de Urgencia ($32.000)</option>
                        <option value="12000">Control Sano / Procedimiento ($12.000)</option>
                        <option value="0">Solo Venta de Farmacia / Alimentos ($0)</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Producto Adicional de Farmacia (Descuenta Stock - RF26)</label>
                        <select className="form-control" value={formVenta.productoId} onChange={e => setFormVenta({ ...formVenta, productoId: e.target.value })}>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (${p.precio.toLocaleString('es-CL')})</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Cantidad</label>
                        <input type="number" min="0" max="10" className="form-control" value={formVenta.cantidadProd} onChange={e => setFormVenta({ ...formVenta, cantidadProd: e.target.value })} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Medio de Pago (RF32)</label>
                        <select className="form-control" value={formVenta.medioPago} onChange={e => setFormVenta({ ...formVenta, medioPago: e.target.value })}>
                          <option value="Efectivo">Efectivo</option>
                          <option value="Tarjeta">Tarjeta Débito / Crédito</option>
                          <option value="Transferencia">Transferencia Bancaria</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Estado del Cobro (RF32)</label>
                        <select className="form-control" value={formVenta.estadoPago} onChange={e => setFormVenta({ ...formVenta, estadoPago: e.target.value })}>
                          <option value="Pagado">Pagado Completo</option>
                          <option value="Deuda pendiente">Dejar Deuda Pendiente</option>
                        </select>
                      </div>
                    </div>

                    <button type="submit" className="btn-primary-vet" style={{ width: '100%' }}>
                      Emitir Comprobante Interno y Registrar Venta (CU15)
                    </button>
                  </form>
                </div>

                <div className="card-panel">
                  <h3>
                    <span>Registrar Gastos y Pagos a Proveedores (CU16 · RF33)</span>
                    <span className="tag tag-red">Exclusivo Administrador</span>
                  </h3>
                  {permisosRol.puedeRegistrarGastos ? (
                    <form onSubmit={registrarGastoProveedor}>
                      <div className="form-group">
                        <label>Proveedor / Laboratorio</label>
                        <input className="form-control" value={formGasto.proveedor} onChange={e => setFormGasto({ ...formGasto, proveedor: e.target.value })} placeholder="Ej: Laboratorio Drag Pharma / VetChile" required />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="form-group">
                          <label>Categoría de Gasto</label>
                          <select className="form-control" value={formGasto.categoria} onChange={e => setFormGasto({ ...formGasto, categoria: e.target.value })}>
                            <option value="Insumos y Vacunas">Insumos y Vacunas</option>
                            <option value="Material Quirúrgico">Material Quirúrgico</option>
                            <option value="Servicios Básicos Clínica">Servicios Básicos Clínica</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Monto Total ($ CLP)</label>
                          <input type="number" className="form-control" value={formGasto.monto} onChange={e => setFormGasto({ ...formGasto, monto: e.target.value })} required />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Descripción de Factura / Compra</label>
                        <input className="form-control" value={formGasto.descripcion} onChange={e => setFormGasto({ ...formGasto, descripcion: e.target.value })} placeholder="Detalle de insumos adquiridos" required />
                      </div>
                      <div className="form-group">
                        <label>Estado del Pago al Proveedor</label>
                        <select className="form-control" value={formGasto.estado} onChange={e => setFormGasto({ ...formGasto, estado: e.target.value })}>
                          <option value="Pagado">Pagado</option>
                          <option value="Pendiente">Factura Pendiente de Pago</option>
                        </select>
                      </div>
                      <button type="submit" className="btn-primary-vet">Guardar Gasto Operativo (RF33)</button>
                    </form>
                  ) : (
                    <div className="alert-box alert-warning">
                      El registro de gastos a proveedores (CU16 / RF33) es una función exclusiva del rol Administrador.
                    </div>
                  )}
                </div>
              </div>

              <div className="card-panel">
                <h3>Registro de Ventas, Medios de Pago y Control de Deudas Pendientes (RF31, RF32)</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Folio / Fecha</th>
                        <th>Cliente / Mascota</th>
                        <th>Detalle Venta</th>
                        <th>Total</th>
                        <th>Medio Pago</th>
                        <th>Estado / Saldo (RF32)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventas.map(v => (
                        <tr key={v.id}>
                          <td><strong>{v.folio}</strong><br /><small>{v.fecha}</small></td>
                          <td><strong>{v.clienteNombre}</strong><br /><small>{v.mascotaNombre}</small></td>
                          <td>{v.detalleItems}</td>
                          <td><strong>${v.total.toLocaleString('es-CL')}</strong></td>
                          <td><span className="tag tag-blue">{v.medioPago}</span></td>
                          <td>
                            <span className={`tag ${v.estadoPago === 'Pagado' ? 'tag-green' : 'tag-red'}`}>
                              {v.estadoPago} {v.saldoPendiente > 0 ? `($${v.saldoPendiente.toLocaleString('es-CL')})` : ''}
                            </span>
                            {v.estadoPago === 'Deuda pendiente' && (
                              <button type="button" className="btn-outline-vet" style={{ marginLeft: '8px', padding: '4px 8px' }} onClick={() => saldarDeudaVenta(v.id)}>
                                Saldar Deuda
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 8: REPORTES EXPORTABLES A EXCEL / PDF (CU17 | RF34)
              =============================================================== */}
          {moduloVisible === 'reportes' && (
            <div>
              <div className="card-panel">
                <h3>
                  <span>Generador de Reportes Gerenciales Exportables a PDF y Excel (CU17 · RF34)</span>
                  <span className="tag tag-red">Rol Administrador</span>
                </h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Tipo de Reporte</label>
                    <select className="form-control" value={tipoReporte} onChange={e => setTipoReporte(e.target.value)}>
                      <option value="ventas">1. Reporte de Ventas e Ingresos</option>
                      <option value="gastos">2. Reporte de Gastos y Proveedores</option>
                      <option value="stock">3. Reporte de Inventario y Alertas Stock</option>
                      <option value="citas">4. Reporte de Citas y Atenciones</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Desde</label>
                    <input type="date" className="form-control" value={rangoInicio} onChange={e => setRangoInicio(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Hasta</label>
                    <input type="date" className="form-control" value={rangoFin} onChange={e => setRangoFin(e.target.value)} />
                  </div>
                  <button type="button" className="btn-primary-vet" onClick={exportarReporteCSV}>
                    📊 Exportar a Excel (.CSV)
                  </button>
                  <button type="button" className="btn-outline-vet" onClick={() => window.print()}>
                    🖨️ Exportar / Imprimir PDF
                  </button>
                </div>

                <div className="kpi-grid">
                  <div className="kpi-card">
                    <div className="kpi-title">Total Ventas Período</div>
                    <div className="kpi-value">${totalIngresos.toLocaleString('es-CL')}</div>
                    <div className="kpi-sub">{ventas.length} transacciones emitidas</div>
                  </div>
                  <div className="kpi-card warn">
                    <div className="kpi-title">Total Gastos Proveedores</div>
                    <div className="kpi-value">${totalGastos.toLocaleString('es-CL')}</div>
                    <div className="kpi-sub">{gastos.length} facturas registradas</div>
                  </div>
                  <div className="kpi-card finance">
                    <div className="kpi-title">Balance Operativo Neto</div>
                    <div className="kpi-value">${(totalIngresos - totalGastos).toLocaleString('es-CL')}</div>
                    <div className="kpi-sub">Utilidad operacional clínica</div>
                  </div>
                  <div className="kpi-card urgent">
                    <div className="kpi-title">Deudas por Cobrar</div>
                    <div className="kpi-value">${totalDeudas.toLocaleString('es-CL')}</div>
                    <div className="kpi-sub">Control de saldos pendientes (RF32)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              MÓDULO 9: USUARIOS, ROLES Y SEGURIDAD (CU02 | RF01-RF04)
              =============================================================== */}
          {moduloVisible === 'usuarios' && (
            <div className="panel-grid-sidebar">
              <div className="card-panel">
                <h3>
                  <span>Vincular Cuenta Auth y Asignar Rol (CU02 · RF03)</span>
                  <span className="tag tag-red">RBAC</span>
                </h3>
                <form onSubmit={crearNuevoUsuarioClinica}>
                  <div className="form-group">
                    <label>Nombre Completo del Trabajador</label>
                    <input className="form-control" value={formUsuario.nombre} onChange={e => setFormUsuario({ ...formUsuario, nombre: e.target.value })} placeholder="Ej: Dr. Pablo Araya" required />
                  </div>
                  <div className="form-group">
                    <label>RUT</label>
                    <input className="form-control" value={formUsuario.rut} onChange={e => setFormUsuario({ ...formUsuario, rut: e.target.value })} placeholder="18.555.222-9" required />
                  </div>
                  <div className="form-group">
                    <label>Correo Institucional</label>
                    <input type="email" className="form-control" value={formUsuario.correo} onChange={e => setFormUsuario({ ...formUsuario, correo: e.target.value })} placeholder="paraya@patitasfelices.cl" required />
                  </div>
                  <div className="form-group">
                    <label>UID de la cuenta en Supabase Auth</label>
                    <input className="form-control" value={formUsuario.authUserId} onChange={e => setFormUsuario({ ...formUsuario, authUserId: e.target.value })} placeholder="UUID copiado desde Authentication → Users" required />
                    <small>Primero crea la cuenta en Supabase → Authentication → Users. Luego copia su UID y completa este perfil.</small>
                  </div>
                  <div className="form-group">
                    <label>Rol Asignado en el Sistema (RF02)</label>
                    <select className="form-control" value={formUsuario.rol} onChange={e => setFormUsuario({ ...formUsuario, rol: e.target.value })}>
                      <option value="Administrador">Administrador</option>
                      <option value="Veterinario">Veterinario</option>
                      <option value="Recepcionista">Recepcionista</option>
                      <option value="Asistente">Asistente</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Especialidad / Cargo</label>
                    <input className="form-control" value={formUsuario.especialidad} onChange={e => setFormUsuario({ ...formUsuario, especialidad: e.target.value })} placeholder="Ej: Cirugía y Urgencias" />
                  </div>
                  <button type="submit" className="btn-primary-vet" style={{ width: '100%' }}>Crear Perfil y Asignar Rol (RF03)</button>
                </form>
              </div>

              <div className="card-panel">
                <h3>Dotación de la Veterinaria (8 Trabajadores EV02) y Control de Bloqueos (RF04)</h3>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Nombre / RUT</th>
                        <th>Correo</th>
                        <th>Rol (RF02)</th>
                        <th>Seguridad (RF04)</th>
                        <th>Acciones (RF03)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map(u => (
                        <tr key={u.id}>
                          <td><strong>{u.nombre}</strong><br /><small>{u.rut} · {u.especialidad}</small></td>
                          <td><code>{u.correo}</code></td>
                          <td><span className="tag tag-teal">{u.rol}</span></td>
                          <td>
                            {u.bloqueado ? (
                              <span className="tag tag-red">🔒 Bloqueado (3 intentos)</span>
                            ) : (
                              <span className={`tag ${u.activo ? 'tag-green' : 'tag-amber'}`}>
                                {u.activo ? `Activo (${u.intentos}/3 fallos)` : 'Desactivado'}
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-outline-vet" onClick={() => alternarEstadoUsuario(u.id)}>
                                {u.activo ? 'Desactivar' : 'Activar'}
                              </button>
                              {u.bloqueado && (
                                <button type="button" className="btn-primary-vet" onClick={() => desbloquearUsuario(u.id)}>
                                  Desbloquear (RF04)
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {moduloVisible === 'seguridad' && <Seguridad />}
        </main>
      </div>
    </div>
  )
}

export default App
