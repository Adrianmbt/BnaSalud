import React from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import './index.css';
import App from './App.jsx';

// targetSdk 36 (Android 15+) fuerza edge-to-edge: el WebView ya se dibuja
// bajo la barra de estado, así que overlay:true es lo unico que se puede
// pedir. Lo que faltaba era (a) la barra transparente con iconos claros y
// (b) que el header respete env(safe-area-inset-top) para no quedar el
// texto bajo la isla o el notch -> eso es la clase .safe-top.
//
// NO usar setOverlaysWebView({overlay:false}): Android 15+ lo ignora, y en
// las versiones donde aplicara empuja el WebView hacia abajo y deja
// safe-area-inset-top en 0, con lo que el padding del header desaparece.
// Con overlay:true env() si reporta el inset real.
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true });
  StatusBar.setStyle({ style: Style.Dark });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);