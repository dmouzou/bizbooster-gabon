import { CategorySchema } from './types';
import { AUTRES_EMPLOIS_SUBCATEGORIES } from '../../../data/categoriesData';
import { AutresEmploisSubCategory } from '../../../types';

export interface AutresEmploisFormValues {
  autresEmploisSubCategory: AutresEmploisSubCategory;
  autresEmploisProfession: string;
  contractType?: string;
  experienceYears?: string;
}

export const autresEmploisSchema: CategorySchema<AutresEmploisFormValues> = {
  category: 'AUTRES_EMPLOIS',
  label: 'Autres Emplois & Métiers',
  fields: [
    {
      name: 'autresEmploisSubCategory',
      label: 'Secteur d\'activité',
      type: 'select',
      required: true,
      options: AUTRES_EMPLOIS_SUBCATEGORIES.map((s) => ({ label: s, value: s })),
    },
    {
      name: 'autresEmploisProfession',
      label: 'Intitulé du poste ou profession',
      type: 'text',
      required: true,
      placeholder: 'ex: Comptable, Développeur Web, Électricien...',
    },
    {
      name: 'contractType',
      label: 'Type de contrat',
      type: 'select',
      options: [
        { label: 'CDI', value: 'CDI' },
        { label: 'CDD', value: 'CDD' },
        { label: 'Stage / Alternance', value: 'STAGE' },
        { label: 'Prestation / Freelance', value: 'FREELANCE' },
      ],
    },
    {
      name: 'experienceYears',
      label: 'Années d\'expérience',
      type: 'number',
      placeholder: 'ex: 2',
    },
  ],
  defaultValues: {
    autresEmploisSubCategory: AUTRES_EMPLOIS_SUBCATEGORIES[0],
    autresEmploisProfession: '',
    contractType: 'CDI',
    experienceYears: '',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.autresEmploisSubCategory) {
      errors.autresEmploisSubCategory = 'Le secteur d\'activité est requis.';
    }
    if (!values.autresEmploisProfession || values.autresEmploisProfession.trim().length < 2) {
      errors.autresEmploisProfession = 'L\'intitulé du poste ou profession est requis.';
    }
    return errors;
  },
  generateTitle: (values) => {
    const prefix = values.autresEmploisSubCategory === "Demandeur d'emploi"
      ? "Demandeur d'emploi"
      : "Offre d'emploi";
    return `${prefix} - ${values.autresEmploisProfession || 'Poste à pourvoir'}`;
  },
};
