import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Building2, Car, Package, Briefcase, Layers, ChevronLeft, ChevronRight, GraduationCap, Heart, Search, UserCheck } from 'lucide-react';
import { MainCategory } from '../types';

interface CategoryBarProps {
  activeCategory: MainCategory | 'ALL';
  onSelectCategory?: (category: MainCategory | 'ALL') => void;
  setActiveCategory?: (category: MainCategory | 'ALL') => void;
  categoryCounts: Record<MainCategory | 'ALL', number>;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  activeCategory,
  onSelectCategory,
  setActiveCategory,
  categoryCounts,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleSelect = (category: MainCategory | 'ALL') => {
    if (onSelectCategory) onSelectCategory(category);
    if (setActiveCategory) setActiveCategory(category);
  };

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const overflow = maxScroll > 2;
      setHasOverflow(overflow);
      setCanScrollLeft(el.scrollLeft > 5);
      setCanScrollRight(el.scrollLeft < maxScroll - 5);
      if (overflow && maxScroll > 0) {
        setScrollProgress(Math.min(1, Math.max(0, el.scrollLeft / maxScroll)));
      } else {
        setScrollProgress(0);
      }
    }
  }, []);

  useEffect(() => {
    updateScrollState();
    const timer = setTimeout(updateScrollState, 100);
    window.addEventListener('resize', updateScrollState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 280;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(updateScrollState, 320);
    }
  };

  // Convert vertical mouse wheel to horizontal scrolling (no Shift key required)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current && e.deltaY !== 0) {
      const el = scrollContainerRef.current;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) {
        el.scrollLeft += e.deltaY;
        updateScrollState();
      }
    }
  };

  // Drag-to-scroll support for mouse on categories
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeftState(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftState - walk;
    updateScrollState();
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Interactive slider track click
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderTrackRef.current || !scrollContainerRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const el = scrollContainerRef.current;
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: ratio * maxScroll, behavior: 'smooth' });
    setTimeout(updateScrollState, 300);
  };

  // Dragging the slider thumb cursor
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startClientX = e.clientX;
    const initialLeft = scrollContainerRef.current?.scrollLeft || 0;
    const trackWidth = sliderTrackRef.current?.clientWidth || 1;
    const maxScroll = (scrollContainerRef.current?.scrollWidth || 0) - (scrollContainerRef.current?.clientWidth || 0);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      const deltaX = moveEvent.clientX - startClientX;
      const deltaScroll = (deltaX / trackWidth) * maxScroll;
      scrollContainerRef.current.scrollLeft = Math.max(0, Math.min(maxScroll, initialLeft + deltaScroll));
      updateScrollState();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const categories: { id: MainCategory | 'ALL'; label: string; icon: React.ReactNode; subtitle: string }[] = [
    {
      id: 'ALL',
      label: 'TOUTES LES CATÉGORIES',
      subtitle: 'Catalogue complet',
      icon: <Layers className="w-5 h-5" />,
    },
    {
      id: 'IMMOBILIER',
      label: '1. IMMOBILIER',
      subtitle: '9 provinces • Vente & Location',
      icon: <Building2 className="w-5 h-5" />,
    },
    {
      id: 'MATERIEL_ROULANT',
      label: '2. MATÉRIEL ROULANT',
      subtitle: 'Voitures, Camions, Engins, Motos',
      icon: <Car className="w-5 h-5" />,
    },
    {
      id: 'BRIC_A_BRAC',
      label: '3. BRIC-À-BRAC',
      subtitle: 'Téléphonie, Électroménager, Meubles',
      icon: <Package className="w-5 h-5" />,
    },
    {
      id: 'EMPLOI',
      label: '4. EMPLOI & MAISONS',
      subtitle: 'Nounous, Cuisiniers, Gardiens',
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      id: 'COURS_A_DOMICILE',
      label: '5. COURS À DOMICILE',
      subtitle: 'Maths, PC, SVT, Français...',
      icon: <GraduationCap className="w-5 h-5" />,
    },
    {
      id: 'NECROLOGIE',
      label: '6. NÉCROLOGIE',
      subtitle: 'Éducation, Police, Armée, Santé...',
      icon: <Heart className="w-5 h-5" />,
    },
    {
      id: 'AVIS_DE_RECHERCHE',
      label: '7. AVIS DE RECHERCHE',
      subtitle: 'Personnes, Objets, Animaux perdus',
      icon: <Search className="w-5 h-5" />,
    },
    {
      id: 'AUTRES_EMPLOIS',
      label: '8. AUTRES EMPLOIS',
      subtitle: 'Demandeurs avec CV, Offres, Stages',
      icon: <UserCheck className="w-5 h-5" />,
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        {/* Scroller horizontal compact des catégories (avec support glisser, molette et tactile) */}
        <div
          ref={scrollContainerRef}
          onScroll={updateScrollState}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none select-none cursor-grab active:cursor-grabbing scroll-smooth"
        >
          {categories.map((cat) => {
            const isSelected = activeCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelect(cat.id)}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all text-left whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-400/40'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
                id={`cat-button-${cat.id.toLowerCase()}`}
                title={`${cat.label} • ${cat.subtitle}`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.icon}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs tracking-tight uppercase">{cat.label}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-emerald-200/80 text-emerald-900'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">{cat.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Navigation : Flèches gauche/droite et curseur slider interactif */}
        {hasOverflow && (
          <div className="flex items-center justify-center gap-3 pt-1.5">
            {/* Flèche gauche */}
            <button
              type="button"
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={`p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-white shadow-xs text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-all cursor-pointer ${
                !canScrollLeft ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
              }`}
              title="Faire défiler vers la gauche"
              aria-label="Faire défiler vers la gauche"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Curseur slider interactif */}
            <div
              ref={sliderTrackRef}
              onClick={handleTrackClick}
              className="w-48 sm:w-72 h-2 bg-slate-200 hover:bg-slate-300/80 rounded-full cursor-pointer relative shadow-inner transition-colors group"
              title="Curseur : glissez ou cliquez pour naviguer entre les catégories"
            >
              <div
                onMouseDown={handleThumbMouseDown}
                style={{
                  width: '32%',
                  left: `${scrollProgress * 68}%`,
                }}
                className="absolute top-0 bottom-0 bg-emerald-600 group-hover:bg-emerald-700 rounded-full cursor-grab active:cursor-grabbing shadow-sm transition-colors"
              />
            </div>

            {/* Flèche droite */}
            <button
              type="button"
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={`p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-white shadow-xs text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-all cursor-pointer ${
                !canScrollRight ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
              }`}
              title="Faire défiler vers la droite"
              aria-label="Faire défiler vers la droite"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
