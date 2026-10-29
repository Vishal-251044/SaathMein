'use client';

/**
 * SellerRegisterForm — dealer sign-up (F30): owner name, business name, business mobile,
 * email and password. KYC comes next, from the dashboard checklist.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Store } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SellerAuthCard from '@/components/features/seller/SellerAuthCard';
import { useSellerAuth } from '@/context/SellerAuthContext';
import { register } from '@/services/sellerAuth.service';
import { ROUTES } from '@/utils/constants';

const EMPTY = { name: '', businessName: '', phone: '', email: '', password: '' };

/**
 * Field errors before sending (the API validates again).
 * @param {typeof EMPTY} values - Form values
 * @returns {Object} Field → message
 */
const validate = (values) => {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Enter your full name';
  if (values.businessName.trim().length < 4) errors.businessName = 'Enter the shop or firm name';
  if (!/^[6-9]\d{9}$/.test(values.phone.replace(/[\s-]/g, '').replace(/^\+91/, ''))) {
    errors.phone = 'Enter a 10-digit Indian mobile number';
  }
  if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Enter a valid email';
  if (
    values.password.length < 10 ||
    !/[A-Za-z]/.test(values.password) ||
    !/\d/.test(values.password)
  ) {
    errors.password = 'At least 10 characters with a letter and a number';
  }
  return errors;
};

/**
 * @returns {JSX.Element}
 */
export default function SellerRegisterForm() {
  const router = useRouter();
  const { status, completeLogin } = useSellerAuth();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') router.replace(ROUTES.SELLER);
  }, [status, router]);

  const set = (key) => (event) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  /** Create the account and open the dashboard. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const phone = values.phone.replace(/[\s-]/g, '').replace(/^\+91/, '');
      completeLogin(
        await register({
          name: values.name.trim(),
          businessName: values.businessName.trim(),
          phone,
          email: values.email.trim(),
          password: values.password,
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SellerAuthCard
      title="Register your business"
      subtitle="Free to join. Get verified once, then bid on group orders in your city."
      footer={
        <>
          Already registered?{' '}
          <Link href={ROUTES.SELLER_LOGIN} className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Input
          label="Your name"
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
        />
        <Input
          label="Business name"
          autoComplete="organization"
          value={values.businessName}
          onChange={set('businessName')}
          error={errors.businessName}
          hint="As on your GST certificate"
        />
        <Input
          label="Business mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={values.phone}
          onChange={set('phone')}
          error={errors.phone}
          hint="Buyers never see this number before they accept your offer"
        />
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
          hint="You log in with this email. We send a code to verify it."
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 10 characters with a letter and a number"
        />
        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Store className="size-5" strokeWidth={2} aria-hidden="true" />
          )}
          Create dealer account
        </Button>
        <p className="text-xs text-muted">
          By registering you agree to the SaathMein dealer terms and privacy policy.
        </p>
      </form>
    </SellerAuthCard>
  );
}
