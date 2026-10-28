'use client';

/**
 * AreaForm — add or edit an area: English name, Hindi and Marathi names, pincodes.
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { parsePincodes } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {Object} [props.initial] - Area to edit (empty = new area)
 * @param {(values: Object) => Promise<void>} props.onSubmit - Save handler
 * @param {() => void} props.onCancel - Close without saving
 * @param {string} props.submitLabel - Button text
 * @returns {JSX.Element}
 */
export default function AreaForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [name, setName] = useState(initial?.name || '');
  const [nameHi, setNameHi] = useState(initial?.nameTranslations?.hi || '');
  const [nameMr, setNameMr] = useState(initial?.nameTranslations?.mr || '');
  const [pincodeText, setPincodeText] = useState((initial?.pincodes || []).join(', '));
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  /** Validate pincodes locally, then save. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const { pincodes, invalid } = parsePincodes(pincodeText);
    if (invalid.length) {
      setError(`These are not 6-digit pincodes: ${invalid.join(', ')}`);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        pincodes,
        nameTranslations: { hi: nameHi.trim() || undefined, mr: nameMr.trim() || undefined },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card bg-bg-band p-4">
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input
          label="Area name (English)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Hindi name"
          value={nameHi}
          onChange={(e) => setNameHi(e.target.value)}
          lang="hi"
        />
        <Input
          label="Marathi name"
          value={nameMr}
          onChange={(e) => setNameMr(e.target.value)}
          lang="mr"
        />
      </div>
      <Input
        label="Pincodes"
        hint="Separate with commas. Several areas can share a pincode."
        value={pincodeText}
        onChange={(e) => setPincodeText(e.target.value)}
        inputMode="numeric"
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || name.trim().length < 2}>
          {isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
