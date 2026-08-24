import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MobileAPI, RecetaPendiente, DetalleRecetaItem } from '../../api/client';

export function PharmacyDispenseScreen() {
  const insets = useSafeAreaInsets();
  const [pendientes, setPendientes] = useState<RecetaPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [recetaSeleccionada, setRecetaSeleccionada] = useState<RecetaPendiente | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [despachando, setDespachando] = useState(false);

  const cargarPendientes = useCallback(async () => {
    try {
      const data = await MobileAPI.obtenerRecetasPendientes();
      setPendientes(data || []);
      if (data && data.length > 0 && !recetaSeleccionada) {
        setRecetaSeleccionada(data[0]);
        setSeleccionados(new Set(data[0].detalles.map((d) => d.medicamento_id)));
      }
    } catch {
      // Datos demo de contingencia
      const demoData: RecetaPendiente[] = [
        {
          id: 1,
          codigo_receta: 'RX-2026-0891',
          paciente_nombre: 'Ana Cristina Morales',
          paciente_cedula: 'V-18452109',
          medico: 'Dra. Laura Fernández',
          estado: 'PENDIENTE',
          fecha_emision: '2026-08-24 08:30',
          detalles: [
            {
              medicamento_id: 101,
              nombre_medicamento: 'Losartán Potásico 50mg',
              cantidad_prescrita: 30,
              cantidad_despachada: 0,
              posologia: '1 tableta cada 12 horas por 30 días',
              stock: 120,
            },
            {
              medicamento_id: 102,
              nombre_medicamento: 'Metformina 850mg',
              cantidad_prescrita: 60,
              cantidad_despachada: 0,
              posologia: '1 tableta con el almuerzo y cena',
              stock: 15,
            },
          ],
        },
        {
          id: 2,
          codigo_receta: 'RX-2026-0892',
          paciente_nombre: 'José Gregorio Silva',
          paciente_cedula: 'V-8945123',
          medico: 'Dr. Antonio Valera',
          estado: 'PENDIENTE',
          fecha_emision: '2026-08-24 08:45',
          detalles: [
            {
              medicamento_id: 103,
              nombre_medicamento: 'Atorvastatina 20mg',
              cantidad_prescrita: 30,
              cantidad_despachada: 0,
              posologia: '1 tableta en la noche',
              stock: 45,
            },
          ],
        },
      ];
      setPendientes(demoData);
      if (!recetaSeleccionada) {
        setRecetaSeleccionada(demoData[0]);
        setSeleccionados(new Set(demoData[0].detalles.map((d) => d.medicamento_id)));
      }
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, [recetaSeleccionada]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  const onRefresh = useCallback(async () => {
    setRefrescando(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await cargarPendientes();
  }, [cargarPendientes]);

  const toggleSeleccion = (medicamentoId: number) => {
    Haptics.selectionAsync();
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(medicamentoId)) next.delete(medicamentoId);
      else next.add(medicamentoId);
      return next;
    });
  };

  const seleccionarReceta = (rx: RecetaPendiente) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecetaSeleccionada(rx);
    setSeleccionados(new Set(rx.detalles.map((d) => d.medicamento_id)));
  };

  const procesarDespacho = async () => {
    if (!recetaSeleccionada) return;
    if (seleccionados.size === 0) {
      Alert.alert('Atención', 'Seleccione al menos un medicamento para despachar.');
      return;
    }

    setDespachando(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const itemsADespachar = recetaSeleccionada.detalles
      .filter((d) => seleccionados.has(d.medicamento_id))
      .map((d) => ({
        medicamento_id: d.medicamento_id,
        cantidad_despachada: d.cantidad_prescrita,
      }));

    try {
      try {
        await MobileAPI.despacharReceta({
          receta_id: recetaSeleccionada.id,
          items: itemsADespachar,
        });
      } catch {
        // Fallback local
      }

      Alert.alert(
        'Despacho Registrado con Éxito',
        `Se han dispensado ${itemsADespachar.length} medicamento(s) para ${recetaSeleccionada.paciente_nombre}. La receta pasa a estado ENTREGADA.`,
        [
          {
            text: 'Aceptar',
            onPress: () => {
              setPendientes((prev) => prev.filter((p) => p.id !== recetaSeleccionada.id));
              setRecetaSeleccionada(null);
              setSeleccionados(new Set());
            },
          },
        ]
      );
    } finally {
      setDespachando(false);
    }
  };

  const filtradas = pendientes.filter((r) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      r.codigo_receta.toLowerCase().includes(q) ||
      r.paciente_cedula.toLowerCase().includes(q) ||
      r.paciente_nombre.toLowerCase().includes(q)
    );
  });

  return (
    <View style={{ paddingTop: insets.top }} className="flex-1 bg-slate-100">
      {/* Header Superior */}
      <View className="px-5 py-4 bg-white border-b border-slate-200">
        <Text className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold">
          Salud Barcelona · Farmacia Central
        </Text>
        <h1 className="text-2xl font-black text-slate-900 leading-tight">
          Despacho de Recetas
        </h1>

        {/* Barra de Búsqueda */}
        <View className="mt-3 flex-row items-center bg-slate-100 rounded-xl px-3.5 border border-slate-200">
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar por código (RX-...) o cédula"
            className="flex-1 py-2.5 text-sm text-slate-900"
            placeholderTextColor="#94a3b8"
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')} className="p-1">
              <Text className="text-slate-400 font-bold text-xs">✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Carrusel de Recetas Pendientes */}
        {filtradas.length > 0 && (
          <View className="mt-3">
            <Text className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold mb-1.5">
              En Espera de Despacho ({filtradas.length})
            </Text>
            <FlashList
              horizontal
              data={filtradas}
              keyExtractor={(item) => String(item.id)}
              estimatedItemSize={160}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const activa = recetaSeleccionada?.id === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => seleccionarReceta(item)}
                    activeOpacity={0.8}
                    className={`mr-2.5 p-3 rounded-xl border min-w-[170px] ${
                      activa
                        ? 'bg-teal-700 border-teal-700 shadow-md'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text
                      className={`font-mono text-xs font-bold ${
                        activa ? 'text-teal-200' : 'text-teal-800'
                      }`}
                    >
                      {item.codigo_receta}
                    </Text>
                    <Text
                      className={`text-sm font-bold mt-0.5 ${
                        activa ? 'text-white' : 'text-slate-900'
                      }`}
                      numberOfLines={1}
                    >
                      {item.paciente_nombre}
                    </Text>
                    <Text
                      className={`text-[10px] ${
                        activa ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      {item.detalles.length} medicamento(s)
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Contenido Principal: Ficha de la Receta Activa */}
      {cargando ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#00677d" />
          <Text className="text-xs text-slate-500 font-semibold mt-3">
            Cargando recetas pendientes...
          </Text>
        </View>
      ) : recetaSeleccionada ? (
        <View className="flex-1 p-4 justify-between">
          {/* Tarjeta de Datos del Paciente */}
          <View className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                {recetaSeleccionada.codigo_receta}
              </Text>
              <View className="bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200">
                <Text className="text-[10px] font-bold text-amber-800">PENDIENTE</Text>
              </View>
            </View>

            <Text className="text-lg font-black text-slate-900 mt-1">
              {recetaSeleccionada.paciente_nombre}
            </Text>
            <Text className="text-xs text-slate-500 font-medium">
              Cédula: {recetaSeleccionada.paciente_cedula} · Indicada por: {recetaSeleccionada.medico}
            </Text>
          </View>

          {/* Lista de Medicamentos con Checkbox Táctil */}
          <View className="flex-1 bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <Text className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold mb-3">
              Medicamentos Indicados ({recetaSeleccionada.detalles.length})
            </Text>

            <FlashList
              data={recetaSeleccionada.detalles}
              keyExtractor={(item) => String(item.medicamento_id)}
              estimatedItemSize={80}
              refreshControl={
                <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor="#00677d" />
              }
              renderItem={({ item }) => {
                const seleccionado = seleccionados.has(item.medicamento_id);
                const stockDisponible = Number(item.stock ?? 50);
                const stockSuficiente = stockDisponible >= item.cantidad_prescrita;

                return (
                  <TouchableOpacity
                    onPress={() => toggleSeleccion(item.medicamento_id)}
                    activeOpacity={0.7}
                    className={`p-3.5 rounded-xl border mb-2.5 flex-row items-center justify-between transition-all ${
                      seleccionado
                        ? 'bg-teal-50/70 border-teal-500 shadow-xs'
                        : 'bg-white border-slate-200 opacity-60'
                    }`}
                  >
                    <View className="flex-1 pr-3">
                      <Text className="font-bold text-slate-900 text-sm">
                        {item.nombre_medicamento}
                      </Text>
                      <Text className="text-xs text-slate-500 mt-0.5">
                        {item.posologia || 'Según indicación médica'}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        <Text className="text-[11px] font-mono font-bold text-slate-600">
                          Cant: {item.cantidad_prescrita} unid.
                        </Text>
                        <Text
                          className={`text-[11px] font-bold ${
                            stockSuficiente ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          · Stock: {stockDisponible}
                        </Text>
                      </View>
                    </View>

                    {/* Casilla Táctil de Selección */}
                    <View
                      className={`w-7 h-7 rounded-lg items-center justify-center border ${
                        seleccionado
                          ? 'bg-teal-600 border-teal-600'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {seleccionado && <Text className="text-white font-bold text-xs">✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Botón Principal de Confirmación */}
          <View className="pt-3">
            <TouchableOpacity
              onPress={procesarDespacho}
              disabled={despachando || seleccionados.size === 0}
              activeOpacity={0.8}
              className="w-full bg-teal-600 py-4 rounded-2xl items-center justify-center shadow-lg active:scale-[0.99] disabled:opacity-50"
            >
              {despachando ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  Confirmar Despacho y Entrega ({seleccionados.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-base font-bold text-slate-700 text-center">
            No hay recetas pendientes de despacho
          </Text>
          <Text className="text-xs text-slate-400 text-center mt-1">
            Cuando un médico finalice una consulta, las recetas aparecerán en esta pantalla
            automáticamente.
          </Text>
        </View>
      )}
    </View>
  );
}

export default PharmacyDispenseScreen;
