// src/components/ui/__tests__/modalShell.test.jsx
// Shell compartido de modales (opción A): panel con tope de altura, cabecera
// y pie fijos, cuerpo con scroll interno — formularios largos nunca se
// recortan fuera del viewport.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModalShell from '../ModalShell';

const header = <h3>Título de Prueba</h3>;
const footer = <button type="submit">Guardar</button>;

describe('ModalShell', () => {
  it('renderiza header, cuerpo y footer', () => {
    render(
      <ModalShell onSubmit={vi.fn()} header={header} footer={footer}>
        <input aria-label="campo" />
      </ModalShell>
    );
    expect(screen.getByText('Título de Prueba')).toBeInTheDocument();
    expect(screen.getByLabelText('campo')).toBeInTheDocument();
    expect(screen.getByText('Guardar')).toBeInTheDocument();
  });

  it('limita la altura del panel y el cuerpo hace scroll interno', () => {
    render(
      <ModalShell onSubmit={vi.fn()} header={header} footer={footer}>
        <span>contenido</span>
      </ModalShell>
    );
    const scroll = screen.getByText('contenido').parentElement;
    expect(scroll.className).toContain('overflow-y-auto');
    expect(scroll.className).toContain('overscroll-contain');
    // El panel lleva el tope de altura (bisabuelo: panel > form > cuerpo)
    expect(scroll.parentElement.parentElement.className).toContain('max-h-[calc(100dvh-2rem)]');
  });

  it('el footer queda fuera del área scrolleable (siempre visible)', () => {
    render(
      <ModalShell onSubmit={vi.fn()} header={header} footer={footer}>
        <span>contenido</span>
      </ModalShell>
    );
    const scroll = screen.getByText('contenido').parentElement;
    const footerWrap = screen.getByText('Guardar').parentElement;
    // Hermanos dentro del form: cuerpo scrolleable y pie fijo
    expect(footerWrap.parentElement).toBe(scroll.parentElement);
    expect(footerWrap.className).toContain('shrink-0');
  });

  it('onSubmit se dispara al enviar el form (botón submit del footer)', () => {
    const onSubmit = vi.fn();
    render(
      <ModalShell onSubmit={onSubmit} header={header} footer={footer}>
        <span>contenido</span>
      </ModalShell>
    );
    fireEvent.click(screen.getByText('Guardar'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin onSubmit el contenido va sin <form> (modales de solo lectura)', () => {
    render(
      <ModalShell header={header} footer={<button type="button">Cerrar</button>}>
        <span>solo lectura</span>
      </ModalShell>
    );
    expect(document.querySelector('form')).toBeNull();
    expect(screen.getByText('solo lectura')).toBeInTheDocument();
  });
});
