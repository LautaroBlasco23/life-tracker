'use client';

import { useState, useEffect, useCallback } from 'react';
import { financeService } from '@shared/services/finance-service';
import type { Category } from '@shared/types';

export function useFinanceCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const loadCategories = useCallback(async () => {
    try {
      const allCategories = await financeService.getCategories();
      setCategories(allCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return categories;
}
