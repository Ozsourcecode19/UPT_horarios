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
      showToast("No tienes permisos para crear o editar secciones.", "error");
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
        showToast("Sección actualizada con éxito (Modo Demo)");
      } else {
        const nuevoGrupo = {
          id: Math.max(...demoGrupos.map(g => g.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoGrupos(prev => [nuevoGrupo, ...prev]);
        showToast("Sección registrada de manera local (Modo Demo)");
      }
      return true;
    }

    try {
      if (editing) {
        await servicios.grupos.updateGrupo(editing.id, formattedData);
        showToast("Sección actualizada exitosamente");
      } else {
        await servicios.grupos.createGrupo(formattedData);
        showToast("Sección registrada exitosamente");
      }
      onInvalidateGrupos();
      return true;
    } catch (err) {
      console.error(err);
      showToast("Error al guardar sección en el servidor", "error");
      return false;
    }
  };

  // GUARDAR LECCIÓN (crear o editar segun `editing`)
  const handleSaveLeccion = async (data, editing = null) => {
    if (!puedeEscribir) {
      showToast("No tienes permisos para crear o editar clases.", "error");
      return false;
    }
    const formattedData = toPayloadLeccion(data);
    // R3: cambiar N/M archiva las sesiones ACTIVO de la clase (backend).
    const cambioEstructura = !!editing && (
      Number(formattedData.bloques_por_sesion) !== Number(editing.bloques_por_sesion ?? 1) ||
      Number(formattedData.sesiones_semana) !== Number(editing.sesiones_semana ?? 1)
    );

    if (demoMode) {
      if (editing) {
        setDemoLecciones(prev => prev.map(l => l.id === editing.id ? {
          ...l,
          ...formattedData,
          updated_at: new Date().toISOString()
        } : l));
        showToast(cambioEstructura
          ? "Clase actualizada. El nuevo tamaño se aplicará al regenerar el horario (Modo Demo)"
          : "Clase actualizada con éxito (Modo Demo)");
      } else {
        const nuevaLeccion = {
          id: Math.max(...demoLecciones.map(l => l.id), 0) + 1,
          ...formattedData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setDemoLecciones(prev => [nuevaLeccion, ...prev]);
        showToast("Clase registrada de manera local (Modo Demo)");
      }
      return true;
    }

    try {
      if (editing) {
        await servicios.lecciones.updateLeccion(editing.id, formattedData);
        showToast(cambioEstructura
          ? "Clase actualizada. Las sesiones anteriores quedaron archivadas; el nuevo tamaño se aplicará al regenerar el horario"
          : "Clase actualizada exitosamente");
      } else {
        await servicios.lecciones.createLeccion(formattedData);
        showToast("Clase registrada exitosamente");
      }
      onInvalidateLecciones();
      return true;
    } catch (err) {
      console.error(err);
      // R0: periodo incoherente con la Sección → 422 con mensaje propio.
      if (err?.response?.status === 422) {
        const detalle = err.response.data?.detail;
        const mensaje = typeof detalle === 'string'
          ? detalle
          : (detalle?.mensaje || 'Datos inválidos al guardar la clase.');
        showToast(mensaje, "error");
        return false;
      }
      showToast("Error al guardar clase en el servidor", "error");
      return false;
    }
  };

  // ELIMINAR GRUPO (con guard de lecciones vinculadas)
  const handleDeleteGrupo = async (grupo = null) => {
    if (!grupo) return false;

    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar secciones.", "error");
      return false;
    }

    // Verificar si el grupo tiene lecciones asociadas en el listado activo
    const leccionesVinculadas = listadoLecciones.filter(l => l.grupo_id === grupo.id);
    if (leccionesVinculadas.length > 0) {
      showToast(`No es posible eliminar la sección: tiene ${leccionesVinculadas.length} clase(s) vinculada(s).`, "error");
      return false;
    }

    if (demoMode) {
      setDemoGrupos(prev => prev.filter(g => g.id !== grupo.id));
      showToast("Sección eliminada con éxito (Modo Demo)", "info");
      return true;
    }

    try {
      await servicios.grupos.deleteGrupo(grupo.id);
      onInvalidateGrupos();
      showToast("Sección eliminada exitosamente", "info");
      return true;
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar sección del servidor", "error");
      return false;
    }
  };

  // ELIMINAR LECCIÓN
  const handleDeleteLeccion = async (leccion = null) => {
    if (!leccion) return false;

    if (!puedeEscribir) {
      showToast("No tienes permisos para eliminar clases.", "error");
      return false;
    }

    if (demoMode) {
      setDemoLecciones(prev => prev.filter(l => l.id !== leccion.id));
      showToast("Clase eliminada con éxito (Modo Demo)", "info");
      return true;
    }

    try {
      await servicios.lecciones.deleteLeccion(leccion.id);
      onInvalidateLecciones();
      showToast("Clase eliminada exitosamente", "info");
      return true;
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar clase del servidor", "error");
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
