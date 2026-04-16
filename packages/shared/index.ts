import { createSupabase as factory } from './supabaseClient';
import { cn as utilsCn } from './utils';

export const createSupabase = factory;
export const cn = utilsCn;
export * from './types';
