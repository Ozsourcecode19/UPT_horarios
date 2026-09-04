// src/features/planning/hooks/useLeccionesCrud.js
// Receta CRUD dual de Grupos y Lecciones, extraida de pages/Lecciones.jsx (E16).
// Encapsula guardar/eliminar en modo real y Modo Demo con servicios inyectables
// para poder testearla de forma aislada. Los handlers devuelven true si la
// operacion se aplico (la pagina cierra el modal en ese caso).

import GruposService from '../../../api/grupos';
import LeccionesService from '../../../api/lecciones';
import { toPayloadGrupo, toPayloadLeccion } from '../schemas';

/**
 * Receta CRUD dual de Grupos y Lecciones. Servicios inyectables para testing.
 * Los handlers devuelven true si la operación se aplicó.
 * @param {object} params
 * @param {boolean} params.demoMode - Si true, aplica cambios localmente
 * @param {boolean} [params.puedeEscribir=true] - Si false, bloquea crear/editar/eliminar
 * @param {(msg: string, type?: string) => void} [params.showToast] - Feedback visual
 * @param {import('../../types/entities').Grupo[]} [params.demoGrupos] - Grupos del modo demo
 * @param {React.Dispatch<React.SetStateAction<import('../../types/entities').Grupo[]>>} [params.setDemoGrupos] - Setter de grupos demo
 * @param {import('../../types/entities').Leccion[]} [params.demoLecciones] - Lecciones del modo demo
 * @param {React.Dispatch<React.SetStateAction<import('../../types/entities').Leccion[]>>} [params.setDemoLecciones] - Setter de lecciones demo
 * @param {import('../../types/entities').Leccion[]} [params.listadoLecciones] - Listado activo (guard de eliminación)
 * @param {() => void} [params.onInvalidateGrupos] - Invalidación de queries de grupos
 * @param {() => void} [params.onInvalidateLecciones] - Invalidación de queries de lecciones
 * @param {{ grupos: typeof GruposService, lecciones: typeof LeccionesService }} [params.servicios] - Servicios inyectables
 * @returns {{
 *   handleSaveGrupo: (data: object, editing?: import('../../types/entities').Grupo | null) => Promise<boolean>,
 *   handleSaveLeccion: (data: object, editing?: import('../../types/entities').Leccion | null) => Promise<boolean>,
 *   handleDeleteGrupo: (grupo?: import('../../types/entities').Grupo | null) => Promise<boolean>,
 *   handleDeleteLeccion: (leccion?: import('../../types/entities').Leccion | null) => Promise<boolean>,
 * }}
 */
export const useLeccionesCrud = ({
  demoMode,
  puedeEscribir = true,
  showToast = () => {},
  demoGrupos = [],
  setDemoGrupos = () => {},
  demoLecciones = [],
  setDemoLecciones = () => {},
  listadoLecciones = [], // para el guard de grupo con lecciones vinculadas
  onInvalidateGrupos = () => {},
  onInvalidateLecciones = () => {},
  servicios = { grupos: GruposService, lecciones: LeccionesService },
}) => {
  // GUARDAR GRUPO (crear o editar segun `editing`)
  const handleSaveGrupo = async (data, editing = null) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para crear o editar grupos.", "error");
      return false;
    }
    const formattedData = toPayloadGrupo(data);

    if (demoMode) {
      if (editing) {
        setDemoGrupos(prev => prev.map(g => g.id === editing.id ? {
          ...g,
          ...formattedData,
          updated_at: new Date().toISOString()
        } : g));
        showToast("Grupo de alumnos actualizado con éxito (Modo Demo)");
      } else {
        const nuevoGrupo = {
          id: Math.max(...demoGrupos.map(g => g.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoGrupos(prev => [nuevoGrupo, ...prev]);
        showToast("Grupo registrado de manera local (Modo Demo)");
      }
      return true;
    }

    try {
      if (editing) {
        await servicios.grupos.updateGrupo(editing.id, formattedData);
        showToast("Grupo de alumnos actualizado exitosamente");
      } else {
        await servicios.grupos.createGrupo(formattedData);
        showToast("Grupo registrado exitosamente");
      }
      onInvalidateGrupos();
      return true;
    } catch (err) {
      console.error(err);
      showToast("Error al guardar grupo en el servidor", "error");
      return false;
    }
  };

  // GUARDAR LECCIÓN (crear o editar segun `editing`)
  const handleSaveLeccion = async (data, editing = null) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para crear o editar lecciones.", "error");
      return false;
    }
    const formattedData = toPayloadLeccion(data);

    if (demoMode) {
      if (editing) {
        setDemoLecciones(prev => prev.map(l => l.id === editing.id ? {
          ...l,
          ...formattedData,
          updated_at: new Date().toISOString()
        } : l));
        showToast("Lección académica actualizada con éxito (Modo Demo)");
      } else {
        const nuevaLeccion = {
          id: Math.max(...demoLecciones.map(l => l.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoLecciones(prev => [nuevaLeccion, ...prev]);
        showToast("Lección registrada de manera local (Modo Demo)");
      }
      return true;
    }

    try {
      if (editing) {
        await servicios.lecciones.updateLeccion(editing.id, formattedData);
        showToast("Lección académica actualizada exitosamente");
      } else {
        await servicios.lecciones.createLeccion(formattedData);
        showToast("Lección registrada exitosamente");
      }
      onInvalidateLecciones();
      return true;
    } catch (err) {
      console.error(err);
      showToast("Error al guardar lección en el servidor", "error");
      return false;
    }
  };

  // ELIMINAR GRUPO (con guard de lecciones vinculadas)
  const handleDeleteGrupo = async (grupo = null) => {
    if (!grupo) return false;

    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar grupos.", "error");
      return false;
    }

    // Verificar si el grupo tiene lecciones asociadas en el listado activo
    const leccionesVinculadas = listadoLecciones.filter(l => l.grupo_id === grupo.id);
    if (leccionesVinculadas.length > 0) {
      showToast(`No es posible eliminar el grupo: tiene ${leccionesVinculadas.length} lección(es) académica(s) vinculada(s).`, "error");
      return false;
    }

    if (demoMode) {
      setDemoGrupos(prev => prev.filter(g => g.id !== grupo.id));
      showToast("Grupo eliminado con éxito (Modo Demo)", "info");
      return true;
    }

    try {
      await servicios.grupos.deleteGrupo(grupo.id);
      onInvalidateGrupos();
      showToast("Grupo de alumnos eliminado exitosamente", "info");
      return true;
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar grupo del servidor", "error");
      return false;
    }
  };

  // ELIMINAR LECCIÓN
  const handleDeleteLeccion = async (leccion = null) => {
    if (!leccion) return false;

    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar lecciones.", "error");
      return false;
    }

    if (demoMode) {
      setDemoLecciones(prev => prev.filter(l => l.id !== leccion.id));
      showToast("Lección académica eliminada con éxito (Modo Demo)", "info");
      return true;
    }

    try {
      await servicios.lecciones.deleteLeccion(leccion.id);
      onInvalidateLecciones();
      showToast("Lección académica eliminada exitosamente", "info");
      return true;
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar lección del servidor", "error");
      return false;
    }
  };

  return {
    handleSaveGrupo,
    handleSaveLeccion,
    handleDeleteGrupo,
    handleDeleteLeccion,
  };
};

export default useLeccionesCrud;
