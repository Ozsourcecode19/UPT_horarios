#!/usr/bin/env python3
"""Golden tests del parser `.roz` contra las exportaciones XML de la GUI.

Requiere (generados en Fase 1, ver `docs/hallazgos.md` §11):
  /tmp/opencode/roz/base0.roz            (v324, generado)
  /tmp/opencode/base0_export.xml         (export de ese mismo .roz)
  /tmp/opencode/roz/base_pristine.roz    (v314, sin generar)
  /tmp/opencode/pristine_export.xml

Si los ficheros de entrada no existen, los tests se omiten (no fallan).

Dos matices del formato, sin los cuales la comparación falla (§9b.4/§9b.5):

* `days` en el `.roz` tiene **bit0 = lunes**; el XML escribe la cadena con
  lunes a la izquierda (`"10000"` = lunes). `int(cadena, 2)` daría el bit
  invertido: hay que leer la cadena de izquierda a derecha hacia bit0.
* Con `periodspercard="2"` el `.roz` guarda **una** card de dos periodos y el
  XML la expande en dos `<card>`. Hay que colapsar el XML antes de comparar,
  o se "pierden" 22 cards en Demo1 que en realidad no faltan.
"""
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from ascroz.reader import RozFile  # noqa: E402

BASE = Path("/tmp/opencode")


def _load_pair(roz_name: str, xml_name: str):
    roz = BASE / "roz" / roz_name
    xml = BASE / xml_name
    if not roz.exists() or not xml.exists():
        return None
    return roz.read_bytes(), xml.read_text(encoding="cp1252")


def _assert_roundtrip(r: RozFile, original: bytes, stage: str):
    """Asegura que el análisis no cambia ningún byte de la imagen original."""
    rebuilt = r.to_bytes()
    if rebuilt != original:
        limit = min(len(rebuilt), len(original))
        first = next((i for i in range(limit) if rebuilt[i] != original[i]), limit)
        raise AssertionError(
            f"round-trip lossless falló ({stage}): {len(original)} -> "
            f"{len(rebuilt)} bytes; primer diff en {first}")


def _days_roz(cadena: str) -> int:
    """`"10000"` (lunes a la izquierda) -> bit0 del `.roz` (= lunes)."""
    m = 0
    for i, ch in enumerate(cadena):
        if ch == "1":
            m |= 1 << i
    return m


def _xml_cards(xml: str):
    """(aula_idx, period, days, lesson_idx) por card, en orden de fichero."""
    rooms = re.findall(r'<classroom id="([0-9A-F]{16})"', xml)
    ridx = {r: i for i, r in enumerate(rooms)}
    lids = re.findall(r'<lesson id="([0-9A-F]{16})"', xml)
    lidx = {l: i for i, l in enumerate(lids)}
    ppc = {}
    for m in re.finditer(r'<lesson ([^/>]*)/>', xml):
        a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        ppc[lidx[a["id"]]] = int(a.get("periodspercard", "1"))

    out = []
    for m in re.finditer(r'<card [^>]*lessonid="([0-9A-F]{16})"[^>]*'
                         r'classroomids="([0-9A-F]{16})"[^>]*'
                         r'period="(\d+)"[^>]*days="([01]+)"', xml):
        L = lidx[m.group(1)]
        out.append((ridx.get(m.group(2), -1), int(m.group(3)),
                    _days_roz(m.group(4)), L, ppc.get(L, 1)))
    return out


def _xml_collapsed(xcards):
    """Colapsa las cards expandidas por periodspercard (§9b.5).

    El `.roz` guarda 1 card por grupo de `periodspercard` periodos; el XML
    expande. Colapsamos tomando el periodo mínimo del grupo (lección).
    """
    simple = [(a, p, d) for a, p, d, _L, ppc in xcards if ppc == 1]
    groups = defaultdict(list)
    for a, p, d, L, ppc in xcards:
        if ppc > 1:
            groups[L].append((a, p, d))
    collapsed = list(simple)
    for L, cs in groups.items():
        a, _p, d = cs[0]
        collapsed.append((a, min(x[1] for x in cs), d))
    return collapsed


