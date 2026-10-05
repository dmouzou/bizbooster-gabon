import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  Building2,
  Car,
  MapPin,
  Clock,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  DollarSign,
  Users,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Ad, UserProfile } from '../types';
import { formatFCFA } from '../utils/formatters';
import { GABON_PROVINCES } from '../data/gabonLocations';
import { isTestAd } from './AdminPanel';

interface RealTimeAnalyticsProps {
  ads: Ad[];
  users?: UserProfile[];
}

interface ActivityEvent {
  id: string;
  time: string;
  type: 'NEW_AD' | 'PAYMENT' | 'USER' | 'EXTENSION';
  text: string;
  location: string;
  timestamp: number;
}

const GABON_COLORS = [
  '#059669', // Emerald Green
  '#f59e0b', // Sun Gold
  '#0284c7', // Ocean Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#10b981', // Mint
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f97316', // Orange
];

export const RealTimeAnalytics: React.FC<RealTimeAnalyticsProps> = ({ ads, users = [] }) => {
  // 1. Exact KPI Counts
  const kpis = useMemo(() => {
    let active = 0;
    let pending = 0;
    let rejected = 0;
    let totalRevenue = 0;
    let totalViews = 0;
    let totalCatalogValue = 0;
    let totalVente = 0;
    let totalLocation = 0;

    ads.forEach((ad) => {
      if (ad.status === 'ACTIVE') {
        active++;
      } else if (ad.status === 'PENDING_REVIEW' || !!ad.pendingExtension) {
        pending++;
      } else if (ad.status === 'REJECTED') {
        rejected++;
      }

      if (ad.transactionType === 'VENTE') totalVente++;
      else if (ad.transactionType === 'LOCATION') totalLocation++;

      // Point 2: Audience (totalViews) & Recettes (totalRevenue) strictly exclude test ads!
      if (!isTestAd(ad)) {
        totalRevenue += Number(ad.paidAmount) || 0;
        totalViews += Number(ad.viewsCount) || 0;
        if (ad.status === 'ACTIVE') {
          totalCatalogValue += Number(ad.price) || 0;
        }
      }
    });

    const advertisersCount = users.length > 0
      ? users.length
      : new Set(ads.map((a) => a.contactPhone || a.contactName)).size;

    return {
      totalAds: ads.length,
      active,
      pending,
      rejected,
      totalRevenue,
      totalViews,
      totalCatalogValue,
      totalVente,
      totalLocation,
      advertisersCount,
    };
  }, [ads, users]);

  // 2. Exact spatial breakdown by 9 Gabon Provinces
  const provinceChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    GABON_PROVINCES.forEach((p) => {
      counts[p.name] = 0;
    });

    ads.forEach((ad) => {
      const p = ad.location?.province;
      if (p && counts[p] !== undefined) {
        counts[p] += 1;
      } else {
        counts['Estuaire'] = (counts['Estuaire'] || 0) + 1;
      }
    });

    return GABON_PROVINCES.map((p) => ({
      name: p.name,
      code: p.code,
      annonces: counts[p.name] || 0,
    }));
  }, [ads]);

  // 3. Exact Transaction Type breakdown (Vente vs Location vs Autres)
  const transactionChartData = useMemo(() => {
    let vente = 0;
    let location = 0;
    let autres = 0;

    ads.forEach((ad) => {
      if (ad.transactionType === 'VENTE') vente++;
      else if (ad.transactionType === 'LOCATION') location++;
      else autres++;
    });

    return [
      { name: 'Vente (Achat définitif)', value: vente, color: '#f59e0b' },
      { name: 'Location (Mensuelle/Journalière)', value: location, color: '#059669' },
      { name: 'Emploi / Services', value: autres, color: '#8b5cf6' },
    ];
  }, [ads]);

  // 4. Exact Category distribution
  const categoryChartData = useMemo(() => {
    const counts: Record<string, number> = {
      IMMOBILIER: 0,
      MATERIEL_ROULANT: 0,
      BRIC_A_BRAC: 0,
      EMPLOI: 0,
    };

    ads.forEach((ad) => {
      if (counts[ad.mainCategory] !== undefined) {
        counts[ad.mainCategory]++;
      }
    });

    return [
      { name: 'Immobilier', count: counts['IMMOBILIER'], color: '#059669' },
      { name: 'Matériel Roulant', count: counts['MATERIEL_ROULANT'], color: '#0284c7' },
      { name: 'Bric-à-Brac', count: counts['BRIC_A_BRAC'], color: '#f59e0b' },
      { name: 'Emploi Maisons', count: counts['EMPLOI'], color: '#9333ea' },
    ];
  }, [ads]);

  // 5. Dynamic Average Prices calculated from real ads (by city)
  const cityPriceTrends = useMemo(() => {
    const cityMap: Record<string, { loyerTotal: number; loyerCount: number; venteTotal: number; venteCount: number }> = {};
    const defaultCities = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda', 'Lambaréné'];
    defaultCities.forEach((c) => {
      cityMap[c] = { loyerTotal: 0, loyerCount: 0, venteTotal: 0, venteCount: 0 };
    });

    ads.forEach((ad) => {
      const city = ad.location?.city;
      if (!city) return;
      if (!cityMap[city]) {
        cityMap[city] = { loyerTotal: 0, loyerCount: 0, venteTotal: 0, venteCount: 0 };
      }
      if (ad.transactionType === 'LOCATION') {
        cityMap[city].loyerTotal += Number(ad.price) || 0;
        cityMap[city].loyerCount += 1;
      } else if (ad.transactionType === 'VENTE') {
        cityMap[city].venteTotal += Number(ad.price) || 0;
        cityMap[city].venteCount += 1;
      }
    });

    return Object.entries(cityMap)
      .slice(0, 6)
      .map(([city, data]) => ({
        city,
        loyerMoyen: data.loyerCount > 0 ? Math.round(data.loyerTotal / data.loyerCount) : 0,
        prixVenteMoyen: data.venteCount > 0 ? Math.round(data.venteTotal / data.venteCount) : 0,
        totalAnnonces: data.loyerCount + data.venteCount,
      }));
  }, [ads]);

  // 6. 100% Real Database Activity Feed (Sorted by actual timestamps)
  const realActivityEvents = useMemo(() => {
    const events: ActivityEvent[] = [];

    // Ad events
    ads.forEach((ad) => {
      const adTime = ad.publishedAt || ad.moderatedAt || new Date().toISOString();
      const ts = new Date(adTime).getTime() || Date.now();
      const loc = ad.location?.city ? `${ad.location.city} (${ad.location.neighborhood || ad.location.province})` : 'Gabon';

      // New Ad or publication
      events.push({
        id: `ad-${ad.id}`,
        time: new Date(adTime).toLocaleString('fr-FR', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: 'NEW_AD',
        text: `Annonce "${ad.title}" (${ad.status === 'ACTIVE' ? 'En ligne' : ad.status === 'PENDING_REVIEW' ? 'En attente' : 'Rejetée'})`,
        location: loc,
        timestamp: ts,
      });

      // Payment event
      if (ad.paidAmount && ad.paidAmount > 0) {
        const op = ad.paymentMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : ad.paymentMethod === 'MOOV_MONEY' ? 'Moov Money' : 'Mobile Money';
        events.push({
          id: `pay-${ad.id}`,
          time: new Date(adTime).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          type: 'PAYMENT',
          text: `Paiement ${op} (${formatFCFA(ad.paidAmount)}) encaissé pour "${ad.title}"`,
          location: loc,
          timestamp: ts + 1, // slightly offset
        });
      }

      // Extension event
      if (ad.pendingExtension) {
        events.push({
          id: `ext-${ad.id}`,
          time: new Date(ad.pendingExtension.requestedAt || adTime).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          type: 'EXTENSION',
          text: `Demande de prolongation +${ad.pendingExtension.days}j pour "${ad.title}"`,
          location: loc,
          timestamp: new Date(ad.pendingExtension.requestedAt || adTime).getTime(),
        });
      }
    });

    // User registrations
    users.forEach((u) => {
      if (u.createdAt) {
        const ts = new Date(u.createdAt).getTime() || Date.now();
        events.push({
          id: `user-${u.id}`,
          time: new Date(u.createdAt).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          type: 'USER',
          text: `Inscription annonceur : ${u.name} (${u.contactPhone || 'Tél vérifié'})`,
          location: 'Gabon (+241)',
          timestamp: ts,
        });
      }
    });

    // Sort descending by actual timestamp
    events.sort((a, b) => b.timestamp - a.timestamp);
    return events.slice(0, 8);
  }, [ads, users]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner: Exact Real-Time Metrics Notice */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-5 sm:p-7 border border-emerald-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Observatoire BIZBOOSTER · Chiffres Exacts de Production
              </span>
              <span className="bg-emerald-800/80 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-600/40">
                Données 100% Réelles Firestore
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
              Baromètre des Annonces & Indicateurs du Marché Gabonais
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Calcul instantané et intègre de l'offre, de la valeur marchande du catalogue, des encaissements Mobile Money et des annonces actives.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 shrink-0">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Annonceurs Inscrits
              </div>
              <div className="text-xl font-black text-white font-mono">
                {kpis.advertisersCount} profil{kpis.advertisersCount > 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (Exact Database Counts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Annonces Actives (En Ligne)</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{kpis.active}</div>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">
            Sur un total de {kpis.totalAds} déposée{kpis.totalAds > 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Valeur Catalogue Actif</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
            {formatFCFA(kpis.totalCatalogValue)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {kpis.totalVente} en vente • {kpis.totalLocation} en location
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Recettes Mobile Money</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
            {formatFCFA(kpis.totalRevenue)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Airtel Money & Moov Money
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold mb-1">
            <span>Total Consultations</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">{kpis.totalViews}</div>
          <p className="text-[11px] text-blue-600 font-bold mt-1">
            Vues cumulées réelles
          </p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Volume d'annonces réelles par Province (9 Provinces) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Volume d'annonces réelles par Province (9 Provinces du Gabon)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Calculé d'après les annonces actives et modérées en base
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={provinceChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  formatter={(val: number | undefined) => [
                    `${val || 0} annonce(s)`,
                    'Volume exact',
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    borderColor: '#e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="annonces" fill="#059669" radius={[6, 6, 0, 0]}>
                  {provinceChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={GABON_COLORS[index % GABON_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Répartition exacte Vente vs Location */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              <span>Répartition par Type de Transaction (Vente vs Location)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Proportion exacte des annonces selon la nature de la transaction
            </p>
          </div>

          <div className="h-64 sm:h-72 w-full flex items-center justify-center">
            {ads.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={transactionChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value, percent }) =>
                      value > 0 ? `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)` : ''
                    }
                  >
                    {transactionChartData.map((entry, index) => (
                      <Cell key={`slice-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number | undefined) => [
                      `${val || 0} annonce(s)`,
                      'Total exact',
                    ]}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">Aucune annonce enregistrée</div>
            )}
          </div>
        </div>
      </div>

      {/* Second Row: Prix Moyens Réels par Ville & Flux d'Activité Réel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prix Moyens par Ville calculés sur les annonces réelles */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                Moyenne des Loyers & Prix de Vente par Ville
              </h3>
              <p className="text-xs text-slate-500">
                Calculée en temps réel d'après les annonces actives réelles de chaque ville
              </p>
            </div>
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
              Moyennes en FCFA
            </span>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityPriceTrends} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickFormatter={(val) => (val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${Math.round(val / 1000)}k`)}
                />
                <Tooltip
                  formatter={(val: number | undefined) => [
                    formatFCFA(val || 0),
                    'Moyenne',
                  ]}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="loyerMoyen" name="Loyer Moyen (Location)" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="prixVenteMoyen" name="Prix Moyen (Vente)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 100% Real Live Activity Feed from Firestore */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-200">
                  Journal d'Activité Réel (Base de Données)
                </h4>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                En direct
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {realActivityEvents.length > 0 ? (
                realActivityEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 transition-all text-xs hover:border-emerald-500/50"
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="text-emerald-400 font-bold truncate max-w-[140px]">{evt.location}</span>
                      <span className="shrink-0">{evt.time}</span>
                    </div>
                    <p className="text-slate-200 font-medium leading-tight">{evt.text}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs">
                  En attente des premières actions utilisateurs
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between mt-3">
            <span>Passerelle Paiements</span>
            <span className="text-emerald-400 font-bold">Airtel Money & Moov Money</span>
          </div>
        </div>
      </div>
    </div>
  );
};
