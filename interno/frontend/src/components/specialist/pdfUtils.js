import jsPDF from 'jspdf';
import { compartirPdf } from '../../utils/compartirPdf';

const MEDIA_CARTA = [396, 612];
const AZUL_INST = [26, 75, 124];
const AZUL_SUAVE = [238, 246, 253];
const VERDE_ACCENT = [56, 176, 0];
const GRIS_TEXTO = [30, 41, 59];
const GRIS_MUTED = [100, 116, 139];
const GRIS_BORDE = [203, 213, 225];
const GRIS_FONDO = [248, 250, 252];

const SIGNOS_LABEL = [
  ['presion_arterial', 'P.A.'],
  ['frecuencia_cardiaca', 'F.C.'],
  ['frecuencia_respiratoria', 'F.R.'],
  ['temperatura', 'T°'],
  ['saturacion_oxigeno', 'SpO₂'],
  ['peso_kg', 'Peso'],
  ['talla_cm', 'Talla'],
];

/* Convierte un hex '#1a4b7c' a [r, g, b]; si falla, usa el fallback. */
const hexToRgb = (hex, fallback = AZUL_INST) => {
  if (!hex) return fallback;
  const m = String(hex).replace('#', '').match(/[0-9a-fA-F]{2}/g);
  if (!m || m.length < 3) return fallback;
  return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
};

const aumentar = (rgb, delta) => rgb.map((v) => Math.max(0, Math.min(255, v + delta)));

const TEXTO_PIE_DEFAULT = 'Documento médico oficial · Sistema BnaSalud · Municipio Simón Bolívar';

