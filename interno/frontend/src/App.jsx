import React, { useEffect, useState } from 'react';
import Login from './pages/Login';
import ReceptionInterface from './pages/ReceptionInterface';
import EmergencyDoctorInterface from './pages/EmergencyDoctorInterface';
import SpecialistInterface from './pages/SpecialistInterface';
import FarmaciaInterface from './pages/FarmaciaInterface';
import AlmacenInterface from './pages/AlmacenInterface';
import HistoriasMedicasInterface from './pages/HistoriasMedicasInterface';
import SystemAdminInterface from './pages/SystemAdminInterface';
import ExecutiveAdminDashboard from './pages/ExecutiveAdminDashboard';
import { ThemeProvider } from './components/ThemeProvider';
import { ModalStackProvider } from './components/ModalStack';
import { cargarSesion, guardarSesion, borrarSesion } from './sesion';
import axiosClient from './api/axiosClient';
import './index.css';

export default function App() {
  return (
    <ModalStackProvider>
      <Aplicacion />
    </ModalStackProvider>
  );
}

function Aplicacion() {
  const [arrancando, setArrancando] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [currentRole, setCurrentRole] = useState('recepcion');
  const [currentUser, setCurrentUser] = useState('');
  const [currentEspecialidad, setCurrentEspecialidad] = useState('');
  const [currentPersonalId, setCurrentPersonalId] = useState(null);
  const [currentClinicaId, setCurrentClinicaId] = useState(null);
  const [currentClinicaCode, setCurrentClinicaCode] = useState('');
  const [currentClinicaNombre, setCurrentClinicaNombre] = useState('');

  // Android 15+ (targetSdk 36) ignora adjustResize en ventanas edge-to-edge:
    // sin esto el teclado tapa los campos de la consulta.
  useEffect(() => {
    import('@capacitor/keyboard')
      .then(({ Keyboard }) => Keyboard.setResizeOnFullScreen())
      .catch(() => {});
  }, []);

  // El <title> de index.html estaba fijo en "Recepción": la pestaña mentía en
  // todos los demás módulos y no había forma de saber dónde estabas.
  useEffect(() => {
    const MODULO = {
      recepcion: 'Recepción',
      emergency: 'Emergencias',
      especialista: 'Especialista',
      farmacia: 'Farmacia',
      almacen: 'Almacén',
      historias_medicas: 'Historias Médicas',
      admin_sistemas: 'Administración',
      recursos_humanos: 'Recursos Humanos',
      director: 'Dirección',
    };
    document.title = loggedIn
      ? `${MODULO[currentRole] || 'Sistema Interno'} · CITAB — Salud Barcelona`
      : 'Sistema Interno CITAB — Salud Barcelona';
  }, [loggedIn, currentRole]);

  useEffect(() => {
    cargarSesion().then(async (s) => {
      if (s.citab_role && s.citab_user && s.citab_token) {
        try {
          // El rol del usuario pudo cambiar en Administración desde que se guardó
          // la sesión (o su guardia pudo cerrarse): se revalida contra el servidor
          // para no pintar una interfaz que ya no le corresponde.
          const { data } = await axiosClient.get('/auth/sesion');
          handleLogin(data);
        } catch (e) {
          if (e?.response) {
            // 401/403: usuario desactivado, eliminado o sin guardia activa.
            borrarSesion().catch(() => {});
          } else {
            // Sin conexión se mantiene la sesión guardada, como antes.
            aplicarSesion({
              rol: s.citab_role,
              nombre: s.citab_user,
              especialidad: s.citab_especialidad,
              personal_id: Number(s.citab_personal_id) || null,
              clinica_id: Number(s.citab_clinica_id) || null,
              clinica_code: s.citab_clinica_code,
              clinica_nombre: s.citab_clinica_nombre,
            });
          }
        }
      }
      setArrancando(false);
    }).catch(() => {
      // Si el almacenamiento falla, mostrar login es mejor que quedar pegado en
      // "Restaurando sesion...". El frontend es la interfaz de respaldo: si no
      // arranca, no hay nada.
      setArrancando(false);
    });
  }, []);

  const aplicarSesion = (session) => {
    setCurrentRole(session.rol);
    setCurrentUser(session.nombre || '');
    setCurrentEspecialidad(session.especialidad || '');
    setCurrentPersonalId(session.personal_id || null);
    setCurrentClinicaId(session.clinica_id || null);
    setCurrentClinicaCode(session.clinica_code || '');
    setCurrentClinicaNombre(session.clinica_nombre || '');
    setLoggedIn(true);
  };

  const handleLogin = (session) => {
    aplicarSesion(session);

    guardarSesion({
      citab_role: session.rol,
      citab_user: session.nombre,
      citab_token: session.access_token,
      citab_especialidad: session.especialidad || '',
      citab_personal_id: session.personal_id || '',
      citab_clinica_id: session.clinica_id || '',
      citab_clinica_code: session.clinica_code || '',
      citab_clinica_nombre: session.clinica_nombre || '',
    }).catch(() => {});
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setCurrentRole('recepcion');
    setCurrentUser('');
    setCurrentEspecialidad('');
    setCurrentPersonalId(null);
    setCurrentClinicaId(null);
    setCurrentClinicaCode('');
    setCurrentClinicaNombre('');
    borrarSesion();
  };

  if (arrancando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Restaurando sesión…</p>
      </div>
    );
  }

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
      <ThemeProvider centerId={currentClinicaId} centerCode={currentClinicaCode}>
      {currentRole === 'emergency' && (
        <EmergencyDoctorInterface
          userName={currentUser}
          personalId={currentPersonalId}
          clinicaId={currentClinicaId}
          clinicaNombre={currentClinicaNombre}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'especialista' && (
        <SpecialistInterface
          userName={currentUser}
          especialidad={currentEspecialidad}
          personalId={currentPersonalId}
          clinicaId={currentClinicaId}
          clinicaNombre={currentClinicaNombre}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'recepcion' && (
        <ReceptionInterface
          userName={currentUser}
          clinicaId={currentClinicaId}
          clinicaNombre={currentClinicaNombre}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'farmacia' && (
        <FarmaciaInterface
          userName={currentUser}
          clinicaId={currentClinicaId}
          clinicaNombre={currentClinicaNombre}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'almacen' && (
        <AlmacenInterface
          userName={currentUser}
          clinicaNombre={currentClinicaNombre}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'historias_medicas' && (
        <HistoriasMedicasInterface
          userName={currentUser}
          personalId={currentPersonalId}
          clinicaId={currentClinicaId}
          clinicaNombre={currentClinicaNombre}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'admin_sistemas' && (
        <SystemAdminInterface
          userName={currentUser}
          userRole={currentRole}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'recursos_humanos' && (
        <SystemAdminInterface
          userName={currentUser}
          userRole={currentRole}
          onLogout={handleLogout}
        />
      )}
      {currentRole === 'director' && (
        <ExecutiveAdminDashboard
          userName={currentUser}
          onLogout={handleLogout}
        />
      )}
      {!['emergency', 'especialista', 'recepcion', 'farmacia', 'almacen', 'historias_medicas', 'admin_sistemas', 'recursos_humanos', 'director'].includes(currentRole) && (
        <Login onLogin={handleLogin} />
      )}
    </ThemeProvider>
  );
}
