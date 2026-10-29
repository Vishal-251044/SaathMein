'use client';

/**
 * ProductImages — upload (signed, straight to Cloudinary) and remove product images.
 * Available once the product has been saved (uploads are tied to the product id).
 */
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { useRemoveProductImage, useUploadProductImage } from '@/hooks/useAdminCatalog';

const MAX_IMAGES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

/**
 * @param {Object} props
 * @param {Object} props.product - Saved admin product
 * @returns {JSX.Element}
 */
export default function ProductImages({ product }) {
  const fileInput = useRef(null);
  const [error, setError] = useState(null);
  const upload = useUploadProductImage();
  const remove = useRemoveProductImage();

  /** Upload the chosen files one by one. */
  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    setError(null);
    for (const file of files.slice(0, MAX_IMAGES - product.images.length)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} is larger than 8 MB`);
        continue;
      }
      try {
        await upload.mutateAsync({ productId: product.id, file });
      } catch (err) {
        setError(err.message);
      }
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Images</h2>
          <p className="text-sm text-muted">First image is the cover. Up to {MAX_IMAGES}.</p>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFiles}
          className="sr-only"
          aria-label="Choose images"
        />
        <Button
          variant="secondary"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending || product.images.length >= MAX_IMAGES}
        >
          {upload.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Add images
        </Button>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {product.images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {product.images.map((image, index) => (
            <li
              key={image.url}
              className="relative overflow-hidden rounded-button border border-line bg-bg-band"
            >
              {/* Imported images may come from any https host, so next/image's host list does not apply */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={`${product.brand} ${product.model} image ${index + 1}`}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => remove.mutate({ productId: product.id, url: image.url })}
                disabled={remove.isPending}
                aria-label={`Remove image ${index + 1}`}
                className="absolute right-1 top-1 grid size-11 place-items-center rounded-button bg-surface/90 text-danger shadow-card"
              >
                <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-button bg-bg-band px-4 py-6 text-center text-sm text-muted">
          No images yet.
        </p>
      )}
    </section>
  );
}
