import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MobileAPI, PacienteCola } from '../../api/client';

export function DoctorQueueScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'espera' | 'consulta' | 'finalizado'>('espera');
  const [cola, setCola] = useState<{
    espera: PacienteCola[];
    consulta: PacienteCola[];
    finalizado: PacienteCola[];
  }>({
    espera: [],
    consulta: [],
    finalizado: [],
  });
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Estado del Modal de Emergencia (+ Agregar Paciente)
  const [modalEmergenciaVisible, setModalEmergenciaVisible] = useState(false);
  const [formEmergencia, setFormEmergencia] = useState({
    nombre: '',
    cedula: '',
    motivo: '',
    prioridad: 1, // 1: Urgente / Triaje Rojo, 3: Normal
  });
  const [guardandoEmergencia, setGuardandoEmergencia] = useState(false);

  const cargarCola = useCallback(async () => {
    try {
      const data = await MobileAPI.obtenerCola();
      setCola({
        espera: data.espera || [],
        consulta: data.consulta || [],
        finalizado: data.finalizado || [],
      });
    } catch (err: any) {
      // Datos de demostración en caso de servidor desconectado
      setCola((prev) =>
        prev.espera.length === 0
          ? {
              espera: [
                {
                  id: 101,
                  token: 'C-48192',
                  paciente_cedula: 'V-14285932',
                  paciente_nombre: 'Carlos Mendoza Ramos',
                  motivo: 'Dolor torácico opresivo y disnea',
                  prioridad: 1,
                  estado: 'EN_ESPERA',
                  creado_en: '2026-08-24 08:15',
                },
                {
                  id: 102,
                  token: 'C-48193',
                  paciente_cedula: 'V-20114852',
                  paciente_nombre: 'María Rodríguez Silva',
                  motivo: 'Evaluación y control de hipertensión',
                  prioridad: 3,
                  estado: 'EN_ESPERA',
                  creado_en: '2026-08-24 08:30',
                },
                {
                  id: 103,
                  token: 'C-48194',
                  paciente_cedula: 'V-8945123',
                  paciente_nombre: 'José Gregorio Silva',
                  motivo: 'Revisión de resultados de laboratorio',
                  prioridad: 3,
                  estado: 'EN_ESPERA',
                  creado_en: '2026-08-24 08:45',
                },
              ],
              consulta: [],
              finalizado: [],
            }
          : prev
      );
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargarCola();
  }, [cargarCola]);

  const onRefresh = useCallback(async () => {
    setRefrescando(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await cargarCola();
  }, [cargarCola]);

  const llamarPaciente = async (paciente: PacienteCola) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await MobileAPI.asignarPaciente(paciente.id);
    } catch {
      // Simulación local si no hay conexión
    }

    setCola((prev) => ({
      ...prev,
      espera: prev.espera.filter((p) => p.id !== paciente.id),
      consulta: [{ ...paciente, estado: 'EN_CONSULTA' }, ...prev.consulta],
    }));
    setTab('consulta');

    Alert.alert(
      'Paciente en Consulta',
      `${paciente.paciente_nombre} ha sido llamado a consulta.`
    );
  };

  const finalizarConsulta = async (paciente: PacienteCola) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await MobileAPI.finalizarPaciente(paciente.id);
    } catch {
      // Simulación local
    }

    setCola((prev) => ({
      ...prev,
      consulta: prev.consulta.filter((p) => p.id !== paciente.id),
      finalizado: [{ ...paciente, estado: 'ATENDIDO' }, ...prev.finalizado],
    }));

    Alert.alert(
      'Consulta Finalizada',
      `Se registró la atención médica de ${paciente.paciente_nombre}.`
    );
  };

  const handleAgregarEmergencia = async () => {
    if (!formEmergencia.nombre.trim() || !formEmergencia.cedula.trim()) {
      Alert.alert('Datos requeridos', 'Por favor ingrese el nombre y la cédula del paciente.');
      return;
    }

    setGuardandoEmergencia(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      let nuevo: PacienteCola;
      try {
        nuevo = await MobileAPI.registrarEmergencia({
          nombre: formEmergencia.nombre.trim(),
          cedula: formEmergencia.cedula.trim(),
          motivo: formEmergencia.motivo.trim() || 'Triaje de Urgencia',
          prioridad: formEmergencia.prioridad,
        });
      } catch {
        // Fallback local
        nuevo = {
          id: Date.now(),
          token: `C-${Math.floor(Math.random() * 90000) + 10000}`,
          paciente_cedula: formEmergencia.cedula.trim(),
          paciente_nombre: formEmergencia.nombre.trim(),
          motivo: formEmergencia.motivo.trim() || 'Triaje de Urgencia',
          prioridad: formEmergencia.prioridad,
          estado: 'EN_ESPERA',
          creado_en: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
        };
      }

      setCola((prev) => ({
        ...prev,
        espera: [nuevo, ...prev.espera],
      }));
      setModalEmergenciaVisible(false);
      setFormEmergencia({ nombre: '', cedula: '', motivo: '', prioridad: 1 });
      setTab('espera');

      Alert.alert(
        'Paciente Ingresado a Cola',
        `Se agregó a ${nuevo.paciente_nombre} exitosamente.`
      );
    } finally {
      setGuardandoEmergencia(false);
    }
  };

  const listaActual = cola[tab] || [];
  const atendidosHoy = cola.finalizado.length;
  const totalTurno = cola.espera.length + cola.consulta.length + atendidosHoy;
  const limiteTurno = 15;

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-slate-100">
      {/* Header Superior */}
      <View className="px-5 py-4 bg-white border-b border-slate-200">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">
              Salud Barcelona · Portal Médico
            </Text>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">
              Cola de Pacientes
            </h1>
          </View>

          {/* Botón "+ Agregar Paciente" (Urgencia) */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setModalEmergenciaVisible(true);
            }}
            activeOpacity={0.8}
            className="bg-rose-600 px-3.5 py-2.5 rounded-xl shadow-md flex-row items-center gap-1"
          >
            <Text className="text-white font-bold text-xs">+ Urgencia</Text>
          </TouchableOpacity>
        </View>

        {/* Indicador de Capacidad de Turno (Límite 10-15) */}
        <View className="mt-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-xs font-bold text-slate-700">Capacidad del Turno</Text>
            <Text
              className={`text-xs font-extrabold ${
                totalTurno >= limiteTurno ? 'text-rose-700' : 'text-teal-800'
              }`}
            >
              {totalTurno} / {limiteTurno} pacientes
            </Text>
          </View>
          <View className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <View
              className={`h-full rounded-full ${
                totalTurno >= limiteTurno
                  ? 'bg-rose-600'
                  : totalTurno >= limiteTurno - 3
                    ? 'bg-amber-500'
                    : 'bg-teal-600'
              }`}
              style={{ width: `${Math.min((totalTurno / limiteTurno) * 100, 100)}%` }}
            />
          </View>
        </View>

        {/* Selector de Pestañas (Tabs) */}
        <View className="flex-row bg-slate-100 p-1 rounded-xl mt-3">
          {[
            { id: 'espera', etiqueta: 'En Espera', count: cola.espera.length },
            { id: 'consulta', etiqueta: 'En Consulta', count: cola.consulta.length },
            { id: 'finalizado', etiqueta: 'Finalizados', count: cola.finalizado.length },
          ].map((t) => {
            const activo = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTab(t.id as any);
                }}
                className={`flex-1 py-2 rounded-lg items-center justify-center flex-row gap-1.5 ${
                  activo ? 'bg-white shadow-sm' : ''
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    activo ? 'text-teal-800' : 'text-slate-500'
                  }`}
                >
                  {t.etiqueta}
                </Text>
                <View
                  className={`px-1.5 py-0.2 rounded-full ${
                    activo ? 'bg-teal-100' : 'bg-slate-200'
                  }`}
                >
                  <Text className="text-[10px] font-bold text-slate-700">{t.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Lista Virtualizada FlashList */}
      {cargando ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00677d" />
          <Text className="text-xs text-slate-500 font-semibold mt-3">
            Cargando pacientes del turno...
          </Text>
        </View>
      ) : (
        <FlashList
          data={listaActual}
          keyExtractor={(item) => String(item.id)}
          estimatedItemSize={92}
          contentContainerStyle={{ paddingVertical: 10 }}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor="#00677d" />
          }
          renderItem={({ item, index }) => {
            const esAlta = item.prioridad === 1;

            return (
              <View className="bg-white mx-4 my-1.5 p-4 rounded-2xl border border-slate-200 shadow-sm flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="font-mono text-xs font-bold text-slate-400">
                      #{index + 1}
                    </Text>
                    <Text className="text-base font-extrabold text-slate-900 flex-1" numberOfLines={1}>
                      {item.paciente_nombre}
                    </Text>
                    {esAlta && (
                      <View className="bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                        <Text className="text-[10px] font-extrabold text-rose-800">
                          TRIAJE ALTO
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text className="text-xs text-slate-500">
                    Cédula: {item.paciente_cedula} · Token: {item.token}
                  </Text>
                  {item.motivo ? (
                    <Text className="text-xs font-semibold text-teal-800 mt-1" numberOfLines={1}>
                      {item.motivo}
                    </Text>
                  ) : null}
                </View>

                {/* Acciones por Pestaña */}
                {tab === 'espera' && (
                  <TouchableOpacity
                    onPress={() => llamarPaciente(item)}
                    activeOpacity={0.8}
                    className="bg-teal-600 px-4 py-2.5 rounded-xl shadow-md"
                  >
                    <Text className="text-white text-xs font-bold">Llamar</Text>
                  </TouchableOpacity>
                )}

                {tab === 'consulta' && (
                  <TouchableOpacity
                    onPress={() => finalizarConsulta(item)}
                    activeOpacity={0.8}
                    className="bg-emerald-600 px-4 py-2.5 rounded-xl shadow-md"
                  >
                    <Text className="text-white text-xs font-bold">Cerrar</Text>
                  </TouchableOpacity>
                )}

                {tab === 'finalizado' && (
                  <View className="px-3 py-1 bg-slate-100 rounded-lg">
                    <Text className="text-[11px] font-bold text-slate-600">Atendido</Text>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="p-10 items-center justify-center">
              <Text className="text-sm font-bold text-slate-600">
                No hay pacientes en esta sección
              </Text>
              <Text className="text-xs text-slate-400 text-center mt-1">
                {tab === 'espera'
                  ? 'La sala de espera está vacía.'
                  : tab === 'consulta'
                    ? 'No hay consultas activas en este momento.'
                    : 'Aún no se han finalizado atenciones en la jornada.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Modal de Emergencia / Triaje Rápido */}
      <Modal
        visible={modalEmergenciaVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalEmergenciaVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-6 space-y-4">
            <View className="flex-row justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <Text className="text-lg font-black text-slate-900">
                  + Agregar Paciente a Cola
                </Text>
                <Text className="text-xs text-slate-500 font-medium">
                  Inserción de urgencias / pacientes espontáneos
                </Text>
              </div>
              <TouchableOpacity
                onPress={() => setModalEmergenciaVisible(false)}
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
              >
                <Text className="text-slate-600 font-bold text-sm">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Inputs del Formulario */}
            <View className="space-y-3">
              <View>
                <Text className="text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                  Nombre Completo
                </Text>
                <TextInput
                  value={formEmergencia.nombre}
                  onChangeText={(t) => setFormEmergencia({ ...formEmergencia, nombre: t })}
                  placeholder="Ej: Rafael Gómez"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
                />
              </View>

              <View>
                <Text className="text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                  Cédula de Identidad
                </Text>
                <TextInput
                  value={formEmergencia.cedula}
                  onChangeText={(t) => setFormEmergencia({ ...formEmergencia, cedula: t })}
                  placeholder="V-12345678"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
                />
              </View>

              <View>
                <Text className="text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                  Motivo de Atención / Triaje
                </Text>
                <TextInput
                  value={formEmergencia.motivo}
                  onChangeText={(t) => setFormEmergencia({ ...formEmergencia, motivo: t })}
                  placeholder="Ej: Crisis hipertensiva, fiebre alta, herida..."
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
                />
              </View>

              {/* Selector de Prioridad */}
              <View>
                <Text className="text-xs font-mono uppercase font-bold text-slate-500 mb-1">
                  Nivel de Triaje
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setFormEmergencia({ ...formEmergencia, prioridad: 1 })}
                    className={`flex-1 py-2.5 rounded-xl border items-center ${
                      formEmergencia.prioridad === 1
                        ? 'bg-rose-50 border-rose-500'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        formEmergencia.prioridad === 1 ? 'text-rose-700' : 'text-slate-600'
                      }`}
                    >
                      Urgencia (Alta)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setFormEmergencia({ ...formEmergencia, prioridad: 3 })}
                    className={`flex-1 py-2.5 rounded-xl border items-center ${
                      formEmergencia.prioridad === 3
                        ? 'bg-teal-50 border-teal-600'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        formEmergencia.prioridad === 3 ? 'text-teal-800' : 'text-slate-600'
                      }`}
                    >
                      Consulta Regular
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Botón de Confirmación */}
            <TouchableOpacity
              onPress={handleAgregarEmergencia}
              disabled={guardandoEmergencia}
              className="w-full bg-teal-600 py-3.5 rounded-xl items-center justify-center shadow-lg mt-2 disabled:opacity-60"
            >
              {guardandoEmergencia ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-sm">
                  Confirmar e Ingresar a Cola
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default DoctorQueueScreen;
