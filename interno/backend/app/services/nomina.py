"""Sincronización de la nómina de empleados desde el Excel consolidado de RRHH.

Lee todas las hojas del libro (una por ente), limpia cédulas, nombres, fechas,
género, edad y teléfono, y sincroniza `empleados` por cédula. Nunca borra:
los egresos son un `activo = false`, que además dispara el trigger
`trg_inactivar_beneficiarios`.
"""
from __future__ import annotations

import io
import json
import re
import unicodedata
from datetime import date, datetime
from typing import Optional

import openpyxl
from openpyxl.utils.datetime import from_excel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

MAX_EMPLEADOS = 50000
VISTA_PREVIA = 100

ALIAS_CEDULA_TITULAR = (
    "cedula titular", "cedula del titular", "cedula trabajador",
    "cedula del trabajador", "cedula de identidad", "cedula", "ci",
    "documento",
)
ALIAS_CEDULA_ASEGURADO = {
    "cedula del asegurado", "cedula asegurado", "cedula beneficiario",
    "cedula del beneficiario", "cedula familiar", "cedula del familiar",
    "cedula del hijo", "cedula carga",
}
ALIAS_PARENTESCO = {"parentesco", "condicion", "relacion", "vinculo"}
ALIAS_NOMBRE_COMPLETO = (
    "nombre y apellido del trabajador", "nombre completo", "nombre y apellido",
    "nombre del trabajador", "nombre", "trabajador",
)
ALIAS_APELLIDOS = {"apellidos"}
ALIAS_NOMBRES = {"nombres"}
ALIAS_PARTES_NOMBRE = {
    "primer apellido", "segundo apellido", "primer nombre", "segundo nombre",
}
ALIAS_FECHA_NAC = (
    "fecha de nacimiento", "fecha nacimiento", "fecha de nac.",
    "fecha nac.", "f_nac", "f. nacimiento", "nacimiento",
)
ALIAS_DIA = {"dia"}
ALIAS_MES = {"mes"}
ALIAS_ANO = {"ano"}
ALIAS_EDAD = {"edad"}
ALIAS_GENERO = {"genero", "sexo"}
ALIAS_CARGO = (
    "cargo", "profesion", "clasificacion del cargo", "tipo de nomina",
    "tipo. nomina", "nomina",
)
ALIAS_TELEFONO = ("telefono celular", "telefono", "celular", "tlf")

ALIAS_TODOS = (
    set(ALIAS_CEDULA_TITULAR) | ALIAS_CEDULA_ASEGURADO | ALIAS_PARENTESCO
    | set(ALIAS_NOMBRE_COMPLETO) | ALIAS_APELLIDOS | ALIAS_NOMBRES
    | ALIAS_PARTES_NOMBRE | set(ALIAS_FECHA_NAC) | ALIAS_DIA | ALIAS_MES
    | ALIAS_ANO | ALIAS_EDAD | ALIAS_GENERO | set(ALIAS_CARGO)
    | set(ALIAS_TELEFONO)
)

PARENTESCO_TITULAR = ("titular", "tirular", "trabajador", "cotizante", "asegurado")
MESES_2_DIGITOS = 2000


def _norm(valor) -> str:
    """Texto de celda normalizado: minúsculas, sin tildes y sin espacios repetidos."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    texto = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode("ascii")
    return " ".join(texto.split()).rstrip(":").strip().lower()


def _texto(valor) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return " ".join(str(valor).split())


def _mayus(valor) -> str:
    return _texto(valor).upper()


def _celda(fila, indice: Optional[int]):
    if indice is None or indice >= len(fila):
        return None
    return fila[indice]


def _cedula(valor) -> str:
    """Cédula como se guarda en `empleados`: solo dígitos, sin V-, puntos ni espacios."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    if isinstance(valor, bool):
        return ""
    texto = str(valor).strip()
    if not texto or texto.lower() in {"nan", "none"}:
        return ""
    if re.fullmatch(r"\d+(?:\.\d+)?[eE][+-]?\d+", texto):
        try:
            return str(int(float(texto)))
        except ValueError:
            return ""
    # Las cédulas vienen como V-14.241.890, 14241890.0 o con espacios.
    return re.sub(r"\D", "", texto)


