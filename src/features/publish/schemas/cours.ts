import { CategorySchema } from './types';
import { TUTORING_SUBJECTS, TUTORING_LEVELS } from '../../../data/categoriesData';
import { TutoringAdKind, TutoringSubject, TutoringLevel } from '../../../types';

export interface CoursFormValues {
  tutoringKind: TutoringAdKind;
  tutoringSubject: TutoringSubject;
  tutoringLevel: TutoringLevel;
}

export const coursSchema: CategorySchema<CoursFormValues> = {
  category: 'COURS_A_DOMICILE',
  label: 'Cours à Domicile',
  fields: [
    {
      name: 'tutoringKind',
      label: 'Type d\'annonce',
      type: 'radio',
      required: true,
      options: [
        { label: 'Je propose des cours (Enseignant / Répétiteur)', value: 'OFFRE' },
        { label: 'Je cherche des cours (Parent / Élève)', value: 'DEMANDE' },
      ],
    },
    {
      name: 'tutoringSubject',
      label: 'Matière enseignée',
      type: 'select',
      required: true,
      options: TUTORING_SUBJECTS.map((s) => ({ label: s, value: s })),
    },
    {
      name: 'tutoringLevel',
      label: 'Niveau scolaire cible',
      type: 'select',
      required: true,
      options: TUTORING_LEVELS.map((l) => ({ label: l, value: l })),
    },
  ],
  defaultValues: {
    tutoringKind: 'OFFRE',
    tutoringSubject: TUTORING_SUBJECTS[0],
    tutoringLevel: TUTORING_LEVELS[0],
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.tutoringKind) {
      errors.tutoringKind = 'Précisez s\'il s\'agit d\'une offre ou d\'une demande.';
    }
    if (!values.tutoringSubject) {
      errors.tutoringSubject = 'La matière est requise.';
    }
    if (!values.tutoringLevel) {
      errors.tutoringLevel = 'Le niveau scolaire est requis.';
    }
    return errors;
  },
  generateTitle: (values) => {
    const prefix = values.tutoringKind === 'OFFRE' ? 'Cours à domicile' : 'Recherche cours';
    return `${prefix} - ${values.tutoringSubject} (${values.tutoringLevel})`;
  },
};
