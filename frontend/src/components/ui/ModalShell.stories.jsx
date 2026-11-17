import ModalShell from './ModalShell';

export default {
  title: 'UI/ModalShell',
  component: ModalShell,
  args: {
    header: <div className="p-4 font-bold">Título del modal</div>,
    footer: <div className="p-4 text-right"><button className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button></div>,
    children: <p>Contenido del cuerpo del modal.</p>,
  },
};

export const Basico = {};

export const ConFormulario = {
  args: {
    onSubmit: (e) => { e.preventDefault(); alert('enviado'); },
  },
};

export const AnchoGrande = {
  args: { maxWidth: 'max-w-2xl' },
};