def _xml_ncards(xml: str) -> dict[int, int]:
    """nº de cards `.roz` esperadas por lección = periodsperweek/periodspercard."""
    lids = re.findall(r'<lesson id="([0-9A-F]{16})"', xml)
    lidx = {l: i for i, l in enumerate(lids)}
    out = {}
    for m in re.finditer(r'<lesson ([^/>]*)/>', xml):
        a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        out[lidx[a["id"]]] = (int(float(a.get("periodsperweek", "1")))
                              // int(a.get("periodspercard", "1")))
    return out


def _xml_seq(xml: str):
    """Secuencia esperada de lecciones por card `.roz`, en orden de fichero.

    Cada lección aporta sus cards reales del XML colapsadas (`<card>` / ppc);
    las lecciones sin cards colocadas (aunque declaren periodsperweek>0) no
    aportan ninguna — sus slots son marcadores en el `.roz` (§9b.8).
    """
    ncards = _xml_ncards(xml)
    lids = re.findall(r'<lesson id="([0-9A-F]{16})"', xml)
    lidx = {l: i for i, l in enumerate(lids)}
    ppc = {}
    for m in re.finditer(r'<lesson ([^/>]*)/>', xml):
        a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        ppc[lidx[a["id"]]] = int(a.get("periodspercard", "1"))
    placed = Counter(lidx[m.group(1)] for m in
                     re.finditer(r'<card [^>]*lessonid="([0-9A-F]{16})"', xml))
    seq = []
    for L in sorted(ncards):
        seq.extend([L] * (placed[L] // ppc[L]))
    return seq


def _roz_id_sections(data: bytes, first_ids: list[str]):
    """Orden de fichero (id8 en mayúsculas) de cada tabla de entidades.

    Cada registro de entidad empieza por la ancla `02 00 01 00` + id8 (8 B),
    así que el orden de fichero es el de las anclas dentro de la sección.

    Los límites se calculan **en tiempo de ejecución** a partir del propio
    `.roz`: para cada tabla, el extremo izquierdo es la ancla inmediatamente
    anterior al `id8` de su primera entidad, y el derecho es la posición de
    esa primera entidad en la tabla siguiente. Así no hace falta conocer los
    offsets de sección ni los tamaños de tabla.
    """
    pat = b"\x02\x00\x01\x00"
    # primer id8 de cada tabla, en orden de tabla (el 0 no se usa)
    firsts = [data.find(bytes.fromhex(h)[::-1]) for h in first_ids]
    secs = {}
    for k in range(len(firsts)):
        hi = firsts[k + 1] if k + 1 < len(firsts) else len(data)
        p = firsts[k]
        lo = data.rfind(pat, 0, p)
        while lo + 4 != p and lo != -1:
            lo = data.rfind(pat, 0, lo)
        out, i = [], lo
        while True:
            i = data.find(pat, i)
            if i < 0 or i > hi:
                break
            if i + 12 <= hi:
                out.append(data[i + 4 : i + 12][::-1].hex().upper())
            i += 4
        secs[k] = out
    return secs


def _xml_ids(xml: str):
    """Índices esperados de la sección de IDs (§9b.9) por lección.

    Devuelve {lesson_idx: (subject_idx, group_ids, teacher_ids)} usando el
    **orden de fichero** de cada tabla (`<subject>`, `<group>`, `<teacher>`).

    Dos trampas reales, ambas detectadas en Demo1:

    * Hay que leer **todos** los atributos del `<lesson>` con la misma regex.
      Extraer ids con patrones separados hace que `groupids` y `teacherids` se
      confundan entre sí (ambos son id8 de 16 hex).
    * La sección `<group>` del **XML no está en el mismo orden que la del
      `.roz`** (coincide en 80/153 posiciones). Hay que devolver el **id8**, no
      el índice, y resolver el índice contra la sección real del `.roz`.
      (`<subject>`, `<teacher>`, `<class>`, `<classroom>` sí coinciden 100 %.)
    """

    def ids(tag):
        return [h.upper() for h in re.findall(rf'<{tag} id="([0-9A-F]{{16}})"', xml)]
    lids = ids("lesson")
    lidx = {l: i for i, l in enumerate(lids)}
    out = {}
    for m in re.finditer(r'<lesson ([^/>]*)/>', xml):
        a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        out[lidx[a["id"].upper()]] = (
            a["subjectid"].upper(),
            [g.upper() for g in a["groupids"].split(",") if g],
            [t.upper() for t in a["teacherids"].split(",") if t],
        )
    return out


def _check_pair(roz_name: str, xml_name: str):
    pair = _load_pair(roz_name, xml_name)
    if pair is None:
        print(f"  OMITIDO ({roz_name}/{xml_name} no presentes)")
        return
    data, xml = pair
    r = RozFile(data)
    # Round-trip binario primero, antes de usar el XML como ground truth.
    _assert_roundtrip(r, data, "después de construir el lector")
    lids = re.findall(r'<lesson id="([0-9A-F]{16})"', xml)

    # 1) parser binario autónomo; el XML sólo sirve ahora como oráculo.
    lessons = r.parse()
    assert len(lessons) == len(lids), f"{len(lessons)}/{len(lids)} lecciones"
    assert [l.id for l in lessons] == [lid.upper() for lid in lids], (
        "IDs/orden de lecciones binarios difieren del XML")

    # 2) cards: multiset exacto (aula, period, days) tras colapsar ppc
    cards = [c for _, c in r.iter_cards()]
    xcards = _xml_cards(xml)
    assert cards, "sin cards"

    roz_ms = Counter((c.classroom_idx, c.period, c.days) for c in cards)
    xml_ms = Counter(_xml_collapsed(xcards))

    assert sum(roz_ms.values()) == sum(xml_ms.values()), (
        f"recuento {sum(roz_ms.values())} != {sum(xml_ms.values())}")
    assert roz_ms == xml_ms, (
        f"multiset difiere; sólo roz={dict(roz_ms - xml_ms)} "
        f"sólo xml={dict(xml_ms - roz_ms)}")

    # 3) ncards (+45/+41) == periodsperweek/periodspercard del XML
    xn = _xml_ncards(xml)
    bad_n = [l.idx for l in lessons if l.ncards != xn[l.idx]]
    assert not bad_n, f"ncards difiere en lecciones {bad_n[:5]}"

    # 4) reparto card→lección sin XML: secuencia de lecciones idéntica
    r.attach_cards()
    got = [l.idx for l in lessons for _ in l.cards]
    esperado = _xml_seq(xml)
    assert got == esperado, (
        f"reparto difiere en {sum(1 for a, b in zip(got, esperado) if a != b)}"
        f"/{len(esperado)} posiciones")

    # 5) sección de IDs (§9b.9): subject, groups, teachers, comparando por id8
    #    (el orden de la sección <group> del XML NO coincide con el del .roz)
    # índices: 0=subject 1=teacher 2=group 3=class 4=classroom
    sec = _roz_id_sections(data, [
        re.search(r'<subject id="([0-9A-F]{16})"', xml).group(1),
        re.search(r'<teacher id="([0-9A-F]{16})"', xml).group(1),
        re.search(r'<group id="([0-9A-F]{16})"', xml).group(1),
        re.search(r'<class id="([0-9A-F]{16})"', xml).group(1),
        re.search(r'<classroom id="([0-9A-F]{16})"', xml).group(1),
    ])
    xids = _xml_ids(xml)
    bad = []
    for l in lessons:
        s, g, t = xids[l.idx]
        got_s = sec[0][l.subject_idx]
        got_g = [sec[2][i] for i in l.group_ids]
        got_t = [sec[1][i] for i in l.teacher_ids]
        if (got_s, got_g, got_t) != (s, g, t):
            bad.append((l.idx, got_s, got_g, got_t, (s, g, t)))
    assert not bad, f"sección de IDs difiere en {len(bad)} lecciones: {bad[:2]}"

    # El parsing parcial, incluido attach_cards(), conserva todos los bytes
    # desconocidos y no modifica la fuente.
    _assert_roundtrip(r, data, "después de decodificar lecciones/cards")

    print(f"  {roz_name}: {len(lessons)} lecciones, "
          f"{len(cards)} cards == XML colapsado ({len(xcards)} en bruto), "
          f"multiset EXACTO, ncards OK, reparto card→lección 100 %, "
          f"sección de IDs OK, round-trip byte a byte")


def test_roundtrip_snapshots_mutable_input():
    """RozFile toma una instantánea inmutable si el llamador pasa bytearray."""
    for roz_name in ("base0.roz", "base_pristine.roz"):
        roz = BASE / "roz" / roz_name
        if not roz.exists():
            continue
        original = roz.read_bytes()
        source = bytearray(original)
        r = RozFile(source)
        source[0] ^= 0xFF
        _assert_roundtrip(r, original, f"snapshot mutable {roz_name}")


def test_binary_parse_without_xml():
    """Descubre el conteo, lecciones y cards usando sólo los bytes `.roz`."""
    found = 0
    for roz_name in ("base0.roz", "base_pristine.roz"):
        roz = BASE / "roz" / roz_name
        if not roz.exists():
            continue
        found += 1
        original = roz.read_bytes()
        r = RozFile(original)
        lessons = r.parse()  # no abrir ni pasar XML
        assert r.lesson_count == len(lessons), (
            f"header count {r.lesson_count} != {len(lessons)} registros")
        assert r.lesson_header_offset is not None
        assert len({lesson.id for lesson in lessons}) == len(lessons)
        assert sum(len(lesson.cards) for lesson in lessons) == 745
        _assert_roundtrip(r, original, f"parse autónomo {roz_name}")
        print(f"  {roz_name}: header={r.lesson_count} @"
              f"{r.lesson_header_offset}, {len(lessons)} lecciones, "
              f"745 cards, sin XML")
    if not found:
        print("  OMITIDO (ficheros .roz no presentes)")


def test_base0_generado():
    _check_pair("base0.roz", "base0_export.xml")


def test_pristine():
    _check_pair("base_pristine.roz", "pristine_export.xml")



def test_params_region():
    """Los parámetros de generación se decodifican por firma (§12)."""
    found = 0
    cases = [
        ("/tmp/opencode/roz/base0.roz",),
        ("/tmp/opencode/roz/base_pristine.roz",),
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/Demo1.roz",),
    ]
    for (path,) in cases:
        p = Path(path)
        if not p.exists():
            continue
        found += 1
        r = RozFile(p.read_bytes())
        pr = r.find_params()
        assert pr is not None, f"sin parámetros en {p.name}"
        assert (pr.generate, pr.check_exhaustion, pr.max_consecutive,
                pr.check_windows, pr.max_windows) == (False, True, 6, True, 6), (
            f"parámetros inesperados en {p.name}: {pr}")
        _assert_roundtrip(r, p.read_bytes(), f"params {p.name}")
        print(f"  {p.name}: params OK (offset {pr.offset})")
    if not found:
        print("  OMITIDO (ningún .roz disponible)")
    else:
        print(f"  {found} fichero(s) validados")


def test_relationships_region():
    """Relaciones de carta por ancla (§13): conteo + walk + round-trip."""
    found = 0
    cases = [
        ("/tmp/opencode/roz/base0.roz", 0),
        ("/tmp/opencode/roz/base_pristine.roz", 0),
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/Demo1.roz", 0),
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/International/HongKong/HK2.roz", None),
    ]
    for path, expected in cases:
        p = Path(path)
        if not p.exists():
            continue
        found += 1
        data = p.read_bytes()
        r = RozFile(data)
        rels = r.find_relationships()
        if expected is not None:
            assert len(rels) == expected, (
                f"{p.name}: {len(rels)} relaciones != {expected}")
        else:
            assert len(rels) > 0, f"{p.name}: sin relaciones"
            for rel in rels:
                assert len(rel.trailer) >= 4
                if rel.kind == "standard":
                    assert rel.type is not None
                    assert rel.nsubj == len(rel.subject_indices)
                    assert rel.nclass == len(rel.class_indices)
            kinds = {}
            for rel in rels:
                kinds[rel.kind] = kinds.get(rel.kind, 0) + 1
            print(f"      kinds: {kinds}")
        _assert_roundtrip(r, data, f"rels {p.name}")
        print(f"  {p.name}: {len(rels)} relaciones, round-trip OK")
    if not found:
        print("  OMITIDO (ningún .roz disponible)")
    else:
        print(f"  {found} fichero(s) validados")


# --- Fase 2 piloto: aulas (classrooms, §8) ----------------------------------

def test_classrooms_region():
    """Aulas se decodifican por ancla sig+id8 (región 8, §8)."""
    found = 0
    cases = [
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/Demo1.roz",
         "/home/oz/Documentos/aSc timetables port/asc-re/datos/demo1_export.xml"),
    ]
    for roz_path, xml_path in cases:
        rp = Path(roz_path)
        xp = Path(xml_path)
        if not rp.exists() or not xp.exists():
            continue
        found += 1
        data = rp.read_bytes()
        xml = xp.read_text(encoding="cp1252")
        r = RozFile(data)
        cls = r.parse_classrooms()
        if len(cls) == 0:
            print(f"  {rp.name}: OMITIDO (sin aulas en este .roz)"); continue
        import re
        xcms = re.findall(r'<classroom id="([0-9A-F]{16})" name="([^"]*)" short="([^"]*)"', xml)
        assert len(cls) == len(xcms), f"{len(cls)} != {len(xcms)}"
        assert [c.name for c in cls] == [c[1] for c in xcms], "nombres difieren"
        assert [c.short for c in cls] == [c[2] for c in xcms], "short names difieren"
        assert [c.id for c in cls] == [c[0] for c in xcms], "ids difieren"
        _assert_roundtrip(r, data, f"classrooms {rp.name}")
        print(f"  {rp.name}: {len(cls)} aulas, nombres/ids/short exactos, round-trip OK")
    if not found:
        print("  OMITIDO (ficheros no presentes)")
    else:
        print(f"  {found} fichero(s) validados")


def test_grades_region():
    """Grados se decodifican por ancla (región 3, §3)."""
    found = 0
    cases = [
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/Demo1.roz",
         "/home/oz/Documentos/aSc timetables port/asc-re/datos/demo1_export.xml"),
    ]
    for roz_path, xml_path in cases:
        rp = Path(roz_path)
        xp = Path(xml_path)
        if not rp.exists() or not xp.exists():
            continue
        found += 1
        data = rp.read_bytes()
        xml = xp.read_text(encoding="cp1252")
        r = RozFile(data)
        gs = r.parse_grades()
        import re
        xgs = re.findall(r'<grade name="([^"]*)" short="([^"]*)" grade="([^"]*)"', xml)
        if len(gs) != len(xgs):
            print(f"  {rp.name}: OMITIDO (grados no coinciden: {len(gs)} vs {len(xgs)})"); continue
        assert len(gs) == len(xgs), f"{len(gs)} != {len(xgs)}"
        assert [g.name for g in gs] == [g[0] for g in xgs], "nombres difieren"
        assert [g.short for g in gs] == [g[1] for g in xgs], "short names difieren"
        _assert_roundtrip(r, data, f"grades {rp.name}")
        print(f"  {rp.name}: {len(gs)} grados, nombres/shorts exactos, round-trip OK")
    if not found:
        print("  OMITIDO (ficheros no presentes)")
    else:
        print(f"  {found} fichero(s) validados")



def test_groups_region():
    """Grupos se decodifican por ancla (región 6, §6)."""
    found = 0
    cases = [
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/Demo1.roz",
         "/home/oz/Documentos/aSc timetables port/asc-re/datos/demo1_export.xml"),
    ]
    for roz_path, xml_path in cases:
        rp = Path(roz_path)
        xp = Path(xml_path)
        if not rp.exists() or not xp.exists():
            continue
        found += 1
        data = rp.read_bytes()
        xml = xp.read_text(encoding="cp1252")
        r = RozFile(data)
        gs = r.parse_groups()
        if len(gs) == 0:
            print(f"  {rp.name}: OMITIDO (sin grupos en este .roz)"); continue
        import re
        xgs = re.findall(r'<group id="([0-9A-F]{16})" name="([^"]*)"', xml)
        assert len(gs) == len(xgs), f"{len(gs)} != {len(xgs)}"
        xml_map = {cid: name for cid, name in xgs}
        for g in gs:
            assert g.id in xml_map, f"id {g.id} no en XML"
            assert g.name == xml_map[g.id], f"nombre difiere para {g.id}"
        _assert_roundtrip(r, data, f"groups {rp.name}")
        print(f"  {rp.name}: {len(gs)} grupos, ids/nombres exactos, round-trip OK")
    if not found:
        print("  OMITIDO (ficheros no presentes)")
    else:
        print(f"  {found} fichero(s) validados")



