import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRouteRoles, isRoleAllowed } from '../config/navigation';
import {
  useDashboardData,
  Toast, DemoBanner, WelcomeHero, StatsGrid, AnalyticsPanels, QuickActions,
  ACCIONES_RAPIDAS,
} from '../features/dashboard';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    demoMode, setDemoMode, toast, showToast,
    stats, cargaPorDocente, distribucionMaterias, saludPeriodo,
    isDocentesPending, isMateriasPending, isAulasPending, isPeriodosPending, isHorariosPending,
    periodoVigente,
    reconectarApi,
  } = useDashboardData();

  const accionesVisibles = ACCIONES_RAPIDAS.filter(a => isRoleAllowed(getRouteRoles(a.path), user?.role));

  const accionRapida = (path) => {
    if (demoMode) { showToast("Conecta la API real para operar con datos del servidor.", 'info'); return; }
    navigate(path);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {demoMode && <DemoBanner onReconnect={reconectarApi} description="Operando con estadísticas de prueba en almacenamiento local." />}
      <Toast toast={toast} />
      <WelcomeHero username={user?.username} />
      <StatsGrid stats={stats} demoMode={demoMode} isDocentesPending={isDocentesPending} isMateriasPending={isMateriasPending} isAulasPending={isAulasPending} isPeriodosPending={isPeriodosPending} isHorariosPending={isHorariosPending} periodoVigente={periodoVigente} />
      {!demoMode && periodoVigente && <AnalyticsPanels cargaPorDocente={cargaPorDocente} distribucionMaterias={distribucionMaterias} saludPeriodo={saludPeriodo} />}
      <QuickActions acciones={accionesVisibles} onNavigate={accionRapida} />
    </div>
  );
};

export default Dashboard;
