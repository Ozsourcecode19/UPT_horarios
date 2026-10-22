// src/features/settings/hooks/useSettingsData.js
// Hook que encapsula las 4 queries de Settings + modo demo.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ConfiguracionesService from '../../../api/configuraciones';
import UsuariosService from '../../../api/usuarios';
import DatabaseService from '../../../api/database';
import { useDemo } from '../../../context/DemoContext';
import { useActivarDemoPorError, useReconectarDemo } from '../../../hooks/useActivarDemoPorError';
import { MOCK_CONFIGURACIONES } from '../demoData';
import { MSG_SERVIDOR_DESCONECTADO, MSG_RECONECTANDO_API } from '../../../constants/messages';
import { TOAST_DURATION, FETCH_ALL_LIMIT } from '../../../constants';

export function useSettingsData() {
  const queryClient = useQueryClient();
  const { demoMode, setDemoMode } = useDemo();
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  const [demoConfigs, setDemoConfigs] = useState(() => {
    try {
      const saved = localStorage.getItem('demo_configuraciones');
      return saved ? JSON.parse(saved) : MOCK_CONFIGURACIONES;
    } catch { return MOCK_CONFIGURACIONES; }
  });

  useEffect(() => { localStorage.setItem('demo_configuraciones', JSON.stringify(demoConfigs)); }, [demoConfigs]);

  const { data: configsReal = [], isLoading: isConfigsLoading, isError: isConfigsError, error: configsError, errorUpdatedAt: configsErrorUpdatedAt, refetch: refetchConfigs } = useQuery({
    queryKey: ['configuraciones'],
    queryFn: async () => { const res = await ConfiguracionesService.getConfiguraciones(0, FETCH_ALL_LIMIT); return res.items || res || []; },
    enabled: !demoMode, retry: 0,
  });

  useActivarDemoPorError({
    sondas: [{ isError: isConfigsError, error: configsError, errorUpdatedAt: configsErrorUpdatedAt }],
    showToast,
    mensajeDesconectado: MSG_SERVIDOR_DESCONECTADO,
  });

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const { data: usuariosData = { items: [], total: 0 }, isLoading: isUsuariosLoading, refetch: refetchUsuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => await UsuariosService.getUsuarios(0, 100, null),
    enabled: !demoMode, retry: 0,
  });

  const { data: dbHealth, isLoading: isDbHealthLoading, refetch: refetchDbHealth } = useQuery({
    queryKey: ['database-health'],
    queryFn: () => DatabaseService.getHealth(),
    enabled: !demoMode, retry: 0,
  });

  const { data: notifConfigs = [], isLoading: isNotifLoading, refetch: refetchNotifConfigs } = useQuery({
    queryKey: ['configuraciones-notif'],
    queryFn: async () => {
      const res = await ConfiguracionesService.getConfiguraciones(0, 100, null);
      const items = res.items || res || [];
      return items.filter(c => ['smtp_server', 'smtp_port', 'smtp_username', 'smtp_use_tls', 'notificaciones_email_generacion', 'notificaciones_email_errores'].includes(c.clave));
    },
    enabled: !demoMode, retry: 0,
  });

  const reconectarApi = useReconectarDemo({
    refetches: [refetchConfigs, refetchUsuarios, refetchDbHealth, refetchNotifConfigs],
    showToast,
    mensaje: MSG_RECONECTANDO_API,
  });

  return {
    demoMode, setDemoMode, toast, showToast,
    configs: demoMode ? demoConfigs : configsReal,
    setDemoConfigs,
    isConfigsLoading,
    usuarios: usuariosData.items || [],
    isUsuariosLoading, refetchUsuarios,
    dbHealth, isDbHealthLoading, refetchDbHealth,
    notifConfigs, isNotifLoading, refetchNotifConfigs,
    refetchConfigs, reconectarApi, queryClient,
  };
}