def _entero_base(valor):
    """Entero de una celda; devuelve (valor|None, error|None)."""
    if valor is None or str(valor).strip() == "":
        return None, None
    if isinstance(valor, bool) or isinstance(valor, (date, datetime)):
        return None, None
    if isinstance(valor, (int, float)):
        return int(valor), None
    limpio = re.sub(r"[^0-9-]", "", str(valor))
    if not re.fullmatch(r"-?\d+", limpio or "x"):
        return None, "no es un número"
    return int(limpio), None


def _entero(valor):
    """Edad: entero entre 0 y 120; devuelve (valor|None, error|None)."""
    numero, error = _entero_base(valor)
    if error or numero is None:
        return numero, error
    if not 0 <= numero <= 120:
        return None, "debe estar entre 0 y 120"
    return numero, None


def _fecha(valor) -> tuple[Optional[date], Optional[str]]:
    """Fecha de nacimiento desde celda de Excel, texto ISO o DD/MM/AAAA."""
    if valor is None or str(valor).strip() == "":
        return None, None
    if isinstance(valor, datetime):
        return valor.date(), None
    if isinstance(valor, date):
        return valor, None
    if isinstance(valor, (int, float)) and not isinstance(valor, bool):
        try:
            return from_excel(valor).date(), None
        except (ValueError, OverflowError):
            return None, "fecha inválida"
    texto = str(valor).strip()
    # Quita la hora de valores tipo "1996-12-06 00:00:00".
    texto = re.split(r"[ T]", texto, maxsplit=1)[0]
    for formato in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
        try:
            fecha = datetime.strptime(texto, formato).date()
            break
        except ValueError:
            continue
    else:
        coincidencia = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", texto)
        if not coincidencia:
            return None, "fecha inválida (usa DD/MM/AAAA)"
        dia, mes, anio = (int(x) for x in coincidencia.groups())
        anio = anio + 2000 if anio < 100 else anio
        try:
            fecha = date(anio, mes, dia)
        except ValueError:
            return None, "fecha inválida (usa DD/MM/AAAA)"
    hoy = date.today()
    if fecha > hoy or fecha.year < 1900:
        return None, "fecha fuera de rango"
    return fecha, None


def _genero(valor) -> Optional[str]:
    texto = _norm(valor)
    if not texto:
        return None
    if texto[0] in {"m", "f"} and texto in {"m", "f"}:
        return texto[0].upper()
    if texto in {"masculino", "masc", "varon", "hombre"}:
        return "M"
    if texto in {"femenino", "fem", "mujer"}:
        return "F"
    return None


def _telefono(valor) -> Optional[str]:
    texto = _texto(valor)
    if not texto:
        return None
    limpio = re.sub(r"[^0-9+]", "", texto)
    return limpio[:20] or None


def _edad_por_fecha(fecha: date) -> int:
    hoy = date.today()
    return hoy.year - fecha.year - ((hoy.month, hoy.day) < (fecha.month, fecha.day))


def _es_titular(valor) -> bool:
    return _norm(valor).startswith(PARENTESCO_TITULAR)


def _es_encabezado(fila) -> bool:
    """Detecta encabezados repetidos en medio de la hoja (CONTRALORIA, etc.)."""
    coincidencias = sum(1 for celda in fila if _norm(celda) in ALIAS_TODOS)
    return coincidencias >= 2


def _buscar_indice(encabezados: list[str], alias: tuple[str, ...]) -> Optional[int]:
    for nombre in alias:
        if nombre in encabezados:
            return encabezados.index(nombre)
    return None


def _indices(encabezados: list[str], alias: set[str]) -> list[int]:
    return [i for i, nombre in enumerate(encabezados) if nombre in alias]


