import { CategorySchema } from './types';
import { NECROLOGIE_MINISTRIES } from '../../../data/categoriesData';
import { NecrologieMinistry } from '../../../types';

export interface NecrologieFormValues {
  necroMinistry: NecrologieMinistry;
  necroDeceasedName: string;
  necroAge?: string;
  necroCeremonyDate?: string;
  necroCeremonyLocation?: string;
  necroFuneralProgram?: string;
  necroFamilyContact?: string;
}

export const necrologieSchema: CategorySchema<NecrologieFormValues> = {
  category: 'NECROLOGIE',
  label: 'Nécrologie & Obsèques',
  fields: [
    {
      name: 'necroDeceasedName',
      label: 'Nom et prénoms du défunt',
      type: 'text',
      required: true,
      placeholder: 'ex: M. Jean-Baptiste Ndong',
    },
    {
      name: 'necroMinistry',
      label: 'Ministère ou corporation de rattachement',
      type: 'select',
      required: true,
      options: NECROLOGIE_MINISTRIES.map((m) => ({ label: m, value: m })),
    },
    {
      name: 'necroAge',
      label: 'Âge du défunt',
      type: 'number',
      placeholder: 'ex: 68',
    },
    {
      name: 'necroCeremonyDate',
      label: 'Date de la veillée / messe',
      type: 'date',
    },
    {
      name: 'necroCeremonyLocation',
      label: 'Lieu de la veillée',
      type: 'text',
      placeholder: 'ex: Domicile familial à Lalala',
    },
    {
      name: 'necroFuneralProgram',
      label: 'Programme des obsèques',
      type: 'textarea',
      placeholder: 'Déroulé des cérémonies et inhumation...',
    },
  ],
  defaultValues: {
    necroMinistry: NECROLOGIE_MINISTRIES[0],
    necroDeceasedName: '',
    necroAge: '',
    necroCeremonyDate: '',
    necroCeremonyLocation: '',
    necroFuneralProgram: '',
    necroFamilyContact: '',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.necroDeceasedName || values.necroDeceasedName.trim().length < 2) {
      errors.necroDeceasedName = 'Le nom du défunt est requis.';
    }
    if (!values.necroMinistry) {
      errors.necroMinistry = 'Le ministère ou corporation est requis.';
    }
    return errors;
  },
  generateTitle: (values) => {
    return `Nécrologie - ${values.necroDeceasedName || 'Avis de décès'} (${values.necroMinistry})`;
  },
};

