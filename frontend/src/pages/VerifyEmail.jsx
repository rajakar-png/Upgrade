import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import Logo from '../components/Logo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
      const response = await fetch(`${API_URL}/api/auth/verify-email?token=${token}`);
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

      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <div className="rounded-2xl border border-dark-700 bg-dark-900 p-8 shadow-card text-center">
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
                className="w-full h-12 rounded-lg bg-primary-500 text-white font-semibold hover:bg-primary-600 transition-all"
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
                className="w-full h-12 rounded-lg bg-primary-500 text-white font-semibold hover:bg-primary-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
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
