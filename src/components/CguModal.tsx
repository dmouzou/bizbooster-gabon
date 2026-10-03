import React, { useState } from 'react';
import { X, ShieldAlert, FileText, CheckCircle2, AlertTriangle, Scale, Lock, Search, Printer } from 'lucide-react';
import { CGU_METADATA, CGU_SECTIONS } from '../data/cguData';

interface CguModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const CguModal: React.FC<CguModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string>('preambule');

  if (!isOpen) return null;

  const filteredSections = CGU_SECTIONS.filter((section) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(q) ||
      section.content.some((p) => p.toLowerCase().includes(q))
    );
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="app-modal-overlay"
      onClick={onClose}
    >
      <div
        className="app-modal-dialog bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl border border-slate-300/80 flex flex-col animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        id="cgu-modal-container"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-emerald-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-sm">
                  Document Officiel
                </span>
                <span className="text-xs text-emerald-300 font-bold">
                  Version {CGU_METADATA.version} • {CGU_METADATA.effectiveDate}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Conditions Générales d'Utilisation & Charte Déontologique
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors"
              title="Imprimer ou enregistrer en PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Disclaimer Highlight Banner (Item 2 Requirement) */}
        <div className="bg-amber-500/10 border-b border-amber-300/60 px-6 py-3 shrink-0 flex items-start gap-3 text-amber-950">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <strong className="font-extrabold text-amber-900 block">
              Clause de Non-Responsabilité & Consignes de Sécurité (Gabon) :
            </strong>
            BIZBOOSTER est un hébergeur technique intermédiaire de mise en relation. Nous ne participons à aucune transaction directe, ne percevons aucun paiement d'achat et déclinons toute responsabilité sur l'état des biens ou la moralité des parties. Ne versez <u>JAMAIS d'acompte mobile money</u> avant inspection physique en personne dans un lieu public sécurisé.
          </div>
        </div>

        {/* Search bar inside modal */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans la charte (ex: non-responsabilité, acompte, titre foncier, CNI)..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-emerald-500"
            />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Body with Sidebar navigation and Content area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Table of contents sidebar (desktop) */}
          <div className="hidden md:block w-64 border-r border-slate-200 p-4 bg-slate-50/50 overflow-y-auto shrink-0 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-2 mb-2">
              Sommaire des Articles
            </span>
            {CGU_SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#sec-${sec.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveSectionId(sec.id);
                  const el = document.getElementById(`sec-${sec.id}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`block px-2.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                  activeSectionId === sec.id
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {sec.title}
              </a>
            ))}
          </div>

          {/* Main content view */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-8 text-xs text-slate-700 leading-relaxed">
            {filteredSections.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Aucun article ne correspond à votre recherche « {searchQuery} ».</p>
              </div>
            ) : (
              filteredSections.map((section) => (
                <div
                  key={section.id}
                  id={`sec-${section.id}`}
                  className={`scroll-mt-4 rounded-2xl p-4 sm:p-5 border transition-all ${
                    section.id === 'clause-non-responsabilite'
                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-400/20'
                      : 'bg-white border-slate-200/80 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {section.id === 'clause-non-responsabilite' ? (
                      <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <h3 className={`font-black text-sm ${
                      section.id === 'clause-non-responsabilite' ? 'text-amber-950' : 'text-slate-900'
                    }`}>
                      {section.title}
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {section.content.map((paragraph, pIdx) => (
                      <p
                        key={pIdx}
                        className={
                          section.id === 'clause-non-responsabilite'
                            ? 'text-amber-950 font-medium'
                            : 'text-slate-600'
                        }
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Legal footer reference */}
            <div className="pt-6 border-t border-slate-200 text-[11px] text-slate-400 space-y-1">
              <p>BIZBOOSTER Gabon • Plateforme d'annonces classées régie par le Droit Gabonais.</p>
              <p>Juridiction compétente : Tribunaux civils et commerciaux de Libreville (République Gabonaise).</p>
              <p>Contact support & modération : {CGU_METADATA.supportContact}</p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Document opposable à tout utilisateur de BIZBOOSTER</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Fermer
            </button>
            {showAcceptButton && onAccept && (
              <button
                type="button"
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>J'accepte la Charte & les CGU</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
