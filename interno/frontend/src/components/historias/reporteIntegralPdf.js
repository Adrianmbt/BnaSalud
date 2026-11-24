import jsPDF from 'jspdf';
import { compartirPdf } from '../../utils/compartirPdf';
import {
  dibujarCabeceraInstitucional,
  dibujarFichaPaciente,
  dibujarFirmaYSello,
  dibujarPiePdf,
  dibujarTituloSeccion,
  obtenerLogotipos,
} from '../specialist/pdfUtils';
import {
  SECCIONES_CITAB,
  normalizarDatos,
  valorLegible,
} from './formularioCitab';

const MEDIA_CARTA = [396, 612];
const GRIS = [71, 85, 105];

const fechaCorta = (valor) => {
  if (!valor) return '—';
  const texto = String(valor).split('T')[0];
  const partes = texto.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return texto;
};

const nombrePaciente = (paciente) => (paciente?.nombre_completo || '').toUpperCase();

const seccionCompacta = (id) => id === 'patologia_personal' || id === 'factores_riesgo';

function filasDeSeccion(seccion, datos) {
  const valores = datos?.[seccion.id] || {};
  const filas = [];
  seccion.campos.forEach((campo) => {
    const valor = valores[campo.key];
    const vacio = valor === null || valor === undefined || String(valor).trim() === '';
    if (vacio) return;
    if (seccionCompacta(seccion.id) && campo.tipo === 'bool' && valor !== true) return;
    filas.push({ label: campo.label, value: valorLegible(campo, valor) });
  });
  return filas;
}

