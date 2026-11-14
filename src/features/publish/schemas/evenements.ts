import { CategorySchema } from './types';
import { EVENT_TYPES } from '../../../data/categoriesData';
import { EventType } from '../../../types';

export interface EvenementsFormValues {
  eventType: EventType;
  eventVenue: string;
  eventDate: string;
  eventTime?: string;
  eventOrganizer?: string;
  eventDressCode?: string;
}

export const evenementsSchema: CategorySchema<EvenementsFormValues> = {
  category: 'EVENEMENTS',
  label: 'Événements & Cérémonies',
  fields: [
    {
      name: 'eventType',
      label: 'Nature de l\'événement',
      type: 'select',
      required: true,
      options: EVENT_TYPES.map((t) => ({ label: t, value: t })),
    },
    {
      name: 'eventVenue',
      label: 'Lieu ou salle de réception',
      type: 'text',
      required: true,
      placeholder: 'ex: Hôtel Nomad, Salle des fêtes...',
    },
    {
      name: 'eventDate',
      label: 'Date de l\'événement',
      type: 'date',
      required: true,
    },
    {
      name: 'eventTime',
      label: 'Heure de début',
      type: 'time',
      placeholder: 'ex: 19:30',
    },
    {
      name: 'eventOrganizer',
      label: 'Organisateur ou promoteur',
      type: 'text',
      placeholder: 'ex: Comité des fêtes / Entreprise...',
    },
    {
      name: 'eventDressCode',
      label: 'Dress code / Tenue exigée',
      type: 'text',
      placeholder: 'ex: Tenue de soirée / Pagne traditionnel...',
    },
  ],
  defaultValues: {
    eventType: EVENT_TYPES[0],
    eventVenue: '',
    eventDate: '',
    eventTime: '',
    eventOrganizer: '',
    eventDressCode: '',
  },
  validate: (values) => {
    const errors: Record<string, string> = {};
    if (!values.eventType) {
      errors.eventType = 'Le type d\'événement est requis.';
    }
    if (!values.eventVenue || values.eventVenue.trim().length < 2) {
      errors.eventVenue = 'Le lieu de l\'événement est requis.';
    }
    if (!values.eventDate) {
      errors.eventDate = 'La date de l\'événement est requise.';
    }
    return errors;
  },
  generateTitle: (values) => {
    return `${values.eventType} - ${values.eventVenue || 'Événement'}`;
  },
};

