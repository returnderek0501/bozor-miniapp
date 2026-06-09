import './Logo.css';

interface Props {
  variant?: 'full' | 'compact';
  className?: string;
}

export function Logo({ variant = 'full', className = '' }: Props) {
  const src = variant === 'compact' ? '/logo-header.svg' : '/logo-light.svg';

  return (
    <img
      src={src}
      alt="Uztronix"
      className={`logo logo--${variant} ${className}`.trim()}
      draggable={false}
    />
  );
}
