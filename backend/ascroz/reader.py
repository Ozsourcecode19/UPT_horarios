#!/usr/bin/env python3
"""
ascroz — lector de ficheros `.roz` de aSc Timetables (v314/v324).

Enfoque: decodificación por *anclas* verificadas (ver `docs/roz_formato.md`),
no por offsets fijos. Las secciones de entidad son de longitud variable
(cadenas `[len][bytes]`), así que cada estructura se localiza por una firma
byte a byte y de ahí se derivan sus campos.

Estado: Fase 1 — `parse()` descubre lecciones/cards sin XML en v314/v324; sus
IDs y cards están decodificados (§9b). Parámetros de generación (§12) y
relaciones de carta (§13) decodificados y parseados (Fase 1 Partes 0+1+2).
El resto de secciones (grados, grupos, aulas, …) se localizan por stride base
(§3), con layouts internos parcialmente pendientes.
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field
from typing import Iterator

# --- constantes de formato (medidas en Demo1) -------------------------------
CARD_SIZE = 79          # B exactos por card (§9b.2)
PLACEHOLDER_SIZE = 47   # B exactos por marcador de card no colocada (§9b.8)
LESSON_ID8_OFF = 12     # offset del id8 dentro del registro de lección (§9b.1)
LESSON_BASE_V314 = 172  # stride base de lección en v314 (pristine)
LESSON_BASE_V324 = 177  # stride base en v324 (re-guardado)
LESSON_BASE = {314: LESSON_BASE_V314, 324: LESSON_BASE_V324}
_LESSON_PREFIX = b"\x02\x00\x00\x00\x02\x00\x00\x00\x02\x00\x01\x00"
_LESSON_HEADER_SIZE = 24  # u32 count + 20 B de metadatos antes del primer registro
_LESSON_TRAILER_MAX = 128  # espacio entre el último registro y la primera card

# nº de cards que la lección DEBE tener (= periodsperweek/periodspercard)
# dentro del registro de lección; depende de la versión (§9b.7)
LESSON_NCARDS_OFF = {314: 41, 324: 45}
CLASSROOM_SIG = b"\x02\x00\x01\x00"  # ancla de entidad (aulas, lecciones, ...)
_PARAMS_SIG = b"\x01\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x01\x00\x00\x00"
_REL_PREAMBLE = b'\x01\x00\x00\x00\xff\xff\xff\xff\xff\xff\xff\xff\x00\x00\x00\x00d\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x02\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00,\x00\x00\x00'
_REL_SIG = b"\x02\x00\x00\x00\x02\x00\x00\x00\x02\x00\x01\x00"
_REL_MAGIC5 = b"\x05\x00\x00\x00"
_REL_TRAILER_DEFAULT = 33
LESSON_ID_SEC = {314: 58, 324: 62}   # subject_idx (§9b.9); +4 ngroup, …
ROOM_MARKER = (10001, 10002)         # marcadores de aula (§9b.9)

# anclas de card (§9b.2)
_CARD_ANC4 = 1          # +4 constante
_CARD_ANC8 = 0xFFFFFFFF  # +8 constante (ancla)
_PH_ANC = b"\x00\xff\xff\xff\xff"  # inicio de marcador (cola de card, §9b.8)
_PH_IX_OFF = 43         # +43 del marcador: índice de lección
_PH_FLAG_OFF = 5        # +5 del marcador: 00 = intermedio, 01 = fin de bloque


def _id8(raw: bytes) -> str:
    """8 bytes little-endian → id hex tal y como aparece en el XML."""
    return raw[::-1].hex().upper()


@dataclass
class Card:
    classroom_idx: int   # +0  índice en <classroom>
    period: int          # +12 1-based (1..N)
    days: int            # +24 máscara de bit, bit0 = lunes (§9b.4)

    @property
    def days_mask(self) -> str:
        """days como cadena de 5 bits **con lunes primero**, estilo XML.

        En el `.roz` el bit 0 es lunes, bit 4 viernes; el XML escribe la misma
        información con lunes a la izquierda. Ojo: `format(days, "05b")` daría
        la cadena al revés (viernes primero) — hay que invertirla.
        """
        return "".join("1" if self.days & (1 << i) else "0" for i in range(5))

    @property
    def day_bits(self) -> list[int]:
        """Índices de día 0-based (0=lunes) que ocupa la card."""
        return [i for i in range(5) if self.days & (1 << i)]


@dataclass
class SchoolClass:
    idx: int
    id: str
    offset: int
    size: int
    name: str
    short: str
    trailing: bytes = b""

@dataclass
class Subject:
    idx: int
    id: str
    offset: int
    size: int
    name: str
    short: str
    trailing: bytes = b""

@dataclass
class Teacher:
    idx: int
    id: str
    offset: int
    size: int
    name: str
    short: str
    trailing: bytes = b""

@dataclass
class Group:
    idx: int
    id: str
    offset: int
    size: int
    name: str
    trailing: bytes = b""

@dataclass
class Grade:
    idx: int
    id: str
    offset: int
    size: int
    name: str
    short: str
    leading: bytes = b""
    fields: tuple = field(default_factory=tuple)

@dataclass
class Classroom:
    idx: int
    id: str
    offset: int
    size: int
    name: str
    short: str
    # campos u32 del bloque de 58 B tras (sig+id8+u32(0)+short+full+sep).
    fields: tuple = field(default_factory=tuple)
    trailing: bytes = b""


@dataclass
class Lesson:
    idx: int                     # índice en orden de fichero (= orden XML)
    id: str                      # id8 hex
    offset: int                  # offset del inicio del registro
    size: int                    # longitud del registro en B
    ncards: int = 0              # +45/+41 = periodsperweek/periodspercard (§9b.7)
    duration: int = 1             # periodspercard (§9b.5): duración de cada sesión en periodos (+41/+37, almacenado como periodspercard-1)
    subject_idx: int = -1        # +62  índice en <subject> (§9b.9)
    group_ids: list[int] = field(default_factory=list)    # lista (§9b.9)
    teacher_ids: list[int] = field(default_factory=list)  # lista (§9b.9)
    room_ids: list[int] = field(default_factory=list)     # lista (§9b.9)
    cards: list[Card] = field(default_factory=list)


def _is_card(buf: memoryview, p: int) -> Card | None:
    """Devuelve la Card si hay una tarjeta válida en el offset `p`, si no None.

    Ancla (§9b.2): `+4 == 1` y `+8 == 0xFFFFFFFF`. Campos: `+0` aula, `+12`
    period, `+24` days (bit0 = lunes, §9b.4). Filtro de sanidad: aula ≤ 40,
    period 1..7, days una sola máscara de bit (1..16 = lunes..viernes).

    Nota (§9b.5): con `periodspercard="2"` el `.roz` guarda **una** card que
    abarca dos periodos; el XML la expande en dos `<card>` consecutivas. Por
    eso el `.roz` de Demo1 tiene 745 cards y el XML 767 (745 + 22 expansiones).
    """
    if struct.unpack_from("<I", buf, p + 4)[0] != _CARD_ANC4:
        return None
    if struct.unpack_from("<I", buf, p + 8)[0] != _CARD_ANC8:
        return None
    a0 = struct.unpack_from("<I", buf, p)[0]
    period = struct.unpack_from("<I", buf, p + 12)[0]
    days = struct.unpack_from("<I", buf, p + 24)[0]
    if a0 <= 40 and 1 <= period <= 7 and days in (1, 2, 4, 8, 16):
        return Card(classroom_idx=a0, period=period, days=days)
    return None


def _is_placeholder(buf: memoryview, p: int) -> tuple[int, int] | None:
    """Marcador de card NO colocada (§9b.8) en el offset `p`.

    Un marcador es exactamente la **cola de 47 B de una card** (bytes +32..+78)
    escrita sin su cabecera de 32 B. Empieza por `00 FF FF FF FF` y lleva:

    * `+43` i32 — índice de lección (orden de fichero)
    * `+5`  u8  — 0x00 intermedio, 0x01 fin de bloque (la card siguiente
      empieza la lección con índice `+43`)

    Devuelve (índice_de_lección, flag) o None.
    """
    if bytes(buf[p:p + 5]) != _PH_ANC:
        return None
    idx = struct.unpack_from("<i", buf, p + _PH_IX_OFF)[0]
    flag = buf[p + _PH_FLAG_OFF]
    return idx, flag


def _walk(buf: memoryview, start: int) -> Iterator[tuple]:
    """Caminata estricta de la región de cards.

    La región es un stream de registros de dos tipos (§9b.8):

    * card (79 B): `+4==1, +8==0xFFFFFFFF`, campos aula/period/days
    * marcador (47 B): `00 FF FF FF FF …`, índice de lección en +43

    Devuelve ("card", offset, Card) o ("ph", offset, idx, flag). Se detiene en
    el primer byte que no es ni una cosa ni la otra (fin de la región).
    """
    p = start
    while True:
        card = _is_card(buf, p) if p + CARD_SIZE <= len(buf) else None
        if card is not None:
            yield ("card", p, card)
            p += CARD_SIZE
            continue
        ph = _is_placeholder(buf, p) if p + PLACEHOLDER_SIZE <= len(buf) else None
        if ph is not None:
            yield ("ph", p, ph[0], ph[1])
            p += PLACEHOLDER_SIZE
            continue
        return


def _iter_cards(buf: memoryview, start: int, end: int) -> Iterator[tuple[int, Card]]:
    """Tarjetas de la región [start, end) con su offset (caminata estricta)."""
    for rec in _walk(buf, start):
        if rec[0] == "card":
            off, card = rec[1], rec[2]
            if off >= end:
                return
            yield off, card


class RozFile:
    """Fichero `.roz` parsed. Acceso por secciones ya localizadas."""

    def __init__(self, data: bytes):
        # Conservar una imagen inmutable permite un round-trip exacto aunque
        # la decodificación sea parcial: los campos todavía desconocidos no
        # se reconstruyen ni se normalizan.
        self._raw = bytes(data)
        self.buf = memoryview(self._raw)
        self.size = len(self._raw)
        self.version = struct.unpack_from("<I", self.buf, 0)[0]
        self.lessons: list[Lesson] = []
        self.classrooms: list["Classroom"] = []
        self.grades: list["Grade"] = []
        self.groups: list["Group"] = []
        self.teachers: list["Teacher"] = []
        self.subjects: list["Subject"] = []
        self.classes: list["SchoolClass"] = []
        self.lesson_count: int | None = None
        self.lesson_header_offset: int | None = None
        self._cards_region_cache: tuple[int, int] | None = None

    def to_bytes(self) -> bytes:
        """Devuelve el `.roz` original byte por byte.

        Es un round-trip lossless de la imagen original, no una serialización
        de los campos decodificados. La distinción es intencional mientras
        haya campos desconocidos: evita perder o normalizar bytes opacos.
        """
        return self._raw

    def _parse_lesson_ids(self, off: int, size: int) -> dict:
        """Decodifica la sección de IDs de un registro de lección (§9b.9).

        Empieza en `LESSON_ID_SEC[version]` con `subject_idx` (u32) y sigue con
        tres **listas planas** `cnt, id0, id1, …` (paso 4 B):

            groups · teachers · rooms

        El primer u32 de la primera lista es por tanto **`ngroup`** (no
        `nclass`): en Demo1 coinciden porque las 47 lecciones con 2 clases son
        exactamente las 47 con 2 grupos, pero son campos distintos.

        La 3ª lista (`rooms`) admite los **marcadores** `10001`/`10002` en vez
        de índices de aula reales. **`classids` no se guarda**: se deriva de
        los grupos (cada grupo pertenece a una clase).

        Devuelve un dict con `subject_idx`, `group_ids`, `teacher_ids`,
        `room_ids` y `ids_end` (offset tras la última lista).
        """
        base = LESSON_ID_SEC.get(self.version)
        out = {"subject_idx": -1, "group_ids": [],
               "teacher_ids": [], "room_ids": [], "ids_end": base or 0}
        if base is None or base + 8 > size:
            return out
        u = lambda p: struct.unpack_from("<I", self.buf, off + p)[0]
        p = base
        out["subject_idx"] = u(p)
        p += 4
        campos = ("group_ids", "teacher_ids", "room_ids")
        for campo in campos:
            if p + 4 > size:
                break
            cnt = u(p)
            if cnt > 8 or cnt == 0xFFFFFFFF:
                break
            p += 4
            ids = []
            for _ in range(cnt):
                if p + 4 > size:
                    break
                ids.append(u(p))
                p += 4
            out[campo] = ids
        out["ids_end"] = p
        return out

    def _card_stream(self) -> tuple[int, int]:
        """Encuentra el stream contiguo más largo de cards/marcadores.

        Búsqueda binaria, independiente de lecciones/XML: prueba cada card
        válida como posible inicio y conserva el walk estricto más largo.
        """
        if self._cards_region_cache is not None:
            return self._cards_region_cache

        best: tuple[int, int, int] | None = None  # (span, start, end)
        for start in range(0, self.size - CARD_SIZE):
            if _is_card(self.buf, start) is None:
                continue
            end = start
            cards = 0
            for rec in _walk(self.buf, start):
                end = rec[1] + (CARD_SIZE if rec[0] == "card" else PLACEHOLDER_SIZE)
                cards += rec[0] == "card"
            span = end - start
            if cards and (best is None or span > best[0]):
                best = (span, start, end)

        if best is None:
            raise ValueError("no se encontró un stream de cards en el .roz")
        self._cards_region_cache = (best[1], best[2])
        return self._cards_region_cache

    def _lesson_record(self, off: int, idx: int, expected_size: int | None = None) -> Lesson:
        """Decodifica una lección a partir de su comienzo binario."""
        if bytes(self.buf[off:off + len(_LESSON_PREFIX)]) != _LESSON_PREFIX:
            raise ValueError(f"firma de registro de lección inválida en {off}")
        ids = self._parse_lesson_ids(off, self.size - off)
        lists = (ids["group_ids"], ids["teacher_ids"], ids["room_ids"])
        base_size = LESSON_BASE.get(self.version)
        n_off = LESSON_NCARDS_OFF.get(self.version)
        if base_size is None or n_off is None:
            raise ValueError(f"versión .roz no soportada: {self.version}")

        # Los strides de Demo1 codifican cada elemento adicional de las tres
        # listas como +4 B frente al caso base de un elemento por lista.
        size = base_size + 4 * sum(len(values) - 1 for values in lists)
        if size <= 0 or (expected_size is not None and size != expected_size):
            raise ValueError(f"stride de lección incoherente en {off}: {size}")
        ncards = self.buf[off + n_off]
        ppc_off = n_off - 4
        periods_per_card = self.buf[off + ppc_off] + 1
        return Lesson(
            idx=idx,
            id=_id8(bytes(self.buf[off + LESSON_ID8_OFF:off + LESSON_ID8_OFF + 8])),
            offset=off,
            size=size,
            ncards=ncards,
            duration=periods_per_card,
            subject_idx=ids["subject_idx"],
            group_ids=ids["group_ids"],
            teacher_ids=ids["teacher_ids"],
            room_ids=ids["room_ids"],
        )

    def _discover_lessons(self, cards_start: int) -> list[Lesson]:
        """Descubre las lecciones sólo desde el `.roz` (sin IDs externos).

        El primer registro está precedido por un encabezado de 24 B cuyo u32
        es el conteo. Se validan candidatos por firma, listas/strides, conteo y
        cierre justo antes del stream de cards. El pequeño hueco final se
        infiere buscando una solución única dentro de una ventana acotada.
        """
        if self.version not in LESSON_BASE:
            raise ValueError(f"versión .roz no soportada: {self.version}")

        data = self._raw
        solutions: list[tuple[int, int, list[Lesson]]] = []
        pos = 0
        while True:
            start = data.find(_LESSON_PREFIX, pos, cards_start)
            if start < 0:
                break
            pos = start + 1
            header = start - _LESSON_HEADER_SIZE
            if header < 0:
                continue
            count = struct.unpack_from("<I", self.buf, header)[0]
            if not 1 <= count <= 10000:
                continue

            lessons: list[Lesson] = []
            cursor = start
            try:
                for idx in range(count):
                    lesson = self._lesson_record(cursor, idx)
                    if cursor + lesson.size > cards_start:
                        raise ValueError("registro se solapa con el stream de cards")
                    lessons.append(lesson)
                    cursor += lesson.size
            except (ValueError, struct.error):
                continue

            trailer = cards_start - cursor
            if 0 <= trailer <= _LESSON_TRAILER_MAX:
                solutions.append((header, count, lessons))

        if len(solutions) != 1:
            raise ValueError(
                "no se pudo identificar una sección única de lecciones "
                f"(candidatos válidos: {len(solutions)})")
        header, count, lessons = solutions[0]
        self.lesson_count = count
        self.lesson_header_offset = header
        self.lessons = lessons
        return lessons

    def parse(self) -> list[Lesson]:
        """Descubre y decodifica lecciones/cards sin XML ni IDs externos."""
        cards_start, _ = self._card_stream()
        lessons = self._discover_lessons(cards_start)
        self.attach_cards()
        return lessons

    def cards_region(self) -> tuple[int, int]:
        """(inicio, fin) del stream de cards/marcadores."""
        return self._card_stream()

    def iter_cards(self) -> list[tuple[int, Card]]:
        """Todas las tarjetas de la región con su offset."""
        start, end = self._card_stream()
        return list(_iter_cards(self.buf, start, end))

    def attach_cards(self):
        """Asigna las cards del stream a las lecciones."""
        cards_start, cards_end = self._card_stream()
        li = 0
        while li < len(self.lessons) and self.lessons[li].ncards == 0:
            li += 1
        for rec in _walk(self.buf, cards_start):
            if rec[0] == "ph":
                idx, flag = rec[2], rec[3]
                if 0 <= idx < len(self.lessons):
                    li = idx
            elif rec[0] == "card":
                if 0 <= li < len(self.lessons):
                    self.lessons[li].cards.append(rec[2])

    def parse_classes(self) -> list["SchoolClass"]:
        """Decodifica la sección de clases (región 7, bloques CLASSTT).

        Ancla: 02 00 01 00 + id8 + u32(0) + "CLASSTT" + nombre + nombre corto
        + separador 00. El tamaño se infiere del siguiente bloque CLASSTT.
        """
        import struct
        data = self._raw
        sig = b"\x02\x00\x01\x00"
        # locate all class blocks
        class_sigs = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0:
                break
            pos = i + 1
            if i + 4 + 8 + 4 > len(data):
                continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0:
                continue
            # v324 has an extra u32 (0x02000000) before CLASSTT
            off_marker = i + 16
            if self.version == 324:
                if i + 16 + 4 > len(data):
                    continue
                if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000:
                    continue
                off_marker = i + 20
            if off_marker + 8 > len(data):
                continue
            if data[off_marker:off_marker + 8] != b"\x07CLASSTT":
                continue
            class_sigs.append((i, off_marker))

        out = []
        for idx, (c, off_marker) in enumerate(class_sigs):
            off = off_marker  # at CLASSTT marker
            # CLASSTT marker
            assert data[off:off + 8] == b"\x07CLASSTT"
            off += 8
            # full name
            ln1 = data[off]
            assert ln1 > 0
            name = data[off + 1:off + 1 + ln1].decode("latin-1")
            off += 1 + ln1
            # short name
            ln2 = data[off]
            assert ln2 > 0
            short = data[off + 1:off + 1 + ln2].decode("latin-1")
            off += 1 + ln2
            # sep
            assert data[off] == 0
            off += 1
            # size: to next class sig or next sig (aulas)
            if idx + 1 < len(class_sigs):
                nxt = class_sigs[idx + 1][0]
            else:
                # find next sig after this one
                nxt = data.find(sig, c + 4)
                if nxt < 0:
                    nxt = len(data)
            size = nxt - c
            trailing = data[off:nxt]
            out.append(SchoolClass(
                idx=len(out),
                id=_id8(bytes(data[c + 4:c + 12])),
                offset=c,
                size=size,
                name=name,
                short=short,
                trailing=trailing,
            ))
        self.classes = out
        return out

    def _parse_subjects_v324(self, data):
        sig = CLASSROOM_SIG
        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0: break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 2 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            off = i + 20
            ln = data[off]
            if ln == 0 or off + 1 + ln > len(data): continue
            full_bytes = data[off + 1:off + 1 + ln]
            if any(c < 32 or c >= 127 for c in full_bytes): continue
            off += 1 + ln
            if off >= len(data): continue
            ln2 = data[off]
            if ln2 == 0 or off + 1 + ln2 > len(data): continue
            short_bytes = data[off + 1:off + 1 + ln2]
            if any(c < 32 or c >= 127 for c in short_bytes): continue
            off += 1 + ln2
            if off + 5 > len(data): continue
            # Subject sep: 00 ff ff ff ff
            if data[off:off + 5] != b"\x00\xff\xff\xff\xff":
                continue
            id8 = _id8(bytes(data[i + 4:i + 12]))
            cands.append((i, id8, full_bytes.decode("latin-1"),
                          short_bytes.decode("latin-1"), off + 5))

        cands.sort(key=lambda c: c[0])
        out = []
        for idx, (off, cid, name, short, p0) in enumerate(cands):
            if idx + 1 < len(cands):
                size = cands[idx + 1][0] - off
            else:
                size = 200
            if size < 20 or size > 2000:
                continue
            trailing = data[p0:p0 + (size - (p0 - off))]
            out.append(Subject(
                idx=idx, id=cid, offset=off, size=size,
                name=name, short=short, trailing=trailing))
        self.subjects = out
        return out

    def parse_subjects(self) -> list["Subject"]:
        data = self._raw
        if self.version == 324:
            return self._parse_subjects_v324(data)
        sig = b"\x02\x00\x01\x00"

        def is_print_latin1(bs):
            return all((32 <= c < 127) or (160 <= c <= 255) for c in bs)

        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0:
                break
            pos = i + 1
            if i + 4 + 8 + 4 + 2 > len(data):
                continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0:
                continue
            off = i + 16
            if off >= len(data):
                continue
            ln1 = data[off]
            if ln1 == 0 or off + 1 + ln1 > len(data):
                continue
            nb1 = data[off + 1:off + 1 + ln1]
            if not is_print_latin1(nb1):
                continue
            off += 1 + ln1
            if off >= len(data):
                continue
            ln2 = data[off]
            if ln2 == 0 or off + 1 + ln2 > len(data):
                continue
            nb2 = data[off + 1:off + 1 + ln2]
            if not is_print_latin1(nb2):
                continue
            off += 1 + ln2
            if off >= len(data) or data[off] != 0:
                continue
            off += 1
            cands.append((i, ln1, ln2, nb1.decode("latin-1"), nb2.decode("latin-1"), off))

        cands_sorted = sorted(cands)
        keep = set()
        for idx, (c, ln1, ln2, n1, n2, off) in enumerate(cands_sorted):
            next_dist = (cands_sorted[idx + 1][0] - c) if idx + 1 < len(cands_sorted) else None
            if next_dist is not None and 1390 <= next_dist <= 1420:
                keep.add(c)

        out = []
        for idx, (c, ln1, ln2, n1, n2, off) in enumerate(cands_sorted):
            if c not in keep:
                continue
            if idx + 1 < len(cands_sorted) and cands_sorted[idx + 1][0] in keep:
                nxt = cands_sorted[idx + 1][0]
            else:
                nxt = c + 1402
            size = nxt - c
            trailing = data[off:nxt]
            out.append(Subject(
                idx=len(out),
                id=_id8(bytes(data[c + 4:c + 12])),
                offset=c,
                size=size,
                name=n1,
                short=n2,
                trailing=trailing,
            ))
        self.subjects = out
        return out

    def _parse_teachers_v324(self, data):
        sig = CLASSROOM_SIG
        # Find where groups start (to limit teacher scan)
        group_start = len(data)
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0: break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 2 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            off = i + 20
            ln = data[off]
            if ln == 0 or off + 1 + ln > len(data): continue
            nb = data[off + 1:off + 1 + ln]
            if any(c < 32 or c >= 127 for c in nb): continue
            name = nb.decode("latin-1")
            if name in ("La clase entera", "Hombres", "Mujeres") or name.startswith("Grupo "):
                if i < group_start:
                    group_start = i
                break

        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0 or i >= group_start:
                break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 2 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            off = i + 20
            ln = data[off]
            if ln == 0 or off + 1 + ln > len(data): continue
            full_bytes = data[off + 1:off + 1 + ln]
            if any(c < 32 or c >= 127 for c in full_bytes): continue
            off += 1 + ln
            if off >= len(data): continue
            ln2 = data[off]
            if ln2 == 0 or off + 1 + ln2 > len(data): continue
            short_bytes = data[off + 1:off + 1 + ln2]
            if any(c < 32 or c >= 127 for c in short_bytes): continue
            off += 1 + ln2
            if off + 5 > len(data): continue
            # Teacher sep: 00 00 00 00 00
            if data[off:off + 5] != b"\x00\x00\x00\x00\x00":
                continue
            id8 = _id8(bytes(data[i + 4:i + 12]))
            cands.append((i, id8, full_bytes.decode("latin-1"),
                          short_bytes.decode("latin-1"), off + 5))

        cands.sort(key=lambda c: c[0])
        out = []
        for idx, (off, cid, name, short, p0) in enumerate(cands):
            if idx + 1 < len(cands):
                size = cands[idx + 1][0] - off
            else:
                size = 200
            if size < 20 or size > 1200:
                continue
            trailing = data[p0:p0 + (size - (p0 - off))] if (size - (p0 - off)) > 0 else b""
            out.append(Teacher(
                idx=idx, id=cid, offset=off, size=size,
                name=name, short=short, trailing=trailing))
        self.teachers = out
        return out

    def parse_teachers(self) -> list["Teacher"]:
        data = self._raw
        if self.version == 324:
            return self._parse_teachers_v324(data)
        sig = b"\x02\x00\x01\x00"

        def is_print_latin1(bs):
            return all((32 <= c < 127) or (160 <= c <= 255) for c in bs)

        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0:
                break
            pos = i + 1
            if i + 4 + 8 + 4 + 2 > len(data):
                continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0:
                continue
            off = i + 16
            if off >= len(data):
                continue
            ln1 = data[off]
            if ln1 == 0 or off + 1 + ln1 > len(data):
                continue
            nb1 = data[off + 1:off + 1 + ln1]
            if not is_print_latin1(nb1):
                continue
            off += 1 + ln1
            if off >= len(data):
                continue
            ln2 = data[off]
            if ln2 == 0 or off + 1 + ln2 > len(data):
                continue
            nb2 = data[off + 1:off + 1 + ln2]
            if not is_print_latin1(nb2):
                continue
            off += 1 + ln2
            if off >= len(data) or data[off] != 0:
                continue
            off += 1
            cands.append((i, ln1, ln2, nb1.decode("latin-1"), nb2.decode("latin-1"), off))

        cands_sorted = sorted(cands)
        keep = set()
        for idx, (c, ln1, ln2, n1, n2, off) in enumerate(cands_sorted):
            next_dist = (cands_sorted[idx + 1][0] - c) if idx + 1 < len(cands_sorted) else None
            prev_dist = (c - cands_sorted[idx - 1][0]) if idx - 1 >= 0 else None
            if (next_dist is not None and 200 <= next_dist <= 260) or \
                    (prev_dist is not None and 200 <= prev_dist <= 260):
                keep.add(c)

        out = []
        for idx, (c, ln1, ln2, n1, n2, off) in enumerate(cands_sorted):
            if c not in keep:
                continue
            if idx + 1 < len(cands_sorted) and cands_sorted[idx + 1][0] in keep:
                nxt = cands_sorted[idx + 1][0]
            else:
                nxt = c + (228 + (1280 if False else 0))
            # use next candidate distance if available and close-ish
            if idx + 1 < len(cands_sorted):
                nd = cands_sorted[idx + 1][0] - c
                if nd <= 1600:
                    nxt = cands_sorted[idx + 1][0]
                else:
                    nxt = c + 230
            size = nxt - c
            trailing = data[off:nxt]
            out.append(Teacher(
                idx=len(out),
                id=_id8(bytes(data[c + 4:c + 12])),
                offset=c,
                size=size,
                name=n1,
                short=n2,
                trailing=trailing,
            ))
        self.teachers = out
        return out

    def _parse_groups_v324(self, data):
        sig = CLASSROOM_SIG
        group_names = {"Grupo 1", "Grupo 2", "Hombres", "Mujeres",
                       "La clase entera", "Estudiantes"}
        # Find class records to know where groups section ends
        class_sigs = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0: break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 8 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            if data[i + 20:i + 28] != b"\x07CLASSTT": continue
            class_sigs.append(i)
        if not class_sigs:
            self.groups = []
            return []
        first_class = class_sigs[0]

        # Parse group records before first class
        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0 or i >= first_class:
                break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 2 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            off = i + 20
            ln = data[off]
            if ln == 0 or off + 1 + ln > len(data): continue
            nb = data[off + 1:off + 1 + ln]
            if any(c < 32 or c >= 127 for c in nb): continue
            name = nb.decode("latin-1")
            if name not in group_names:
                continue
            off += 1 + ln
            if off + 4 > len(data): continue
            id8 = _id8(bytes(data[i + 4:i + 12]))
            cands.append((i, id8, name, off + 4))

        cands.sort(key=lambda c: c[0])
        out = []
        for idx, (off, cid, name, p0) in enumerate(cands):
            if idx + 1 < len(cands):
                size = cands[idx + 1][0] - off
            else:
                size = first_class - off
            if size < 20 or size > 200:
                continue
            out.append(Group(
                idx=idx, id=cid, offset=off, size=size,
                name=name, trailing=b""))
        self.groups = out
        return out

    def parse_groups(self) -> list["Group"]:
        data = self._raw
        if self.version == 324:
            return self._parse_groups_v324(data)
        sig = b"\x02\x00\x01\x00"
        suffix = b"\x02\x00\x00\x00\x02\x00\x00\x00"
        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0:
                break
            pos = i + 1
            if i + 4 + 8 + 4 + 2 > len(data):
                continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0:
                continue
            off = i + 16
            if off >= len(data):
                continue
            ln = data[off]
            if ln == 0 or off + 1 + ln > len(data):
                continue
            nb = data[off + 1:off + 1 + ln]
            if any(c < 32 or c >= 127 for c in nb):
                continue
            off += 1 + ln
            # sufijo debe aparecer a <= 60 B
            sp = data.find(suffix, off)
            if sp < 0 or sp - off > 60:
                continue
            size_chk = sp + len(suffix) - i
            if size_chk > 82:
                continue
            cands.append((i, ln, nb.decode("latin-1"), off, sp))

        # filtrar contiguos: distancia al siguiente candidato <= 90
        cands_sorted = sorted(cands)
        keep = set()
        for idx, (c, ln, name, off, sp) in enumerate(cands_sorted):
            next_dist = (cands_sorted[idx + 1][0] - c) if idx + 1 < len(cands_sorted) else None
            if next_dist is not None and next_dist <= 90:
                keep.add(c)
        # último de un bloque contiguo (sin sucesor cercano) pero con sufijo
        for idx, (c, ln, name, off, sp) in enumerate(cands_sorted):
            if c in keep:
                continue
            prev_dist = (c - cands_sorted[idx - 1][0]) if idx - 1 >= 0 else None
            if prev_dist is not None and prev_dist <= 90:
                keep.add(c)

        out = []
        for idx, (c, ln, name, off, sp) in enumerate(cands_sorted):
            if c not in keep:
                continue
            size = sp + len(suffix) - c
            trailing = data[off:sp + len(suffix)]
            out.append(Group(
                idx=len(out),
                id=_id8(bytes(data[c + 4:c + 12])),
                offset=c,
                size=size,
                name=name,
                trailing=trailing,
            ))
        self.groups = out
        return out

    def _parse_grades_v324(self, data):
        sig = CLASSROOM_SIG
        grade_prefixes = ("Grado", "Grade", "Nivel")
        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0: break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 2 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            off = i + 20
            ln = data[off]
            if ln == 0 or off + 1 + ln > len(data): continue
            nb = data[off + 1:off + 1 + ln]
            if any(c < 32 or c >= 127 for c in nb): continue
            name = nb.decode("latin-1")
            if not any(name.startswith(p) for p in grade_prefixes):
                continue
            off += 1 + ln
            if off >= len(data): continue
            ln2 = data[off]
            if ln2 == 0 or off + 1 + ln2 > len(data): continue
            nb2 = data[off + 1:off + 1 + ln2]
            if any(c < 32 or c >= 127 for c in nb2): continue
            short_name = nb2.decode("latin-1")
            off += 1 + ln2
            if off + 4 > len(data): continue
            id8 = _id8(bytes(data[i + 4:i + 12]))
            cands.append((i, id8, name, short_name, off + 4))

        cands.sort(key=lambda c: c[0])
        out = []
        for idx, (off, cid, name, short, p0) in enumerate(cands):
            if idx + 1 < len(cands):
                size = cands[idx + 1][0] - off
            else:
                size = 200
            if size < 20 or size > 500:
                continue
            trailing = data[p0:p0 + 24]
            if len(trailing) >= 24:
                fields = struct.unpack_from("<6I", trailing, 0)
            else:
                fields = ()
            out.append(Grade(
                idx=idx, id=cid, offset=off, size=size,
                name=name, short=short, leading=b"", fields=fields))
        self.grades = out
        return out

    def parse_grades(self) -> list["Grade"]:
        data = self._raw
        if self.version == 324:
            return self._parse_grades_v324(data)
        cands = []
        pos = 0
        while True:
            i = data.find(b"\x02", pos)
            if i < 0:
                break
            pos = i + 1
            if i + 1 + 8 + 3 + 8 + 4 + 2 > len(data):
                continue
            off = i + 1 + 8
            if data[off:off+3] != b"\x00\x01\x00":
                continue
            off += 3 + 8
            if struct.unpack_from("<I", data, off)[0] != 0:
                continue
            off += 4
            if off >= len(data):
                continue
            ln1 = data[off]
            if ln1 == 0 or off + 1 + ln1 > len(data):
                continue
            nb1 = data[off + 1:off + 1 + ln1]
            if any(c < 32 or c >= 127 for c in nb1):
                continue
            off += 1 + ln1
            if off >= len(data):
                continue
            ln2 = data[off]
            if ln2 == 0 or off + 1 + ln2 > len(data):
                continue
            nb2 = data[off + 1:off + 1 + ln2]
            if any(c < 32 or c >= 127 for c in nb2):
                continue
            off += 1 + ln2
            if off + 24 > len(data):
                continue
            cands.append((i, ln1, ln2))

        cands_sorted = sorted(cands)
        # keep only those whose next candidate is close (grados contiguos)
        keep = set()
        for idx, (c, ln1, ln2) in enumerate(cands_sorted):
            next_dist = (cands_sorted[idx + 1][0] - c) if idx + 1 < len(cands_sorted) else None
            if next_dist is not None and 50 <= next_dist <= 70:
                keep.add(c)

        out = []
        for idx, (c, ln1, ln2) in enumerate(cands_sorted):
            if c not in keep:
                continue
            off = c
            leading = data[off:off + 9]
            off += 9
            assert data[off:off + 3] == b"\x00\x01\x00"
            off += 3
            id8 = _id8(bytes(data[off:off + 8]))
            off += 8
            assert struct.unpack_from("<I", data, off)[0] == 0
            off += 4
            assert data[off] == ln1
            off += 1
            name = data[off:off + ln1].decode("latin-1")
            off += ln1
            assert data[off] == ln2
            off += 1
            short = data[off:off + ln2].decode("latin-1")
            off += ln2
            if idx + 1 < len(cands_sorted) and cands_sorted[idx + 1][0] in keep:
                nxt = cands_sorted[idx + 1][0]
            else:
                nxt = c + 50 + ln1 + ln2
            size = nxt - c
            trailing = data[off:nxt]
            if len(trailing) >= 24:
                fields = struct.unpack_from("<6I", trailing, 0)
            else:
                fields = ()
            out.append(Grade(
                idx=len(out),
                id=id8,
                offset=c,
                size=size,
                name=name,
                short=short,
                leading=leading,
                fields=fields,
            ))
        self.grades = out
        return out

    def parse_classrooms(self) -> list["Classroom"]:
        data = self._raw
        if self.version == 324:
            return self._parse_classrooms_v324(data)
        sig = CLASSROOM_SIG
        cands = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0:
                break
            pos = i + 1
            if i + 4 + 8 + 4 > len(data):
                continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0:
                continue
            p = i + 16
            if p >= len(data):
                continue
            ln = data[p]
            if ln == 0 or p + 1 + ln > len(data):
                continue
            short_bytes = data[p + 1:p + 1 + ln]
            if any(c < 32 or c >= 127 for c in short_bytes):
                continue
            p += 1 + ln
            if p >= len(data):
                continue
            ln2 = data[p]
            if ln2 == 0 or p + 1 + ln2 > len(data):
                continue
            full_bytes = data[p + 1:p + 1 + ln2]
            if any(c < 32 or c >= 127 for c in full_bytes):
                continue
            p += 1 + ln2
            if p >= len(data) or data[p] != 0:
                continue
            p += 1
            if p + 58 > len(data):
                continue
            id8 = _id8(bytes(data[i + 4:i + 12]))
            cands.append((i, id8, short_bytes.decode("latin-1"),
                          full_bytes.decode("latin-1"), p))

        cands.sort(key=lambda c: c[0])
        out = []
        for idx, (off, cid, short, name, p0) in enumerate(cands):
            if idx + 1 < len(cands):
                size = cands[idx + 1][0] - off
            else:
                size = 200
            if size < 70 or size > 200:
                continue
            rem = data[p0:p0 + 58]
            if len(rem) < 58:
                continue
            fields = struct.unpack_from("<14I", rem, 0)
            trailing = rem[56:58]
            out.append(Classroom(
                idx=idx, id=cid, offset=off, size=size,
                name=name, short=short, fields=fields, trailing=trailing))
        self.classrooms = out
        return out

    def _parse_classrooms_v324(self, data):
        sig = CLASSROOM_SIG
        class_sigs = []
        pos = 0
        while True:
            i = data.find(sig, pos)
            if i < 0: break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 8 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            if data[i + 20:i + 28] != b"\x07CLASSTT": continue
            class_sigs.append(i)
        if not class_sigs:
            self.classrooms = []
            return []
        last_class = class_sigs[-1]
        scan_start = data.find(sig, last_class + 4)
        if scan_start < 0:
            scan_start = last_class + 4

        skip_prefixes = ("Sede", "Master", "Todo", "Profesores", "Aulas",
                         "Asignaturas", "Estudiantes", "Plan", "Opciones",
                         "Materias", "Grupos")
        cands = []
        pos = scan_start
        while True:
            i = data.find(sig, pos)
            if i < 0:
                break
            pos = i + 1
            if i + 4 + 8 + 4 + 4 + 2 > len(data): continue
            if struct.unpack_from("<I", data, i + 12)[0] != 0: continue
            if struct.unpack_from("<I", data, i + 16)[0] != 0x02000000: continue
            off = i + 20
            ln = data[off]
            if ln == 0 or off + 1 + ln > len(data): continue
            short_bytes = data[off + 1:off + 1 + ln]
            if any(c < 32 or c >= 127 for c in short_bytes): continue
            off += 1 + ln
            if off >= len(data): continue
            ln2 = data[off]
            if ln2 == 0 or off + 1 + ln2 > len(data): continue
            full_bytes = data[off + 1:off + 1 + ln2]
            if any(c < 32 or c >= 127 for c in full_bytes): continue
            off += 1 + ln2
            if off + 4 > len(data): continue
            short_name = short_bytes.decode("latin-1")
            if short_name.startswith(skip_prefixes):
                continue
            id8 = _id8(bytes(data[i + 4:i + 12]))
            cands.append((i, id8, short_name, full_bytes.decode("latin-1"), off + 4))

        cands.sort(key=lambda c: c[0])
        out = []
        for idx, (off, cid, short, name, p0) in enumerate(cands):
            if idx + 1 < len(cands):
                size = cands[idx + 1][0] - off
            else:
                size = 200
            if size < 20 or size > 500:
                continue
            out.append(Classroom(
                idx=idx, id=cid, offset=off, size=size,
                name=name, short=short, fields=(), trailing=b""))
        self.classrooms = out
        return out



@dataclass
class Params:
    generate: bool = False
    check_exhaustion: bool = True
    max_consecutive: int = 6
    check_windows: bool = True
    max_windows: int = 6
    offset: int = 0


@dataclass
class Relationship:
    offset: int = 0
    text: str = ""
    kind: str = "standard"
    subjects: list[str] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)
    all_classes: bool = False
    description: str = ""
    nclass: int = 0
    class_indices: list[int] = field(default_factory=list)
    nsubj: int = 0
    subject_indices: list[int] = field(default_factory=list)
    trailer: bytes = b""
    trailer_u32: tuple = ()
    type: int | None = None

    @property
    def t0(self):
        return self.trailer_u32[0] if len(self.trailer_u32) > 0 else None
    @property
    def t1(self):
        return self.trailer_u32[1] if len(self.trailer_u32) > 1 else None
    @property
    def t2(self):
        return self.trailer_u32[2] if len(self.trailer_u32) > 2 else None
    @property
    def t3(self):
        return self.trailer_u32[3] if len(self.trailer_u32) > 3 else None
    @property
    def t4(self):
        return self.trailer_u32[4] if len(self.trailer_u32) > 4 else None
    @property
    def t5(self):
        return self.trailer_u32[5] if len(self.trailer_u32) > 5 else None
    @property
    def t6(self):
        return self.trailer_u32[6] if len(self.trailer_u32) > 6 else None
    @property
    def t7(self):
        return self.trailer_u32[7] if len(self.trailer_u32) > 7 else None



def _find_hdr_rel(data: bytes, s: int):
    if s < 0 or s + 0x25 > len(data):
        return None
    if data[s + 12:s + 24] != _REL_SIG:
        return None
    for hdr in (0x2c, 0x28):
        if s + hdr + 1 > len(data):
            continue
        if sum(1 for b in data[s:s + 8] if b == 0) < 6:
            continue
        if data[s + hdr - 4:s + hdr] != _REL_MAGIC5:
            continue
        ln = data[s + hdr]
        if ln == 0 or s + hdr + 1 + ln > len(data):
            continue
        txt = data[s + hdr + 1:s + hdr + 1 + ln]
        if b"  -  " not in txt:
            continue
        if any(c < 9 or (13 < c < 32) for c in txt):
            continue
        return hdr, "standard", ln, txt.decode("latin-1")
    hdr = 0x24
    if s + hdr + 1 <= len(data):
        if sum(1 for b in data[s:s + 8] if b == 0) >= 7:
            if data[s + 0x20:s + 0x24] == b"\x00\x00\x00\x00":
                ln = data[s + hdr]
                if 0 < ln < 200 and s + hdr + 1 + ln <= len(data):
                    txt = data[s + hdr + 1:s + hdr + 1 + ln]
                    if all(32 <= c < 127 for c in txt):
                        return hdr, "compact", ln, txt.decode("latin-1")
    return None

def _find_params(data: bytes):
    p = 0
    while True:
        i = data.find(_PARAMS_SIG, p)
        if i < 0:
            return None
        p = i + 1
        if i + 16 + 20 > len(data):
            continue
        gen, exh, cons, wen, win = struct.unpack_from("<5I", data, i + 16)
        if gen <= 1 and exh <= 1 and 1 <= cons <= 1000 and wen <= 1 and 0 <= win <= 1000:
            return Params(generate=bool(gen), check_exhaustion=bool(exh),
                         max_consecutive=cons, check_windows=bool(wen),
                         max_windows=win, offset=i)
    return None


def _parse_relationships(data: bytes) -> list[Relationship]:
    a = data.find(_REL_PREAMBLE)
    if a < 0:
        return []
    try:
        count = struct.unpack_from("<I", data, a + 48)[0]
    except struct.error:
        return []
    s = None
    q = a + 44
    while True:
        i = data.find(_REL_SIG, q)
        if i < 0 or i > a + 256:
            break
        c = i - 12
        if _find_hdr_rel(data, c) is not None:
            s = c
            break
        q = i + 1
    if s is None:
        return []

    out = []
    for _ in range(count):
        h = _find_hdr_rel(data, s)
        if h is None:
            break
        hdr, kind, ln, text = h
        p = s + hdr + 1 + ln
        if kind == "standard":
            if p + 4 > len(data):
                break
            nclass = struct.unpack_from("<I", data, p)[0]
            p += 4
            if nclass > 400 or p + 4 * nclass > len(data):
                break
            class_indices = list(struct.unpack_from(f"<{nclass}I", data, p)) if nclass else []
            p += 4 * nclass
            if p + 4 > len(data):
                break
            nsubj = struct.unpack_from("<I", data, p)[0]
            p += 4
            if nsubj > 400 or p + 4 * nsubj > len(data):
                break
            subject_indices = list(struct.unpack_from(f"<{nsubj}I", data, p)) if nsubj else []
            p += 4 * nsubj
            parts = text.split("  -  ")
            if len(parts) >= 3:
                subjects_txt = parts[0]
                classes_txt = parts[1]
                description = "  -  ".join(parts[2:])
            elif len(parts) == 2:
                subjects_txt = parts[0]
                classes_txt = parts[1]
                description = ""
            else:
                subjects_txt = parts[0] if parts else ""
                classes_txt = ""
                description = ""
            subjects = [x.strip() for x in subjects_txt.split(",") if x.strip()]
            all_classes = (classes_txt.strip().lower() == "all classes")
            classes = [] if all_classes else [x.strip() for x in classes_txt.split(",") if x.strip()]
        else:
            nclass = 0
            class_indices = []
            nsubj = 0
            subject_indices = []
            subjects = []
            classes = []
            all_classes = False
            description = text
        nxt = None
        qq = p
        while True:
            i = data.find(_REL_SIG, qq)
            if i < 0:
                break
            c = i - 12
            if c >= p and _find_hdr_rel(data, c) is not None:
                nxt = c
                break
            qq = i + 1
        if nxt is not None and nxt > p:
            trailer = data[p:nxt]
        else:
            trailer = data[p:p + _REL_TRAILER_DEFAULT]
        n_u32 = min(8, len(trailer) // 4)
        trailer_u32 = tuple(struct.unpack_from(f"<{n_u32}I", trailer, 0)) if n_u32 else ()
        rtype = trailer_u32[0] if trailer_u32 else None
        out.append(Relationship(
            offset=s, text=text, kind=kind, subjects=subjects, classes=classes,
            all_classes=all_classes, description=description,
            nclass=nclass, class_indices=class_indices, nsubj=nsubj,
            subject_indices=subject_indices, trailer=trailer,
            trailer_u32=trailer_u32, type=rtype))
        if nxt is None:
            break
        s = nxt
    return out


def find_params(self):
    return _find_params(self._raw)


def find_relationships(self):
    return _parse_relationships(self._raw)


RozFile.find_params = find_params
RozFile.find_relationships = find_relationships

# module-level aliases
parse_params = _find_params
parse_relationships = _parse_relationships