export async function exportarHistoriaPdf({ paciente, ficha, reposos = [], tema, servicio = 'Historia Clínica Integral' }) {
  const colores = { primary: tema?.colors?.primary, accent: tema?.colors?.accent };
  const centroNombre = tema?.fullName || 'CITAB';
  const logos = await obtenerLogotipos(tema?.logo);
  const doc = new jsPDF({ unit: 'pt', format: MEDIA_CARTA });
  const ancho = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const datos = normalizarDatos(ficha?.datos);

  const opciones = { centroNombre, servicio, colores };
  const titulo = `HISTORIA CLÍNICA INTEGRAL · ${paciente?.cedula || ''}`;
  const { margen } = dibujarCabeceraInstitucional(doc, logos, titulo, ancho, opciones);
  const anchoContenido = ancho - 2 * margen;
  let y = 80;

  y = dibujarFichaPaciente(
    doc,
    {
      paciente_nombre: nombrePaciente(paciente),
      paciente_cedula: paciente?.cedula,
      medico_nombre: ficha?.actualizado_por || 'Registro administrativo',
      comprobante_ref: ficha ? `FICHA v${ficha.version}` : 'SIN FICHA',
      fecha: ficha?.updated_at || new Date().toISOString(),
      especialidad: servicio,
    },
    margen,
    y,
    ancho,
    opciones,
  );

  const salto = (necesita = 22) => {
    if (y > altura - 78 - necesita) {
      doc.addPage();
      dibujarCabeceraInstitucional(doc, logos, titulo, ancho, opciones);
      y = 80;
    }
  };

  SECCIONES_CITAB.forEach((seccion) => {
    const filas = filasDeSeccion(seccion, datos);
    if (!filas.length) return;
    salto(34);
    y = dibujarTituloSeccion(doc, seccion.titulo, margen, anchoContenido, y);
    filas.forEach((fila) => {
      const lineas = doc.splitTextToSize(fila.value || '—', anchoContenido - 150);
      const alto = Math.max(11, lineas.length * 9);
      salto(alto);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
      doc.text(fila.label.toUpperCase(), margen + 4, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(lineas, margen + 142, y);
      y += alto + 2;
    });
    y += 6;
  });

  if (reposos.length) {
    salto(50);
    y = dibujarTituloSeccion(doc, 'Reposos médicos', margen, anchoContenido, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text('FOLIO', margen + 4, y);
    doc.text('DESDE', margen + 105, y);
    doc.text('HASTA', margen + 155, y);
    doc.text('DÍAS', margen + 205, y);
    doc.text('ESTADO', margen + 235, y);
    y += 5;
    doc.setDrawColor(203, 213, 225);
    doc.line(margen, y, margen + anchoContenido, y);
    y += 10;
    reposos.forEach((r) => {
      salto(14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(r.folio || '—', margen + 4, y);
      doc.text(fechaCorta(r.fecha_inicio), margen + 105, y);
      doc.text(fechaCorta(r.fecha_fin), margen + 155, y);
      doc.text(String(r.dias ?? '—'), margen + 205, y);
      doc.text((r.estado || '').toUpperCase(), margen + 235, y);
      y += 12;
      if (r.diagnostico) {
        const lineas = doc.splitTextToSize(`Diagnóstico: ${r.diagnostico}`, anchoContenido - 10);
        doc.setFontSize(6.5);
        doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
        doc.text(lineas, margen + 4, y);
        y += lineas.length * 8;
      }
      y += 3;
    });
  }

  const medico = reposos[0]?.medico_nombre || ficha?.actualizado_por || 'Médico tratante';
  dibujarFirmaYSello(doc, medico, margen, ancho, Math.max(y + 30, 480), opciones);
  dibujarPiePdf(doc, `Historia clínica integral · ${centroNombre} · Sistema BnaSalud`);
  return compartirPdf(
    doc,
    `historia-integral-${(paciente?.cedula || 'paciente').replace(/[^A-Za-z0-9-]/g, '')}.pdf`,
  );
}

export async function exportarReposoPdf({ reposo, paciente, tema }) {
  const colores = { primary: tema?.colors?.primary, accent: tema?.colors?.accent };
  const centroNombre = tema?.fullName || 'CITAB';
  const logos = await obtenerLogotipos(tema?.logo);
  const doc = new jsPDF({ unit: 'pt', format: MEDIA_CARTA });
  const ancho = doc.internal.pageSize.getWidth();
  const opciones = { centroNombre, servicio: 'Reposo Médico', colores };
  const titulo = `CONSTANCIA DE REPOSO · ${reposo?.folio || ''}`;
  const { margen } = dibujarCabeceraInstitucional(doc, logos, titulo, ancho, opciones);
  const anchoContenido = ancho - 2 * margen;
  let y = 92;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
  doc.text('DATOS DEL PACIENTE', margen, y);
  y += 14;
  const campos = [
    ['Paciente', nombrePaciente(paciente)],
    ['Cédula', paciente?.cedula || '—'],
    ['Folio', reposo?.folio || '—'],
    ['Fecha de emisión', fechaCorta(reposo?.fecha_emision)],
    ['Reposo desde', fechaCorta(reposo?.fecha_inicio)],
    ['Reposo hasta', fechaCorta(reposo?.fecha_fin)],
    ['Días', String(reposo?.dias ?? '—')],
    ['Médico', reposo?.medico_nombre || '—'],
  ];
  doc.setFontSize(8.5);
  campos.forEach(([label, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text(`${label.toUpperCase()}`, margen, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(String(valor || '—'), margen + 110, y);
    y += 15;
  });

  if (reposo?.diagnostico) {
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text('DIAGNÓSTICO', margen, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const lineas = doc.splitTextToSize(reposo.diagnostico, anchoContenido);
    doc.text(lineas, margen, y);
    y += lineas.length * 10 + 8;
  }

  if (reposo?.descripcion) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
    doc.text('INDICACIONES', margen, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const lineas = doc.splitTextToSize(reposo.descripcion, anchoContenido);
    doc.text(lineas, margen, y);
    y += lineas.length * 10;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(GRIS[0], GRIS[1], GRIS[2]);
  const texto = `Se certifica que el paciente requiere reposo médico por ${reposo?.dias} día(s), contados desde el ${fechaCorta(
    reposo?.fecha_inicio,
  )} hasta el ${fechaCorta(reposo?.fecha_fin)}.`;
  const lineasTexto = doc.splitTextToSize(texto, anchoContenido);
  doc.text(lineasTexto, margen, Math.max(y + 16, 330));

  dibujarFirmaYSello(
    doc,
    reposo?.medico_nombre || 'Médico tratante',
    margen,
    ancho,
    Math.max(y + 110, 490),
    opciones,
  );
  dibujarPiePdf(doc, `Reposo médico ${reposo?.folio || ''} · ${centroNombre} · Sistema BnaSalud`);
  return compartirPdf(
    doc,
    `reposo-${(reposo?.folio || paciente?.cedula || 'paciente').replace(/[^A-Za-z0-9-]/g, '')}.pdf`,
  );
}
