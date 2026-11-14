import { CategorySchema } from './types';
import { PROPERTY_TYPES } from '../../../data/categoriesData';
import { PropertyType, TransactionType } from '../../../types';

export interface ImmobilierFormValues {
  transactionType: TransactionType;
  propertyType: PropertyType;
  surface?: string;
  rooms?: string;
}

export const immobilierSchema: CategorySchema<ImmobilierFormValues> = {
  category: 'IMMOBILIER',
  label: 'Immobilier',
  fields: [
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
      name: 'propertyType',
      label: 'Catégorie de bien immobilier',
      type: 'select',
      required: true,
      options: PROPERTY_TYPES.map((t) => ({ label: t, value: t })),
    },
    {
      name: 'surface',
      label: 'Superficie (m²)',
      type: 'number',
      placeholder: 'ex: 150',
      helperText: 'Facultatif pour les chambres, recommandé pour villas et terrains',
    },
    {
      name: 'rooms',
      label: 'Nombre de pièces',
      type: 'number',
      placeholder: 'ex: 4',
      helperText: 'Facultatif',
    },
  ],
  defaultValues: {
    transactionType: 'VENTE',
    propertyType: PROPERTY_TYPES[0],
    surface: '',
    rooms: '',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.transactionType) {
      errors.transactionType = 'La nature de la transaction est requise.';
    }
    if (!values.propertyType) {
      errors.propertyType = 'Le type de bien immobilier est requis.';
    }
    return errors;
  },
  generateTitle: (values, locationText) => {
    const op = values.transactionType === 'VENTE' ? 'Vente' : 'Location';
    return `${op} - ${values.propertyType}${locationText ? ` à ${locationText}` : ''}`;
  },
};

