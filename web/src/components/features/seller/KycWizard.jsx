'use client';

/**
 * KycWizard — /seller/kyc (TRU-1, PAY-4): business identity → shop address → documents →
 * payout bank → submit. Submitting also creates the dealer's Razorpay Route linked account.
 * Bank details are sent to Razorpay only; SaathMein keeps the last 4 digits.
 * While KYC is under review or approved, the page shows the status instead of the form.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BadgeCheck, Clock, Landmark, Loader2, Send } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import KycDocumentField from '@/components/features/seller/KycDocumentField';
import { usePublicCategories, usePublicCities, useSellerMe, useSubmitKyc } from '@/hooks/useSeller';
import { DURATION, EASE } from '@/utils/animations';
import {
  BUSINESS_TYPE_OPTIONS,
  KYC_DOC_LABELS,
  PAYOUT_STATUS_LABELS,
  ROUTES,
  VEHICLE_CATEGORY_SLUGS,
} from '@/utils/constants';
import { cn } from '@/utils/genericFunctions';

const STEPS = ['Business', 'Shop address', 'Documents', 'Payout bank'];
const OPTIONAL_DOCS = ['address_proof', 'cancelled_cheque'];
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;

/**
 * Initial form values from the dealer's saved data.
 * @param {Object} seller - Dealer (self view)
 * @returns {Object}
 */
const initialValues = (seller) => ({
  businessName: seller.businessName || '',
  businessType: seller.businessType || 'proprietorship',
  contactName: seller.contactName || '',
  contactPhone: (seller.contactPhone || '').replace(/^\+91/, ''),
  gstin: seller.gstin || '',
  pan: seller.pan || '',
  line1: seller.address?.line1 || '',
  line2: seller.address?.line2 || '',
  area: seller.address?.area || '',
  cityId: seller.address?.cityId || seller.cities?.[0] || '',
  pincode: seller.address?.pincode || '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifsc: seller.bank?.ifsc || '',
  beneficiaryName: seller.bank?.beneficiaryName || seller.businessName || '',
});

/**
 * Field errors for one step (the API validates everything again).
 * @param {number} step - Step index
 * @param {Object} values - Form values
 * @param {Object} documents - type → upload
 * @param {string[]} requiredDocs - Required document types
 * @returns {Object} Field → message
 */
const validateStep = (step, values, documents, requiredDocs) => {
  const errors = {};
  if (step === 0) {
    if (values.businessName.trim().length < 4)
      errors.businessName = 'Enter the name on your GST certificate';
    if (values.contactName.trim().length < 2) errors.contactName = 'Enter the contact person';
    if (!/^[6-9]\d{9}$/.test(values.contactPhone.replace(/[\s-]/g, '')))
      errors.contactPhone = 'Enter a 10-digit mobile number';
    if (!GSTIN_PATTERN.test(values.gstin)) errors.gstin = 'Enter the 15-character GSTIN';
    if (!PAN_PATTERN.test(values.pan)) errors.pan = 'Enter the 10-character PAN';
    else if (GSTIN_PATTERN.test(values.gstin) && values.gstin.slice(2, 12) !== values.pan) {
      errors.pan = 'This PAN does not match your GSTIN (characters 3 to 12)';
    }
  }
  if (step === 1) {
    if (values.line1.trim().length < 3) errors.line1 = 'Enter the shop address';
    if (!values.cityId) errors.cityId = 'Choose the city';
    if (!/^[1-9]\d{5}$/.test(values.pincode)) errors.pincode = 'Enter the 6-digit pincode';
  }
  if (step === 2) {
    const missing = requiredDocs.filter((type) => !documents[type]);
    if (missing.length)
      errors.documents = `Upload: ${missing.map((type) => KYC_DOC_LABELS[type]).join(', ')}`;
  }
  if (step === 3) {
    if (!/^\d{9,18}$/.test(values.accountNumber))
      errors.accountNumber = 'Account number must be 9 to 18 digits';
    if (values.accountNumber !== values.confirmAccountNumber)
      errors.confirmAccountNumber = 'The account numbers do not match';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(values.ifsc)) errors.ifsc = 'Enter the 11-character IFSC';
    if (values.beneficiaryName.trim().length < 3)
      errors.beneficiaryName = 'Enter the account holder name';
  }
  return errors;
};

