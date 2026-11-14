import React, { useRef } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Video,
  Film,
  FileText,
  AlertCircle,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { PhotoMediaItem } from '../publishTypes';
import { getMaxPhotosAllowed } from '../schemas/types';
import { SubscriptionTier, MainCategory, AutresEmploisSubCategory } from '../../../types';

interface Step2PhotosProps {
  photos: PhotoMediaItem[];
  onPhotosChange: (photos: PhotoMediaItem[]) => void;
  tier?: SubscriptionTier | null;
  mainCategory: MainCategory;
  autresEmploisSubCategory?: AutresEmploisSubCategory;
  hasVideo: boolean;
  onHasVideoChange: (hasVideo: boolean) => void;
  videoFile: File | null;
  videoPreviewUrl: string | null;
  videoDuration: number | null;
  onVideoFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveVideo: () => void;
  cvFile: File | null;
  cvFileName: string;
  cvFileSize: number;
  onCvFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCv: () => void;
  mediaError: string | null;
  setMediaError: (err: string | null) => void;
}

export const Step2Photos: React.FC<Step2PhotosProps> = ({
  photos,
  onPhotosChange,
  tier,
  mainCategory,
  autresEmploisSubCategory,
  hasVideo,
  onHasVideoChange,
  videoFile,
  videoPreviewUrl,
  videoDuration,
  onVideoFileSelect,
  onRemoveVideo,
  cvFile,
  cvFileName,
  cvFileSize,
  onCvFileSelect,
  onRemoveCv,
  mediaError,
  setMediaError,
}) => {
  const maxPhotos = getMaxPhotosAllowed(tier);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selectedFiles: File[] = Array.from(files);
    e.target.value = '';

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 Mo
    for (const file of selectedFiles) {
      if (file.size > MAX_IMAGE_SIZE) {
        setMediaError(
          `La photo "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} Mo) dépasse la limite autorisée de 10 Mo.`
        );
        return;
      }
    }

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      setMediaError(
        `Limite atteinte : ${maxPhotos} photos maximum autorisées pour votre formule (${tier || 'Standard'}).`
      );
      return;
    }

    const filesToAdd = selectedFiles.slice(0, remainingSlots);
    if (selectedFiles.length > remainingSlots) {
      setMediaError(
        `Seules ${remainingSlots} photo(s) ont été ajoutées pour respecter le plafond de ${maxPhotos} photos.`
      );
    } else {
      setMediaError(null);
    }

    const newItems: PhotoMediaItem[] = filesToAdd.map((file, idx) => ({
      id: `file-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      url: URL.createObjectURL(file),
      file,
      name: file.name,
      size: file.size,
    }));

    onPhotosChange([...photos, ...newItems]);
  };

  const handleRemovePhoto = (index: number) => {
    const removed = photos[index];
    if (removed?.url && removed.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(removed.url);
      } catch {}
    }
    onPhotosChange(photos.filter((_, idx) => idx !== index));
    setMediaError(null);
  };

  const handleMovePhoto = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= photos.length) return;
    const updated = [...photos];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onPhotosChange(updated);
  };

  const isDemandeurEmploi =
    mainCategory === 'AUTRES_EMPLOIS' &&
    (autresEmploisSubCategory === "Demandeur d'emploi" || (autresEmploisSubCategory as any) === 'DEMANDE_EMPLOI');

  return (
    <div className="space-y-5 animate-in fade-in">
      {/* Photo Allowance Badge */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Galerie Photos de l'annonce
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Format WebP optimisé automatiquement (max 1280px).
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            {photos.length} / {maxPhotos} photos
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {tier ? `Forfait ${tier}` : 'Forfait Standard'}
          </span>
        </div>
      </div>

      {mediaError && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{mediaError}</span>
        </div>
      )}

      {/* Grid of uploaded photos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((item, index) => (
          <div
            key={item.id}
            className="group relative aspect-4/3 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-2xs"
          >
            <img
              src={item.url}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {index === 0 && (
              <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs">
                Photo principale
              </span>
            )}
            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => handleMovePhoto(index, index - 1)}
                  aria-label="Déplacer vers la gauche"
                  className="p-1.5 bg-white text-slate-800 rounded-lg hover:bg-slate-100 shadow-xs cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemovePhoto(index)}
                aria-label="Supprimer la photo"
                className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-xs cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {index < photos.length - 1 && (
                <button
                  type="button"
                  onClick={() => handleMovePhoto(index, index + 1)}
                  aria-label="Déplacer vers la droite"
                  className="p-1.5 bg-white text-slate-800 rounded-lg hover:bg-slate-100 shadow-xs cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        {photos.length < maxPhotos && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="aspect-4/3 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[110px]"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold">Ajouter une photo</span>
            <span className="text-[10px] text-emerald-700/80">
              {maxPhotos - photos.length} restante(s)
            </span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelect}
        className="hidden"
      />

      {/* Option Vidéo Descriptive (≤ 30s) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              Vidéo descriptive courte (facultatif, ≤ 30s, ≤ 50 Mo)
            </span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer min-h-[36px]">
            <input
              type="checkbox"
              checked={hasVideo}
              onChange={(e) => {
                onHasVideoChange(e.target.checked);
                if (!e.target.checked) onRemoveVideo();
              }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {hasVideo && (
          <div className="pt-2 border-t border-slate-200">
            {videoPreviewUrl ? (
              <div className="space-y-2">
                <video
                  src={videoPreviewUrl}
                  controls
                  playsInline
                  className="w-full max-h-48 rounded-xl bg-black"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-semibold">
                    {videoFile?.name} ({videoDuration ? `${videoDuration}s` : ''})
                  </span>
                  <button
                    type="button"
                    onClick={onRemoveVideo}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer min-h-[36px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer la vidéo</span>
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/50 hover:bg-purple-50 cursor-pointer min-h-[96px]">
                <Video className="w-6 h-6 text-purple-600 mb-1" />
                <span className="text-xs font-bold text-purple-900">
                  Sélectionner un fichier vidéo (MP4, WebM)
                </span>
                <span className="text-[10px] text-purple-700">Durée recommandée ≤ 30s</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={onVideoFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}
      </div>

      {/* CV / Document professionnel pour Demandeur d'emploi */}
      {isDemandeurEmploi && (
        <div className="bg-teal-50 border-2 border-teal-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-700 shrink-0" />
            <div>
              <span className="bg-teal-700 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-sm">
                Obligatoire
              </span>
              <h4 className="font-extrabold text-xs sm:text-sm text-teal-950 mt-0.5">
                Curriculum Vitae (CV) du demandeur d'emploi
              </h4>
            </div>
          </div>
          <p className="text-[11px] text-teal-800 leading-relaxed">
            Pour garantir le sérieux des candidatures présentées aux employeurs gabonais, l'attachement d'un CV au format .pdf, .docx ou .md (max 15 Mo) est obligatoire.
          </p>

          {cvFile ? (
            <div className="bg-white border border-teal-300 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{cvFileName}</p>
                  <p className="text-[10px] text-slate-500">
                    {(cvFileSize / (1024 * 1024)).toFixed(2)} Mo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onRemoveCv}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer min-h-[36px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Retirer</span>
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-teal-400 rounded-xl bg-white hover:bg-teal-50/50 cursor-pointer min-h-[80px]">
              <Upload className="w-5 h-5 text-teal-600 mb-1" />
              <span className="text-xs font-bold text-teal-900">
                Attacher mon CV (.pdf, .docx, .md)
              </span>
              <span className="text-[10px] text-teal-700">Taille maximale : 15 Mo</span>
              <input
                type="file"
                accept=".pdf,.docx,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
                onChange={onCvFileSelect}
                className="hidden"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
};
