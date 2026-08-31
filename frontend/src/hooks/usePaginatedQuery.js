import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

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