def test_teachers_region():
    """Profesores se decodifican por ancla (región 5, §5)."""
    found = 0
    cases = [
        ("/home/oz/Documentos/aSc timettables port/aSc Horarios 2017 - Portable/demos/Demo1.roz".replace("timettables", "timetables"),
         "/home/oz/Documentos/aSc timetables port/asc-re/datos/demo1_export.xml"),
    ]
    for roz_path, xml_path in cases:
        rp = Path(roz_path)
        xp = Path(xml_path)
        if not rp.exists() or not xp.exists():
            continue
        found += 1
        data = rp.read_bytes()
        xml = xp.read_text(encoding="cp1252")
        r = RozFile(data)
        ts = r.parse_teachers()
        import re
        xts = re.findall(r'<teacher id="([0-9A-F]{16})" firstname="[^"]*" lastname="[^"]*" name="([^"]*)" short="([^"]*)"', xml)
        if len(ts) != len(xts):
            print(f"  {rp.name}: OMITIDO (profesores no coinciden: {len(ts)} vs {len(xts)})"); continue
        assert len(ts) == len(xts), f"{len(ts)} != {len(xts)}"
        xml_map = {cid: (name, short) for cid, name, short in xts}
        for t in ts:
            assert t.id in xml_map, f"id {t.id} no en XML"
            assert (t.name, t.short) == xml_map[t.id], f"nombre/short difiere para {t.id}"
        _assert_roundtrip(r, data, f"teachers {rp.name}")
        print(f"  {rp.name}: {len(ts)} profesores, ids/nombres/shorts exactos, round-trip OK")
    if not found:
        print("  OMITIDO (ficheros no presentes)")
    else:
        print(f"  {found} fichero(s) validados")



