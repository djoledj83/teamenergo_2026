'use client';

import type { ComponentType, SVGProps } from 'react';
import * as HeroIcons from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

type IconVariant = 'outline' | 'solid';
type HeroIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name' | 'onClick'> {
  /** Heroicon component name, e.g. "BoltIcon". Resolved at runtime. */
  name: string;
  variant?: IconVariant;
  size?: number;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function Icon({
  name,
  variant = 'outline',
  size = 24,
  className = '',
  onClick,
  disabled = false,
  ...props
}: IconProps) {
  const iconSet = variant === 'solid' ? HeroIconsSolid : HeroIcons;
  const IconComponent = (iconSet as Record<string, HeroIconComponent>)[name];

  const stateClasses = disabled
    ? 'opacity-50 cursor-not-allowed'
    : onClick
      ? 'cursor-pointer hover:opacity-80'
      : '';

  const Component: HeroIconComponent = IconComponent ?? QuestionMarkCircleIcon;

  return (
    <Component
      width={size}
      height={size}
      aria-hidden="true"
      className={`${stateClasses} ${className}`}
      onClick={disabled ? undefined : onClick}
      {...props}
    />
  );
}
