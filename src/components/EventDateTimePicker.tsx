import React, { useMemo } from 'react';
import { Calendar, Clock, X, AlertCircle } from 'lucide-react';
import { formatEventDate } from '../utils/formatters';
import { validateEventSchedule } from '../utils/eventValidation';

const FRENCH_MONTHS = [
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' },
];

const HOURS_24 = Array.from({ length: 24 }, (_, i) => {
  const str = i.toString().padStart(2, '0');
  return { value: str, label: `${str}h` };
});

const MINUTES = [
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'
];

interface EventDateTimePickerProps {
  eventDate: string; // YYYY-MM-DD
  onDateChange: (dateStr: string) => void;
  eventTime?: string; // HH:mm
  onTimeChange: (timeStr: string) => void;
  idPrefix?: string;
}

export const EventDateTimePicker: React.FC<EventDateTimePickerProps> = ({
  eventDate,
  onDateChange,
  eventTime = '',
  onTimeChange,
  idPrefix = 'publish-event',
}) => {
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => [currentYear, currentYear + 1, currentYear + 2], [currentYear]);

  // Décomposition de la date YYYY-MM-DD
  const { year, month, day } = useMemo(() => {
    if (!eventDate || !eventDate.includes('-')) {
      return { year: '', month: '', day: '' };
    }
    const parts = eventDate.split('-');
    return {
      year: parts[0] || '',
      month: (parts[1] || '').padStart(2, '0'),
      day: (parts[2] || '').padStart(2, '0'),
    };
  }, [eventDate]);

  // Nombre de jours dans le mois sélectionné
  const daysInMonth = useMemo(() => {
    const y = parseInt(year, 10) || currentYear;
    const m = parseInt(month, 10) || 1;
    return new Date(y, m, 0).getDate();
  }, [year, month, currentYear]);

  const daysList = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0'));
  }, [daysInMonth]);

  const scheduleValidation = useMemo(() => {
    if (!eventDate || !eventTime) return null;
    return validateEventSchedule(eventDate, eventTime);
  }, [eventDate, eventTime]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const isDateInPast = Boolean(eventDate && eventDate < todayIso);

  const handleDayChange = (newDay: string) => {
    if (!newDay) {
      onDateChange('');
      return;
    }
    const y = year || currentYear.toString();
    const m = month || (new Date().getMonth() + 1).toString().padStart(2, '0');
    onDateChange(`${y}-${m}-${newDay}`);
  };

  const handleMonthChange = (newMonth: string) => {
    if (!newMonth) {
      onDateChange('');
      return;
    }
    const y = year || currentYear.toString();
    let d = day || (new Date().getDate()).toString().padStart(2, '0');
    const maxDays = new Date(parseInt(y, 10), parseInt(newMonth, 10), 0).getDate();
    if (parseInt(d, 10) > maxDays) {
      d = maxDays.toString().padStart(2, '0');
    }
    onDateChange(`${y}-${newMonth}-${d}`);
  };

  const handleYearChange = (newYear: string) => {
    if (!newYear) {
      onDateChange('');
      return;
    }
    const m = month || (new Date().getMonth() + 1).toString().padStart(2, '0');
    let d = day || (new Date().getDate()).toString().padStart(2, '0');
    const maxDays = new Date(parseInt(newYear, 10), parseInt(m, 10), 0).getDate();
    if (parseInt(d, 10) > maxDays) {
      d = maxDays.toString().padStart(2, '0');
    }
    onDateChange(`${newYear}-${m}-${d}`);
  };

  // Décomposition de l'heure HH:mm (format 24h)
  const { hour, minute } = useMemo(() => {
    if (!eventTime || !eventTime.includes(':')) {
      return { hour: '', minute: '00' };
    }
    const [h, m] = eventTime.split(':');
    return { hour: h || '', minute: m || '00' };
  }, [eventTime]);

  const handleHourChange = (newHour: string) => {
    if (!newHour) {
      onTimeChange('');
    } else {
      const m = minute || '00';
      onTimeChange(`${newHour}:${m}`);
    }
  };

  const handleMinuteChange = (newMinute: string) => {
    const h = hour || '18'; // Heure par défaut à 18h si minute sélectionnée en premier
    onTimeChange(`${h}:${newMinute}`);
  };

  const handleClearTime = () => {
    onTimeChange('');
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {/* Date de l'événement (contexte gabonais : Jour, Mois en français, Année) */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-fuchsia-600" />
          <span>Date de l'événement *</span>
        </label>

        <div className="grid grid-cols-3 gap-1.5">
          {/* Jour */}
          <select
            value={day}
            onChange={(e) => handleDayChange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-fuchsia-500"
            id={`${idPrefix}-day-select`}
            aria-label="Jour de l'événement"
          >
            <option value="">Jour</option>
            {daysList.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Mois en français */}
          <select
            value={month}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-fuchsia-500"
            id={`${idPrefix}-month-select`}
            aria-label="Mois de l'événement"
          >
            <option value="">Mois</option>
            {FRENCH_MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Année */}
          <select
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-fuchsia-500"
            id={`${idPrefix}-year-select`}
            aria-label="Année de l'événement"
          >
            <option value="">Année</option>
            {years.map((y) => (
              <option key={y} value={y.toString()}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {eventDate && (
          isDateInPast ? (
            <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>La date ne peut pas être dans le passé</span>
            </p>
          ) : (
            <p className="text-[11px] font-bold text-fuchsia-700 capitalize flex items-center gap-1">
              <span>✓</span>
              <span>{formatEventDate(eventDate)}</span>
            </p>
          )
        )}
      </div>

      {/* Heure de début (format 24 heures gabonais : 00h à 23h) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-fuchsia-600" />
            <span>Heure de début (24h) *</span>
          </label>
          {eventTime && (
            <button
              type="button"
              onClick={handleClearTime}
              className="text-[10px] text-slate-400 hover:text-red-600 font-semibold flex items-center gap-0.5 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Effacer</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {/* Heure 24h */}
          <select
            value={hour}
            onChange={(e) => handleHourChange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-fuchsia-500"
            id={`${idPrefix}-hour-select`}
            aria-label="Heure de début"
          >
            <option value="">Heure (ex: 18h)</option>
            {HOURS_24.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>

          {/* Minute */}
          <select
            value={hour ? minute : ''}
            disabled={!hour}
            onChange={(e) => handleMinuteChange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
            id={`${idPrefix}-minute-select`}
            aria-label="Minute de début"
          >
            <option value="00">00 min</option>
            {MINUTES.filter((m) => m !== '00').map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>

        {eventTime ? (
          scheduleValidation && !scheduleValidation.isValid ? (
            <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{scheduleValidation.error}</span>
            </p>
          ) : (
            <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <span>✓</span>
              <span>Début prévu à {hour}h{minute}</span>
            </p>
          )
        ) : (
          <p className="text-[11px] text-slate-400">
            Horaires 24h (ex: 18h30, 20h00)
          </p>
        )}
      </div>
    </div>
  );

};