def _fila_cabecera(filas: list) -> Optional[int]:
    mejor, puntaje = None, 0
    for indice, fila in enumerate(filas[:20]):
        normalizada = [_norm(c) for c in fila]
        puntaje_fila = sum(1 for c in normalizada if c in ALIAS_TODOS)
        tiene_cedula = any(c in ALIAS_CEDULA_TITULAR for c in normalizada)
        if tiene_cedula and puntaje_fila >= 2 and puntaje_fila > puntaje:
            mejor, puntaje = indice, puntaje_fila
    return mejor


def _mapear(encabezados: list[str]) -> dict:
    cedula = _buscar_indice(encabezados, ALIAS_CEDULA_TITULAR)
    asegurado = _buscar_indice(encabezados, tuple(ALIAS_CEDULA_ASEGURADO))
    parentesco = _buscar_indice(encabezados, tuple(ALIAS_PARENTESCO))
    nombre_completo = _buscar_indice(encabezados, ALIAS_NOMBRE_COMPLETO)
    apellidos = _buscar_indice(encabezados, tuple(ALIAS_APELLIDOS))
    nombres = _buscar_indice(encabezados, tuple(ALIAS_NOMBRES))
    partes = _indices(encabezados, ALIAS_PARTES_NOMBRE)
    if asegurado is not None:
        partes_titular = [i for i in partes if i < asegurado]
    else:
        partes_titular = partes
    return {
        "cedula": cedula,
        "asegurado": asegurado,
        "parentesco": parentesco,
        "nombre_completo": nombre_completo,
        "apellidos": apellidos,
        "nombres": nombres,
        "partes_titular": partes_titular or partes,
        "fecha_nac": _buscar_indice(encabezados, ALIAS_FECHA_NAC),
        "dia": _buscar_indice(encabezados, tuple(ALIAS_DIA)),
        "mes": _buscar_indice(encabezados, tuple(ALIAS_MES)),
        "ano": _buscar_indice(encabezados, tuple(ALIAS_ANO)),
        "edad": _buscar_indice(encabezados, tuple(ALIAS_EDAD)),
        "genero": _buscar_indice(encabezados, tuple(ALIAS_GENERO)),
        "cargo": _buscar_indice(encabezados, ALIAS_CARGO),
        "telefono": _buscar_indice(encabezados, ALIAS_TELEFONO),
        "encabezados": encabezados,
    }


def _nombre(fila, col: dict) -> str:
    completo = _texto(_celda(fila, col["nombre_completo"]))
    if completo:
        return _mayus(completo)
    if col["apellidos"] is not None or col["nombres"] is not None:
        apellidos = _texto(_celda(fila, col["apellidos"]))
        nombres = _texto(_celda(fila, col["nombres"]))
        if apellidos or nombres:
            return _mayus(f"{nombres} {apellidos}")
    encabezados = col["encabezados"]
    partes = []
    for alias in ("primer nombre", "segundo nombre", "primer apellido", "segundo apellido"):
        for indice in col["partes_titular"]:
            if encabezados[indice] == alias:
                valor = _texto(_celda(fila, indice))
                if valor and valor not in {"-", "."}:
                    partes.append(valor)
                break
    return _mayus(" ".join(partes))


def _cargo(fila, col: dict) -> str:
    encabezados = col["encabezados"]
    for alias in ALIAS_CARGO:
        if alias in encabezados:
            valor = _texto(_celda(fila, encabezados.index(alias)))
            if valor:
                return _mayus(valor)
    return ""


def _fecha_de_fila(fila, col: dict) -> tuple[Optional[date], Optional[str]]:
    fecha, error = _fecha(_celda(fila, col["fecha_nac"]))
    if fecha or error:
        return fecha, error
    dia, error_dia = _entero_base(_celda(fila, col["dia"]))
    mes, error_mes = _entero_base(_celda(fila, col["mes"]))
    anio, error_anio = _entero_base(_celda(fila, col["ano"]))
    if error_dia or error_mes or error_anio:
        return None, "fecha inválida (día/mes/año)"
    if dia is None or mes is None or anio is None:
        return None, None
    if anio < 100:
        anio += 2000
    try:
        fecha = date(anio, mes, dia)
    except ValueError:
        return None, "fecha inválida (día/mes/año)"
    hoy = date.today()
    if fecha > hoy or fecha.year < 1900:
        return None, "fecha fuera de rango"
    return fecha, None