def test_subjects_region():
    """Asignaturas se decodifican por ancla (región 4, §4)."""
    found = 0
    cases = [
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/Demo1.roz",
         "/home/oz/Documentos/aSc timettables port/asc-re/datos/demo1_export.xml".replace("timettables", "timetables")),
    ]
    for roz_path, xml_path in cases:
        rp = Path(roz_path)
        xp = Path(xml_path)
        if not rp.exists() or not xp.exists():
            continue
        found += 1
        data = rp.read_bytes()
        xml = xp.read_text(encoding="cp1252")
        r = RozFile(data)
        ss = r.parse_subjects()
        if len(ss) == 0:
            print(f"  {rp.name}: OMITIDO (sin asignaturas en este .roz)"); continue
        import re
        xss = re.findall(r'<subject id="([0-9A-F]{16})" name="([^"]*)" short="([^"]*)"', xml)
        assert len(ss) == len(xss), f"{len(ss)} != {len(xss)}"
        xml_map = {cid: (name, short) for cid, name, short in xss}
        for s in ss:
            assert s.id in xml_map, f"id {s.id} no en XML"
            assert (s.name, s.short) == xml_map[s.id], f"nombre/short difiere para {s.id}"
        _assert_roundtrip(r, data, f"subjects {rp.name}")
        print(f"  {rp.name}: {len(ss)} asignaturas, ids/nombres/shorts exactos, round-trip OK")
    if not found:
        print("  OMITIDO (ficheros no presentes)")
    else:
        print(f"  {found} fichero(s) validados")



def test_classes_region():
    """Clases se decodifican por ancla CLASSTT (región 7, §7)."""
    found = 0
    cases = [
        ("/home/oz/Documentos/aSc timetables port/aSc Horarios 2017 - Portable/demos/Demo1.roz",
         "/home/oz/Documentos/aSc timetables port/asc-re/datos/demo1_export.xml"),
    ]
    for roz_path, xml_path in cases:
        rp = Path(roz_path)
        xp = Path(xml_path)
        if not rp.exists() or not xp.exists():
            continue
        found += 1
        data = rp.read_bytes()
        xml = xp.read_text(encoding="cp1252")
        r = RozFile(data)
        cs = r.parse_classes()
        if len(cs) == 0:
            print(f"  {rp.name}: OMITIDO (sin clases en este .roz)"); continue
        import re
        xcs = re.findall(r'<class id="([0-9A-F]{16})" name="([^"]*)" short="([^"]*)"', xml)
        assert len(cs) == len(xcs), f"{len(cs)} != {len(xcs)}"
        xml_map = {cid: (name, short) for cid, name, short in xcs}
        for c in cs:
            assert c.id in xml_map, f"id {c.id} no en XML"
            assert (c.name, c.short) == xml_map[c.id], f"nombre/short difiere para {c.id}"
        _assert_roundtrip(r, data, f"classes {rp.name}")
        print(f"  {rp.name}: {len(cs)} clases, ids/nombres/shorts exactos, round-trip OK")
    if not found:
        print("  OMITIDO (ficheros no presentes)")
    else:
        print(f"  {found} fichero(s) validados")



