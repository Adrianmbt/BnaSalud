import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  Eye,
  Loader2,
  LogOut,
  Monitor,
  Plus,
  Search,
  Shield,
  ShieldOff,
  Terminal,
  Trash2,
  Pencil,
  Upload,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';

const ROLES = [
  { value: 'recepcionista', label: 'Recepcionista' },
  { value: 'medico_emergencia', label: 'Medico de Emergencia' },
  { value: 'medico', label: 'Medico Especialista' },
  { value: 'historias_medicas', label: 'Historias Medicas' },
  { value: 'jefe_farmacia', label: 'Jefe de Farmacia' },
  { value: 'farmaceutico', label: 'Farmaceutico' },
  { value: 'admin_sistemas', label: 'Admin de Sistemas' },
  { value: 'recursos_humanos', label: 'Recursos Humanos' },
];

const CARGOS = [
  'Director', 'Sub-Director', 'Gerente', 'Coordinador', 'Analista',
  'Tecnico', 'Asistente', 'Operador', 'Auxiliar', 'Supervisor',
];

/* ─── Badge ─── */
const Badge = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 rounded-full ${colors[color]}`}>
      {children}
    </span>
  );
};

/* ─── Input ─── */
const Input = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">{label}</label>}
    <input {...props} className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all" />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">{label}</label>}
    <select {...props} className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all">
      {children}
    </select>
  </div>
);

/* ─── Pagination ─── */
const Pagination = ({ page, total, perPage, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="flex items-center justify-between text-[12px] text-slate-500 mt-3">
      <span>{total} resultado{total !== 1 ? 's' : ''} · Pagina {page}/{totalPages}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-brand-primary hover:text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-brand-primary hover:text-brand-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   USERS SECTION
   ═══════════════════════════════════════════════════════════════════ */
function UsuariosSection({ onEditarHorario }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    username: '', password: '', rol: 'recepcionista', personal_id: '',
    nombre: '', apellido: '', especialidad: '', cedula: '',
  });
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const PER_PAGE = 5;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await axiosClient.get('/admin/usuarios', { params: { q: busqueda, page, per_page: PER_PAGE } });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch { setItems([]); } finally { setCargando(false); }
  }, [busqueda, page]);

  useEffect(() => { cargar(); }, [cargar]);

  const esRolMedico = ['medico', 'medico_emergencia'].includes(form.rol);

  const formVacio = () => ({
    username: '', password: '', rol: 'recepcionista', personal_id: '',
    nombre: '', apellido: '', especialidad: '', cedula: '',
  });

  const abrirCrear = () => {
    setForm(formVacio());
    setEditando(null);
    setError('');
    setModal('crear');
  };

  const datosPersonales = () => ({
    nombre: form.nombre.trim() || null,
    apellido: form.apellido.trim() || null,
    especialidad: form.especialidad.trim() || null,
    cedula: form.cedula.trim() || null,
  });

  const crear = async () => {
    setGuardando(true); setError('');
    try {
      await axiosClient.post('/admin/usuarios', {
        username: form.username.trim(),
        password: form.password,
        rol: form.rol,
        personal_id: form.personal_id ? Number(form.personal_id) : null,
        ...datosPersonales(),
      });
      setModal(null); setForm(formVacio());
      cargar();
    } catch (e) { setError(e?.response?.data?.detail || 'Error al crear usuario.'); } finally { setGuardando(false); }
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({
      username: u.username,
      password: '',
      rol: u.rol,
      personal_id: u.personal_id || '',
      nombre: u.nombre || '',
      apellido: u.apellido || '',
      especialidad: u.especialidad || '',
      cedula: u.cedula || '',
    });
    setError('');
    setModal('editar');
  };

  const editar = async () => {
    setGuardando(true); setError('');
    try {
      const payload = {
        rol: form.rol,
        personal_id: form.personal_id ? Number(form.personal_id) : null,
        ...datosPersonales(),
      };
      if (form.password) payload.password = form.password;
      await axiosClient.put(`/admin/usuarios/${editando.id}`, payload);
      setModal(null); setEditando(null); setForm(formVacio());
      cargar();
    } catch (e) { setError(e?.response?.data?.detail || 'Error al editar usuario.'); } finally { setGuardando(false); }
  };

  const verHorario = (u) => {
    setModal(null);
    onEditarHorario && onEditarHorario(u.personal_id);
  };

  const toggleActivo = async (u) => {
    try {
      await axiosClient.put(`/admin/usuarios/${u.id}`, { activo: !u.activo });
      cargar();
    } catch {}
  };

  const eliminar = async (id) => {
    if (!confirm('Eliminar este usuario?')) return;
    try { await axiosClient.delete(`/admin/usuarios/${id}`); cargar(); } catch {}
  };

  const rolColor = (rol) => {
    if (rol === 'admin_sistemas') return 'blue';
    if (rol === 'historias_medicas') return 'violet';
    if (rol?.includes('medico')) return 'green';
    return 'slate';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
            placeholder="Buscar usuario..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all" />
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white font-semibold text-sm rounded-lg hover:bg-brand-primaryDark shadow-sm shadow-brand-primary/20 transition-all">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Usuario</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rol</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-brand-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400 text-sm">Sin resultados</td></tr>
              ) : items.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-sm text-slate-800">{u.username}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{u.nombre} {u.apellido}</td>
                  <td className="py-3 px-4"><Badge color={rolColor(u.rol)}>{u.rol}</Badge></td>
                  <td className="py-3 px-4">
                    <Badge color={u.activo ? 'green' : 'red'}>{u.activo ? 'ACTIVO' : 'INACTIVO'}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditar(u)} title="Editar"
                        className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                        <UserCog className="w-4 h-4" />
                      </button>
                      {u.personal_id && ['medico', 'medico_emergencia'].includes(u.rol) && (
                        <button onClick={() => verHorario(u)} title="Editar horario"
                          className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                          <CalendarClock className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => toggleActivo(u)} title={u.activo ? 'Desactivar' : 'Activar'}
                        className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                        {u.activo ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </button>
                      <button onClick={() => eliminar(u.id)} title="Eliminar"
                        className="p-1.5 text-slate-400 hover:text-brand-danger rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />

      {modal === 'crear' && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <UserCog className="w-5 h-5 text-brand-primary" />
                </div>
                <span className="font-bold text-slate-800">Nuevo Usuario</span>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="minimo 3 caracteres" />
              <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="minimo 6 caracteres" />
              <Select label="Rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
              <Input label="Personal ID (opcional)" type="number" value={form.personal_id} onChange={(e) => setForm({ ...form, personal_id: e.target.value })} placeholder="ID del personal existente" />
              {esRolMedico && (
                <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Datos del médico</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" />
                    <Input label="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} placeholder="Apellido" />
                  </div>
                  <Input label="Especialidad" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} placeholder="Ej: Cardiología" />
                  <Input label="Cédula (opcional)" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="V-12345678" />
                  <p className="text-[11px] text-slate-400">Si dejas vacío el Personal ID se crea una ficha nueva con estos datos.</p>
                </div>
              )}
              <button onClick={crear} disabled={guardando || !form.username.trim() || !form.password || (esRolMedico && !form.nombre.trim())}
                className="w-full py-2.5 bg-brand-primary text-white font-semibold text-sm rounded-lg hover:bg-brand-primaryDark shadow-sm shadow-brand-primary/20 disabled:opacity-40 transition-all">
                {guardando ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'editar' && editando && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <UserCog className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <span className="font-bold text-slate-800">Editar Usuario</span>
                  <p className="text-[11px] text-slate-400">{editando.username}</p>
                </div>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="minimo 3 caracteres" />
              <Input label="Nueva Password (dejar vacio para mantener)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="dejar vacio si no cambia" />
              <Select label="Rol" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
              <Input label="Personal ID (opcional)" type="number" value={form.personal_id} onChange={(e) => setForm({ ...form, personal_id: e.target.value })} placeholder="ID del personal" />
              {esRolMedico && (
                <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Datos del médico</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" />
                    <Input label="Apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} placeholder="Apellido" />
                  </div>
                  <Input label="Especialidad" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} placeholder="Ej: Cardiología" />
                  <Input label="Cédula (opcional)" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="V-12345678" />
                  {form.personal_id && (
                    <button onClick={() => verHorario({ ...editando, personal_id: form.personal_id })}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm hover:border-brand-primary hover:text-brand-primary transition-all">
                      <CalendarClock className="w-4 h-4" /> Editar horario del médico
                    </button>
                  )}
                </div>
              )}
              <button onClick={editar} disabled={guardando || !form.username.trim()}
                className="w-full py-2.5 bg-brand-primary text-white font-semibold text-sm rounded-lg hover:bg-brand-primaryDark shadow-sm shadow-brand-primary/20 disabled:opacity-40 transition-all">
                {guardando ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EMPLOYEES (NOMINA) SECTION
   ═══════════════════════════════════════════════════════════════════ */
function EmpleadosSection() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ cedula: '', nombre_completo: '', edad: '', cargo: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [cargandoBenef, setCargandoBenef] = useState(false);
  const [carForm, setCarForm] = useState({ cedula: '', nombre_completo: '', parentesco: '' });
  const [benefForm, setBenefForm] = useState({ nombre_completo: '', parentesco: '', empleado_id: '' });
  const [editandoBenef, setEditandoBenef] = useState(null);
  const [opciones, setOpciones] = useState([]);
  const [importacion, setImportacion] = useState(null); // {nombre, archivo, datos}
  const [importando, setImportando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [enteImport, setEnteImport] = useState('');
  const [aviso, setAviso] = useState('');
  const inputArchivo = useRef(null);
  const PER_PAGE = 8;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await axiosClient.get('/admin/empleados', { params: { q: busqueda, page, per_page: PER_PAGE } });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch { setItems([]); } finally { setCargando(false); }
  }, [busqueda, page]);

  const cargarBeneficiarios = useCallback(async (empleadoId) => {
    setCargandoBenef(true);
    try {
      const { data } = await axiosClient.get(`/admin/empleados/${empleadoId}/beneficiarios`);
      setBeneficiarios(data || []);
    } catch { setBeneficiarios([]); } finally { setCargandoBenef(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    axiosClient.get('/admin/empleados/opciones')
      .then(({ data }) => setOpciones(data || []))
      .catch(() => {});
  }, []);

  const elegirArchivo = () => inputArchivo.current && inputArchivo.current.click();

  // Ente u organismo por defecto: solo se usa si el archivo no trae columna ENTE.
  const paramEnte = () => {
    const v = enteImport.trim();
    return v ? `&ente=${encodeURIComponent(v)}` : '';
  };

  const leerArchivo = async (ev) => {
    const archivo = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!archivo) return;
    setImportando(true); setError(''); setAviso('');
    const fd = new FormData();
    fd.append('file', archivo);
    try {
      const { data } = await axiosClient.post(`/admin/empleados/importar?modo=validar${paramEnte()}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportacion({ nombre: archivo.name, archivo, datos: data });
    } catch (e) {
      const d = e?.response?.data;
      if (d && Array.isArray(d.errores)) {
        setImportacion({ nombre: archivo.name, archivo, datos: d });
      } else {
        const detalle = d?.detail?.mensaje || d?.mensaje || d?.detail ||
          (typeof d === 'string' ? d : 'No se pudo leer el archivo.');
        setError(typeof detalle === 'string' ? detalle : 'No se pudo leer el archivo.');
      }
    } finally { setImportando(false); }
  };

  const aplicarImportacion = async () => {
    if (!importacion?.archivo) return;
    setAplicando(true); setError('');
    const fd = new FormData();
    fd.append('file', importacion.archivo);
    try {
      const { data } = await axiosClient.post(`/admin/empleados/importar?modo=aplicar${paramEnte()}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportacion(null);
      setAviso(data.mensaje || 'Importación aplicada.');
      cargar();
    } catch (e) {
      const d = e?.response?.data;
      if (d && Array.isArray(d.errores)) {
        setImportacion({ ...importacion, datos: d });
      } else {
        const detalle = d?.detail || d?.mensaje || 'No se pudo aplicar la importación.';
        setError(typeof detalle === 'string' ? detalle : 'No se pudo aplicar la importación.');
        setImportacion(null);
      }
    } finally { setAplicando(false); }
  };

  const descargarPlantilla = () => {
    const contenido = 'cedula;nombre;edad;cargo;ente;estado\n';
    const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_nomina.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const abrirCrear = () => { setForm({ cedula: '', nombre_completo: '', edad: '', cargo: '', ente: '' }); setEditando(null); setModal('form'); };
  const abrirEditar = (e) => {
    setForm({ cedula: e.cedula, nombre_completo: e.nombre_completo, edad: e.edad ?? '', cargo: e.cargo, ente: e.ente || '' });
    setEditando(e); setModal('form'); setBeneficiarios([]); cargarBeneficiarios(e.id);
  };

  const guardar = async () => {
    setGuardando(true); setError('');
    try {
      if (editando) {
        await axiosClient.put(`/admin/empleados/${editando.id}`, form);
      } else {
        await axiosClient.post('/admin/empleados', form);
      }
      setModal(null); cargar();
    } catch (e) { setError(e?.response?.data?.detail || 'Error al guardar.'); } finally { setGuardando(false); }
  };

  const toggleActivo = async (e) => {
    try { await axiosClient.put(`/admin/empleados/${e.id}`, { activo: !e.activo }); cargar(); } catch {}
  };

  const eliminar = async (e) => {
    if (!confirm(`Desactivar a ${e.nombre_completo} y sus cargas familiares?`)) return;
    try { await axiosClient.delete(`/admin/empleados/${e.id}`); cargar(); } catch {}
  };

  const crearBenef = async () => {
    if (!editando || !carForm.cedula.trim() || !carForm.nombre_completo.trim()) return;
    try {
      await axiosClient.post(`/admin/empleados/${editando.id}/beneficiarios`, carForm);
      setCarForm({ cedula: '', nombre_completo: '', parentesco: '' });
      cargarBeneficiarios(editando.id); cargar();
    } catch (e) { setError(e?.response?.data?.detail || 'Error al agregar carga.'); }
  };

  const abrirEditarBenef = (b) => {
    setEditandoBenef(b.id);
    setBenefForm({ nombre_completo: b.nombre_completo, parentesco: b.parentesco || '', empleado_id: '' });
  };

  const guardarBenef = async (b) => {
    try {
      const upd = { nombre_completo: benefForm.nombre_completo.trim(), parentesco: benefForm.parentesco.trim() || null };
      if (benefForm.empleado_id) upd.empleado_id = benefForm.empleado_id;
      await axiosClient.put(`/admin/beneficiarios/${b.id}`, upd);
      setEditandoBenef(null);
      if (editando) { cargarBeneficiarios(editando.id); cargar(); }
    } catch (e) { setError(e?.response?.data?.detail || 'Error al guardar carga.'); }
  };

  const toggleBenef = async (b) => {
    try {
      await axiosClient.put(`/admin/beneficiarios/${b.id}`, { activo: !b.activo });
      if (editando) { cargarBeneficiarios(editando.id); cargar(); }
    } catch (e) { setError(e?.response?.data?.detail || 'Error al cambiar estado.'); }
  };

  const promoverBenef = async (b) => {
    if (!confirm(`Promover a ${b.nombre_completo} como empleado? Se desactiva como carga familiar.`)) return;
    try {
      await axiosClient.post(`/admin/beneficiarios/${b.id}/promover`);
      if (editando) { cargarBeneficiarios(editando.id); cargar(); }
    } catch (e) { setError(e?.response?.data?.detail || 'Error al promover.'); }
  };

  const eliminarBenef = async (b) => {
    if (!confirm(`Desactivar a ${b.nombre_completo}?`)) return;
    try {
      await axiosClient.delete(`/admin/beneficiarios/${b.id}`);
      if (editando) { cargarBeneficiarios(editando.id); cargar(); }
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, cedula, cargo..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all" />
        </div>
        <button onClick={descargarPlantilla} title="Descargar plantilla CSV"
          className="flex items-center gap-2 px-3 py-2.5 border border-slate-200 bg-white text-slate-600 font-semibold text-sm rounded-lg hover:border-brand-primary hover:text-brand-primary transition-all">
          <Download className="w-4 h-4" /> Plantilla
        </button>
        <button onClick={elegirArchivo} disabled={importando}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-brand-primary/40 text-brand-primary font-semibold text-sm rounded-lg hover:bg-brand-primary/5 disabled:opacity-50 transition-all">
          {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importando ? 'Leyendo…' : 'Importar Excel'}
        </button>
        <input
          ref={inputArchivo}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={leerArchivo}
        />
        <button onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-white font-semibold text-sm rounded-lg hover:bg-brand-primaryDark shadow-sm shadow-brand-primary/20 transition-all">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {aviso && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">{aviso}</div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cedula</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nombre</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Edad</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cargo</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ente</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cargas</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={8} className="py-10 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-brand-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-slate-400 text-sm">Sin resultados</td></tr>
              ) : items.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 text-sm text-slate-600 font-mono">{e.cedula}</td>
                  <td className="py-3 px-4 font-semibold text-sm text-slate-800">{e.nombre_completo}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{e.edad ?? '—'}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{e.cargo || '—'}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{e.ente || '—'}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{e.num_beneficiarios ?? 0}</td>
                  <td className="py-3 px-4">
                    <Badge color={e.activo ? 'green' : 'red'}>{e.activo ? 'ACTIVO' : 'INACTIVO'}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => abrirEditar(e)} title="Editar"
                        className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                        <UserCog className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleActivo(e)} title={e.activo ? 'Desactivar' : 'Reactivar'}
                        className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                        {e.activo ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </button>
                      <button onClick={() => eliminar(e)} title="Eliminar"
                        className="p-1.5 text-slate-400 hover:text-brand-danger rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />

      {importacion && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setImportacion(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <span className="font-bold text-slate-800">Importar nómina (vista previa)</span>
                  <p className="text-[11px] text-slate-400 truncate">{importacion.nombre}</p>
                </div>
              </div>
              <button onClick={() => setImportacion(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { etiqueta: 'Trabajadores', valor: importacion.datos?.titulares ?? 0, color: 'text-slate-800' },
                  { etiqueta: 'Nuevos', valor: importacion.datos?.a_crear ?? 0, color: 'text-emerald-600' },
                  { etiqueta: 'A actualizar', valor: importacion.datos?.a_actualizar ?? 0, color: 'text-sky-600' },
                  { etiqueta: 'Cargas', valor: importacion.datos?.cargas ?? 0, color: 'text-slate-800' },
                  { etiqueta: 'Cargas nuevas', valor: importacion.datos?.cargas_crear ?? 0, color: 'text-emerald-600' },
                  { etiqueta: 'Cargas a actualizar', valor: importacion.datos?.cargas_actualizar ?? 0, color: 'text-sky-600' },
                  { etiqueta: 'Filas leídas', valor: importacion.datos?.filas ?? 0, color: 'text-slate-500' },
                  { etiqueta: 'Errores', valor: (importacion.datos?.errores || []).length, color: 'text-red-600' },
                ].map((c) => (
                  <div key={c.etiqueta} className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.etiqueta}</p>
                    <p className={`text-xl font-extrabold ${c.color}`}>{c.valor}</p>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  Ente u organismo {importacion.datos?.ente ? `· aplicado: ${importacion.datos.ente}` : ''}
                </label>
                <input value={enteImport} onChange={(ev) => setEnteImport(ev.target.value)}
                  placeholder="Ej: Alcaldía de Bolívar"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
                <p className="text-[11px] text-slate-400 mt-1">
                  Solo se usa si el archivo no trae columna <span className="font-semibold">ENTE</span>.
                  {' '}Modo de planilla detectado: <span className="font-semibold">{importacion.datos?.modo_planilla === 'nomina' ? 'nómina completa (titular + cargas)' : 'resumen'}</span>.
                  {' '}Las celdas vacías no borran datos y nunca se elimina a quien no venga en el archivo.
                </p>
              </div>

              {((importacion.datos?.cargas_reasignadas || 0) > 0 || (importacion.datos?.cargas_repetidas || 0) > 0) && (
                <p className="text-[12px] text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2">
                  {importacion.datos?.cargas_reasignadas > 0 && (
                    <>{importacion.datos.cargas_reasignadas} carga(s) cambiarán de titular al titular que indica el archivo. </>
                  )}
                  {importacion.datos?.cargas_repetidas > 0 && (
                    <>{importacion.datos.cargas_repetidas} fila(s) repetidas: la misma cédula de carga aparece varias veces y se toma la última.</>
                  )}
                </p>
              )}

              <p className="text-[12px] text-slate-500 bg-sky-50 ring-1 ring-sky-200 rounded-lg px-3 py-2">
                Formato resumen: <span className="font-semibold">Cédula</span> y <span className="font-semibold">Nombre</span>{' '}
                (opcionales Edad, Cargo, Ente, Estado). Formato nómina: el layout del sistema con cédula del titular,
                cédula del asegurado y parentesco, una fila por carga. El cruce es por cédula.
              </p>

              {importacion.datos?.mensaje && (
                <p className="text-[12px] text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{importacion.datos.mensaje}</p>
              )}

              {(importacion.datos?.errores || []).length > 0 && (
                <div className="border border-red-200 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-red-50 text-[11px] font-bold uppercase tracking-wide text-red-700">
                    Filas con errores · nada se aplicará hasta corregirlas
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-red-100">
                    {importacion.datos.errores.map((err) => (
                      <div key={`${err.fila}-${err.cedula}`} className="px-3 py-2 flex gap-3 text-[12px]">
                        <span className="font-mono font-semibold text-slate-600 shrink-0">Fila {err.fila}</span>
                        <span className="font-mono text-slate-500 shrink-0">{err.cedula || '—'}</span>
                        <span className="text-red-700">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-2.5">
              <button onClick={descargarPlantilla}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all">
                <Download className="w-4 h-4" /> Plantilla
              </button>
              <button onClick={() => setImportacion(null)} disabled={aplicando}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={aplicarImportacion} disabled={aplicando || (importacion.datos?.errores || []).length > 0}
                className="flex-[1.4] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primaryDark text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {aplicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Aplicar {importacion.datos?.titulares ?? 0} trabajadores + {importacion.datos?.cargas ?? 0} cargas
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'form' && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-brand-primary" />
                </div>
                <span className="font-bold text-slate-800">
                  {editando ? 'Editar Empleado' : 'Nuevo Empleado'}
                </span>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <Input label="Cedula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="V-12345678" />
              <Input label="Nombre Completo" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} placeholder="Nombre y apellido" />
              <Input label="Edad" type="number" value={form.edad} onChange={(e) => setForm({ ...form, edad: e.target.value })} placeholder="Ej: 35" />
              <Select label="Cargo" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })}>
                <option value="">Seleccionar...</option>
                {CARGOS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Ente u organismo" value={form.ente || ''} onChange={(e) => setForm({ ...form, ente: e.target.value })} placeholder="Ej: Alcaldía de Bolívar" />

              {editando && (
                <div className="border-t border-slate-100 pt-4 mt-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-slate-800 text-sm">Cargas familiares</span>
                    <span className="text-[11px] text-slate-400">{cargandoBenef ? '...' : `${beneficiarios.length} registro(s)`}</span>
                  </div>

                  {!cargandoBenef && beneficiarios.length > 0 && (
                    <div className="max-h-44 overflow-y-auto space-y-2 mb-3">
                      {beneficiarios.map((b) => (
                        <div key={b.id} className="border border-slate-200 rounded-lg p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{b.nombre_completo}</p>
                              <p className="text-[11px] text-slate-500">CI {b.cedula} · {b.parentesco || 'Sin parentesco'}</p>
                            </div>
                            <Badge color={b.activo ? 'green' : 'red'}>{b.activo ? 'ACTIVO' : 'INACTIVO'}</Badge>
                          </div>

                          {editandoBenef === b.id ? (
                            <div className="mt-2 space-y-2">
                              <Input label="Nombre" value={benefForm.nombre_completo} onChange={(e) => setBenefForm({ ...benefForm, nombre_completo: e.target.value })} />
                              <Input label="Parentesco" value={benefForm.parentesco} onChange={(e) => setBenefForm({ ...benefForm, parentesco: e.target.value })} placeholder="Ej: Esposa, Hijo..." />
                              <Select label="Trabajador (transferir)" value={benefForm.empleado_id} onChange={(e) => setBenefForm({ ...benefForm, empleado_id: e.target.value })}>
                                <option value="">Mantener actual...</option>
                                {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre_completo}</option>)}
                              </Select>
                              <div className="flex gap-2">
                                <button onClick={() => guardarBenef(b)}
                                  className="flex-1 py-2 bg-brand-primary text-white font-semibold text-sm rounded-lg hover:bg-brand-primaryDark transition-all">
                                  Guardar
                                </button>
                                <button onClick={() => setEditandoBenef(null)}
                                  className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <button onClick={() => abrirEditarBenef(b)} title="Editar (cambiar parentesco o trabajador)"
                                className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleBenef(b)} title={b.activo ? 'Desactivar' : 'Activar'}
                                className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                                {b.activo ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => promoverBenef(b)} title="Promover a empleado"
                                className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => eliminarBenef(b)} title="Quitar (desactivar)"
                                className="p-1.5 text-slate-400 hover:text-brand-danger rounded-lg hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Cedula" value={carForm.cedula} onChange={(e) => setCarForm({ ...carForm, cedula: e.target.value })} placeholder="CI carga" />
                    <Input label="Parentesco" value={carForm.parentesco} onChange={(e) => setCarForm({ ...carForm, parentesco: e.target.value })} placeholder="Ej: Esposa" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Input label="Nombre de la carga" value={carForm.nombre_completo} onChange={(e) => setCarForm({ ...carForm, nombre_completo: e.target.value })} placeholder="Nombre y apellido" />
                    <button onClick={crearBenef} disabled={!carForm.cedula.trim() || !carForm.nombre_completo.trim()}
                      title="Agregar carga"
                      className="self-end mb-1 p-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primaryDark disabled:opacity-40 transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <button onClick={guardar} disabled={guardando || !form.cedula.trim() || !form.nombre_completo.trim()}
                className="w-full py-2.5 bg-brand-primary text-white font-semibold text-sm rounded-lg hover:bg-brand-primaryDark shadow-sm shadow-brand-primary/20 disabled:opacity-40 transition-all">
                {guardando ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : editando ? 'Actualizar' : 'Crear Empleado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HORARIOS DE MÉDICOS SECTION
   ═══════════════════════════════════════════════════════════════════ */
function HorariosSection({ medicoInicial = null, onInicialAbierto, userRole = 'admin_sistemas' }) {
  const [medicos, setMedicos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [horario, setHorario] = useState(null);
  const [seleccion, setSeleccion] = useState({});
  const [cargandoHorario, setCargandoHorario] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [certificando, setCertificando] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const { data } = await axiosClient.get('/admin/medicos', { params: { q: busqueda } });
      setMedicos(data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo cargar la lista de médicos.');
      setMedicos([]);
    } finally { setCargando(false); }
  }, [busqueda]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirHorario = async (medicoId) => {
    setCargandoHorario(true); setError(''); setAviso('');
    try {
      const { data } = await axiosClient.get(`/admin/medicos/${medicoId}/horario`);
      setHorario(data);
      const mapa = {};
      (data.dias || []).forEach((d) => { mapa[d.dia_semana] = [...(d.turno_ids || [])]; });
      setSeleccion(mapa);
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo cargar el horario.');
    } finally { setCargandoHorario(false); }
  };

  useEffect(() => {
    if (medicoInicial) {
      abrirHorario(medicoInicial);
      onInicialAbierto && onInicialAbierto();
    }
    // Abre una sola vez el horario pedido desde el formulario de usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicoInicial]);

  const alternarTurno = (dia, turnoId) => {
    setSeleccion((prev) => {
      const actuales = prev[dia] || [];
      const siguiente = actuales.includes(turnoId)
        ? actuales.filter((t) => t !== turnoId)
        : [...actuales, turnoId];
      return { ...prev, [dia]: siguiente };
    });
  };

  const guardar = async () => {
    if (!horario) return;
    setGuardando(true); setError(''); setAviso('');
    try {
      const dias = Object.entries(seleccion).map(([dia, turno_ids]) => ({
        dia_semana: Number(dia),
        turno_ids,
      }));
      const { data } = await axiosClient.put(`/admin/medicos/${horario.medico.id}/horario`, { dias });
      setAviso(`Horario guardado: ${data.dias_configurados} día(s) configurado(s).`);
      cargar();
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo guardar el horario.');
    } finally { setGuardando(false); }
  };

  const certificarHorario = async () => {
    if (!horario) return;
    setCertificando(horario.medico.id); setError(''); setAviso('');
    try {
      const { data } = await axiosClient.post(`/admin/medicos/${horario.medico.id}/horario/certificar`);
      setAviso(`Horario certificado: ${data.dias_certificados} día(s) certificado(s).`);
      setHorario(null);
      cargar();
    } catch (e) {
      setError(e?.response?.data?.detail || 'No se pudo certificar el horario.');
    } finally { setCertificando(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar médico por nombre o especialidad..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all" />
        </div>
      </div>

      <p className="text-[12px] text-slate-500 bg-sky-50 ring-1 ring-sky-200 rounded-lg px-3 py-2">
        Los especialistas se agendan por turnos de Mañana y Tarde. Solo Medicina General y Emergencias tienen cobertura 24 horas.
      </p>

      {error && !horario && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Médico</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Especialidad</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Días con horario</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={4} className="py-10 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-brand-primary" /></td></tr>
              ) : medicos.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400 text-sm">Sin resultados</td></tr>
              ) : medicos.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-semibold text-sm text-slate-800">
                    {m.nombre}
                    {m.emergencia && <span className="ml-2"><Badge color="red">EMERGENCIA</Badge></span>}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">{m.especialidad || '—'}</td>
                  <td className="py-3 px-4">
                    <Badge color={m.dias_con_horario ? 'green' : 'amber'}>{m.dias_con_horario} / 7</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => abrirHorario(m.id)} title="Editar horario"
                      className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                      <CalendarClock className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {horario && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setHorario(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <span className="font-bold text-slate-800">{horario.medico.nombre}</span>
                  <p className="text-[11px] text-slate-400">{horario.medico.especialidad || 'Sin especialidad'}</p>
                </div>
              </div>
              <button onClick={() => setHorario(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-3">
              {cargandoHorario ? (
                <div className="py-8 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-brand-primary" /></div>
              ) : (
                <>
                  {horario.medico.permite_24h && (
                    <p className="text-[11px] text-slate-500 bg-emerald-50 ring-1 ring-emerald-200 rounded-lg px-3 py-2">
                      Este médico puede tener turnos de 24 horas (Medicina General / Emergencias).
                    </p>
                  )}
                  {(horario.dias || []).map((d) => (
                    <div key={d.dia_semana} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-slate-100 pb-2 last:border-0">
                      <span className="w-24 shrink-0 text-[12px] font-semibold text-slate-600">{d.nombre}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(horario.turnos || []).map((t) => {
                          const bloqueado = t.es_24h && !horario.medico.permite_24h;
                          const activo = (seleccion[d.dia_semana] || []).includes(t.id);
                          return (
                            <button key={t.id} type="button" disabled={bloqueado}
                              onClick={() => alternarTurno(d.dia_semana, t.id)}
                              title={bloqueado ? 'Solo Medicina General y Emergencias cubren 24 horas' : `${t.hora_inicio}–${t.hora_fin}`}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                                activo
                                  ? 'bg-brand-primary text-white border-brand-primary'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-brand-primary/50'
                              }`}>
                              {t.nombre} <span className="font-mono text-[10px] opacity-80">{t.hora_inicio}–{t.hora_fin}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {error && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
                  )}
                  {aviso && (
                    <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg">{aviso}</div>
                  )}

                  <button onClick={guardar} disabled={guardando}
                    className="w-full py-2.5 bg-brand-primary text-white font-semibold text-sm rounded-lg hover:bg-brand-primaryDark shadow-sm shadow-brand-primary/20 disabled:opacity-40 transition-all">
                    {guardando ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Guardar Horario'}
                  </button>
                  {userRole === 'recursos_humanos' && (
                    <button onClick={certificarHorario} disabled={certificando === horario.medico.id}
                      className="w-full py-2.5 mt-2 bg-emerald-600 text-white font-semibold text-sm rounded-lg hover:bg-emerald-700 shadow-sm shadow-emerald/20 disabled:opacity-40 transition-all">
                      {certificando === horario.medico.id ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : 'Certificar Horario'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SYSTEM LOGS SECTION
   ═══════════════════════════════════════════════════════════════════ */
function LogsSection() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [nivel, setNivel] = useState('');
  const [cargando, setCargando] = useState(true);
  const [stats, setStats] = useState({ total: 0, por_nivel: [] });
  const [detallando, setDetallando] = useState(null);
  const PER_PAGE = 20;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        axiosClient.get('/admin/logs', { params: { q: busqueda, nivel, page, per_page: PER_PAGE } }),
        axiosClient.get('/admin/logs/stats'),
      ]);
      setItems(logsRes.data.items || []);
      setTotal(logsRes.data.total || 0);
      setStats(statsRes.data || { total: 0, por_nivel: [] });
    } catch { setItems([]); } finally { setCargando(false); }
  }, [busqueda, nivel, page]);

  useEffect(() => { cargar(); }, [cargar]);

  const nivelBadge = (n) => {
    const map = { ERROR: 'red', WARNING: 'amber', INFO: 'slate' };
    return map[n] || 'slate';
  };

  const nivelColor = (n) => {
    const map = { ERROR: 'text-red-600', WARNING: 'text-amber-600', INFO: 'text-slate-500' };
    return map[n] || 'text-slate-500';
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"><Terminal className="w-5 h-5 text-slate-500" /></div>
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total</p><p className="text-xl font-bold text-slate-800">{stats.total}</p></div>
        </div>
        {stats.por_nivel.map((s) => (
          <div key={s.nivel} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.nivel === 'ERROR' ? 'bg-red-50' : s.nivel === 'WARNING' ? 'bg-amber-50' : 'bg-slate-100'}`}>
              {s.nivel === 'ERROR' ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <ClipboardList className="w-5 h-5 text-slate-500" />}
            </div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.nivel}</p><p className="text-xl font-bold text-slate-800">{s.total}</p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
            placeholder="Buscar en logs..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all" />
        </div>
        <select value={nivel} onChange={(e) => { setNivel(e.target.value); setPage(1); }}
          className="px-3 py-2.5 bg-white border border-slate-200 text-slate-800 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all">
          <option value="">Todos</option>
          <option value="ERROR">ERROR</option>
          <option value="WARNING">WARNING</option>
          <option value="INFO">INFO</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nivel</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fuente</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mensaje</th>
                <th className="py-3 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="w-5 h-5 mx-auto animate-spin text-brand-primary" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400 text-sm">Sin logs registrados</td></tr>
              ) : items.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-4 text-[12px] text-slate-500 whitespace-nowrap font-mono">{l.creado_en}</td>
                  <td className="py-2.5 px-4"><Badge color={nivelBadge(l.nivel)}>{l.nivel}</Badge></td>
                  <td className="py-2.5 px-4 text-sm text-slate-600">{l.fuente || '—'}</td>
                  <td className="py-2.5 px-4 text-sm text-slate-700 max-w-[300px] truncate">{l.mensaje}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button onClick={() => setDetallando(l)} className="p-1.5 text-slate-400 hover:text-brand-primary rounded-lg hover:bg-blue-50 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />

      {detallando && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetallando(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-brand-primary" />
                </div>
                <span className="font-bold text-slate-800">Detalle del Log</span>
              </div>
              <button onClick={() => setDetallando(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400">ID:</span> <span className="text-slate-700 font-mono">{detallando.id}</span></div>
                <div><span className="text-slate-400">Nivel:</span> <span className={nivelColor(detallando.nivel)}>{detallando.nivel}</span></div>
                <div><span className="text-slate-400">Fuente:</span> <span className="text-slate-700">{detallando.fuente || '—'}</span></div>
                <div><span className="text-slate-400">Fecha:</span> <span className="text-slate-700 font-mono">{detallando.creado_en}</span></div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Mensaje</p>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">{detallando.mensaje}</p>
              </div>
              {detallando.detalle && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Detalle</p>
                  <pre className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-40">{detallando.detalle}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN INTERFACE
   ═══════════════════════════════════════════════════════════════════ */
const SECCIONES = [
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'empleados', label: 'Nomina', icon: Database },
  { id: 'horarios', label: 'Horarios', icon: CalendarClock },
  { id: 'logs', label: 'Logs del Sistema', icon: Terminal },
];

export default function SystemAdminInterface({ userName = 'Oswaldo Garcia', userRole = 'admin_sistemas', onLogout }) {
  const [seccion, setSeccion] = useState('usuarios');
  const [horarioMedicoId, setHorarioMedicoId] = useState(null);

  return (
    <div className="min-h-screen bg-brand-surface">
      {/* Subtle grid pattern */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundSize: '44px 44px',
          backgroundImage: 'linear-gradient(rgba(26, 75, 124, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 75, 124, 0.15) 1px, transparent 1px)',
        }} />

      {/* Header */}
      <header className="relative z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-1.5 ring-1 ring-slate-200 shadow-sm">
              <img src="/instituto-salud.jpeg" alt="Instituto de Salud" className="h-11 w-auto object-contain" />
            </div>
            <div className="hidden sm:block border-l border-slate-200 pl-4">
              <h1 className="font-display font-bold text-base text-brand-deep leading-tight">Panel de Administracion</h1>
              <p className="text-[11px] text-slate-500">Sistema de Gestion Clinica · Instituto de Salud</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{userName}</p>
              <p className="text-[11px] text-brand-primary font-medium">Encargado de Informatica y Sistemas</p>
            </div>
            <button onClick={onLogout}
              className="p-2 text-slate-400 hover:text-brand-danger rounded-lg hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all"
              title="Cerrar sesion">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="relative z-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex">
          {SECCIONES.map((s) => {
            const Icon = s.icon;
            const activa = seccion === s.id;
            return (
              <button key={s.id} onClick={() => setSeccion(s.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                  activa
                    ? 'border-brand-primary text-brand-primary bg-brand-primary/5'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}>
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {userRole === 'recursos_humanos' ? (
          <HorariosSection
            medicoInicial={horarioMedicoId}
            onInicialAbierto={() => setHorarioMedicoId(null)}
            userRole={userRole}
          />
        ) : (
          <>
            {seccion === 'usuarios' && (
              <UsuariosSection
                onEditarHorario={(personalId) => {
                  if (!personalId) return;
                  setHorarioMedicoId(personalId);
                  setSeccion('horarios');
                }}
              />
            )}
            {seccion === 'empleados' && <EmpleadosSection />}
            {seccion === 'horarios' && (
              <HorariosSection
                medicoInicial={horarioMedicoId}
                onInicialAbierto={() => setHorarioMedicoId(null)}
                userRole={userRole}
              />
            )}
            {seccion === 'logs' && <LogsSection />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sistema operativo</span>
          </div>
          <span>Instituto de Salud · Municipio Simon Bolivar</span>
        </div>
      </footer>
    </div>
  );
}
