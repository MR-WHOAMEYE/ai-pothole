import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, UserRole } from '@/src/stores/authStore';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuthStore();
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRoleRedirect = () => {
    const currentRole = useAuthStore.getState().role;
    if (currentRole === 'ADMIN') {
      navigate('/admin');
    } else if (currentRole === 'CREW') {
      navigate('/crew');
    } else {
      navigate('/');
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      handleRoleRedirect();
    } catch (err) {
      // errors are handled in store toast
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (isSignUp && !fullName) {
      toast.error('Please enter your full name.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, fullName);
      } else {
        await signInWithEmail(email, password);
      }
      handleRoleRedirect();
    } catch (err: any) {
      // Error message is toasted in authStore, but we catch here to stop loading
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-zinc-900/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-10 right-10 size-60 bg-red-950/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <ShieldAlert className="size-6 text-red-500 animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 font-sans">
            Pothole<span className="text-red-500">IQ</span>
          </h1>
          <p className="text-xs text-zinc-400">
            Municipal Pothole Detection & AI-Driven Infrastructure Operations
          </p>
        </div>

        <Card className="bg-zinc-900 border-zinc-800 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-lg text-zinc-100 font-semibold">
              {isSignUp ? 'Create Account' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              {isSignUp
                ? 'Sign up to register issues or access municipal staff tools.'
                : 'Access the municipal repair portals or report issues.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignUp && (
                <div className="space-y-1">
                  <Label htmlFor="fullName" className="text-xs text-zinc-400">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className="bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-700 h-9"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs text-zinc-400">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-700 h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs text-zinc-400">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-zinc-950 border-zinc-800 text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-zinc-700 h-9"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-medium h-9 mt-2 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isSignUp ? 'Register Account' : 'Sign In with Email'}
              </Button>
            </form>

            <div className="relative py-2 flex items-center justify-center">
              <span className="absolute w-full border-t border-zinc-800" />
              <span className="relative bg-zinc-900 px-3 text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
                or continue with
              </span>
            </div>

            <Button
              onClick={handleGoogleLogin}
              variant="outline"
              disabled={loading}
              className="w-full bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 h-9 flex items-center justify-center gap-2 font-medium"
            >
              <svg className="size-4 mr-1" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-0">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-4"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
            <p className="text-[10px] text-center text-zinc-500 leading-normal">
              By logging in, you agree to submit geolocated reports for infrastructure quality improvement.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
