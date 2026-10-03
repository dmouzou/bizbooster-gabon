#!/usr/bin/env python3
import re

file_path = "/home/loading/Documents/daniel/bizbooster-gabon/src/components/PublishAdModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update IMMOBILIER block to keep propertyType selection only
old_immo_regex = r"\{\/\* SPECIFIC FIELDS: IMMOBILIER \(9 Provinces > Villes > Quartiers as per Section B-1\) \*\/\}\s*\{mainCategory === 'IMMOBILIER' && \([\s\S]*?id=\"publish-property-type-select\"[\s\S]*?<\/select>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}"

new_immo_block = """{/* SPECIFIC FIELDS: IMMOBILIER (Point 2: Localisation étendue à toutes les catégories) */}
              {mainCategory === 'IMMOBILIER' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                      Type de Bien Immobilier
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Catégorie de bien immobilier *
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
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
              )}"""

content = re.sub(old_immo_regex, new_immo_block, content, count=1)

# 2. Update EMPLOI block to include jobKind distinction (Point 8)
old_emploi_regex = r"\{\/\* SPECIFIC FIELDS: EMPLOI \/ EMPLOYÉS DE MAISONS \(Section B-3\) \*\/\}\s*\{mainCategory === 'EMPLOI' && \([\s\S]*?id=\"publish-neighborhood-select\"?[\s\S]*?<\/select>\s*<\/div>\s*\)\}"
# Fallback simple string match
old_emploi_str = """              {/* SPECIFIC FIELDS: EMPLOI / EMPLOYÉS DE MAISONS (Section B-3) */}
              {mainCategory === 'EMPLOI' && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Spécialité Employé de Maison (Section B-3)
                  </label>
                  <select
                    value={domesticJobType}
                    onChange={(e) => setDomesticJobType(e.target.value as DomesticJobType)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                  >
                    {DOMESTIC_JOB_TYPES.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
              )}"""

new_emploi_block = """              {/* SPECIFIC FIELDS: EMPLOI (Point 8: Distinction Offre vs Demande d'emploi) */}
              {mainCategory === 'EMPLOI' && (
                <div className="bg-purple-50/80 border-2 border-purple-200 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-purple-700" />
                    <span className="font-black text-xs text-purple-950 uppercase tracking-wide">
                      Annonce Emploi & Métiers Domestiques
                    </span>
                  </div>

                  {/* Offre d'emploi (Recruteur) vs Demande d'emploi (Candidat) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Nature de l'annonce Emploi : Recrutez-vous ou cherchez-vous du travail ? *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setJobKind('OFFRE_EMPLOI');
                          setTransactionType('LOCATION');
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          jobKind === 'OFFRE_EMPLOI'
                            ? 'bg-purple-600 border-purple-700 text-white shadow-md ring-2 ring-purple-400/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50'
                        }`}
                      >
                        <div className="font-black text-xs flex items-center gap-1.5">
                          💼 OFFRE D'EMPLOI
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug ${jobKind === 'OFFRE_EMPLOI' ? 'text-purple-100' : 'text-slate-500'}`}>
                          Je recrute ou cherche un employé / travailleur
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setJobKind('DEMANDE_EMPLOI');
                          setTransactionType('CHERCHE_EMPLOI');
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          jobKind === 'DEMANDE_EMPLOI'
                            ? 'bg-teal-600 border-teal-700 text-white shadow-md ring-2 ring-teal-400/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50'
                        }`}
                      >
                        <div className="font-black text-xs flex items-center gap-1.5">
                          🙋 DEMANDE D'EMPLOI
                        </div>
                        <p className={`text-[11px] mt-1 leading-snug ${jobKind === 'DEMANDE_EMPLOI' ? 'text-teal-100' : 'text-slate-500'}`}>
                          Je cherche du travail et je propose mes compétences
                        </p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Métier Domestique ciblé *
                    </label>
                    <select
                      value={domesticJobType}
                      onChange={(e) => setDomesticJobType(e.target.value as DomesticJobType)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-purple-500"
                    >
                      {DOMESTIC_JOB_TYPES.map((j) => (
                        <option key={j} value={j}>
                          {j}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}"""

if old_emploi_str in content:
    content = content.replace(old_emploi_str, new_emploi_block)
else:
    print("WARNING: old_emploi_str not matched exactly!")

