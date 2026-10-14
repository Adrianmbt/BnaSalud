import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  User, Lock, Eye, EyeOff,
  ArrowRight, Loader2, AlertCircle, Activity, Server,
} from 'lucide-react';
import { HEALTH_CENTERS_THEME } from '../config/healthCentersTheme';
import { apiBase, esNativo, getServidor } from '../config/api';
import ServerSettingsModal from '../components/ServerSettingsModal';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [servidorAbierto, setServidorAbierto] = useState(false);
  const [sinServidor, setSinServidor] = useState(false);

  // ponytail: en nativo '/api/v1' nunca resuelve (origen https://localhost), avisamos antes de fallar
  useEffect(() => {
    if (esNativo()) getServidor().then((base) => setSinServidor(!base));
  }, []);

  const abrirServidor = () => {
    setServidorAbierto(true);
    setError('');
  };

  // Tema general para el login (antes de conocer el centro del usuario)
  const theme = HEALTH_CENTERS_THEME.general;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Ingresa tu usuario y contraseña para continuar.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const resp = await axios.post(`${await apiBase()}/auth/login`, {
        username: username.trim(),
        password,
      });
      onLogin(resp.data);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.detail;
      if (status === 401) {
        setError('Usuario o contraseña incorrectos.');
      } else if (status === 403) {
        setError(msg || 'Tu rol no tiene acceso a este módulo.');
      } else if (!err.response) {
        // sin respuesta = nadie contestó: red caída, CORS o servidor mal configurado
        setSinServidor(true);
        setError('No se pudo conectar con el servidor. Revisa la URL e inténtalo de nuevo.');
      } else {
        setError(msg || `El servidor respondió con error ${status}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: theme.colors.bg }}>
      {/* ─── Panel izquierdo: identidad ─── */}
      <div
        className="hidden lg:flex relative w-[46%] flex-col justify-between overflow-hidden text-white p-12"
        style={{
          background: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.via} 50%, ${theme.gradient.to} 100%)`,
        }}
      >
        {/* Decoración de fondo */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, ${theme.colors.secondary} 0, transparent 45%), radial-gradient(circle at 85% 80%, ${theme.colors.accent} 0, transparent 42%), radial-gradient(circle at 70% 15%, ${theme.colors.danger} 0, transparent 35%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 22px)',
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${theme.colors.secondary}33` }}
        />

        {/* Logo institucional */}
        <div className="relative flex flex-col items-center gap-5 animate-fade-in">
          <div className="bg-white rounded-xl p-2.5 shadow-lg">
            <img
              src={theme.logo}
              alt={theme.fullName}
              className="h-14 w-auto object-contain"
            />
          </div>
        </div>

        {/* Texto de bienvenida */}
        <div className="relative space-y-5 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3.5 py-1 text-[11px] font-semibold tracking-widest uppercase">
            <Activity className="w-3.5 h-3.5 text-emerald-300" />
            Acceso institucional seguro
          </div>
          <h1
            className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: `"${theme.fonts.heading}", "Segoe UI", sans-serif` }}
          >
            Red de Salud
            <span
              className="block text-2xl xl:text-3xl mt-2 font-bold"
              style={{ color: theme.colors.secondary }}
            >
              Municipio Simón Bolívar
            </span>
          </h1>
          <p className="text-white/70 text-base max-w-md leading-relaxed">
            Plataforma interna de atención médica. Ingresa con tus credenciales
            para gestionar tu módulo asignado.
          </p>

          {/* Centros de salud */}
          <div className="grid grid-cols-2 gap-2 pt-3 max-w-md">
            {Object.values(HEALTH_CENTERS_THEME)
              .filter((t) => t.id !== 'general')
              .map((center) => (
                <div
                  key={center.id}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 flex items-center gap-2"
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: center.colors.secondary }}
                  />
                  <p className="text-[10px] text-white/80 font-medium truncate">
                    {center.name}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ─── Panel derecho: formulario ─── */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 relative">
        {/* Logo móvil */}
        <div className="lg:hidden absolute top-8 left-1/2 -translate-x-1/2">
          <div className="bg-white rounded-xl shadow-lg p-1.5 ring-1" style={{ borderColor: theme.colors.border }}>
            <img src={theme.logo} alt={theme.name} className="h-14 w-auto object-contain" />
          </div>
        </div>

        <div className="w-full max-w-md animate-fade-up">
          {/* Header desktop */}
          <div className="hidden lg:flex items-center gap-3 mb-6">
            <div className="bg-white rounded-xl shadow-md ring-1 p-2" style={{ borderColor: theme.colors.border }}>
              <img src={theme.logo} alt={theme.name} className="h-12 w-auto object-contain" />
            </div>
            <div>
              <p
                className="font-extrabold text-lg leading-tight"
                style={{ color: theme.colors.primary }}
              >
                Sistema Interno
              </p>
              <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                {theme.name} · Red de Salud
              </p>
            </div>
          </div>

          <h2
            className="text-2xl font-extrabold tracking-tight mb-1 mt-10 lg:mt-0"
            style={{ color: theme.colors.primary }}
          >
            Iniciar sesión
          </h2>
          <p className="mb-6" style={{ color: theme.colors.textMuted }}>
            Ingresa tus credenciales para acceder a tu módulo asignado.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="block text-[13px] font-semibold mb-1" style={{ color: theme.colors.text }}>
                Usuario
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none" style={{ color: theme.colors.textMuted }} />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: med_citab"
                  className="cp-input !py-2 pl-11"
                  style={{ borderColor: theme.colors.border }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-semibold mb-1" style={{ color: theme.colors.text }}>
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[17px] h-[17px] pointer-events-none" style={{ color: theme.colors.textMuted }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="cp-input !py-2 pl-11 pr-11"
                  style={{ borderColor: theme.colors.border }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: theme.colors.textMuted }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {sinServidor && (
              <div
                className="flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] animate-fade-in"
                style={{ borderColor: '#FCD34D', backgroundColor: '#FFFBEB', color: '#92400E' }}
              >
                <Server className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Esta app aún no tiene servidor configurado. Sin esa URL no puede iniciar sesión.{' '}
                  <button type="button" onClick={abrirServidor} className="font-bold underline">
                    Configurar ahora
                  </button>
                </span>
              </div>
            )}

            {error && (
              <div
                className="flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] animate-fade-in"
                style={{
                  borderColor: '#FCA5A5',
                  backgroundColor: '#FEF2F2',
                  color: theme.colors.danger,
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-sm transition-all duration-200 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed group"
              style={{
                background: `linear-gradient(135deg, ${theme.gradient.from}, ${theme.gradient.to})`,
                boxShadow: `0 10px 25px -8px ${theme.colors.primary}55`,
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
                </>
              ) : (
                <>
                  Entrar al sistema
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${theme.colors.border}` }}>
            <p className="text-xs text-center leading-relaxed" style={{ color: theme.colors.textMuted }}>
              Acceso restringido al personal de la{' '}
              <strong style={{ color: theme.colors.primary }}>Red de Salud</strong> del municipio.
              <br />
              {Object.values(HEALTH_CENTERS_THEME)
                .filter((t) => t.id !== 'general')
                .map((t) => t.name)
                .join(' · ')}
            </p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={abrirServidor}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-xl text-xs font-semibold transition-colors"
                style={{ color: theme.colors.textMuted, border: `1px solid ${theme.colors.border}` }}
              >
                <Server className="w-4 h-4" />
                Configurar servidor
              </button>
            </div>
          </div>
        </div>
      </div>

      {servidorAbierto && (
        <ServerSettingsModal theme={theme} onClose={() => setServidorAbierto(false)} />
      )}
    </div>
  );
}
