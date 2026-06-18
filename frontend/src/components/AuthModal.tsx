import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  variantName?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, variantName }) => {
  const { login, register, isLoading, error, clearError } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<'login' | 'register'>('login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const switchTab = (newTab: 'login' | 'register') => {
    setTab(newTab);
    clearError();
    setLocalError('');
  };

  const displayError = localError || error;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    clearError();
    setLocalError('');
    try {
      await login(username.trim(), password);
      onSuccess();
    } catch {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError('');

    if (!username.trim() || !email.trim() || !password) return;
    if (password !== confirmPassword) {
      setLocalError(t('auth.passwordsMismatch'));
      return;
    }
    if (password.length < 8) {
      setLocalError(t('auth.passwordTooShort'));
      return;
    }

    try {
      await register(username.trim(), email.trim(), password);
      onSuccess();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 pt-8">
          <h2 className="text-center text-2xl font-bold text-[#171212]">
            {variantName
              ? `Start "${variantName}" Trial`
              : t('auth.signInTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-[#8f8681]">
            {variantName
              ? 'Sign in or create an account to launch your trial instance.'
              : t('auth.subtitle')}
          </p>
        </div>

        <div className="flex border-b border-[#f1e7e1] mt-6">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'login'
                ? 'text-[#dc2626] border-b-2 border-[#dc2626]'
                : 'text-[#8f8681] hover:text-[#5f5957]'
            }`}
          >
            {t('auth.signIn')}
          </button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === 'register'
                ? 'text-[#dc2626] border-b-2 border-[#dc2626]'
                : 'text-[#8f8681] hover:text-[#5f5957]'
            }`}
          >
            {t('auth.signUp')}
          </button>
        </div>

        <div className="px-8 py-6">
          {displayError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {displayError}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5f5957] mb-1">
                  {t('auth.username')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="app-input w-full"
                  placeholder={t('auth.usernamePlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5f5957] mb-1">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="app-input w-full"
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[linear-gradient(135deg,#ef6b4a_0%,#dc2626_100%)] text-white font-semibold text-sm shadow-[0_12px_24px_-12px_rgba(220,38,38,0.5)] hover:translate-y-[-1px] transition-all disabled:opacity-50"
              >
                {isLoading ? t('auth.signingIn') : t('auth.signIn')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5f5957] mb-1">
                  {t('auth.username')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="app-input w-full"
                  placeholder={t('auth.usernamePlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5f5957] mb-1">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="app-input w-full"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5f5957] mb-1">
                  {t('auth.password')}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="app-input w-full"
                  placeholder={t('auth.passwordPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#5f5957] mb-1">
                  {t('auth.confirmPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="app-input w-full"
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-[linear-gradient(135deg,#ef6b4a_0%,#dc2626_100%)] text-white font-semibold text-sm shadow-[0_12px_24px_-12px_rgba(220,38,38,0.5)] hover:translate-y-[-1px] transition-all disabled:opacity-50"
              >
                {isLoading ? t('auth.creating') : t('auth.createAccount')}
              </button>
            </form>
          )}

          <button
            onClick={onClose}
            className="w-full mt-4 py-2 text-sm text-[#8f8681] hover:text-[#5f5957] transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