def _ente_de_hoja(nombre: str) -> str:
    ente = _mayus(nombre)
    ente = re.sub(
        r"\s+\d{1,2}\s*[-/]\s*\d{1,2}(?:\s*[-/]\s*\d{2,4})?\s*$", "", ente
    )
    return ente.strip(" -_")[:120]


def _fecha_de_hoja(nombre: str) -> date:
    """Fecha del nombre de la hoja (para que la versión más nueva gane).

    shortcut: una hoja sin fecha en el título pierde siempre contra una que sí
    la trae; alcanza para este libro, revisar si aparecen hojas sin fecha
    duplicadas.
    """
    coincidencia = re.search(
        r"(\d{1,2})\s*[-/]\s*(\d{1,2})(?:\s*[-/]\s*(\d{2,4}))?\s*$",
        _texto(nombre),
    )
    if not coincidencia:
        return date(1900, 1, 1)
    dia, mes, anio = coincidencia.groups()
    anio = int(anio) if anio else date.today().year
    anio = anio + 2000 if anio < 100 else anio
    try:
        return date(anio, int(mes), int(dia))
    except ValueError:
        return date(1900, 1, 1)


def _leer_hoja(
    hoja, nombre_hoja: str
) -> tuple[list[dict], list[dict], list[dict], set[str], dict]:
    """Extrae los titulares de una hoja: (registros, errores, advertencias, cédulas, meta)."""
    errores = []
    advertencias = []
    cedulas_presentes: set[str] = set()
    meta = {"hoja": nombre_hoja, "filas": 0, "titulares": 0}
    ente = _ente_de_hoja(nombre_hoja)

    primeras = list(
        hoja.iter_rows(min_row=1, max_row=20, max_col=min(hoja.max_column or 200, 200), values_only=True)
    )
    indice_cabecera = _fila_cabecera(primeras)
    if indice_cabecera is None:
        meta["omitida"] = "sin encabezado con columna de cédula"
        return [], errores, advertencias, cedulas_presentes, meta

    cabecera = [_norm(c) for c in primeras[indice_cabecera]]
    col = _mapear(cabecera)
    if col["cedula"] is None:
        meta["omitida"] = "sin columna de cédula"
        return [], errores, advertencias, cedulas_presentes, meta

    ancho = max((i for i, c in enumerate(cabecera) if c), default=col["cedula"]) + 1
    filas = hoja.iter_rows(
        min_row=indice_cabecera + 2, max_col=ancho, values_only=True
    )

    elegidos: dict[str, dict] = {}
    filas_vacias = 0
    for numero, fila in enumerate(filas, start=indice_cabecera + 2):
        if not any(c is not None and str(c).strip() != "" for c in fila):
            filas_vacias += 1
            continue
        if _es_encabezado(fila):
            continue
        meta["filas"] += 1

        cedula = _cedula(_celda(fila, col["cedula"]))
        parentesco = _celda(fila, col["parentesco"])
        titular = _es_titular(parentesco)
        asegurado = _cedula(_celda(fila, col["asegurado"]))

        if not cedula:
            if titular:
                errores.append({
                    "hoja": nombre_hoja, "fila": numero, "cedula": "",
                    "error": "cédula del titular vacía",
                })
            continue

        valida = re.fullmatch(r"\d{4,12}", cedula)
        if not valida:
            if titular:
                errores.append({
                    "hoja": nombre_hoja, "fila": numero, "cedula": cedula,
                    "error": "cédula del titular inválida (4 a 12 dígitos)",
                })
            continue

        # Si la hoja trae parentesco, manda ese dato: hay filas de familiares
        # con la cédula del asegurado repetida (y no son el titular).
        if col["parentesco"] is not None and _texto(parentesco):
            es_fila_titular = titular
        else:
            es_fila_titular = not asegurado or asegurado == cedula
        if es_fila_titular:
            # Incluso una fila con errores cuenta como presente: no debe
            # inactivarse a quien sí viene en el archivo.
            cedulas_presentes.add(cedula)

        anterior = elegidos.get(cedula)
        if anterior is not None:
            if es_fila_titular and anterior["titular"]:
                advertencias.append({
                    "hoja": nombre_hoja, "fila": numero, "cedula": cedula,
                    "advertencia": f"cédula duplicada; se usa la fila {anterior['fila']}",
                })
                continue
            if anterior["titular"] and not es_fila_titular:
                continue
            if not es_fila_titular and not anterior["titular"]:
                continue

        nombre = _nombre(fila, col)
        if not nombre:
            if es_fila_titular:
                errores.append({
                    "hoja": nombre_hoja, "fila": numero, "cedula": cedula,
                    "error": "nombre del titular vacío",
                })
            continue
        nombre = nombre[:200]

        fecha, error_fecha = _fecha_de_fila(fila, col)
        if error_fecha:
            advertencias.append({
                "hoja": nombre_hoja, "fila": numero, "cedula": cedula,
                "advertencia": f"fecha de nacimiento {error_fecha}; se guarda sin fecha",
            })
            fecha = None

        edad, _ = _entero(_celda(fila, col["edad"]))
        if edad is None and fecha:
            edad = _edad_por_fecha(fecha)

        elegidos[cedula] = {
            "titular": es_fila_titular,
            "fila": numero,
            "registro": {
                "cedula": cedula,
                "nombre_completo": nombre,
                "cargo": (_cargo(fila, col) or None),
                "fecha_nacimiento": fecha,
                "genero": _genero(_celda(fila, col["genero"])),
                "edad": edad,
                "telefono": _telefono(_celda(fila, col["telefono"])),
                "ente": ente,
                "hoja": nombre_hoja,
                "fila": numero,
            },
        }

    meta["titulares"] = len(elegidos)
    meta["filas_vacias"] = filas_vacias
    # Toda cédula que entra al upsert está presente aunque no fuera fila
    # "TITULAR": si no, el egreso la inactivaría en la misma transacción.
    cedulas_presentes |= set(elegidos)
    return (
        [dato["registro"] for dato in elegidos.values()],
        errores,
        advertencias,
        cedulas_presentes,
        meta,
    )