# 3. Remove duplicate province/city in COURS_A_DOMICILE
old_tutor_loc = """                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-indigo-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Province (Gabon)
                      </label>
                      <select
                        value={province}
                        onChange={(e) => {
                          setProvince(e.target.value);
                          const pObj = GABON_PROVINCES.find((p) => p.name === e.target.value);
                          if (pObj && pObj.cities.length > 0) {
                            setCity(pObj.cities[0].name);
                            setNeighborhood(pObj.cities[0].neighborhoods[0] || '');
                          }
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                      >
                        {GABON_PROVINCES.map((p) => (
                          <option key={p.code} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ville / Commune
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
                      >
                        {currentProvinceData.cities.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>"""

if old_tutor_loc in content:
    content = content.replace(old_tutor_loc, "")
else:
    print("WARNING: old_tutor_loc not matched exactly!")

# 4. Insert Global Location Block at the end of Step 1 (Point 2)
global_location_block = """              {/* LOCALISATION GÉOGRAPHIQUE AU GABON (Accessible à toutes les catégories - Point 2) */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                      Localisation spatiale au Gabon (9 Provinces)
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Quartier détaillé
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      1. Province du Gabon *
                    </label>
                    <select
                      value={province}
                      onChange={(e) => {
                        setProvince(e.target.value);
                        const pObj = GABON_PROVINCES.find((p) => p.name === e.target.value);
                        if (pObj && pObj.cities.length > 0) {
                          setCity(pObj.cities[0].name);
                          setNeighborhood(pObj.cities[0].neighborhoods[0] || '');
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                      id="publish-province-select"
                    >
                      {GABON_PROVINCES.map((p) => (
                        <option key={p.code} value={p.name}>
                          {p.name} ({p.capital})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      2. Ville / Commune *
                    </label>
                    <select
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        const cObj = currentProvinceData.cities.find((c) => c.name === e.target.value);
                        if (cObj && cObj.neighborhoods.length > 0) {
                          setNeighborhood(cObj.neighborhoods[0]);
                        }
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                      id="publish-city-select"
                    >
                      {currentProvinceData.cities.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quartier Détaillé - Point 2 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      3. Quartier / Précision du secteur *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Tapez librement pour détailler votre quartier
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      list="publish-neighborhood-suggestions"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      placeholder="Ex: Louis, Angondjé (Carrefour GP), Nzeng-Ayong, Oloumi..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                      id="publish-neighborhood-input"
                      required
                    />
                    <datalist id="publish-neighborhood-suggestions">
                      {currentCityData.neighborhoods.map((q) => (
                        <option key={q} value={q} />
                      ))}
                    </datalist>
                  </div>

                  {/* Suggestion pills from selected city */}
                  {currentCityData.neighborhoods.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">Suggestions rapides :</span>
                      {currentCityData.neighborhoods.slice(0, 6).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setNeighborhood(q)}
                          className={`text-[10px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                            neighborhood === q
                              ? 'bg-emerald-600 text-white border-emerald-700 font-bold'
                              : 'bg-white hover:bg-emerald-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CONTENT, MEDIA & STRICT CHAR LIMIT */}"""

old_step1_end = """            </div>
          )}

          {/* STEP 2: CONTENT, MEDIA & STRICT CHAR LIMIT */}"""

if old_step1_end in content:
    content = content.replace(old_step1_end, global_location_block)
else:
    print("WARNING: old_step1_end not matched exactly!")

