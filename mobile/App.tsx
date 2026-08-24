import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DoctorQueueScreen } from './src/screens/doctor/DoctorQueueScreen';
import { PharmacyDispenseScreen } from './src/screens/farmacia/PharmacyDispenseScreen';
import './global.css';

function MainApp() {
  const insets = useSafeAreaInsets();
  const [rolActivo, setRolActivo] = useState<'doctor' | 'farmacia'>('doctor');

  return (
    <View className="flex-1 bg-slate-900">
      <StatusBar style="dark" />

      {/* Pantalla Activa */}
      <View className="flex-1">
        {rolActivo === 'doctor' ? <DoctorQueueScreen /> : <PharmacyDispenseScreen />}
      </View>

      {/* Barra de Navegación Inferior (Roles de Personal) */}
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        className="bg-white border-t border-slate-200 px-6 pt-3 flex-row justify-around items-center"
      >
        <TouchableOpacity
          onPress={() => setRolActivo('doctor')}
          activeOpacity={0.8}
          className={`flex-1 py-2 rounded-2xl items-center flex-row justify-center gap-2 ${
            rolActivo === 'doctor' ? 'bg-teal-50 border border-teal-200' : ''
          }`}
        >
          <Text
            className={`text-sm font-black ${
              rolActivo === 'doctor' ? 'text-teal-800' : 'text-slate-400'
            }`}
          >
            🩺 Cola Médica
          </Text>
        </TouchableOpacity>

        <View className="w-4" />

        <TouchableOpacity
          onPress={() => setRolActivo('farmacia')}
          activeOpacity={0.8}
          className={`flex-1 py-2 rounded-2xl items-center flex-row justify-center gap-2 ${
            rolActivo === 'farmacia' ? 'bg-teal-50 border border-teal-200' : ''
          }`}
        >
          <Text
            className={`text-sm font-black ${
              rolActivo === 'farmacia' ? 'text-teal-800' : 'text-slate-400'
            }`}
          >
            💊 Farmacia
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}