def leer_nomina(
    datos: bytes, archivo: str = ""
) -> tuple[list[dict], list[dict], list[dict], set[str], dict]:
    """Lee el libro completo. Devuelve (registros, errores, advertencias, cédulas, metadatos)."""
    if not datos:
        raise ValueError("El archivo está vacío.")
    try:
        libro = openpyxl.load_workbook(io.BytesIO(datos), read_only=True, data_only=True)
    except Exception as exc:
        raise ValueError("No se pudo leer el archivo. Usa un .xlsx válido.") from exc

    if archivo and not archivo.lower().endswith(".xlsx"):
        libro.close()
        raise ValueError("El archivo debe ser .xlsx.")

    registros: dict[str, dict] = {}
    errores: list[dict] = []
    advertencias: list[dict] = []
    cedulas_presentes: set[str] = set()
    hojas = []
    fechas_hoja: dict[str, date] = {}
    try:
        for hoja in libro.worksheets:
            filas, errores_hoja, advertencias_hoja, cedulas_hoja, meta = _leer_hoja(
                hoja, hoja.title
            )
            hojas.append(meta)
            errores.extend(errores_hoja)
            advertencias.extend(advertencias_hoja)
            cedulas_presentes |= cedulas_hoja
            fecha_hoja = _fecha_de_hoja(hoja.title)
            for registro in filas:
                cedula = registro["cedula"]
                anterior = registros.get(cedula)
                if anterior is None or fecha_hoja >= fechas_hoja[cedula]:
                    # La hoja más reciente del libro define el ente y los datos.
                    registros[cedula] = registro
                    fechas_hoja[cedula] = fecha_hoja
    finally:
        libro.close()

    if len(registros) > MAX_EMPLEADOS:
        raise ValueError(f"El archivo supera el máximo de {MAX_EMPLEADOS} empleados.")
    if not registros:
        raise ValueError("No se encontró ningún empleado con cédula válida en el archivo.")

    registros_ordenados = sorted(registros.values(), key=lambda r: (r["ente"], r["nombre_completo"]))
    resumen = {
        "archivo": archivo,
        "hojas": [h for h in hojas if not h.get("omitida")],
        "hojas_omitidas": [h for h in hojas if h.get("omitida")],
        "filas": sum(h.get("filas", 0) for h in hojas),
        "filas_vacias": sum(h.get("filas_vacias", 0) for h in hojas),
        "empleados": len(registros_ordenados),
        "entes": len({r["ente"] for r in registros_ordenados}),
        "advertencias": len(advertencias),
        "errores": len(errores),
    }
    return registros_ordenados, errores, advertencias, cedulas_presentes, resumen


