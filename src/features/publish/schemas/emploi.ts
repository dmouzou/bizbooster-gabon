import { CategorySchema } from './types';
import { DOMESTIC_JOB_TYPES } from '../../../data/categoriesData';
import { DomesticJobType, JobAdKind } from '../../../types';

export interface EmploiFormValues {
  jobKind: JobAdKind;
  domesticJobType: DomesticJobType;
  experienceYears?: string;
  salaryPeriod?: 'mois' | 'heure';
}

export const emploiSchema: CategorySchema<EmploiFormValues> = {
  category: 'EMPLOI',
  label: 'Emploi Domestique',
  fields: [
    {
      name: 'jobKind',
      label: 'Type d\'annonce',
      type: 'radio',
      required: true,
      options: [
        { label: 'Offre d\'emploi (Recruteur)', value: 'OFFRE_EMPLOI' },
        { label: 'Demande d\'emploi (Candidat)', value: 'DEMANDE_EMPLOI' },
      ],
    },
    {
      name: 'domesticJobType',
      label: 'Métier ou profil recherché',
      type: 'select',
      required: true,
      options: DOMESTIC_JOB_TYPES.map((j) => ({ label: j, value: j })),
    },
    {
      name: 'experienceYears',
      label: 'Années d\'expérience',
      type: 'number',
      placeholder: 'ex: 3',
    },
  ],
  defaultValues: {
    jobKind: 'OFFRE_EMPLOI',
    domesticJobType: DOMESTIC_JOB_TYPES[0],
    experienceYears: '',
    salaryPeriod: 'mois',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.jobKind) {
      errors.jobKind = 'Précisez s\'il s\'agit d\'une offre ou d\'une demande.';
    }
    if (!values.domesticJobType) {
      errors.domesticJobType = 'Le métier est requis.';
    }
    return errors;
  },
  generateTitle: (values) => {
    const prefix = values.jobKind === 'DEMANDE_EMPLOI' ? "Demande d'emploi" : "Offre d'emploi";
    return `${prefix} - ${values.domesticJobType}`;
  },
};

