import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import Logo from '../components/Logo';

function getApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname.includes('app.github.dev')) {
    return window.location.origin.replace('-5173.', '-4000.') + '/api'
  }
  return 'http://localhost:4000/api'
}
const API_URL = getApiUrl();

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    verifyEmail(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await fetch(`${API_URL}/auth/verify-email?token=${token}`);
      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        if (data.expired) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        setMessage(data.error || 'Verification failed');
      }
    } catch (_err) {
      setStatus('error');
      setMessage('Failed to verify email. Please try again.');
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const email = localStorage.getItem('pending_verification_email');
      if (!email) {
        setMessage('Email address not found. Please register again.');
        return;
      }

      const response = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      setMessage(data.message);
      setStatus('success');
    } catch (_err) {
      setMessage('Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.12),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.14),transparent_40%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="surface-card surface-elevated card-3d rounded-2xl p-8 text-center">
          {status === 'verifying' && (
            <>
              <Loader2 className="h-16 w-16 text-primary-500 animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Verifying Email</h2>
              <p className="text-slate-400">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Email Verified!</h2>
              <p className="text-slate-400 mb-4">{message}</p>
              <p className="text-sm text-slate-500">Redirecting to login...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Verification Failed</h2>
              <p className="text-slate-400 mb-4">{message}</p>
              <button
                onClick={() => navigate('/login')}
                className="button-3d w-full h-12 rounded-xl border border-primary-500/40 bg-primary-500/90 text-white font-semibold hover:bg-primary-500 transition-all"
              >
                Go to Login
              </button>
            </>
          )}

          {status === 'expired' && (
            <>
              <Mail className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Token Expired</h2>
              <p className="text-slate-400 mb-4">{message}</p>
              <button
                onClick={handleResend}
                disabled={resending}
                className="button-3d w-full h-12 rounded-xl border border-primary-500/40 bg-primary-500/90 text-white font-semibold hover:bg-primary-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {resending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend Verification Email'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