async def _consultar_estado(db: AsyncSession, cedulas: list[str]) -> dict:
    """cédula -> {id, activo} de las que ya existen en `empleados`."""
    if not cedulas:
        return {}
    resultado = await db.execute(
        text("SELECT cedula, id::text, activo FROM empleados WHERE cedula = ANY(:cedulas)"),
        {"cedulas": cedulas},
    )
    return {fila[0]: {"id": fila[1], "activo": fila[2]} for fila in resultado.all()}


def _presentes(cedulas_presentes: Optional[set[str]], registros: list[dict]) -> list[str]:
    """Cédulas que el archivo trae: no deben considerarse egresos."""
    if cedulas_presentes is not None:
        return sorted(cedulas_presentes)
    return sorted({r["cedula"] for r in registros})


async def _egresos(db: AsyncSession, presentes: list[str], limite: Optional[int] = None) -> dict:
    """Activos que no vienen en el archivo: total y (opcional) muestra."""
    total = (
        await db.execute(
            text(
                "SELECT COUNT(*) FROM empleados "
                "WHERE activo = TRUE AND NOT (cedula = ANY(:cedulas))"
            ),
            {"cedulas": presentes},
        )
    ).scalar() or 0
    if limite is None or not total:
        return {"total": total, "muestra": []}
    resultado = await db.execute(
        text(
            "SELECT cedula, nombre_completo, ente FROM empleados "
            "WHERE activo = TRUE AND NOT (cedula = ANY(:cedulas)) "
            "ORDER BY nombre_completo LIMIT :limite"
        ),
        {"cedulas": presentes, "limite": limite},
    )
    return {"total": total, "muestra": [dict(fila._mapping) for fila in resultado.all()]}


async def previsualizar(
    db: AsyncSession,
    registros: list[dict],
    cedulas_presentes: Optional[set[str]] = None,
    inactivar_no_presentes: bool = True,
) -> dict:
    """Compara el archivo con la BD sin escribir nada."""
    existentes = await _consultar_estado(db, [r["cedula"] for r in registros])
    egresos = {"total": 0, "muestra": []}
    if inactivar_no_presentes:
        egresos = await _egresos(db, _presentes(cedulas_presentes, registros), limite=50)
    return {
        "inactivar_no_presentes": inactivar_no_presentes,
        "nuevos": sum(1 for r in registros if r["cedula"] not in existentes),
        "actualizar": sum(1 for r in registros if r["cedula"] in existentes),
        "a_inactivar": egresos["total"] if inactivar_no_presentes else 0,
        "a_inactivar_disponible": egresos["total"],
        "egresos_muestra": egresos["muestra"],
        "vista_previa": [
            {
                "cedula": r["cedula"],
                "nombre_completo": r["nombre_completo"],
                "cargo": r["cargo"],
                "ente": r["ente"],
                "edad": r["edad"],
                "genero": r["genero"],
                "fecha_nacimiento": r["fecha_nacimiento"].isoformat() if r["fecha_nacimiento"] else None,
                "telefono": r["telefono"],
                "estado": "actualizar" if r["cedula"] in existentes else "nuevo",
            }
            for r in registros[:VISTA_PREVIA]
        ],
    }


