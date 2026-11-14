import { MainCategory } from '../../../types';
import { CategorySchema } from './types';
import { immobilierSchema } from './immobilier';
import { vehiculesSchema } from './vehicules';
import { emploiSchema } from './emploi';
import { coursSchema } from './cours';
import { necrologieSchema } from './necrologie';
import { avisRechercheSchema } from './avisRecherche';
import { evenementsSchema } from './evenements';
import { bricABracSchema } from './bricABrac';
import { autresEmploisSchema } from './autresEmplois';

export * from './types';
export * from './immobilier';
export * from './vehicules';
export * from './emploi';
export * from './cours';
export * from './necrologie';
export * from './avisRecherche';
export * from './evenements';
export * from './bricABrac';
export * from './autresEmplois';

export const CATEGORY_SCHEMAS: Record<MainCategory, CategorySchema> = {
  IMMOBILIER: immobilierSchema,
  MATERIEL_ROULANT: vehiculesSchema,
  EMPLOI: emploiSchema,
  COURS_A_DOMICILE: coursSchema,
  NECROLOGIE: necrologieSchema,
  AVIS_DE_RECHERCHE: avisRechercheSchema,
  EVENEMENTS: evenementsSchema,
  BRIC_A_BRAC: bricABracSchema,
  AUTRES_EMPLOIS: autresEmploisSchema,
};

export function getCategorySchema(category: MainCategory): CategorySchema {
  return CATEGORY_SCHEMAS[category] || CATEGORY_SCHEMAS.IMMOBILIER;
}
