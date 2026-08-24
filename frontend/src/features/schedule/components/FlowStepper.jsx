// src/features/schedule/components/FlowStepper.jsx
// Stepper del flujo de generación (E8), extraído de pages/Horarios.jsx en E14.
// Marca ✓ cada paso completado según el pre-generation-check (E2).
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

const FLOW_STEPS = [
  { id: 1, label: 'Planificación', desc: 'Periodos, bloques y aulas', path: '/periodos', ready: (pc) => pc && pc.bloques > 0 && pc.aulas > 0 },
  { id: 2, label: 'Recursos', desc: 'Docentes, materias y lecciones', path: '/lecciones', ready: (pc) => pc && pc.lecciones_activas > 0 },
  { id: 3, label: 'Restricciones', desc: 'Disponibilidad y habilitaciones', path: '/docentes/disponibilidad', ready: (pc) => pc && pc.docentes_con_disponibilidad > 0 && pc.docentes_con_habilitacion > 0 },
  { id: 4, label: 'Generar', desc: 'Solver y publicación', path: '/horarios', ready: null, current: true },
];

const FlowStepper = ({ preCheck, demoMode }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-0 overflow-x-auto">
        {FLOW_STEPS.map((step, idx) => {
          const done = !demoMode && !!preCheck && step.ready ? step.ready(preCheck) : false;
          const isCurrent = step.current;
          return (
            <div key={step.id} className="flex items-center flex-1 min-w-[180px]">
              <button
                onClick={() => navigate(step.path)}
                className={`flex items-center gap-3 ${isCurrent ? 'cursor-default' : 'cursor-pointer group'}`}
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                  isCurrent
                    ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20'
                    : done
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}>
                  {done ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </span>
                <div className="text-left">
                  <p className={`text-sm font-bold leading-tight ${isCurrent ? 'text-indigo-700' : 'text-slate-700 group-hover:text-blue-700'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-400">{step.desc}</p>
                </div>
              </button>
              {idx < FLOW_STEPS.length - 1 && (
                <div className="flex-1 h-px bg-slate-200 mx-4 hidden md:block" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlowStepper;
