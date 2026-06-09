import { useTheme } from '../../hooks/useTheme';
import './Logo.css';

interface Props {
  variant?: 'full' | 'compact';
  className?: string;
}

export function Logo({ variant = 'full', className = '' }: Props) {
  const { isDark } = useTheme();

  let src: string;
  if (variant === 'compact') {
    src = '/logo-header.svg';
  } else {
    src = isDark ? '/logo-dark.svg' : '/logo-light.svg';
  }

  return (
    <img
      src={src}
      alt="Uztronix"
      className={`logo logo--${variant} ${className}`.trim()}
      draggable={false}
    />
  );
}
