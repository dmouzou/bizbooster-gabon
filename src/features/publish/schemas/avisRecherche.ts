import { CategorySchema } from './types';
import { AVIS_RECHERCHE_CATEGORIES } from '../../../data/categoriesData';
import { AvisRechercheCategory } from '../../../types';

export interface AvisRechercheFormValues {
  avisCategory: AvisRechercheCategory;
  avisTargetName: string;
  avisLastSeenDate?: string;
  avisLastSeenLocation?: string;
  avisEmergencyContact?: string;
  hasReward: boolean;
  avisRewardAmount?: string;
}

export const avisRechercheSchema: CategorySchema<AvisRechercheFormValues> = {
  category: 'AVIS_DE_RECHERCHE',
  label: 'Avis de Recherche & Vigilance',
  fields: [
    {
      name: 'avisCategory',
      label: 'Nature du signalement',
      type: 'select',
      required: true,
      options: AVIS_RECHERCHE_CATEGORIES.map((c) => ({ label: c, value: c })),
    },
    {
      name: 'avisTargetName',
      label: 'Personne, objet ou animal recherché',
      type: 'text',
      required: true,
      placeholder: 'ex: Disparition d\'un jeune homme / Passeport égaré...',
    },
    {
      name: 'avisLastSeenDate',
      label: 'Date de disparition / perte',
      type: 'date',
    },
    {
      name: 'avisLastSeenLocation',
      label: 'Dernier lieu aperçu',
      type: 'text',
      placeholder: 'ex: Gare routière d\'Oyem',
    },
    {
      name: 'avisEmergencyContact',
      label: 'Numéro d\'urgence famille / police',
      type: 'text',
      placeholder: 'ex: +241 07 00 00 00',
    },
    {
      name: 'hasReward',
      label: 'Une récompense est-elle proposée ?',
      type: 'checkbox',
    },
    {
      name: 'avisRewardAmount',
      label: 'Montant de la récompense (FCFA)',
      type: 'number',
      placeholder: 'ex: 200000',
    },
  ],
  defaultValues: {
    avisCategory: AVIS_RECHERCHE_CATEGORIES[0],
    avisTargetName: '',
    avisLastSeenDate: '',
    avisLastSeenLocation: '',
    avisEmergencyContact: '',
    hasReward: false,
    avisRewardAmount: '',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.avisCategory) {
      errors.avisCategory = 'La catégorie de signalement est requise.';
    }
    if (!values.avisTargetName || values.avisTargetName.trim().length < 2) {
      errors.avisTargetName = 'L\'objet ou la personne recherchée est requis.';
    }
    return errors;
  },
  generateTitle: (values) => {
    return `Avis de Recherche - ${values.avisCategory}: ${values.avisTargetName}`;
  },
};
