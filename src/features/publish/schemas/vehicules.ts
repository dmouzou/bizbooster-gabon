import { CategorySchema } from './types';
import { RollingStockCategory, TransactionType } from '../../../types';
import { CAR_BRANDS_AND_MODELS } from '../../../data/vehiclesData';

export interface VehiculesFormValues {
  vehicleCategory: RollingStockCategory;
  transactionType: TransactionType;
  brand: string;
  model: string;
  year?: string;
  transmission?: string;
  mileage?: string;
}

export const ROLLING_STOCK_CATEGORIES: RollingStockCategory[] = [
  'Voitures',
  'Camions Bennes',
  'Camions Citernes',
  'Engins de chantiers',
  'Motos',
  'Vélos',
];

export const vehiculesSchema: CategorySchema<VehiculesFormValues> = {
  category: 'MATERIEL_ROULANT',
  label: 'Matériel Roulant',
  fields: [
    {
      name: 'vehicleCategory',
      label: 'Sous-catégorie véhicule / engin',
      type: 'select',
      required: true,
      options: ROLLING_STOCK_CATEGORIES.map((c) => ({ label: c, value: c })),
    },
    {
      name: 'transactionType',
      label: 'Nature de la transaction',
      type: 'radio',
      required: true,
      options: [
        { label: 'À Vendre', value: 'VENTE' },
        { label: 'À Louer', value: 'LOCATION' },
      ],
    },
    {
      name: 'brand',
      label: 'Marque',
      type: 'select',
      required: true,
      options: CAR_BRANDS_AND_MODELS.map((b) => ({ label: b.brand, value: b.brand })),
    },
    {
      name: 'model',
      label: 'Modèle',
      type: 'text',
      required: true,
      placeholder: 'ex: Hilux, Prado, Tucson...',
    },
    {
      name: 'year',
      label: 'Année de mise en circulation',
      type: 'number',
      placeholder: 'ex: 2018',
    },
    {
      name: 'transmission',
      label: 'Boîte de vitesse',
      type: 'select',
      options: [
        { label: 'Automatique', value: 'Automatique' },
        { label: 'Manuelle', value: 'Manuelle' },
      ],
    },
    {
      name: 'mileage',
      label: 'Kilométrage (km)',
      type: 'number',
      placeholder: 'ex: 85000',
    },
  ],
  defaultValues: {
    vehicleCategory: 'Voitures',
    transactionType: 'VENTE',
    brand: CAR_BRANDS_AND_MODELS[0]?.brand || 'TOYOTA',
    model: '',
    year: '',
    transmission: 'Automatique',
    mileage: '',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.vehicleCategory) {
      errors.vehicleCategory = 'La catégorie de véhicule est requise.';
    }
    if (!values.transactionType) {
      errors.transactionType = 'La nature de la transaction est requise.';
    }
    if (values.vehicleCategory === 'Voitures' && !values.brand) {
      errors.brand = 'La marque est requise pour les voitures.';
    }
    return errors;
  },
  generateTitle: (values) => {
    const op = values.transactionType === 'VENTE' ? 'Vente' : 'Location';
    const brandModel = [values.brand, values.model].filter(Boolean).join(' ');
    return `${op} - ${brandModel || values.vehicleCategory}`;
  },
};

