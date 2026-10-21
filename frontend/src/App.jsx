import AppRouter from './routes/AppRouter';
import AcercaDeModal from './components/ui/AcercaDeModal';

function App() {
  return (
    <>
      <AppRouter />
      {/* Escritorio: modal "Acerca de" del menú nativo (no-op en la web). */}
      <AcercaDeModal />
    </>
  );
}

export default App;