# 5. Insert Ad Preview card at the top of Step 3 (Point 4)
step3_preview_card = """          {/* STEP 3: DURATION, BILLING & PAYMENT (Section C-b, C-d, C-e) */}
          {step === 3 && (
            <div className="space-y-6">
              {/* APERÇU ET VÉRIFICATION DE L'ANNONCE AVANT PAIEMENT (Point 4) */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-slate-700/80 space-y-4 animate-in fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-700/70">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                      Aperçu avant paiement
                    </span>
                    <h3 className="text-sm font-black text-white">
                      Vérifiez les informations de votre annonce
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Modifier la catégorie ou la localisation"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Éditer Étape 1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      title="Modifier les photos, le titre ou le prix"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Éditer Étape 2</span>
                    </button>
                  </div>
                </div>

                {/* Preview Mini Card */}
                <div className="flex flex-col sm:flex-row gap-4 bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700">
                  {/* Photo thumbnail */}
                  <div className="w-full sm:w-28 sm:h-28 h-36 rounded-xl overflow-hidden bg-slate-950 shrink-0 relative border border-slate-600">
                    <img
                      src={photos[0]?.url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=400&q=80'}
                      alt="Aperçu"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 bg-black/75 text-[10px] text-white px-1.5 py-0.2 rounded font-mono">
                      📷 {photos.length} photo{photos.length > 1 ? 's' : ''}
                      {hasVideo ? ' + 🎥' : ''}
                    </span>
                  </div>

                  {/* Summary details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-400 text-slate-950">
                        {mainCategory === 'IMMOBILIER' ? 'Immobilier' :
                         mainCategory === 'MATERIEL_ROULANT' ? 'Matériel Roulant' :
                         mainCategory === 'BRIC_A_BRAC' ? 'Bric-à-Brac' :
                         mainCategory === 'EMPLOI' ? (jobKind === 'DEMANDE_EMPLOI' ? "Demande d'Emploi" : "Offre d'Emploi") :
                         mainCategory === 'COURS_A_DOMICILE' ? (tutoringKind === 'OFFRE' ? 'Offre Cours' : 'Demande Cours') :
                         'Nécrologie'}
                      </span>
                      {mainCategory === 'IMMOBILIER' && (
                        <span className="text-[10px] font-bold bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md">
                          {transactionType === 'VENTE' ? 'Vente' : 'Location'} • {propertyType}
                        </span>
                      )}
                      {mainCategory === 'MATERIEL_ROULANT' && (
                        <span className="text-[10px] font-bold bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md">
                          {vehicleBrand} {vehicleModel}
                        </span>
                      )}
                      {mainCategory === 'EMPLOI' && (
                        <span className="text-[10px] font-bold bg-slate-700 text-slate-200 px-2 py-0.5 rounded-md">
                          {domesticJobType}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-white line-clamp-1">
                      {title || 'Titre de votre annonce'}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                      <div className="flex items-center gap-1 text-emerald-400 font-black">
                        <span>{formatFCFA(Number(price) || 0)}</span>
                        {priceUnit !== 'total' && (
                          <span className="text-[11px] font-normal text-emerald-200">/ {priceUnit}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-slate-300 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="truncate">{province} • {city} • <strong className="text-amber-300 font-bold">{neighborhood || 'Non précisé'}</strong></span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {description || 'Aucune description rédigée'}
                    </p>

                    <div className="text-[10px] text-slate-400 pt-0.5 flex flex-wrap items-center gap-2">
                      <span>Contact : <strong className="text-white">{contactName || 'Annonceur'}</strong> ({contactPhone})</span>
                      <span>•</span>
                      <span>Durée choisie : <strong className="text-amber-400">{durationDays} jours</strong></span>
                    </div>
                  </div>
                </div>
              </div>"""

old_step3_start = """          {/* STEP 3: DURATION, BILLING & PAYMENT (Section C-b, C-d, C-e) */}
          {step === 3 && (
            <div className="space-y-6">"""

if old_step3_start in content:
    content = content.replace(old_step3_start, step3_preview_card)
else:
    print("WARNING: old_step3_start not matched exactly!")

# 6. Update title auto-generation for Emploi (Point 8)
content = content.replace(
    "genTitle = `Offre d'emploi - ${domesticJobType}`;",
    "genTitle = `${jobKind === 'DEMANDE_EMPLOI' ? \"Demande d'emploi\" : \"Offre d'emploi\"} - ${domesticJobType}`;"
)

# 7. Validate neighborhood when moving step 1 -> step 2
old_step1_btn = """                if (step === 1) {
                  setStep(2);"""
new_step1_btn = """                if (step === 1) {
                  if (!neighborhood.trim()) {
                    setMediaError('Veuillez préciser ou détailler le quartier de votre bien / service.');
                    const el = document.getElementById('publish-neighborhood-input');
                    if (el) el.focus();
                    return;
                  }
                  setMediaError(null);
                  setStep(2);"""

if old_step1_btn in content:
    content = content.replace(old_step1_btn, new_step1_btn)
else:
    print("WARNING: old_step1_btn not matched exactly!")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Section replacements complete.")
