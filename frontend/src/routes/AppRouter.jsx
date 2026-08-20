// src/routes/AppRouter.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Docentes from '../pages/Docentes';
import DocenteDisponibilidadPage from '../pages/DocenteDisponibilidadPage';
import DocenteHabilitacionesPage from '../pages/DocenteHabilitacionesPage';
import Materias from '../pages/Materias';
import Aulas from '../pages/Aulas';
import Trayectos from '../pages/Trayectos';
import Carreras from '../pages/Carreras';
import Horarios from '../pages/Horarios';
import Periodos from '../pages/Periodos';
import Settings from '../pages/Settings';
import Lecciones from '../pages/Lecciones';
import BloquesHorarios from '../pages/BloquesHorarios';
import MainLayout from '../components/layout/MainLayout';

const AppRouter = () => {
  return (
    <Routes>
      {/* Rutas Públicas */}
      <Route path="/login" element={<Login />} />

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
          <Route path="/carreras" element={<Carreras />} />
          <Route path="/trayectos" element={<Trayectos />} />
          <Route path="/lecciones" element={<Lecciones />} />
          <Route path="/periodos" element={<Periodos />} />
          <Route path="/bloques" element={<BloquesHorarios />} />
          <Route path="/horarios" element={<Horarios />} />
          <Route path="/configuracion" element={<Settings />} />
        </Route>
      </Route>

      {/* Ruta 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRouter;