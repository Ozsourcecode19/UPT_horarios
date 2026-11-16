"""Router para importar archivos .roz (aSc Timetables 2017)."""
import os
import tempfile
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from config.database import get_db
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/importacion", tags=["Importacion"])

_ASC_RE = os.environ.get("ASC_RE_PATH", "/home/oz/Documentos/aSc timetables port/asc-re")


@router.post("/roz", dependencies=[Depends(require_role(["ADMIN", "JEFE-PNF"]))])
async def importar_archivo_roz(archivo: UploadFile = File(...), db: Session = Depends(get_db)):
    """Importa un archivo .roz y crea las entidades en UPT.

    Retorna un resumen con los conteos de entidades creadas.
    """
    if not archivo.filename or not archivo.filename.lower().endswith(".roz"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extension .roz")

    # Guardar el archivo en un temporal
    fd, tmp_path = tempfile.mkstemp(suffix=".roz")
    try:
        contenido = await archivo.read()
        with os.fdopen(fd, "wb") as f:
            f.write(contenido)

        # Importar ascroz si no esta disponible
        if _ASC_RE not in __import__("sys").path:
            __import__("sys").path.insert(0, _ASC_RE)

        from services.importador_roz import importar_roz
        resumen = importar_roz(db, tmp_path)
        return resumen
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al importar: {e}")
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass