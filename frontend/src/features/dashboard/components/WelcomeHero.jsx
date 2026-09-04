// src/features/dashboard/components/WelcomeHero.jsx

export default function WelcomeHero({ username }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-10 text-white shadow-xl shadow-blue-600/20">
      <div className="relative z-10">
        <h2 className="text-3xl sm:text-4xl font-bold mb-2">
          {username ? `Bienvenido, ${username}` : 'Bienvenido al Sistema UPT'}
        </h2>
        <p className="text-blue-100 text-lg max-w-xl">
          Gestiona de forma inteligente los horarios, docentes y aulas de la institución. Todo en un solo lugar.
        </p>
      </div>
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-20 -mb-20 w-72 h-72 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />
    </div>
  );
}
