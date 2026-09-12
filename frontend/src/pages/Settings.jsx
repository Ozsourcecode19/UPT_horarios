import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings as SettingsIcon } from 'lucide-react';
import ConfiguracionesService from '../api/configuraciones';
import { useAuth } from '../context/AuthContext';
import {
  useSettingsData, useUsuariosCrud,
  buildDefaultValues, buildZodSchema, buildPayload,
  WIDGETS, CLAVE_GRUPO, GRUPOS, GRUPO_NOTAS,
  Toast, DemoBanner, SettingsTabs,
  AlgoritmoTab, UsuariosTab, BaseDatosTab, NotificacionesTab,
  UserFormModal, ConfirmDeleteUserModal,
} from '../features/settings';

const Settings = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('algoritmo');

  const {
    demoMode, setDemoMode, toast, showToast,
    configs, setDemoConfigs,
    isConfigsLoading,
    usuarios, isUsuariosLoading, refetchUsuarios,
    dbHealth, isDbHealthLoading, refetchDbHealth,
    notifConfigs, isNotifLoading, refetchNotifConfigs,
    refetchConfigs, queryClient,
  } = useSettingsData();

  const { handleSaveUser, handleDeleteUser } = useUsuariosCrud({ showToast, refetchUsuarios });

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState(null);

  const [notifForm, setNotifForm] = useState({
    smtp_server: '',
    smtp_port: '587',
    smtp_username: '',
    smtp_password: '',
    smtp_use_tls: true,
    notificaciones_email_generacion: false,
    notificaciones_email_errores: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    if (notifConfigs.length > 0) {
      const map = {};
      for (const c of notifConfigs) { map[c.clave] = c.valor; }
      setNotifForm(prev => ({
        ...prev,
        smtp_server: map.smtp_server ?? '',
        smtp_port: String(map.smtp_port ?? '587'),
        smtp_username: map.smtp_username ?? '',
        smtp_use_tls: map.smtp_use_tls ?? true,
        notificaciones_email_generacion: map.notificaciones_email_generacion ?? false,
        notificaciones_email_errores: map.notificaciones_email_errores ?? false,
      }));
    }
  }, [notifConfigs]);

  const editables = configs.filter(c => c.editable);
  const readonlys = configs.filter(c => !c.editable);

  const groupedEditables = useMemo(() => {
    const byGroup = {};
    for (const c of editables) {
      const g = CLAVE_GRUPO[c.clave] || 'otros';
      (byGroup[g] = byGroup[g] || []).push(c);
    }
    const groups = GRUPOS
      .filter(g => byGroup[g.id])
      .map(g => ({ ...g, items: byGroup[g.id] }));
    if (byGroup['otros']) {
      groups.push({ id: 'otros', label: 'Otros parámetros', descripcion: 'Claves de configuración sin tema asignado.', icon: SettingsIcon, items: byGroup['otros'] });
    }
    return groups;
  }, [editables]);

  const defaultValues = useMemo(() => buildDefaultValues(configs), [configs]);
  const zodSchema = useMemo(() => buildZodSchema(configs), [configs]);

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(zodSchema), defaultValues });

  useEffect(() => { reset(defaultValues); }, [defaultValues, reset]);

  const handleSave = async (data) => {
    if (demoMode) {
      setDemoConfigs(prev => prev.map(c => c.editable ? { ...c, valor: buildPayload(c.clave, data[c.clave]), updated_at: new Date().toISOString() } : c));
      showToast("Configuración guardada exitosamente en Modo Demo");
      return;
    }
    try {
      await Promise.all(editables.map(c =>
        ConfiguracionesService.updateConfiguracion(c.clave, { valor: buildPayload(c.clave, data[c.clave]) })
      ));
      queryClient.invalidateQueries({ queryKey: ['configuraciones'] });
      showToast("Configuración guardada exitosamente");
    } catch (err) {
      showToast("Error al guardar la configuración en el servidor", "error");
    }
  };

  const toggleDia = (dia) => {
    const current = watch('dias_laborables') || [];
    const next = current.includes(dia) ? current.filter(d => d !== dia) : [...current, dia];
    setValue('dias_laborables', next, { shouldValidate: true, shouldDirty: true });
  };

  const openAddUser = () => { setEditingUser(null); setUserModalOpen(true); };
  const openEditUser = (u) => { setEditingUser(u); setUserModalOpen(true); };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 py-6 relative">
      {demoMode && <DemoBanner onReconnect={() => { setDemoMode(false); refetchConfigs(); showToast("Intentando conectar con API real...", "info"); }} description="Operando con la configuración de prueba en almacenamiento local." />}
      <Toast toast={toast} />

      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-extrabold text-slate-800">Configuración del Sistema</h2>
        <p className="text-slate-500">Administra los parámetros generales del algoritmo de horarios y preferencias globales.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
          {activeTab === 'algoritmo' && (
            <AlgoritmoTab
              groupedEditables={groupedEditables} readonlys={readonlys}
              register={register} watch={watch} setValue={setValue} errors={errors}
              handleSubmit={handleSubmit} handleSave={handleSave}
              reset={reset} defaultValues={defaultValues} isDirty={isDirty}
              isAdmin={isAdmin} user={user}
              isConfigsLoading={isConfigsLoading} demoMode={demoMode} toggleDia={toggleDia}
            />
          )}

          {activeTab === 'seguridad' && (
            <UsuariosTab
              usuarios={usuarios} isUsuariosLoading={isUsuariosLoading}
              isAdmin={isAdmin} user={user}
              onAdd={openAddUser} onEdit={openEditUser}
              onDelete={setDeleteUserConfirm}
            />
          )}

          {activeTab === 'base-datos' && (
            <BaseDatosTab dbHealth={dbHealth} isDbHealthLoading={isDbHealthLoading} onRefresh={refetchDbHealth} />
          )}

          {activeTab === 'notificaciones' && (
            <NotificacionesTab
              notifForm={notifForm} setNotifForm={setNotifForm}
              notifSaving={notifSaving} setNotifSaving={setNotifSaving}
              isAdmin={isAdmin} user={user}
              isNotifLoading={isNotifLoading} showToast={showToast}
              refetchNotifConfigs={refetchNotifConfigs}
            />
          )}
        </div>
      </div>

      <UserFormModal
        isOpen={userModalOpen} editingUser={editingUser}
        onSave={async (data) => {
          const result = await handleSaveUser(data, editingUser);
          if (result === true) setUserModalOpen(false);
          else return result;
        }}
        onClose={() => setUserModalOpen(false)}
      />

      <ConfirmDeleteUserModal
        user={deleteUserConfirm}
        onConfirm={async () => {
          const ok = await handleDeleteUser(deleteUserConfirm);
          if (ok) setDeleteUserConfirm(null);
        }}
        onCancel={() => setDeleteUserConfirm(null)}
      />
    </div>
  );
};

export default Settings;
