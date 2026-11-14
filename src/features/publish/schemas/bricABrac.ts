import { CategorySchema } from './types';
import { BRIC_A_BRAC_CATEGORIES } from '../../../data/categoriesData';
import { BricABracCategory } from '../../../types';

export interface BricABracFormValues {
  bricCategory: BricABracCategory;
  condition?: string;
}

export const bricABracSchema: CategorySchema<BricABracFormValues> = {
  category: 'BRIC_A_BRAC',
  label: 'Bric-à-Brac & Objets',
  fields: [
    {
      name: 'bricCategory',
      label: 'Sous-catégorie d\'objet',
      type: 'select',
      required: true,
      options: BRIC_A_BRAC_CATEGORIES.map((c) => ({ label: c, value: c })),
    },
    {
      name: 'condition',
      label: 'État de l\'objet',
      type: 'select',
      options: [
        { label: 'Neuf dans l\'emballage', value: 'NEUF' },
        { label: 'Occasion - Très bon état', value: 'TRES_BON_ETAT' },
        { label: 'Occasion - Bon état', value: 'BON_ETAT' },
      ],
    },
  ],
  defaultValues: {
    bricCategory: BRIC_A_BRAC_CATEGORIES[0],
    condition: 'TRES_BON_ETAT',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.bricCategory) {
      errors.bricCategory = 'La sous-catégorie d\'objet est requise.';
    }
    return errors;
  },
  generateTitle: (values) => {
    return `À Vendre - ${values.bricCategory}`;
  },
};