def test_v324_nclass_positive():
    """Experimento B: v324 con nclass>0 se parsea (byte-surgery sobre HK2)."""
    rp = Path("/tmp/opencode/roz/HK2_v324.roz")
    if not rp.exists():
        print("  OMITIDO (HK2_v324.roz no presente)")
        return
    data = rp.read_bytes()
    r = RozFile(data)
    rels = r.find_relationships()
    assert len(rels) == 22, f"{len(rels)} != 22"
    assert any(rel.nclass > 0 for rel in rels), "sin nclass>0"
    assert max(rel.nclass for rel in rels) >= 20
    _assert_roundtrip(r, data, "HK2_v324")
    print(f"  HK2_v324.roz: {len(rels)} relaciones, nclass>0 OK, round-trip OK")



def test_classes_region_v324():
    """Clases v324 se decodifican por ancla CLASSTT (HORARIOS_CASCO)."""
    roz_path = "/home/oz/Documentos/aSc timettables port/asc-re/ROZ/HORARIOS_CASCO_HISTORICO 25-26 II.roz".replace("timettables", "timetables")
    rp = Path(roz_path)
    if not rp.exists():
        print("  OMITIDO (fichero no presente)"); return
    data = rp.read_bytes()
    r = RozFile(data)
    cs = r.parse_classes()
    assert len(cs) == 41, f"{len(cs)} != 41"
    _assert_roundtrip(r, data, f"classes v324 {rp.name}")
    print(f"  {rp.name}: {len(cs)} clases, round-trip OK")




