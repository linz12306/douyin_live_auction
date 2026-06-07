import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type PageBackButtonProps = {
  fallback: string;
  className?: string;
  ariaLabel?: string;
  children?: ReactNode;
};

export default function PageBackButton({ fallback, className = '', ariaLabel, children }: PageBackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key === 'default') {
      navigate(fallback, { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-white/75 transition hover:border-white/35 hover:text-white ${className}`}
    >
      {children ?? (
        <>
          <span aria-hidden="true">&larr;</span>
          返回上一页
        </>
      )}
    </button>
  );
}
