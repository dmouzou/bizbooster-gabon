import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { storage, db } from '../services/firebase';
import { UserProfile } from '../types';

interface KycUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSuccess?: () => void;
}

export const KycUploadModal: React.FC<KycUploadModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [docType, setDocType] = useState<'CNI' | 'CARTE_SEJOUR' | 'PASSPORT'>(
    currentUser.idDocumentType || 'CNI'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentUser.idDocumentUrl || null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('La photo du document dépasse la taille maximale de 10 Mo.');
      return;
    }

    // Validate type: support image mime types or image extensions
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/i.test(file.name);
    if (!isImage && file.type) {
      setErrorMsg('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP, HEIC).');
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    // Read as Base64 data URL so it displays reliably inside the container on all devices
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (loadEvent.target?.result) {
        setPreviewUrl(loadEvent.target.result as string);
      }
    };
    reader.onerror = () => {
      // Fallback to object URL if FileReader fails
      setPreviewUrl(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !currentUser.idDocumentUrl) {
      setErrorMsg('Veuillez sélectionner une photo de votre pièce d’identité.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let finalUrl = currentUser.idDocumentUrl;

      if (selectedFile) {
        const storagePath = `kyc/${currentUser.id}/${Date.now()}_id_${selectedFile.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, selectedFile);
        finalUrl = await getDownloadURL(storageRef);
      }

      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'users', currentUser.id), {
        idDocumentUrl: finalUrl,
        idDocumentType: docType,
        idVerificationStatus: 'PENDING',
        idSubmittedAt: nowIso,
        idRejectionReason: null,
      });

      setSuccessMsg('Votre pièce d’identité a bien été transmise ! Elle sera examinée par notre équipe.');
      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('KYC Upload error:', err);
      setErrorMsg(err?.message || 'Erreur lors du téléversement. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-emerald-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">
                Badge « Vérifié » (Facultatif)
              </h3>
              <p className="text-xs text-emerald-300">
                Signal de confiance recommandé pour rassurer vos acquéreurs au Gabon
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {currentUser.idRejectionReason && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong>Précédent rejet :</strong> {currentUser.idRejectionReason}
                <div className="text-[11px] text-red-700 mt-0.5">
                  Veuillez fournir une nouvelle photo nette et conforme de votre document.
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Type de pièce d’identité
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDocType('CNI')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                  docType === 'CNI'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <CreditCard className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <span>CNI</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType('CARTE_SEJOUR')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                  docType === 'CARTE_SEJOUR'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <FileText className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <span>Carte Séjour</span>
              </button>

              <button
                type="button"
                onClick={() => setDocType('PASSPORT')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                  docType === 'PASSPORT'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4 mx-auto mb-1 text-indigo-600" />
                <span>Passeport</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              2. Photo de la pièce (en cours de validité)
            </label>

            {previewUrl ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-2">
                <img
                  src={previewUrl}
                  alt="Aperçu document"
                  className="w-full max-h-56 object-contain rounded-xl"
                />
                <label className="mt-2 block cursor-pointer text-center text-xs font-bold text-emerald-700 hover:underline">
                  Changer la photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <label className="cursor-pointer border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all">
                <Upload className="w-8 h-8 text-emerald-600 mb-2" />
                <span className="text-xs font-extrabold text-slate-900 block">
                  Téléverser une photo lisible de votre pièce
                </span>
                <span className="text-[11px] text-slate-500 mt-0.5">
                  Format image (JPG, PNG) • Maximum 10 Mo
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed">
            🔒 <strong>Confidentialité garantie :</strong> Vos documents sont chiffrés et consultés uniquement par les administrateurs BIZBOOSTER Gabon afin de vérifier votre identité légale.
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!selectedFile && !currentUser.idDocumentUrl)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi en cours…</span>
                </>
              ) : (
                <span>Transmettre ma pièce d’identité</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
