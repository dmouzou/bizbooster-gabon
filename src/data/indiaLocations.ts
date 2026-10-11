export interface IndiaCity {
  name: string;
}

export interface IndiaState {
  name: string;
  code: string;
  capital: string;
  cities: IndiaCity[];
}

export const INDIA_STATES: IndiaState[] = [
  {
    name: 'Maharashtra',
    code: 'MH',
    capital: 'Mumbai',
    cities: [
      { name: 'Mumbai' },
      { name: 'Pune' },
      { name: 'Nagpur' },
      { name: 'Thane' },
      { name: 'Nashik' },
    ],
  },
  {
    name: 'Delhi',
    code: 'DL',
    capital: 'New Delhi',
    cities: [
      { name: 'New Delhi' },
      { name: 'North Delhi' },
      { name: 'South Delhi' },
      { name: 'East Delhi' },
      { name: 'West Delhi' },
    ],
  },
  {
    name: 'Karnataka',
    code: 'KA',
    capital: 'Bengaluru',
    cities: [
      { name: 'Bengaluru' },
      { name: 'Mysuru' },
      { name: 'Mangaluru' },
      { name: 'Hubballi' },
      { name: 'Belagavi' },
    ],
  },
  {
    name: 'Tamil Nadu',
    code: 'TN',
    capital: 'Chennai',
    cities: [
      { name: 'Chennai' },
      { name: 'Coimbatore' },
      { name: 'Madurai' },
      { name: 'Tiruchirappalli' },
      { name: 'Salem' },
    ],
  },
  {
    name: 'Telangana',
    code: 'TG',
    capital: 'Hyderabad',
    cities: [
      { name: 'Hyderabad' },
      { name: 'Warangal' },
      { name: 'Nizamabad' },
      { name: 'Karimnagar' },
    ],
  },
  {
    name: 'Gujarat',
    code: 'GJ',
    capital: 'Gandhinagar',
    cities: [
      { name: 'Ahmedabad' },
      { name: 'Surat' },
      { name: 'Vadodara' },
      { name: 'Rajkot' },
      { name: 'Gandhinagar' },
    ],
  },
  {
    name: 'West Bengal',
    code: 'WB',
    capital: 'Kolkata',
    cities: [
      { name: 'Kolkata' },
      { name: 'Howrah' },
      { name: 'Durgapur' },
      { name: 'Siliguri' },
      { name: 'Asansol' },
    ],
  },
  {
    name: 'Uttar Pradesh',
    code: 'UP',
    capital: 'Lucknow',
    cities: [
      { name: 'Lucknow' },
      { name: 'Noida' },
      { name: 'Kanpur' },
      { name: 'Varanasi' },
      { name: 'Agra' },
    ],
  },
  {
    name: 'Kerala',
    code: 'KL',
    capital: 'Thiruvananthapuram',
    cities: [
      { name: 'Kochi' },
      { name: 'Thiruvananthapuram' },
      { name: 'Kozhikode' },
      { name: 'Thrissur' },
    ],
  },
  {
    name: 'Rajasthan',
    code: 'RJ',
    capital: 'Jaipur',
    cities: [
      { name: 'Jaipur' },
      { name: 'Jodhpur' },
      { name: 'Udaipur' },
      { name: 'Kota' },
    ],
  },
  {
    name: 'Punjab',
    code: 'PB',
    capital: 'Chandigarh',
    cities: [
      { name: 'Chandigarh' },
      { name: 'Ludhiana' },
      { name: 'Amritsar' },
      { name: 'Jalandhar' },
    ],
  },
  {
    name: 'Haryana',
    code: 'HR',
    capital: 'Chandigarh',
    cities: [
      { name: 'Gurugram' },
      { name: 'Faridabad' },
      { name: 'Panipat' },
      { name: 'Ambala' },
    ],
  },
];
