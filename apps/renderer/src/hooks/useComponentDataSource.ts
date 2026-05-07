'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ComponentDataSource, DataSourceDef } from '@portal/core'
import { useBindingContext } from '../lib/binding/bindingContext.js'

interface ComponentDataSourceResult {
  data: unknown
  loading: boolean
  error: Error | null
  page: number
  pageSize: number
  total: number
  sortField: string | undefined
  sortDirection: 'asc' | 'desc' | undefined
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setSort: (field: string, direction: 'asc' | 'desc') => void
  refetch: () => void
}

export function useComponentDataSource(
  componentDataSource: ComponentDataSource | undefined,
  pageSources: DataSourceDef[],
  urlParams: Record<string, string>,
): ComponentDataSourceResult {
  const { context, resolver } = useBindingContext()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(
    componentDataSource?.pagination?.defaultPageSize ?? 20,
  )
  const [sortField, setSortField] = useState<string | undefined>(undefined)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<unknown>(null)

  const alias = componentDataSource?.alias

  // Read initial data from binding context (resolved by BindingProvider)
  useEffect(() => {
    if (alias) {
      setData(context.datasource[alias] ?? null)
    }
  }, [alias, context.datasource])

  const fetch = useCallback(async () => {
    if (!alias || !resolver) return
    setLoading(true)
    setError(null)

    // Find the source definition
    const sourceDef = pageSources.find(s => s.alias === alias)
    if (!sourceDef) {
      setLoading(false)
      return
    }

    // Build pagination/sorting query params
    const paginationParams: Record<string, unknown> = {}
    if (componentDataSource?.pagination?.enabled) {
      const pageParam = componentDataSource.pagination.pageParam ?? 'page'
      const pageSizeParam = componentDataSource.pagination.pageSizeParam ?? 'pageSize'
      paginationParams[pageParam] = page
      paginationParams[pageSizeParam] = pageSize
    }

    const sortParams: Record<string, unknown> = {}
    if (componentDataSource?.sorting?.enabled && sortField) {
      const fieldParam = componentDataSource.sorting.fieldParam ?? 'sortField'
      const directionParam = componentDataSource.sorting.directionParam ?? 'sortDirection'
      sortParams[fieldParam] = sortField
      sortParams[directionParam] = sortDirection ?? 'asc'
    }

    // Merge params into source queryParams
    const enhancedSource = {
      ...sourceDef,
      queryParams: {
        ...sourceDef.queryParams,
        ...paginationParams,
        ...sortParams,
      },
    }

    try {
      // Use the resolver to re-fetch with updated params
      const patchedSources = pageSources.map(s =>
        s.alias === alias ? enhancedSource : s,
      )
      await resolver.resolveSourceByAlias(alias, patchedSources, urlParams)
      setData(resolver.resolvedData[alias] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [alias, resolver, page, pageSize, sortField, sortDirection, componentDataSource, pageSources, urlParams])

  function handleSetSort(field: string, direction: 'asc' | 'desc'): void {
    setSortField(field)
    setSortDirection(direction)
  }

  // Refetch when page/sort changes (after initial mount)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    void fetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortField, sortDirection])

  return {
    data,
    loading,
    error,
    page,
    pageSize,
    total: 0, // Total comes from API response; components parse it from data
    sortField,
    sortDirection,
    setPage,
    setPageSize,
    setSort: handleSetSort,
    refetch: () => { void fetch() },
  }
}