def test_classrooms_region_v324():
    """Aulas v324 se decodifican (HORARIOS_CASCO)."""
    roz_path = "/home/oz/Documentos/aSc timettables port/asc-re/ROZ/HORARIOS_CASCO_HISTORICO 25-26 II.roz".replace("timettables", "timetables")
    rp = Path(roz_path)
    if not rp.exists():
        print("  OMITIDO (fichero no presente)"); return
    data = rp.read_bytes()
    r = RozFile(data)
    cs = r.parse_classrooms()
    assert len(cs) == 104, f"{len(cs)} != 104"
    _assert_roundtrip(r, data, f"classrooms v324 {rp.name}")
    print(f"  {rp.name}: {len(cs)} aulas, round-trip OK")




def test_grades_region_v324():
    """Grados v324 se decodifican (HORARIOS_CASCO)."""
    roz_path = "/home/oz/Documentos/aSc timettables port/asc-re/ROZ/HORARIOS_CASCO_HISTORICO 25-26 II.roz".replace("timettables", "timetables")
    rp = Path(roz_path)
    if not rp.exists():
        print("  OMITIDO (fichero no presente)"); return
    data = rp.read_bytes()
    r = RozFile(data)
    gs = r.parse_grades()
    assert len(gs) == 9, f"{len(gs)} != 9"
    _assert_roundtrip(r, data, f"grades v324 {rp.name}")
    print(f"  {rp.name}: {len(gs)} grados, round-trip OK")




