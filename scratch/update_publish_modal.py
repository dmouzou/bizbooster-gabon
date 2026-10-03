#!/usr/bin/env python3
import re

file_path = "/home/loading/Documents/daniel/bizbooster-gabon/src/components/PublishAdModal.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add JobAdKind to import
if "JobAdKind," not in content:
    content = content.replace(
        "DomesticJobType,\n",
        "DomesticJobType,\n  JobAdKind,\n"
    )

# 2. isOwnerVerified
old_iov = "  const isOwnerVerified = currentUser?.idVerificationStatus === 'VERIFIED';"
new_iov = "  const isOwnerVerified = currentUser?.idVerificationStatus === 'VERIFIED' || !!currentUser?.idVerifiedAt || (!!currentUser?.idDocumentUrl && currentUser?.idVerificationStatus !== 'REJECTED' && currentUser?.idVerificationStatus !== 'PENDING');"
if old_iov in content:
    content = content.replace(old_iov, new_iov)

# 3. Add jobKind state
old_state = "  // Emploi specifics\n  const [domesticJobType, setDomesticJobType] = useState<DomesticJobType>('Nounous (garde-bébé)');"
new_state = """  // Emploi specifics (Point 8: Distinction Offre d'emploi vs Demande d'emploi)
  const [domesticJobType, setDomesticJobType] = useState<DomesticJobType>('Nounous (garde-bébé)');
  const [jobKind, setJobKind] = useState<JobAdKind>('OFFRE_EMPLOI');"""
if old_state in content:
    content = content.replace(old_state, new_state)

# 4. Draft restore
old_resume = "    if (existingDraft.domesticJobType) setDomesticJobType(existingDraft.domesticJobType);"
new_resume = """    if (existingDraft.domesticJobType) setDomesticJobType(existingDraft.domesticJobType);
    if (existingDraft.jobKind) setJobKind(existingDraft.jobKind);"""
if old_resume in content:
    content = content.replace(old_resume, new_resume)

# 5. Draft discard
old_discard = "    setDomesticJobType('Nounous (garde-bébé)');"
new_discard = """    setDomesticJobType('Nounous (garde-bébé)');
    setJobKind('OFFRE_EMPLOI');"""
if old_discard in content:
    content = content.replace(old_discard, new_discard)

# 6. Draft auto-save
old_autosave = "          domesticJobType,\n"
new_autosave = "          domesticJobType,\n          jobKind,\n"
if old_autosave in content:
    content = content.replace(old_autosave, new_autosave)

# 7. Media upload texts (Point 3)
content = content.replace(
    "setUploadProgressText(`Téléversement de la photo ${i + 1}/${photos.length} sur Firebase Storage...`);",
    "setUploadProgressText(`Téléversement de la photo ${i + 1}/${photos.length} en cours...`);"
)
content = content.replace(
    "setUploadProgressText('Téléversement de la vidéo descriptive (≤ 30s) sur Firebase Storage...');",
    "setUploadProgressText('Téléversement de la vidéo descriptive (≤ 30s) en cours...');"
)
content = content.replace(
    "<h3>Téléversement sur Firebase Storage...</h3>",
    "<h3>Enregistrement sécurisé de vos médias...</h3>"
)
content = content.replace(
    "{/* Loading / Uploading Overlay during media transfer to Firebase Storage */}",
    "{/* Loading / Uploading Overlay during secure media transfer */}"
)
content = content.replace(
    '<h3 className="text-base font-extrabold tracking-tight">Téléversement sur Firebase Storage...</h3>',
    '<h3 className="text-base font-extrabold tracking-tight">Enregistrement sécurisé de vos médias...</h3>'
)

# 8. executeFinalPublish
old_efp = """        transactionType:
          mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT'
            ? transactionType
            : mainCategory === 'EMPLOI'
            ? 'EMPLOYER'
            : 'VENTE',"""
new_efp = """        transactionType:
          mainCategory === 'IMMOBILIER' || mainCategory === 'MATERIEL_ROULANT'
            ? transactionType
            : mainCategory === 'EMPLOI'
            ? (jobKind === 'DEMANDE_EMPLOI' ? 'CHERCHE_EMPLOI' : 'EMPLOYER')
            : 'VENTE',
        jobKind: mainCategory === 'EMPLOI' ? jobKind : undefined,"""
if old_efp in content:
    content = content.replace(old_efp, new_efp)

old_efp_iov = "isOwnerVerified: Boolean(currentUser?.idVerificationStatus === 'VERIFIED'),"
new_efp_iov = "isOwnerVerified: Boolean(currentUser?.idVerificationStatus === 'VERIFIED' || !!currentUser?.idVerifiedAt || (!!currentUser?.idDocumentUrl && currentUser?.idVerificationStatus !== 'REJECTED' && currentUser?.idVerificationStatus !== 'PENDING')),"
if old_efp_iov in content:
    content = content.replace(old_efp_iov, new_efp_iov)

# 9. Modal sizing / responsive padding (Point 1)
content = content.replace(
    '<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">',
    '<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5">'
)
content = content.replace(
    'className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 relative"',
    'className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 max-h-[96vh] sm:max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 relative"'
)
content = content.replace(
    '<div className="bg-emerald-950 text-white px-6 py-4 flex items-center justify-between border-b border-emerald-900">',
    '<div className="bg-emerald-950 text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-emerald-900">'
)
content = content.replace(
    '<div className="p-5 sm:p-7 overflow-y-auto space-y-6 flex-1">',
    '<div className="p-3.5 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1">'
)
content = content.replace(
    '<div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">',
    '<div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">'
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Base replacements complete.")
