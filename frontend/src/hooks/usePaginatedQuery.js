import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

/**
 * Hook genérico de consulta paginada con TanStack Query.
 * @template T - Tipo de los elementos del listado
 * @param {string[]} queryKey - Clave de caché de React Query
 * @param {(skip: number, limit: number, search?: string) => Promise<import('../types/api').PaginatedResponse<T>>} fetchFn - Función que retorna { items, total, ... }
 * @param {object} [opts]
 * @param {number} [opts.pageSize=20] - Cantidad de elementos por página
 * @param {string} [opts.searchTerm=''] - Término de búsqueda (resetea a página 1)
 * @param {unknown[]} [opts.resetOn=[]] - Dependencias adicionales que resetean la página a 1
 * @returns {{
 *   items: T[],
 *   total: number,
 *   totalPages: number,
 *   page: number,
 *   setPage: (p: number) => void,
 *   isLoading: boolean,
 *   isError: boolean,
 * }}
 */
export default function usePaginatedQuery(queryKey, fetchFn, { pageSize = 20, searchTerm = '', resetOn = [] } = {}) {
  const [page, setPage] = useState(1);
  const skip = (page - 1) * pageSize;

  useEffect(() => {
    setPage(1);
  }, [searchTerm, ...resetOn]);

  const { data, isLoading, isError } = useQuery({
    queryKey: [...queryKey, skip, pageSize, searchTerm],
    queryFn: () => fetchFn(skip, pageSize, searchTerm || undefined),
    placeholderData: keepPreviousData,
    retry: 0,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return {
    items: data?.items ?? [],
    total,
    totalPages,
    page,
    setPage,
    isLoading,
    isError,
  };
}
