import {
  MainCategory,
  TransactionType,
  PropertyType,
  RollingStockCategory,
  JobAdKind,
  DomesticJobType,
  TutoringAdKind,
  TutoringSubject,
  TutoringLevel,
  NecrologieMinistry,
  AvisRechercheCategory,
  AutresEmploisSubCategory,
  BricABracCategory,
  EventType,
  PriceUnit,
  SubscriptionTier,
} from '../../../types';

export interface CategorySchemaField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'date' | 'time' | 'textarea' | 'checkbox';
  required?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
  helperText?: string;
}

export interface CategorySchema<T = any> {
  category: MainCategory;
  label: string;
  fields: CategorySchemaField[];
  defaultValues: T;
  validate: (values: T) => Record<string, string>;
  generateTitle?: (values: T, locationText: string) => string;
}

export function getMaxPhotosAllowed(tier?: SubscriptionTier | null): number {
  switch (tier) {
    case 'BUSINESS':
      return 5;
    case 'ELITE':
      return 4;
    case 'PRO':
    case 'STANDARD':
    default:
      return 3;
  }
}