export const fechaCitaAmigable = (f) => {
  if (!f) return '—';
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return f;
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

let _logotiposCache = null;
export const obtenerLogotipos = async (logoCentro = '/citab.jpeg') => {
  const cargar = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  if (_logotiposCache && _logotiposCache.key === logoCentro) return _logotiposCache;
  const [instituto, centro] = await Promise.all([
    cargar('/instituto-salud.jpeg'),
    cargar(logoCentro || '/citab.jpeg'),
  ]);
  _logotiposCache = { instituto, centro, key: logoCentro };
  return _logotiposCache;
};

/**
 * Cabecera institucional parametrizada por centro (tema).
 * opciones: { centroNombre, servicio, colores: {primary, accent} }
 */
export const dibujarCabeceraInstitucional = (doc, logos, tituloDoc, anchoPdf, opciones = {}) => {
  const margen = 18;
  const { centroNombre = 'CLÍNICA CITAB', servicio = 'URGENCIAS', colores = {} } = opciones;
  const azul = hexToRgb(colores.primary, AZUL_INST);
  const verde = hexToRgb(colores.accent, VERDE_ACCENT);
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, anchoPdf, 52, 'F');
  if (logos?.instituto) doc.addImage(logos.instituto, 'JPEG', margen, 10, 105, 28);
  if (logos?.centro) doc.addImage(logos.centro, 'JPEG', anchoPdf - margen - 30, 9, 30, 30);
  const centroX = (margen + 105 + anchoPdf - margen - 30) / 2;
  doc.setTextColor(azul[0], azul[1], azul[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CENTRO INTEGRAL DE ALTA TECNOLOGÍA', centroX, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
  doc.text(`${centroNombre.toUpperCase()} · SERVICIO DE ${servicio.toUpperCase()}`, centroX, 31, { align: 'center' });
  doc.setFillColor(azul[0], azul[1], azul[2]);
  doc.rect(0, 48, anchoPdf, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(tituloDoc.toUpperCase(), anchoPdf / 2, 62, { align: 'center' });
  doc.setFillColor(verde[0], verde[1], verde[2]);
  doc.rect(0, 70, anchoPdf, 2.5, 'F');
  return { margen, y: 80 };
};

export const dibujarFichaPaciente = (doc, d, margen, y, ancho, opciones = {}) => {
  const anchoCard = ancho - 2 * margen;
  const azul = hexToRgb((opciones.colores || {}).primary, AZUL_INST);
  doc.setFillColor(GRIS_FONDO[0], GRIS_FONDO[1], GRIS_FONDO[2]);
  doc.setDrawColor(GRIS_BORDE[0], GRIS_BORDE[1], GRIS_BORDE[2]);
  doc.setLineWidth(0.8);
  doc.roundedRect(margen, y, anchoCard, 64, 4, 4, 'FD');
  doc.setFillColor(232, 240, 248);
  doc.roundedRect(margen, y, anchoCard, 14, 4, 4, 'F');
  doc.rect(margen, y + 8, anchoCard, 6, 'F');
  doc.setTextColor(azul[0], azul[1], azul[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('DATOS DEL PACIENTE Y DE LA ATENCIÓN MÉDICA', margen + 8, y + 10);
  const col1X = margen + 8;
  const col2X = margen + 195;
  const drawField = (label, value, x, yy, bold = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
    doc.text(label, x, yy);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 8.5 : 8);
    doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
    doc.text(String(value || '—').slice(0, 30), x + 45, yy);
  };
  drawField('PACIENTE:', (d.paciente_nombre || '').toUpperCase(), col1X, y + 26, true);
  drawField('CÉDULA:', d.paciente_cedula, col1X, y + 39);
  drawField('MÉDICO:', d.medico_nombre, col1X, y + 52);
  drawField('COMPROBANTE:', d.comprobante_ref || d.consulta_id?.slice(0, 10), col2X, y + 26, true);
  const fechaStr = d.fecha ? new Date(d.fecha.replace(' ', 'T')).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  drawField('FECHA / HORA:', fechaStr, col2X, y + 39);
  drawField('ESPECIALIDAD:', d.especialidad || 'Medicina General', col2X, y + 52);
  return y + 74;
};

export const dibujarFirmaYSello = (doc, medicoNombre, margen, anchoPdf, yPos, opciones = {}) => {
  const centro = anchoPdf / 2;
  const yFirma = Math.max(yPos || 495, 485);
  const { centroNombre = 'CLÍNICA CITAB', servicio = 'URGENCIAS', colores = {} } = opciones;
  const azul = hexToRgb(colores.primary, AZUL_INST);
  doc.setDrawColor(GRIS_BORDE[0], GRIS_BORDE[1], GRIS_BORDE[2]);
  doc.setLineWidth(0.8);
  doc.line(centro - 85, yFirma, centro + 85, yFirma);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(azul[0], azul[1], azul[2]);
  doc.text(`DR(A). ${(medicoNombre || 'MÉDICO TRATANTE').toUpperCase()}`, centro, yFirma + 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
  doc.text(`SERVICIO DE ${servicio.toUpperCase()} · ${centroNombre.toUpperCase()}`, centro, yFirma + 21, { align: 'center' });
  doc.text('M.P.P.S. / C.M. / FIRMA Y SELLO', centro, yFirma + 29, { align: 'center' });
};

export const dibujarPiePdf = (doc, pieText = TEXTO_PIE_DEFAULT) => {
  const altura = doc.internal.pageSize.getHeight();
  const ancho = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(GRIS_BORDE[0], GRIS_BORDE[1], GRIS_BORDE[2]);
    doc.setLineWidth(0.5);
    doc.line(18, altura - 22, ancho - 18, altura - 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
    doc.text(pieText, 18, altura - 13);
    doc.text(`Pág. ${i}/${total}`, ancho - 18, altura - 13, { align: 'right' });
  }
};

export const examenesPorCategoria = (d) => {
  const estudios = Array.isArray(d?.estudios) ? d.estudios : [];
  return {
    laboratorio: Array.isArray(d?.laboratorios) ? d.laboratorios : [],
    imagen: estudios.filter((e) => String(e.tipo || '').toUpperCase() === 'IMAGEN'),
    funcional: estudios.filter((e) => String(e.tipo || '').toUpperCase() === 'FUNCIONAL'),
  };
};

export const dibujarTituloSeccion = (doc, t, margen, anchoContenido, y, colorRelleno = AZUL_SUAVE, colorTexto = AZUL_INST) => {
  doc.setFillColor(colorRelleno[0], colorRelleno[1], colorRelleno[2]);
  doc.roundedRect(margen, y, anchoContenido, 16, 3, 3, 'F');
  doc.setTextColor(colorTexto[0], colorTexto[1], colorTexto[2]);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(t.toUpperCase(), margen + 6, y + 11);
  return y + 21;
};

export const exportarPdf = async (d, modo, opciones = {}) => {
  const { centroNombre = 'CITAB', servicio = 'Consulta Externa', tema } = opciones;
  const colores = { primary: tema?.colors?.primary, accent: tema?.colors?.accent };
  const pieText = opciones.pieText || (tema?.fullName ? `Documento médico oficial · ${tema.fullName} · Municipio Simón Bolívar` : TEXTO_PIE_DEFAULT);
  const logos = await obtenerLogotipos(tema?.logo);
  const doc = new jsPDF({ unit: 'pt', format: MEDIA_CARTA });
  const ancho = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const sufijoModo = modo === 'recetas' ? 'recetas' : modo === 'examenes' ? 'examenes' : 'completo';
  const titulo =
    modo === 'recetas' ? `RECETARIO MÉDICO · ${d.comprobante_ref || ''}`
    : modo === 'examenes' ? `ORDEN DE EXÁMENES Y ESTUDIOS · ${d.comprobante_ref || ''}`
    : `REPORTE COMPLETO DE CONSULTA · ${d.comprobante_ref || ''}`;

  const opcCabe = { centroNombre, servicio, colores };
  const { margen } = dibujarCabeceraInstitucional(doc, logos, titulo, ancho, opcCabe);
  let y = 80;
  const anchoContenido = ancho - 2 * margen;
  const zonaMax = altura - 75;

  const saltoDePagina = (necesita = 30) => {
    if (y > zonaMax - necesita) {
      doc.addPage();
      dibujarCabeceraInstitucional(doc, logos, titulo, ancho, opcCabe);
      y = 80;
    }
  };

  y = dibujarFichaPaciente(doc, d, margen, y, ancho, opcCabe);

  if (modo === 'recetas') {
    const recetas = Array.isArray(d.recetas) ? d.recetas.filter((r) => r && (r.nombre || '').trim()) : [];
    y = dibujarTituloSeccion(doc, 'Prescripción de Medicamentos (RP)', margen, anchoContenido, y);
    const colNumW = 24;
    const colMedW = 156;
    const colPosW = anchoContenido - colNumW - colMedW;
    doc.setFillColor(AZUL_INST[0], AZUL_INST[1], AZUL_INST[2]);
    doc.rect(margen, y, anchoContenido, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('#', margen + 8, y + 11);
    doc.text('MEDICAMENTO / PRESENTACIÓN', margen + colNumW + 6, y + 11);
    doc.text('POSOLOGÍA E INDICACIÓN', margen + colNumW + colMedW + 6, y + 11);
    y += 16;
    if (recetas.length === 0) {
      doc.setFillColor(255, 255, 255);
      doc.rect(margen, y, anchoContenido, 22, 'F');
      doc.setDrawColor(GRIS_BORDE[0], GRIS_BORDE[1], GRIS_BORDE[2]);
      doc.rect(margen, y, anchoContenido, 22, 'S');
      doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Sin medicamentos prescritos en esta consulta.', margen + 10, y + 14);
      y += 26;
    } else {
      recetas.forEach((r, idx) => {
        const posLines = doc.splitTextToSize(r.posologia || 'Según criterio médico', colPosW - 12);
        const altoFila = Math.max(22, posLines.length * 10 + 10);
        saltoDePagina(altoFila);
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margen, y, anchoContenido, altoFila, 'F');
        doc.setDrawColor(GRIS_BORDE[0], GRIS_BORDE[1], GRIS_BORDE[2]);
        doc.setLineWidth(0.5);
        doc.rect(margen, y, anchoContenido, altoFila, 'S');
        doc.line(margen + colNumW, y, margen + colNumW, y + altoFila);
        doc.line(margen + colNumW + colMedW, y, margen + colNumW + colMedW, y + altoFila);
        doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(String(idx + 1).padStart(2, '0'), margen + 7, y + 14);
        doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const medLines = doc.splitTextToSize(r.nombre || '—', colMedW - 12);
        doc.text(medLines, margen + colNumW + 6, y + 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(posLines, margen + colNumW + colMedW + 6, y + 13);
        y += altoFila;
      });
      y += 10;
    }
    if (d.recomendaciones) {
      saltoDePagina(40);
      const recLines = doc.splitTextToSize(d.recomendaciones, anchoContenido - 16);
      const altoRec = recLines.length * 10 + 20;
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margen, y, anchoContenido, altoRec, 4, 4, 'FD');
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('INDICACIONES GENERALES:', margen + 8, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(recLines, margen + 8, y + 22);
      y += altoRec + 10;
    }
    dibujarFirmaYSello(doc, d.medico_nombre, margen, ancho, Math.max(y + 35, 490), opcCabe);
  } else if (modo === 'examenes') {
    const cat = examenesPorCategoria(d);
    const todasOrdenes = [
      ...cat.laboratorio.map((e) => ({ ...e, tipoNombre: 'LABORATORIO', chip: [59, 130, 246] })),
      ...cat.imagen.map((e) => ({ ...e, tipoNombre: 'IMAGEN', chip: [139, 92, 246] })),
      ...cat.funcional.map((e) => ({ ...e, tipoNombre: 'FUNCIONAL', chip: [245, 158, 11] })),
    ];
    y = dibujarTituloSeccion(doc, 'Órdenes de Exámenes y Estudios Clínicos', margen, anchoContenido, y);
    const colNumW = 24;
    const colTipoW = 66;
    const colEstW = 145;
    const colIndW = anchoContenido - colNumW - colTipoW - colEstW;
    doc.setFillColor(AZUL_INST[0], AZUL_INST[1], AZUL_INST[2]);
    doc.rect(margen, y, anchoContenido, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('#', margen + 8, y + 11);
    doc.text('TIPO', margen + colNumW + 6, y + 11);
    doc.text('ESTUDIO SOLICITADO', margen + colNumW + colTipoW + 6, y + 11);
    doc.text('INDICACIÓN CLÍNICA', margen + colNumW + colTipoW + colEstW + 6, y + 11);
    y += 16;
    if (todasOrdenes.length === 0) {
      doc.setFillColor(255, 255, 255);
      doc.rect(margen, y, anchoContenido, 22, 'F');
      doc.setDrawColor(GRIS_BORDE[0], GRIS_BORDE[1], GRIS_BORDE[2]);
      doc.rect(margen, y, anchoContenido, 22, 'S');
      doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Sin órdenes de exámenes registradas.', margen + 10, y + 14);
      y += 26;
    } else {
      todasOrdenes.forEach((e, idx) => {
        const indLines = doc.splitTextToSize(e.indicacion || 'Evaluación clínica', colIndW - 10);
        const estLines = doc.splitTextToSize(e.estudio || e.nombre || '—', colEstW - 10);
        const altoFila = Math.max(22, indLines.length * 10 + 10, estLines.length * 10 + 12);
        saltoDePagina(altoFila);
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(margen, y, anchoContenido, altoFila, 'F');
        doc.setDrawColor(GRIS_BORDE[0], GRIS_BORDE[1], GRIS_BORDE[2]);
        doc.setLineWidth(0.5);
        doc.rect(margen, y, anchoContenido, altoFila, 'S');
        doc.line(margen + colNumW, y, margen + colNumW, y + altoFila);
        doc.line(margen + colNumW + colTipoW, y, margen + colNumW + colTipoW, y + altoFila);
        doc.line(margen + colNumW + colTipoW + colEstW, y, margen + colNumW + colTipoW + colEstW, y + altoFila);
        doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(String(idx + 1).padStart(2, '0'), margen + 7, y + 14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(e.chip[0], e.chip[1], e.chip[2]);
        doc.text(e.tipoNombre, margen + colNumW + 6, y + 14);
        doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(estLines, margen + colNumW + colTipoW + 6, y + 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(indLines, margen + colNumW + colTipoW + colEstW + 6, y + 13);
        y += altoFila;
      });
      y += 10;
    }
    if (d.cie10_codigo || d.cie10_descripcion) {
      saltoDePagina(22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
      doc.text('DIAGNÓSTICO PRESUNTIVO / CIE-10:', margen, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
      const cieTxt = `${d.cie10_codigo ? `[${d.cie10_codigo}] ` : ''}${d.cie10_descripcion || ''}`;
      doc.text(cieTxt.slice(0, 60), margen + 130, y);
      y += 16;
    }
    dibujarFirmaYSello(doc, d.medico_nombre, margen, ancho, Math.max(y + 35, 490), opcCabe);
  } else {
    // COMPLETO
    if (d.remision?.remitido) {
      saltoDePagina(34);
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(margen, y, anchoContenido, 28, 4, 4, 'FD');
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`PACIENTE REMITIDO A: ${(d.remision.especialidad_destino || 'ESPECIALISTA').toUpperCase()}`, margen + 8, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text(`Cita: ${fechaCitaAmigable(d.remision.cita_fecha)} · ${d.remision.cita_hora || '—'}  |  Médico: ${d.remision.medico_especialista || '—'}  |  Código: ${d.remision.codigo_cita || '—'}`, margen + 8, y + 21);
      y += 34;
    }
    if (d.remision_examen?.remitido) {
      saltoDePagina(34);
      doc.setFillColor(139, 92, 246);
      doc.rect(margen, y, anchoContenido, 30, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`PACIENTE REMITIDO PARA EXAMEN: ${(d.remision_examen.examen || 'ESTUDIO').toUpperCase()}`, margen + 8, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`Centro: ${d.remision_examen.centro || '—'}  |  Cita: ${fechaCitaAmigable(d.remision_examen.fecha_cita)} · ${d.remision_examen.hora_inicio || '—'}  |  Código: ${d.remision_examen.codigo_confirmacion || '—'}  |  Estado: ${d.remision_examen.estado || 'pendiente'}`, margen + 8, y + 21);
      y += 34;
    }
    const sv = d.signos_vitales || {};
    const signos = SIGNOS_LABEL.map(([k, l]) => ({ l, v: sv[k] })).filter((s) => s.v !== undefined && s.v !== null && s.v !== '');
    if (signos.length) {
      y = dibujarTituloSeccion(doc, 'Signos Vitales', margen, anchoContenido, y);
      const cols = 4;
      const colW = anchoContenido / cols;
      signos.forEach((s, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cardX = margen + col * colW + 2;
        const cardY = y + row * 22;
        doc.setFillColor(240, 249, 255);
        doc.setDrawColor(186, 230, 253);
        doc.roundedRect(cardX, cardY, colW - 4, 18, 3, 3, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(2, 132, 199);
        doc.text(s.l, cardX + 4, cardY + 7);
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(String(s.v), cardX + 4, cardY + 15);
      });
      y += Math.ceil(signos.length / cols) * 22 + 6;
    }
    y = dibujarTituloSeccion(doc, 'Motivo de Consulta y Examen Físico', margen, anchoContenido, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
    doc.text('MOTIVO:', margen + 4, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
    const motLines = doc.splitTextToSize(d.motivo_consulta || '—', anchoContenido - 50);
    doc.text(motLines, margen + 48, y);
    y += motLines.length * 9 + 5;
    if (d.examen_fisico) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
      doc.text('EXAMEN:', margen + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
      const exLines = doc.splitTextToSize(d.examen_fisico, anchoContenido - 50);
      doc.text(exLines, margen + 48, y);
      y += exLines.length * 9 + 6;
    }
    y = dibujarTituloSeccion(doc, 'Diagnóstico Clínico (CIE-10)', margen, anchoContenido, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(AZUL_INST[0], AZUL_INST[1], AZUL_INST[2]);
    const diagTxt = `${d.cie10_codigo ? `[${d.cie10_codigo}] ` : ''}${d.cie10_descripcion || '—'}`;
    doc.text(diagTxt, margen + 4, y);
    y += 14;
    if (d.tratamiento) {
      y = dibujarTituloSeccion(doc, 'Tratamiento', margen, anchoContenido, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
      const tratLines = doc.splitTextToSize(d.tratamiento, anchoContenido - 8);
      doc.text(tratLines, margen + 4, y);
      y += tratLines.length * 9 + 6;
    }
    const recetas = Array.isArray(d.recetas) ? d.recetas.filter((r) => r && (r.nombre || '').trim()) : [];
    if (recetas.length) {
      y = dibujarTituloSeccion(doc, 'Recetas Médicas', margen, anchoContenido, y);
      recetas.forEach((r, i) => {
        saltoDePagina(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
        doc.text(`${String(i + 1).padStart(2, '0')}. ${r.nombre}`, margen + 6, y);
        if (r.posologia) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(GRIS_MUTED[0], GRIS_MUTED[1], GRIS_MUTED[2]);
          doc.text(`— ${r.posologia}`, margen + 140, y);
        }
        y += 11;
      });
      y += 4;
    }
    if (d.recomendaciones) {
      y = dibujarTituloSeccion(doc, 'Recomendaciones', margen, anchoContenido, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(GRIS_TEXTO[0], GRIS_TEXTO[1], GRIS_TEXTO[2]);
      const recLines = doc.splitTextToSize(d.recomendaciones, anchoContenido - 8);
      doc.text(recLines, margen + 4, y);
      y += recLines.length * 9 + 6;
    }
    dibujarFirmaYSello(doc, d.medico_nombre, margen, ancho, Math.max(y + 30, 490), opcCabe);
  }

  dibujarPiePdf(doc, pieText);
  return compartirPdf(doc, `${sufijoModo}-${(d.paciente_cedula || d.comprobante_ref || d.consulta_id || 'paciente').replace(/[^A-Za-z0-9-]/g, '')}.pdf`);
};
