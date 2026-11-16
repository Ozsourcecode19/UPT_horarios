// src/routes/AppRouter.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleGate from './RoleGate';
import Login from '../pages/Login';
import Presentacion from '../pages/Presentacion';
import Dashboard from '../pages/Dashboard';
import Docentes from '../pages/Docentes';
import DocenteDisponibilidadPage from '../pages/DocenteDisponibilidadPage';
import DocenteHabilitacionesPage from '../pages/DocenteHabilitacionesPage';
import Materias from '../pages/Materias';
import Aulas from '../pages/Aulas';
import Carreras from '../pages/Carreras';
import Trayectos from '../pages/Trayectos';
import Horarios from '../pages/Horarios';
import Periodos from '../pages/Periodos';
import Settings from '../pages/Settings';
import Lecciones from '../pages/Lecciones';
import BloquesHorarios from '../pages/BloquesHorarios';
import ImportarRoz from '../pages/ImportarRoz';
import MainLayout from '../components/layout/MainLayout';

const AppRouter = () => {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/presentacion" element={<Presentacion />} />
      <Route path="/inicio" element={<Navigate to="/presentacion" replace />} />

      {/* Rutas Protegidas (Usan el MainLayout) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/docentes" element={<Docentes />} />
          <Route path="/docentes/disponibilidad" element={<DocenteDisponibilidadPage />} />
          <Route path="/docentes/habilitaciones" element={<DocenteHabilitacionesPage />} />
          <Route path="/materias" element={<Materias />} />
          <Route path="/aulas" element={<Aulas />} />

          {/* Rutas de gestión: solo roles con permisos de escritura según navigation.js */}
          <Route element={<RoleGate />}>
            <Route path="/carreras" element={<Carreras />} />
            <Route path="/trayectos" element={<Trayectos />} />
            <Route path="/lecciones" element={<Lecciones />} />
            <Route path="/periodos" element={<Periodos />} />
            <Route path="/bloques" element={<BloquesHorarios />} />
            <Route path="/horarios" element={<Horarios />} />
            <Route path="/importar-roz" element={<ImportarRoz />} />
            <Route path="/configuracion" element={<Settings />} />
          </Route>
        </Route>
      </Route>

      {/* Ruta 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRouter;