import React from 'react';
import {
  Building2,
  Car,
  Package,
  Briefcase,
  GraduationCap,
  Heart,
  Search,
  UserCheck,
  PartyPopper,
  Tag,
  ShieldCheck,
  Phone,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  MainCategory,
  TransactionType,
  PropertyType,
  RollingStockCategory,
  BricABracCategory,
  DomesticJobType,
  JobAdKind,
  TutoringAdKind,
  TutoringSubject,
  TutoringLevel,
  NecrologieMinistry,
  AvisRechercheCategory,
  EventType,
  AutresEmploisSubCategory,
  UserProfile,
} from '../../../types';
import {
  PROPERTY_TYPES,
  BRIC_A_BRAC_CATEGORIES,
  DOMESTIC_JOB_TYPES,
  NECROLOGIE_MINISTRIES,
  AVIS_RECHERCHE_CATEGORIES,
  EVENT_TYPES,
  TUTORING_LEVELS,
  TUTORING_SUBJECTS,
} from '../../../data/categoriesData';
import {
  CAR_BRANDS_AND_MODELS,
  DUMP_TRUCK_BRANDS,
} from '../../../data/vehiclesData';
import { EventDateTimePicker } from '../../../components/EventDateTimePicker';

interface Step3DetailsProps {
  mainCategory: MainCategory;
  transactionType: TransactionType;
  propertyType: PropertyType;
  onPropertyTypeChange: (type: PropertyType) => void;
  vehicleCategory: RollingStockCategory;
  onVehicleCategoryChange: (cat: RollingStockCategory) => void;
  vehicleBrand: string;
  onVehicleBrandChange: (brand: string) => void;
  vehicleModel: string;
  onVehicleModelChange: (model: string) => void;
  bricCategory: BricABracCategory;
  onBricCategoryChange: (cat: BricABracCategory) => void;
  domesticJobType: DomesticJobType;
  onDomesticJobTypeChange: (type: DomesticJobType) => void;
  jobKind: JobAdKind;
  onJobKindChange: (kind: JobAdKind) => void;
  tutoringKind: TutoringAdKind;
  onTutoringKindChange: (kind: TutoringAdKind) => void;
  tutoringSubject: TutoringSubject;
  onTutoringSubjectChange: (subj: TutoringSubject) => void;
  tutoringLevel: TutoringLevel;
  onTutoringLevelChange: (lvl: TutoringLevel) => void;
  necroMinistry: NecrologieMinistry;
  onNecroMinistryChange: (min: NecrologieMinistry) => void;
  necroDeceasedName: string;
  onNecroDeceasedNameChange: (val: string) => void;
  necroCeremonyDate: string;
  onNecroCeremonyDateChange: (val: string) => void;
  necroCeremonyLocation: string;
  onNecroCeremonyLocationChange: (val: string) => void;
  necroFuneralProgram: string;
  onNecroFuneralProgramChange: (val: string) => void;
  necroFamilyContact: string;
  onNecroFamilyContactChange: (val: string) => void;
  avisCategory: AvisRechercheCategory;
  onAvisCategoryChange: (cat: AvisRechercheCategory) => void;
  avisTargetName: string;
  onAvisTargetNameChange: (val: string) => void;
  avisLastSeenDate: string;
  onAvisLastSeenDateChange: (val: string) => void;
  avisLastSeenLocation: string;
  onAvisLastSeenLocationChange: (val: string) => void;
  avisEmergencyContact: string;
  onAvisEmergencyContactChange: (val: string) => void;
  avisRewardAmount: number | '';
  onAvisRewardAmountChange: (val: number | '') => void;
  eventType: EventType;
  onEventTypeChange: (val: EventType) => void;
  eventDate: string;
  onEventDateChange: (val: string) => void;
  eventTime: string;
  onEventTimeChange: (val: string) => void;
  eventVenue: string;
  onEventVenueChange: (val: string) => void;
  eventOrganizer: string;
  onEventOrganizerChange: (val: string) => void;
  eventDressCode: string;
  onEventDressCodeChange: (val: string) => void;
  autresEmploisSubCategory: AutresEmploisSubCategory;
  onAutresEmploisSubCategoryChange: (val: AutresEmploisSubCategory) => void;
  autresEmploisProfession: string;
  onAutresEmploisProfessionChange: (val: string) => void;
  autresEmploisContractType: string;
  onAutresEmploisContractTypeChange: (val: string) => void;
  autresEmploisExperience: string;
  onAutresEmploisExperienceChange: (val: string) => void;
  title: string;
  onTitleChange: (val: string) => void;
  description: string;
  onDescriptionChange: (val: string) => void;
  contactName: string;
  onContactNameChange: (val: string) => void;
  contactPhone: string;
  onContactPhoneChange: (val: string) => void;
  isOwnerVerified: boolean;
  onAutoGenerateTitle: () => void;
  error?: string | null;
}

export const Step3Details: React.FC<Step3DetailsProps> = ({
  mainCategory,
  transactionType,
  propertyType,
  onPropertyTypeChange,
  vehicleCategory,
  onVehicleCategoryChange,
  vehicleBrand,
  onVehicleBrandChange,
  vehicleModel,
  onVehicleModelChange,
  bricCategory,
  onBricCategoryChange,
  domesticJobType,
  onDomesticJobTypeChange,
  jobKind,
  onJobKindChange,
  tutoringKind,
  onTutoringKindChange,
  tutoringSubject,
  onTutoringSubjectChange,
  tutoringLevel,
  onTutoringLevelChange,
  necroMinistry,
  onNecroMinistryChange,
  necroDeceasedName,
  onNecroDeceasedNameChange,
  necroCeremonyDate,
  onNecroCeremonyDateChange,
  necroCeremonyLocation,
  onNecroCeremonyLocationChange,
  necroFuneralProgram,
  onNecroFuneralProgramChange,
  necroFamilyContact,
  onNecroFamilyContactChange,
  avisCategory,
  onAvisCategoryChange,
  avisTargetName,
  onAvisTargetNameChange,
  avisLastSeenDate,
  onAvisLastSeenDateChange,
  avisLastSeenLocation,
  onAvisLastSeenLocationChange,
  avisEmergencyContact,
  onAvisEmergencyContactChange,
  avisRewardAmount,
  onAvisRewardAmountChange,
  eventType,
  onEventTypeChange,
  eventDate,
  onEventDateChange,
  eventTime,
  onEventTimeChange,
  eventVenue,
  onEventVenueChange,
  eventOrganizer,
  onEventOrganizerChange,
  eventDressCode,
  onEventDressCodeChange,
  autresEmploisSubCategory,
  onAutresEmploisSubCategoryChange,
  autresEmploisProfession,
  onAutresEmploisProfessionChange,
  autresEmploisContractType,
  onAutresEmploisContractTypeChange,
  autresEmploisExperience,
  onAutresEmploisExperienceChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  contactName,
  onContactNameChange,
  contactPhone,
  onContactPhoneChange,
  isOwnerVerified,
  onAutoGenerateTitle,
  error,
}) => {
  const currentCarModels = React.useMemo(() => {
    const brand = CAR_BRANDS_AND_MODELS.find((b) => b.brand === vehicleBrand);
    return brand ? brand.models : ['Standard'];
  }, [vehicleBrand]);

  return (
    <div className="space-y-5 animate-in fade-in">
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Champs spécifiques par catégorie */}
      {mainCategory === 'IMMOBILIER' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
              Type de Bien Immobilier ({transactionType === 'VENTE' ? 'Vente' : 'Location'})
            </span>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Catégorie de bien immobilier *
            </label>
            <select
              value={propertyType}
              onChange={(e) => onPropertyTypeChange(e.target.value as PropertyType)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
              id="publish-property-type-select"
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {mainCategory === 'MATERIEL_ROULANT' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-blue-600" />
            <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
              Matériel Roulant ({transactionType === 'VENTE' ? 'Vente' : 'Location'})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Catégorie *
              </label>
              <select
                value={vehicleCategory}
                onChange={(e) => {
                  const cat = e.target.value as RollingStockCategory;
                  onVehicleCategoryChange(cat);
                  if (cat === 'Camions Bennes') {
                    onVehicleBrandChange(DUMP_TRUCK_BRANDS[0]);
                  } else if (cat === 'Voitures') {
                    onVehicleBrandChange('TOYOTA');
                    onVehicleModelChange('Hilux');
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="Voitures">Voitures</option>
                <option value="Camions Bennes">Camions Bennes</option>
                <option value="Camions Citernes">Camions Citernes</option>
                <option value="Engins de chantiers">Engins de chantiers</option>
                <option value="Motos">Motos</option>
                <option value="Vélos">Vélos</option>
              </select>
            </div>

            {vehicleCategory === 'Voitures' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Marque *
                  </label>
                  <select
                    value={vehicleBrand}
                    onChange={(e) => {
                      onVehicleBrandChange(e.target.value);
                      const b = CAR_BRANDS_AND_MODELS.find((x) => x.brand === e.target.value);
                      if (b) onVehicleModelChange(b.models[0]);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  >
                    {CAR_BRANDS_AND_MODELS.map((b) => (
                      <option key={b.brand} value={b.brand}>
                        {b.brand}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Modèle *
                  </label>
                  <select
                    value={vehicleModel}
                    onChange={(e) => onVehicleModelChange(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  >
                    {currentCarModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mainCategory === 'BRIC_A_BRAC' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-600" />
            <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
              Catégorie Bric-à-Brac
            </span>
          </div>
          <select
            value={bricCategory}
            onChange={(e) => onBricCategoryChange(e.target.value as BricABracCategory)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500 min-h-[44px]"
          >
            {BRIC_A_BRAC_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {mainCategory === 'EMPLOI' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-purple-600" />
            <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
              Métiers & Emplois de Maisons
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Type de démarche *
              </label>
              <select
                value={jobKind}
                onChange={(e) => onJobKindChange(e.target.value as JobAdKind)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500 min-h-[44px]"
              >
                <option value="OFFRE_EMPLOI">Je recrute (Offre d'emploi)</option>
                <option value="DEMANDE_EMPLOI">Je cherche un emploi (Candidature)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Métier domestique *
              </label>
              <select
                value={domesticJobType}
                onChange={(e) => onDomesticJobTypeChange(e.target.value as DomesticJobType)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500 min-h-[44px]"
              >
                {DOMESTIC_JOB_TYPES.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {mainCategory === 'COURS_A_DOMICILE' && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
              Cours & Soutien Scolaire
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Type de démarche *
              </label>
              <select
                value={tutoringKind}
                onChange={(e) => onTutoringKindChange(e.target.value as TutoringAdKind)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              >
                <option value="OFFRE">Je donne des cours (Enseignant/Répétiteur)</option>
                <option value="DEMANDE">Je cherche un répétiteur pour mon enfant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Matière enseignée *
              </label>
              <select
                value={tutoringSubject}
                onChange={(e) => onTutoringSubjectChange(e.target.value as TutoringSubject)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              >
                {TUTORING_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Niveau scolaire *
              </label>
              <select
                value={tutoringLevel}
                onChange={(e) => onTutoringLevelChange(e.target.value as TutoringLevel)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              >
                {TUTORING_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {mainCategory === 'NECROLOGIE' && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" />
            <span className="font-black text-xs uppercase tracking-wide text-rose-300">
              Nécrologie & Avis d'Obsèques
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nom complet du défunt *
              </label>
              <input
                type="text"
                value={necroDeceasedName}
                onChange={(e) => onNecroDeceasedNameChange(e.target.value)}
                placeholder="Ex: Feu Jean-Félix Mba"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Ministère / Institution de tutelle
              </label>
              <select
                value={necroMinistry}
                onChange={(e) => onNecroMinistryChange(e.target.value as NecrologieMinistry)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              >
                {NECROLOGIE_MINISTRIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Lieu des obsèques / veillée
              </label>
              <input
                type="text"
                value={necroCeremonyLocation}
                onChange={(e) => onNecroCeremonyLocationChange(e.target.value)}
                placeholder="Ex: Casep-Ga, Libreville"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Contact de la famille
              </label>
              <input
                type="text"
                value={necroFamilyContact}
                onChange={(e) => onNecroFamilyContactChange(e.target.value)}
                placeholder="Ex: 077 12 34 56"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:ring-2 focus:ring-rose-500 min-h-[44px]"
              />
            </div>
          </div>
        </div>
      )}

      {mainCategory === 'AVIS_DE_RECHERCHE' && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-red-600" />
            <span className="font-black text-xs uppercase tracking-wide text-red-900">
              Avis de Recherche & Signalements Publics
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catégorie *
              </label>
              <select
                value={avisCategory}
                onChange={(e) => onAvisCategoryChange(e.target.value as AvisRechercheCategory)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-red-600 min-h-[44px]"
              >
                {AVIS_RECHERCHE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nom ou désignation de la cible *
              </label>
              <input
                type="text"
                value={avisTargetName}
                onChange={(e) => onAvisTargetNameChange(e.target.value)}
                placeholder="Ex: Titre foncier N° 4589 / Chien Husky..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-red-600 min-h-[44px]"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dernier lieu vu
              </label>
              <input
                type="text"
                value={avisLastSeenLocation}
                onChange={(e) => onAvisLastSeenLocationChange(e.target.value)}
                placeholder="Ex: Carrefour Charbonnages, Libreville"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-red-600 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Récompense financière promise (FCFA, facultatif)
              </label>
              <input
                type="number"
                value={avisRewardAmount}
                onChange={(e) => onAvisRewardAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 100000"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-red-600 min-h-[44px]"
              />
            </div>
          </div>
        </div>
      )}

      {mainCategory === 'EVENEMENTS' && (
        <div className="bg-fuchsia-50/70 border border-fuchsia-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-fuchsia-700 shrink-0" />
            <span className="font-black text-xs text-fuchsia-950 uppercase tracking-wide">
              Événement : Mariage, Soirée, Gala, Anniversaire...
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Type d'événement *
              </label>
              <select
                value={eventType}
                onChange={(e) => onEventTypeChange(e.target.value as EventType)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-fuchsia-600 min-h-[44px]"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lieu ou salle *
              </label>
              <input
                type="text"
                value={eventVenue}
                onChange={(e) => onEventVenueChange(e.target.value)}
                placeholder="Ex: Salle des fêtes de la Sablière"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-fuchsia-600 min-h-[44px]"
              />
            </div>
          </div>

          <EventDateTimePicker
            eventDate={eventDate}
            onDateChange={onEventDateChange}
            eventTime={eventTime}
            onTimeChange={onEventTimeChange}
            idPrefix="publish-event"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Organisateur ou famille (facultatif)
              </label>
              <input
                type="text"
                value={eventOrganizer}
                onChange={(e) => onEventOrganizerChange(e.target.value)}
                placeholder="Ex: Famille Mba"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-fuchsia-600 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tenue exigée (facultatif)
              </label>
              <input
                type="text"
                value={eventDressCode}
                onChange={(e) => onEventDressCodeChange(e.target.value)}
                placeholder="Ex: Tenue de soirée"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-fuchsia-600 min-h-[44px]"
              />
            </div>
          </div>
        </div>
      )}

      {mainCategory === 'AUTRES_EMPLOIS' && (
        <div className="bg-teal-50 border border-teal-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-teal-700" />
            <span className="font-black text-xs text-teal-950 uppercase tracking-wide">
              Autres Emplois, Métiers & Recrutement
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Métier / Spécialité / Poste *
              </label>
              <input
                type="text"
                value={autresEmploisProfession}
                onChange={(e) => onAutresEmploisProfessionChange(e.target.value)}
                placeholder="Ex: Comptable, Ingénieur..."
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-teal-600 min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Type de contrat
              </label>
              <select
                value={autresEmploisContractType}
                onChange={(e) => onAutresEmploisContractTypeChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-teal-600 min-h-[44px]"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Stage">Stage</option>
                <option value="Prestation / Freelance">Prestation / Freelance</option>
                <option value="Intérim">Intérim</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Expérience
              </label>
              <input
                type="text"
                value={autresEmploisExperience}
                onChange={(e) => onAutresEmploisExperienceChange(e.target.value)}
                placeholder="Ex: 3 ans"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-teal-600 min-h-[44px]"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Titre de l'annonce */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Titre de l'annonce *
          </label>
          <button
            type="button"
            onClick={onAutoGenerateTitle}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer min-h-[32px]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Générer automatiquement</span>
          </button>
        </div>
        <input
          type="text"
          value={title}
          maxLength={120}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Ex: Villa de standing 4 chambres avec piscine à La Sablière"
          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
          id="publish-title-input"
        />
        <div className="text-right text-[10px] text-slate-400">
          {title.length} / 120 caractères
        </div>
      </div>

      {/* 3. Description détaillée (min 50 car.) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Description détaillée * (min. 50 caractères)
          </label>
          <span
            className={`text-xs font-bold ${
              description.trim().length >= 50 ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {description.trim().length} / 50 car. min.
          </span>
        </div>
        <textarea
          value={description}
          rows={5}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Décrivez précisément votre bien ou prestation : caractéristiques, état général, modalités de visite, conditions particulières..."
          className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 min-h-[110px]"
          id="publish-desc-input"
        />
      </div>

      {/* 4. Coordonnées de l'annonceur */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
            Coordonnées de contact
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-600">
                Nom ou Agence *
              </label>
              {isOwnerVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Vérifié (Verrouillé)</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={contactName}
              disabled={isOwnerVerified}
              onChange={(e) => onContactNameChange(e.target.value)}
              placeholder="Ex: Jean Mba ou Agence Prestige"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Téléphone / WhatsApp au Gabon *
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => onContactPhoneChange(e.target.value)}
              placeholder="Ex: 077 00 11 22 ou +241..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