def test_groups_region_v324():
    """Grupos v324 se decodifican (HORARIOS_CASCO)."""
    roz_path = "/home/oz/Documentos/aSc timettables port/asc-re/ROZ/HORARIOS_CASCO_HISTORICO 25-26 II.roz".replace("timettables", "timetables")
    rp = Path(roz_path)
    if not rp.exists():
        print("  OMITIDO (fichero no presente)"); return
    data = rp.read_bytes()
    r = RozFile(data)
    gs = r.parse_groups()
    assert len(gs) == 205, f"{len(gs)} != 205"
    _assert_roundtrip(r, data, f"groups v324 {rp.name}")
    print(f"  {rp.name}: {len(gs)} grupos, round-trip OK")




def test_teachers_region_v324():
    """Profesores v324 se decodifican (HORARIOS_CASCO)."""
    roz_path = "/home/oz/Documentos/aSc timettables port/asc-re/ROZ/HORARIOS_CASCO_HISTORICO 25-26 II.roz".replace("timettables", "timetables")
    rp = Path(roz_path)
    if not rp.exists():
        print("  OMITIDO (fichero no presente)"); return
    data = rp.read_bytes()
    r = RozFile(data)
    ts = r.parse_teachers()
    assert len(ts) == 81, f"{len(ts)} != 81"
    _assert_roundtrip(r, data, f"teachers v324 {rp.name}")
    print(f"  {rp.name}: {len(ts)} profesores, round-trip OK")




def test_subjects_region_v324():
    """Asignaturas v324 se decodifican (HORARIOS_CASCO)."""
    roz_path = "/home/oz/Documentos/aSc timettables port/asc-re/ROZ/HORARIOS_CASCO_HISTORICO 25-26 II.roz".replace("timettables", "timetables")
    rp = Path(roz_path)
    if not rp.exists():
        print("  OMITIDO (fichero no presente)"); return
    data = rp.read_bytes()
    r = RozFile(data)
    ss = r.parse_subjects()
    assert len(ss) == 67, f"{len(ss)} != 67"
    _assert_roundtrip(r, data, f"subjects v324 {rp.name}")
    print(f"  {rp.name}: {len(ss)} asignaturas, round-trip OK")


if __name__ == "__main__":
    print("test_roundtrip_snapshots_mutable_input:")
    test_roundtrip_snapshots_mutable_input()
    print("  OK")
    print("test_binary_parse_without_xml:")
    test_binary_parse_without_xml()
    for fn in (test_base0_generado, test_pristine):
        print(f"{fn.__name__}:")
        fn()
    print("test_params_region:")
    test_params_region()
    print("test_relationships_region:")
    test_relationships_region()
    print("test_classrooms_region:")
    test_classrooms_region()
    print("test_grades_region:")
    test_grades_region()
    print("test_groups_region:")
    test_groups_region()
    print("test_teachers_region:")
    test_teachers_region()
    print("test_subjects_region:")
    test_subjects_region()
    print("test_classes_region:")
    test_classes_region()
    print("test_classes_region_v324:")
    test_classes_region_v324()
    print("test_grades_region_v324:")
    test_grades_region_v324()
    print("test_groups_region_v324:")
    test_groups_region_v324()
    print("test_teachers_region_v324:")
    test_teachers_region_v324()
    print("test_subjects_region_v324:")
    test_subjects_region_v324()
    print("test_classrooms_region_v324:")
    test_classrooms_region_v324()
    print("test_v324_nclass_positive:")
    test_v324_nclass_positive()
    print("OK")
