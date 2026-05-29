import { useLocation, useNavigate } from 'react-router-dom';

type PageBackButtonProps = {
  fallback: string;
  className?: string;
};

export default function PageBackButton({ fallback, className = '' }: PageBackButtonProps) {
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
      className={`inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/8 px-3 py-2 text-sm text-white/75 transition hover:border-white/35 hover:text-white ${className}`}
    >
      <span aria-hidden="true">&larr;</span>
      返回上一页
    </button>
  );
}
