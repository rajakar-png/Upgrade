import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function getApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (window.location.hostname.includes('app.github.dev')) {
    return window.location.origin.replace('-5173.', '-4000.') + '/api'
  }
  return 'http://localhost:4000/api'
}

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');

    if (error) {
      localStorage.setItem('oauth_error', 'Authentication failed. Please try again.');
      navigate('/login');
      return;
    }

    const code = params.get('code');

    // New secure flow: exchange session-stored token via API call
    if (code === 'session') {
      fetch(`${getApiUrl()}/auth/exchange-token`, {
        method: 'POST',
        credentials: 'include' // send session cookie
      })
        .then(r => {
          if (!r.ok) throw new Error('Token exchange failed');
          return r.json();
        })
        .then(({ token }) => {
          localStorage.setItem('token', token);
          return fetch(`${getApiUrl()}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        })
        .then(r => r.ok ? r.json() : null)
        .then(user => {
          if (user) localStorage.setItem('user', JSON.stringify(user));
          navigate('/dashboard');
        })
        .catch(() => {
          localStorage.setItem('oauth_error', 'Authentication failed. Please try again.');
          navigate('/login');
        });
      return;
    }

    // Legacy fallback: token directly in URL (for backwards compatibility)
    const token = params.get('token');
    if (!token) {
      localStorage.setItem('oauth_error', 'Authentication failed. Please try again.');
      navigate('/login');
      return;
    }

    localStorage.setItem('token', token);
    fetch(`${getApiUrl()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) localStorage.setItem('user', JSON.stringify(user));
        navigate('/dashboard');
      })
      .catch(() => {
        navigate('/dashboard');
      });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-white text-lg">Completing authentication...</p>
      </div>
    </div>
  );
}