async def _auditar(
    db: AsyncSession,
    *,
    archivo: str,
    usuario: Optional[dict],
    nuevos: int,
    actualizados: int,
    inactivados: int,
    errores: int,
    resumen: dict,
) -> None:
    payload = {
        "archivo": archivo,
        "nuevos": nuevos,
        "actualizados": actualizados,
        "inactivados": inactivados,
        "errores_fila": errores,
        "filas": resumen.get("filas"),
        "empleados": resumen.get("empleados"),
        "entes": resumen.get("entes"),
    }
    await db.execute(
        text(
            "INSERT INTO bitacora_acciones "
            "(usuario_id, username, rol, accion, entidad, detalle, created_at) "
            "VALUES (:usuario_id, :username, 'recursos_humanos', 'importar_nomina', "
            "        'empleados', :detalle, NOW())"
        ),
        {
            "usuario_id": (usuario or {}).get("personal_id"),
            "username": (usuario or {}).get("sub") or "cli",
            "detalle": json.dumps(payload, ensure_ascii=False),
        },
    )


async def sincronizar(
    db: AsyncSession,
    registros: list[dict],
    cedulas_presentes: Optional[set[str]] = None,
    *,
    inactivar_no_presentes: bool = True,
    archivo: str = "",
    usuario: Optional[dict] = None,
    resumen: Optional[dict] = None,
    errores_fila: int = 0,
) -> dict:
    """Upsert atómico por cédula + egresos por inactivación. Nunca borra filas."""
    if not registros:
        raise ValueError("No hay empleados para sincronizar.")

    cedulas = [r["cedula"] for r in registros]
    presentes = _presentes(cedulas_presentes, registros)
    try:
        existentes = await _consultar_estado(db, cedulas)
        nuevos = sum(1 for c in cedulas if c not in existentes)
        actualizados = len(cedulas) - nuevos
        reactivados = sum(
            1 for c in cedulas if c in existentes and not existentes[c]["activo"]
        )

        await db.execute(
            text(
                "INSERT INTO empleados "
                "(cedula, nombre_completo, cargo, activo, fecha_nacimiento, "
                " genero, edad, telefono, ente) "
                "VALUES (:cedula, :nombre_completo, :cargo, TRUE, :fecha_nacimiento, "
                "        :genero, :edad, :telefono, :ente) "
                "ON CONFLICT (cedula) DO UPDATE SET "
                "  nombre_completo = EXCLUDED.nombre_completo, "
                "  cargo = COALESCE(EXCLUDED.cargo, empleados.cargo), "
                "  activo = TRUE, "
                "  fecha_nacimiento = COALESCE(EXCLUDED.fecha_nacimiento, empleados.fecha_nacimiento), "
                "  genero = COALESCE(EXCLUDED.genero, empleados.genero), "
                "  edad = COALESCE(EXCLUDED.edad, empleados.edad), "
                "  telefono = COALESCE(EXCLUDED.telefono, empleados.telefono), "
                "  ente = EXCLUDED.ente"
            ),
            [
                {
                    "cedula": r["cedula"],
                    "nombre_completo": r["nombre_completo"],
                    "cargo": r["cargo"],
                    "fecha_nacimiento": r["fecha_nacimiento"],
                    "genero": r["genero"],
                    "edad": r["edad"],
                    "telefono": r["telefono"],
                    "ente": r["ente"],
                }
                for r in registros
            ],
        )

        inactivados = 0
        if inactivar_no_presentes:
            resultado = await db.execute(
                text(
                    "UPDATE empleados SET activo = FALSE "
                    "WHERE activo = TRUE AND NOT (cedula = ANY(:cedulas))"
                ),
                {"cedulas": presentes},
            )
            inactivados = resultado.rowcount or 0

        await _auditar(
            db,
            archivo=archivo,
            usuario=usuario,
            nuevos=nuevos,
            actualizados=actualizados,
            inactivados=inactivados,
            errores=errores_fila,
            resumen=resumen or {},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {
        "nuevos": nuevos,
        "actualizados": actualizados,
        "reactivados": reactivados,
        "a_inactivar": inactivados,
        "inactivados": inactivados,
        "mensaje": (
            f"{nuevos} empleado(s) nuevo(s), {actualizados} actualizado(s) y "
            f"{inactivados} inactivado(s) por no estar en el archivo."
        ),
    }