/** Status panel shown while KYC is under review or approved. */
function KycStatusPanel({ seller }) {
  const approved = seller.kyc.status === 'approved';
  const Icon = approved ? BadgeCheck : Clock;
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <Icon
          className={cn('size-6 shrink-0', approved ? 'text-primary' : 'text-warning')}
          strokeWidth={2}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">
            {approved ? 'Your business is verified' : 'KYC under review'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {approved
              ? 'Contact SaathMein support if your GST, PAN or bank details change.'
              : 'Our team is checking your documents. We email you as soon as it is done.'}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">GSTIN</dt>
          <dd className="font-mono font-semibold text-ink">{seller.gstin}</dd>
        </div>
        <div>
          <dt className="text-muted">Payout account</dt>
          <dd className="font-semibold text-ink">
            {seller.bank ? `${seller.bank.ifsc} · ending ${seller.bank.accountLast4}` : 'Not added'}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Payout setup (Razorpay)</dt>
          <dd className="font-semibold text-ink">
            {PAYOUT_STATUS_LABELS[seller.payouts.status] || seller.payouts.status}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Documents</dt>
          <dd className="font-semibold text-ink">{seller.kyc.documents.length} uploaded</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function KycWizard() {
  const reduceMotion = useReducedMotion();
  const { data: seller } = useSellerMe();
  const cities = usePublicCities();
  const categories = usePublicCategories();
  const submit = useSubmitKyc();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(() => initialValues(seller));
  const [documents, setDocuments] = useState({});
  const [errors, setErrors] = useState({});

  // Dealers in vehicle categories must prove they are authorised dealers (TRU-1)
  const requiredDocs = useMemo(() => {
    const vehicleIds = new Set(
      (categories.data || [])
        .flatMap((parent) => parent.children)
        .filter((category) => VEHICLE_CATEGORY_SLUGS.includes(category.slug))
        .map((category) => category.id),
    );
    const needsDealerProof = seller.categories.some((id) => vehicleIds.has(id));
    return [
      'gst_certificate',
      'pan_card',
      'shop_photo',
      ...(needsDealerProof ? ['dealer_proof'] : []),
    ];
  }, [categories.data, seller.categories]);

  const city = (cities.data || []).find((item) => item.id === values.cityId);

  if (seller.role !== 'owner') {
    return <Alert tone="info">Only the account owner can submit or change KYC.</Alert>;
  }
  if (['pending', 'approved'].includes(seller.kyc.status)) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Verification</h1>
        <KycStatusPanel seller={seller} />
      </div>
    );
  }
  if (!seller.checklist.profileComplete) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Verification</h1>
        <Alert tone="info">First choose the cities and categories you sell in.</Alert>
        <Button href={ROUTES.SELLER_PROFILE} className="self-start">
          Set coverage
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    );
  }

  const set =
    (key, transform = (value) => value) =>
    (event) =>
      setValues((prev) => ({ ...prev, [key]: transform(event.target.value) }));
  const upper = (value) => value.toUpperCase().replace(/\s/g, '');
  const digits = (value) => value.replace(/\D/g, '');

  /** Validate the step, then go next or submit. */
  const handleNext = async (event) => {
    event.preventDefault();
    const stepErrors = validateStep(step, values, documents, requiredDocs);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    submit.mutate({
      businessName: values.businessName.trim(),
      businessType: values.businessType,
      contactName: values.contactName.trim(),
      contactPhone: values.contactPhone.replace(/[\s-]/g, ''),
      gstin: values.gstin,
      pan: values.pan,
      address: {
        line1: values.line1.trim(),
        ...(values.line2.trim() ? { line2: values.line2.trim() } : {}),
        ...(values.area ? { area: values.area } : {}),
        cityId: values.cityId,
        state: city?.state,
        pincode: values.pincode,
      },
      documents: Object.values(documents),
      bank: {
        accountNumber: values.accountNumber,
        ifsc: values.ifsc,
        beneficiaryName: values.beneficiaryName.trim(),
      },
    });
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
        transition: { duration: DURATION.base, ease: EASE.out },
      };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Verification</h1>
        <p className="mt-1 text-muted">
          Takes about 5 minutes. Keep your GST certificate and PAN ready.
        </p>
      </div>

      {seller.kyc.status === 'rejected' ? (
        <Alert tone="warning">
          <p className="font-bold">Please fix this and resubmit</p>
          <p className="mt-1">{seller.kyc.rejectionReason}</p>
          <p className="mt-1">Upload your documents again when you resubmit.</p>
        </Alert>
      ) : null}

      <ol className="grid grid-cols-4 gap-2" aria-label="KYC steps">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? 'step' : undefined}>
            <span
              className={cn('block h-1.5 rounded-full', index <= step ? 'bg-sunrise' : 'bg-line')}
            />
            <span
              className={cn(
                'mt-2 block text-xs font-semibold',
                index === step ? 'text-ink' : 'text-muted',
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <form
        onSubmit={handleNext}
        noValidate
        className="overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...motionProps} className="flex flex-col gap-4">
            {step === 0 ? (
              <>
                <Input
                  label="Legal business name"
                  value={values.businessName}
                  onChange={set('businessName')}
                  error={errors.businessName}
                  hint="Exactly as on the GST certificate"
                />
                <Select
                  label="Business type"
                  value={values.businessType}
                  onChange={set('businessType')}
                >
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Contact person"
                    value={values.contactName}
                    onChange={set('contactName')}
                    error={errors.contactName}
                  />
                  <Input
                    label="Contact mobile"
                    type="tel"
                    inputMode="tel"
                    value={values.contactPhone}
                    onChange={set('contactPhone', digits)}
                    maxLength={10}
                    error={errors.contactPhone}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="GSTIN"
                    value={values.gstin}
                    onChange={set('gstin', upper)}
                    maxLength={15}
                    error={errors.gstin}
                    className="font-mono uppercase"
                  />
                  <Input
                    label="Business PAN"
                    value={values.pan}
                    onChange={set('pan', upper)}
                    maxLength={10}
                    error={errors.pan}
                    className="font-mono uppercase"
                  />
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Input
                  label="Shop address"
                  value={values.line1}
                  onChange={set('line1')}
                  error={errors.line1}
                  autoComplete="address-line1"
                />
                <Input
                  label="Landmark or building (optional)"
                  value={values.line2}
                  onChange={set('line2')}
                  autoComplete="address-line2"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="City"
                    value={values.cityId}
                    onChange={set('cityId')}
                    error={errors.cityId}
                  >
                    <option value="">Choose a city</option>
                    {(cities.data || []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="Area (optional)"
                    value={values.area}
                    onChange={set('area')}
                    disabled={!city}
                  >
                    <option value="">Choose an area</option>
                    {(city?.areas || []).map((area) => (
                      <option key={area.id} value={area.name}>
                        {area.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  label="Pincode"
                  inputMode="numeric"
                  maxLength={6}
                  value={values.pincode}
                  onChange={set('pincode', digits)}
                  error={errors.pincode}
                  className="sm:max-w-48"
                />
                {cities.isError ? <Alert>{cities.error.message}</Alert> : null}
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-sm text-muted">
                  Clear photos or scans. Only the SaathMein review team can open them.
                </p>
                {[...requiredDocs, ...OPTIONAL_DOCS].map((type) => (
                  <KycDocumentField
                    key={type}
                    docType={type}
                    required={requiredDocs.includes(type)}
                    value={documents[type] || null}
                    onUploaded={(doc) => setDocuments((prev) => ({ ...prev, [type]: doc }))}
                  />
                ))}
                {errors.documents ? <Alert>{errors.documents}</Alert> : null}
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="flex items-start gap-3 rounded-button bg-bg-band p-4 text-sm text-muted">
                  <Landmark
                    className="mt-0.5 size-5 shrink-0 text-ink"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <p>
                    Winning group payments are sent to this account through Razorpay. SaathMein
                    never stores the full account number.
                  </p>
                </div>
                <Input
                  label="Account holder name"
                  value={values.beneficiaryName}
                  onChange={set('beneficiaryName')}
                  error={errors.beneficiaryName}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Account number"
                    inputMode="numeric"
                    autoComplete="off"
                    value={values.accountNumber}
                    onChange={set('accountNumber', digits)}
                    error={errors.accountNumber}
                    className="font-mono"
                  />
                  <Input
                    label="Confirm account number"
                    inputMode="numeric"
                    autoComplete="off"
                    value={values.confirmAccountNumber}
                    onChange={set('confirmAccountNumber', digits)}
                    error={errors.confirmAccountNumber}
                    className="font-mono"
                    onPaste={(event) => event.preventDefault()}
                  />
                </div>
                <Input
                  label="IFSC"
                  value={values.ifsc}
                  onChange={set('ifsc', upper)}
                  maxLength={11}
                  error={errors.ifsc}
                  className="font-mono uppercase sm:max-w-60"
                />
                {submit.isError ? <Alert>{submit.error.message}</Alert> : null}
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            disabled={step === 0 || submit.isPending}
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            Back
          </Button>
          <Button type="submit" disabled={submit.isPending}>
            {submit.isPending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : step === STEPS.length - 1 ? (
              <Send className="size-4" strokeWidth={2} aria-hidden="true" />
            ) : null}
            {step === STEPS.length - 1 ? 'Submit for review' : 'Continue'}
            {step < STEPS.length - 1 ? (
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
            ) : null}
          </Button>
        </div>
      </form>
    </div>
  );
}
