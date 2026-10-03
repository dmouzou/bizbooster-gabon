import { RollingStockCategory } from '../types';

export interface CarBrandModels {
  brand: string;
  models: string[];
}

export const CAR_BRANDS_AND_MODELS: CarBrandModels[] = [
  {
    brand: 'HYUNDAI',
    models: ['Santa Fe', 'Tucson', 'Creta', 'Ioniq 5', 'Ioniq 9', 'i30', 'i20', 'Elantra', 'Accent', 'Palisade']
  },
  {
    brand: 'TOYOTA',
    models: ['Hilux', 'Land Cruiser Prado', 'Land Cruiser 300', 'RAV4', 'Corolla', 'Corolla Cross', 'Yaris', 'Fortuner', 'Rush']
  },
  {
    brand: 'NISSAN',
    models: ['Patrol', 'Navara', 'Qashqai', 'X-Trail', 'Kicks', 'Sunny', 'Pathfinder']
  },
  {
    brand: 'KIA',
    models: ['Morning', 'Sportage', 'Sorento', 'Picanto', 'Seltos', 'Rio', 'Carnival', 'EV6']
  },
  {
    brand: 'MERCEDES-BENZ',
    models: ['Classe G (G63)', 'GLE', 'GLC', 'GLA', 'Classe C', 'Classe E', 'Classe S']
  },
  {
    brand: 'MITSUBISHI',
    models: ['Pajero', 'L200', 'Outlander', 'ASX', 'Eclipse Cross']
  },
  {
    brand: 'PEUGEOT',
    models: ['3008', '2008', '5008', '208', '508', 'Landtrek Pick-up']
  },
  {
    brand: 'SUZUKI',
    models: ['Jimny', 'Grand Vitara', 'Swift', 'Baleno', 'S-Presso', 'Ertiga']
  },
  {
    brand: 'RENAULT',
    models: ['Duster', 'Koleos', 'Captur', 'Clio', 'Kwid']
  },
  {
    brand: 'FORD',
    models: ['Ranger', 'Everest', 'Explorer', 'F-150', 'EcoSport']
  }
];

export const DUMP_TRUCK_BRANDS: string[] = [
  'IVECO',
  'MERCEDES-BENZ',
  'HOWO / SINOTRUK',
  'CHINOTRUK',
  'SHACMAN (CHACMAN)',
  'RENAULT TRUCKS',
  'MAN',
  'DAF',
  'VOLVO TRUCKS',
  'ISUZU'
];

export const TANKER_TRUCK_TYPES: string[] = [
  'Citerne Carburant (Hydrocarbures)',
  'Citerne Eau Potable',
  'Citerne Vidange / Assainissement',
  'Citerne Huile / Alimentaire',
  'Citerne Bitume / Goudron'
];

export const HEAVY_MACHINERY_TYPES: string[] = [
  'Pelleteuses (Excavatrices)',
  'Compacteurs (Rouleaux compresseurs)',
  'Nivelleuses (Graders)',
  'Chargeurs sur pneus (Loaders)',
  'Bulldozers',
  'Tractopelles (Backhoe loaders)',
  'Grues mobiles',
  'Foreuses',
  'Chariots élévateurs (Fenwicks)'
];

export const MOTORBIKE_TYPES: string[] = [
  'Scooters (125cc / 150cc)',
  'Taxis-Motos (Bajaj Boxer, TVS King)',
  'Motos Routières',
  'Motos Cross / Tout-terrain',
  'Quads / Buggys'
];

export const BICYCLE_TYPES: string[] = [
  'VTT (Vélo Tout-Terrain)',
  'VTC (Vélo Tout-Chemin)',
  'Vélo de Route / Course',
  'Vélo Électrique (VAE)',
  'Vélo pour Enfants'
];
