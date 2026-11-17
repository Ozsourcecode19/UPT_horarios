import { useState } from 'react';
import Pagination from './Pagination';

export default {
  title: 'UI/Pagination',
  component: Pagination,
};

export const Basica = {
  render: () => {
    const [page, setPage] = useState(3);
    return <Pagination currentPage={page} totalPages={10} onPageChange={setPage} />;
  },
};

export const PrimeraPagina = {
  args: { currentPage: 1, totalPages: 10, onPageChange: () => {} },
};

export const UltimaPagina = {
  args: { currentPage: 10, totalPages: 10, onPageChange: () => {} },
};