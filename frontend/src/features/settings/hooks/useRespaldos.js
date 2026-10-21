// src/features/settings/hooks/useRespaldos.js
// Respaldo y restauración de la base de datos local (solo escritorio).
//
// El backend crea/lista/descarga respaldos y valida archivos de
// restauración; la sustitución real del archivo la ejecuta el shell Tauri
// (comando Rust `restaurar_bd`, que detiene el sidecar, reemplaza
// horarios.db y lo relanza — recargando la ventana al terminar).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DatabaseService from '../../../api/database';
import { esEscritorio, invocarComando } from '../../../utils/desktop';
import { marcarReinicioBD, limpiarReinicioBD } from '../../../utils/reinicioBd';
import {
  MSG_RESPALDO_CREADO,
  MSG_RESPALDO_ERROR,
  MSG_RESPALDOS_ERROR,
  MSG_RESTAURACION_INICIADA,
  MSG_RESTAURACION_INVALIDA,
  MSG_RESTAURACION_ERROR,
  MSG_RESTAURACION_SIN_PENDIENTE,
  MSG_RESPALDO_DESCARGA_ERROR,
  MSG_RESPALDO_GUARDADO,
} from '../../../constants/messages';
import { TOAST_DURATION } from '../../../constants';

export function useRespaldos() {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState(null);
  const [restaurando, setRestaurando] = useState(false);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  useEffect(
    () => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); },
    [],
  );

  const {
    data: respaldos = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['respaldos'],
    queryFn: DatabaseService.listarRespaldos,
    enabled: esEscritorio(),
    retry: 0,
  });

  useEffect(() => {
    if (isError) showToast(MSG_RESPALDOS_ERROR, 'error');
  }, [isError, showToast]);

  const crearMutation = useMutation({
    mutationFn: DatabaseService.crearRespaldo,
    onSuccess: () => {
      showToast(MSG_RESPALDO_CREADO, 'success');
      queryClient.invalidateQueries({ queryKey: ['respaldos'] });
    },
    onError: () => showToast(MSG_RESPALDO_ERROR, 'error'),
  });

  const descargar = useCallback(
    async (nombre) => {
      try {
        if (esEscritorio()) {
          // WebKitGTK descarta en silencio las descargas del webview
          // (`a[download]` no guarda nada; wry no conecta download-started).
          // El shell guarda el archivo en Descargas desde Rust.
          const ruta = await invocarComando('descargar_respaldo', { nombre });
          showToast(MSG_RESPALDO_GUARDADO(ruta), 'success');
          return;
        }
        const blob = await DatabaseService.descargarRespaldo(nombre);
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        // No revocar de inmediato: algunos navegadores cancelan la descarga.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } catch {
        showToast(MSG_RESPALDO_DESCARGA_ERROR, 'error');
      }
    },
    [showToast],
  );

  /**
   * Restaura desde un archivo .db: valida con el backend y, si es válido,
   * invoca `restaurar_bd` al shell (que relanza el backend y recarga la
   * ventana). Mientras reinicia, la bandera evita que las peticiones caídas
   * activen el Modo Demo.
   */
  const restaurar = useCallback(
    async (archivo) => {
      setRestaurando(true);
      try {
        await DatabaseService.validarRestauracion(archivo);
      } catch {
        setRestaurando(false);
        showToast(MSG_RESTAURACION_INVALIDA, 'error');
        return;
      }
      marcarReinicioBD();
      try {
        showToast(MSG_RESTAURACION_INICIADA, 'info');
        await invocarComando('restaurar_bd');
      } catch (error) {
        // Sin shell (web) o el shell rechazó (p. ej. sin pendiente).
        limpiarReinicioBD();
        setRestaurando(false);
        showToast(
          String(error).includes('pendiente') ? MSG_RESTAURACION_SIN_PENDIENTE : MSG_RESTAURACION_ERROR,
          'error',
        );
      }
    },
    [showToast],
  );

  return {
    respaldos,
    isLoading,
    restaurando,
    toast,
    crearRespaldo: crearMutation.mutate,
    creando: crearMutation.isPending,
    descargar,
    restaurar,
  };
}

export default useRespaldos;
