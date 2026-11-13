'use client';

/**
 * KycDocumentField — upload one KYC document privately (signed upload straight to
 * Cloudinary as an authenticated asset; only SaathMein staff can open it).
 */
import { useId, useRef, useState } from 'react';
import { CircleCheck, FileUp, Loader2, RefreshCw } from 'lucide-react';
import { uploadKycDocument } from '@/services/seller.service';
import { KYC_DOC_LABELS } from '@/utils/constants';
import { cn } from '@/utils/genericFunctions';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/jpeg,image/png';

/**
 * @param {Object} props
 * @param {string} props.docType - KYC document type
 * @param {boolean} [props.required] - Shows "Required"
 * @param {Object|null} props.value - Uploaded document (from the upload) or null
 * @param {(doc: Object) => void} props.onUploaded - Called with the verified upload fields
 * @returns {JSX.Element}
 */
export default function KycDocumentField({ docType, required = false, value, onUploaded }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  /** Upload the chosen file. */
  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError('This file is larger than 10 MB. Use a smaller scan or photo.');
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      onUploaded(await uploadKycDocument(docType, file));
      setFileName(file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-button border p-4 sm:flex-row sm:items-center',
        value ? 'border-primary/40 bg-primary/5' : 'border-line bg-surface',
        error && 'border-danger',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">
          {KYC_DOC_LABELS[docType]}
          {required ? (
            <span className="ml-2 text-xs font-semibold text-muted">Required</span>
          ) : null}
        </p>
        {value ? (
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-primary-text">
            <CircleCheck className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {fileName || 'Uploaded'}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-muted">PDF, JPG or PNG, up to 10 MB</p>
        )}
        {error ? (
          <p role="alert" className="mt-1 text-sm font-medium text-danger-text">
            {error}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={handleChange}
        disabled={isUploading}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        aria-label={`${value ? 'Replace' : 'Upload'} ${KYC_DOC_LABELS[docType]}`}
        className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-button border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-bg-band disabled:opacity-50 sm:self-auto"
      >
        {isUploading ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : value ? (
          <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
        ) : (
          <FileUp className="size-4" strokeWidth={2} aria-hidden="true" />
        )}
        {isUploading ? 'Uploading' : value ? 'Replace' : 'Upload'}
      </button>
    </div>
  );
}
