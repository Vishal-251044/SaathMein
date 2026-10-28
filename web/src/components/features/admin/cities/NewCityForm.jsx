'use client';

/**
 * NewCityForm — add a launch city (starts switched OFF so it can be set up before buyers see it).
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { useCreateCity } from '@/hooks/useAdminCities';

/**
 * @param {Object} props
 * @param {() => void} props.onDone - Close the form
 * @returns {JSX.Element}
 */
export default function NewCityForm({ onDone }) {
  const createCity = useCreateCity();
  const [form, setForm] = useState({
    name: '',
    state: 'Maharashtra',
    hi: '',
    mr: '',
    lat: '',
    lng: '',
  });
  const [error, setError] = useState(null);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  /** Validate coordinates (optional) and create the city. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    const hasCoordinates = form.lat !== '' || form.lng !== '';
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (hasCoordinates && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
      setError('Latitude and longitude must both be numbers, e.g. 18.5204 and 73.8567');
      return;
    }
    try {
      await createCity.mutateAsync({
        name: form.name.trim(),
        state: form.state.trim(),
        nameTranslations: { hi: form.hi.trim() || undefined, mr: form.mr.trim() || undefined },
        location: hasCoordinates ? [lng, lat] : undefined,
        active: false,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <h2 className="text-lg font-bold text-ink">New city</h2>
      {error ? <Alert>{error}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="City name (English)" value={form.name} onChange={set('name')} required />
        <Input label="State" value={form.state} onChange={set('state')} required />
        <Input label="Hindi name" value={form.hi} onChange={set('hi')} lang="hi" />
        <Input label="Marathi name" value={form.mr} onChange={set('mr')} lang="mr" />
        <Input
          label="Centre latitude"
          hint="Used to detect the city from GPS"
          value={form.lat}
          onChange={set('lat')}
          inputMode="decimal"
        />
        <Input
          label="Centre longitude"
          value={form.lng}
          onChange={set('lng')}
          inputMode="decimal"
        />
      </div>
      <p className="text-sm text-muted">
        New cities start switched off. Add areas, then switch the city on.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={createCity.isPending || form.name.trim().length < 2}>
          {createCity.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Create city
        </Button>
      </div>
    </form>
  );
}
