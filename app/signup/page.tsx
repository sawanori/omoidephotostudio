import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  );
}