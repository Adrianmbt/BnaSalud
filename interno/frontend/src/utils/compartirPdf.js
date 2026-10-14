import { esNativo } from '../config/api';

// En un WebView de Capacitor `doc.save()` no tiene destino de descarga: el
// archivo se genera y se pierde en silencio. Este es el entregable de la
// rendición de cuentas del director, así que tiene que funcionar de verdad.
export async function compartirPdf(doc, nombre) {
  try {
    if (!esNativo()) {
      doc.save(nombre);
      return { ok: true, detalle: 'Archivo descargado.' };
    }

    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const base64 = doc.output('datauristring').split(',')[1];
    const ruta = nombre.endsWith('.pdf') ? nombre : `${nombre}.pdf`;

    const escrito = await Filesystem.writeFile({
      path: ruta,
      data: base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: ruta,
      dialogTitle: ruta,
      files: [escrito.uri],
    });

    return { ok: true, detalle: 'Documento listo para enviar.' };
  } catch (err) {
    return { ok: false, detalle: err?.message ?? 'No se pudo generar el documento.' };
  }
}
