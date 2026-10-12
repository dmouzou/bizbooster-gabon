import { GABON_PROVINCES } from './gabonLocations';

export type SupportedCountry = 'GA' | 'IN' | 'CM' | 'ML' | 'TG' | 'SN' | 'GH';

export interface LocationCity {
  name: string;
}

export interface CountryRegion {
  name: string;
  code?: string;
  cities: LocationCity[];
}

export const COUNTRY_LOCATIONS: Record<SupportedCountry, CountryRegion[]> = {
  GA: GABON_PROVINCES.map((p) => ({
    name: p.name,
    code: p.code,
    cities: p.cities.map((c) => ({ name: c.name })),
  })),

  CM: [
    {
      name: 'Centre',
      code: 'CE',
      cities: [{ name: 'Yaoundé' }, { name: 'Mbalmayo' }, { name: 'Bafia' }],
    },
    {
      name: 'Littoral',
      code: 'LT',
      cities: [{ name: 'Douala' }, { name: 'Edéa' }, { name: 'Nkongsamba' }],
    },
    {
      name: 'Ouest',
      code: 'OU',
      cities: [{ name: 'Bafoussam' }, { name: 'Dschang' }, { name: 'Foumban' }],
    },
    {
      name: 'Sud-Ouest',
      code: 'SW',
      cities: [{ name: 'Buea' }, { name: 'Limbe' }, { name: 'Kumba' }],
    },
    {
      name: 'Nord-Ouest',
      code: 'NW',
      cities: [{ name: 'Bamenda' }, { name: 'Kumbo' }],
    },
    {
      name: 'Nord',
      code: 'NO',
      cities: [{ name: 'Garoua' }, { name: 'Guider' }],
    },
    {
      name: 'Extrême-Nord',
      code: 'EN',
      cities: [{ name: 'Maroua' }, { name: 'Kousséri' }, { name: 'Mora' }],
    },
    {
      name: 'Adamaoua',
      code: 'AD',
      cities: [{ name: 'Ngaoundéré' }, { name: 'Meiganga' }],
    },
    {
      name: 'Sud',
      code: 'SU',
      cities: [{ name: 'Kribi' }, { name: 'Ebolowa' }, { name: 'Sangmélima' }],
    },
    {
      name: 'Est',
      code: 'ES',
      cities: [{ name: 'Bertoua' }, { name: 'Batouri' }],
    },
  ],

  SN: [
    {
      name: 'Dakar',
      code: 'DK',
      cities: [{ name: 'Dakar' }, { name: 'Pikine' }, { name: 'Guédiawaye' }, { name: 'Rufisque' }],
    },
    {
      name: 'Thiès',
      code: 'TH',
      cities: [{ name: 'Thiès' }, { name: 'Mbour' }, { name: 'Tivaouane' }, { name: 'Saly' }],
    },
    {
      name: 'Diourbel',
      code: 'DB',
      cities: [{ name: 'Diourbel' }, { name: 'Touba' }, { name: 'Mbacké' }],
    },
    {
      name: 'Saint-Louis',
      code: 'SL',
      cities: [{ name: 'Saint-Louis' }, { name: 'Richard-Toll' }, { name: 'Dagana' }],
    },
    {
      name: 'Kaolack',
      code: 'KL',
      cities: [{ name: 'Kaolack' }, { name: 'Nioro du Rip' }],
    },
    {
      name: 'Ziguinchor',
      code: 'ZG',
      cities: [{ name: 'Ziguinchor' }, { name: 'Cap Skirring' }, { name: 'Bignona' }],
    },
    {
      name: 'Fatick',
      code: 'FK',
      cities: [{ name: 'Fatick' }, { name: 'Foundiougne' }],
    },
    {
      name: 'Kolda',
      code: 'KD',
      cities: [{ name: 'Kolda' }, { name: 'Vélingara' }],
    },
    {
      name: 'Tambacounda',
      code: 'TC',
      cities: [{ name: 'Tambacounda' }, { name: 'Bakel' }],
    },
  ],

  ML: [
    {
      name: 'District de Bamako',
      code: 'BKO',
      cities: [{ name: 'Bamako' }],
    },
    {
      name: 'Sikasso',
      code: 'SKO',
      cities: [{ name: 'Sikasso' }, { name: 'Koutiala' }, { name: 'Bougouni' }],
    },
    {
      name: 'Ségou',
      code: 'SEG',
      cities: [{ name: 'Ségou' }, { name: 'San' }, { name: 'Niono' }],
    },
    {
      name: 'Koulikoro',
      code: 'KLK',
      cities: [{ name: 'Koulikoro' }, { name: 'Kati' }, { name: 'Kolokani' }],
    },
    {
      name: 'Kayes',
      code: 'KYS',
      cities: [{ name: 'Kayes' }, { name: 'Kita' }, { name: 'Nioro du Sahel' }],
    },
    {
      name: 'Mopti',
      code: 'MOP',
      cities: [{ name: 'Mopti' }, { name: 'Sévaré' }, { name: 'Djenné' }],
    },
    {
      name: 'Gao',
      code: 'GAO',
      cities: [{ name: 'Gao' }],
    },
    {
      name: 'Tombouctou',
      code: 'TBK',
      cities: [{ name: 'Tombouctou' }],
    },
  ],

  TG: [
    {
      name: 'Maritime',
      code: 'MAR',
      cities: [{ name: 'Lomé' }, { name: 'Tsévié' }, { name: 'Aného' }],
    },
    {
      name: 'Plateaux',
      code: 'PLT',
      cities: [{ name: 'Kpalimé' }, { name: 'Atakpamé' }, { name: 'Notsé' }],
    },
    {
      name: 'Centrale',
      code: 'CEN',
      cities: [{ name: 'Sokodé' }, { name: 'Tchamba' }],
    },
    {
      name: 'Kara',
      code: 'KAR',
      cities: [{ name: 'Kara' }, { name: 'Bafilo' }, { name: 'Niamtougou' }],
    },
    {
      name: 'Savanes',
      code: 'SAV',
      cities: [{ name: 'Dapaong' }, { name: 'Mango' }],
    },
  ],

  GH: [
    {
      name: 'Greater Accra',
      code: 'GAR',
      cities: [{ name: 'Accra' }, { name: 'Tema' }, { name: 'Madina' }, { name: 'Kasoa' }],
    },
    {
      name: 'Ashanti',
      code: 'ASH',
      cities: [{ name: 'Kumasi' }, { name: 'Obuasi' }, { name: 'Ejisu' }],
    },
    {
      name: 'Western',
      code: 'WES',
      cities: [{ name: 'Sekondi-Takoradi' }, { name: 'Tarkwa' }],
    },
    {
      name: 'Eastern',
      code: 'EAS',
      cities: [{ name: 'Koforidua' }, { name: 'Nkawkaw' }],
    },
    {
      name: 'Central',
      code: 'CEN',
      cities: [{ name: 'Cape Coast' }, { name: 'Winneba' }],
    },
    {
      name: 'Northern',
      code: 'NOR',
      cities: [{ name: 'Tamale' }, { name: 'Yendi' }],
    },
    {
      name: 'Volta',
      code: 'VOL',
      cities: [{ name: 'Ho' }, { name: 'Keta' }],
    },
  ],

  IN: [
    {
      name: 'Maharashtra',
      code: 'MH',
      cities: [{ name: 'Mumbai' }, { name: 'Pune' }, { name: 'Nagpur' }, { name: 'Thane' }, { name: 'Nashik' }],
    },
    {
      name: 'Delhi',
      code: 'DL',
      cities: [{ name: 'New Delhi' }, { name: 'North Delhi' }, { name: 'South Delhi' }, { name: 'East Delhi' }],
    },
    {
      name: 'Karnataka',
      code: 'KA',
      cities: [{ name: 'Bengaluru' }, { name: 'Mysuru' }, { name: 'Mangaluru' }, { name: 'Hubballi' }],
    },
    {
      name: 'Tamil Nadu',
      code: 'TN',
      cities: [{ name: 'Chennai' }, { name: 'Coimbatore' }, { name: 'Madurai' }, { name: 'Salem' }],
    },
    {
      name: 'Telangana',
      code: 'TG',
      cities: [{ name: 'Hyderabad' }, { name: 'Warangal' }, { name: 'Nizamabad' }],
    },
    {
      name: 'Gujarat',
      code: 'GJ',
      cities: [{ name: 'Ahmedabad' }, { name: 'Surat' }, { name: 'Vadodara' }, { name: 'Rajkot' }],
    },
    {
      name: 'West Bengal',
      code: 'WB',
      cities: [{ name: 'Kolkata' }, { name: 'Howrah' }, { name: 'Durgapur' }, { name: 'Siliguri' }],
    },
    {
      name: 'Uttar Pradesh',
      code: 'UP',
      cities: [{ name: 'Lucknow' }, { name: 'Noida' }, { name: 'Kanpur' }, { name: 'Varanasi' }],
    },
    {
      name: 'Kerala',
      code: 'KL',
      cities: [{ name: 'Kochi' }, { name: 'Thiruvananthapuram' }, { name: 'Kozhikode' }],
    },
    {
      name: 'Rajasthan',
      code: 'RJ',
      cities: [{ name: 'Jaipur' }, { name: 'Jodhpur' }, { name: 'Udaipur' }],
    },
  ],
};
