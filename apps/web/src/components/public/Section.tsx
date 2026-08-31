import React from 'react';
import { Container, ContainerSize } from '../ui/layout/Container';
import { Reveal } from './Reveal';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /** Container width */
  size?: ContainerSize;
  /** Background treatment */
  background?: 'default' | 'muted' | 'white' | 'gradient' | 'transparent';
  /** Reveal the section content on scroll */
  reveal?: boolean;
}

const backgroundStyles: Record<NonNullable<SectionProps['background']>, string> = {
  default: 'bg-background',
  muted: 'bg-background-alt',
  white: 'bg-white',
  gradient:
    'bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600 text-white',
  transparent: 'bg-transparent',
};

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    { children, size = 'xl', background = 'default', reveal = false, className = '', ...rest },
    ref
  ) => {
    const inner = <Container size={size}>{children}</Container>;
    return (
      <section
        ref={ref}
        className={`py-16 sm:py-20 lg:py-24 ${backgroundStyles[background]} ${className}`.trim()}
        {...rest}
      >
        {reveal ? <Reveal>{inner}</Reveal> : inner}
      </section>
    );
  }
);

Section.displayName = 'Section';

export interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  /** Render title in inverse (light) color for dark backgrounds */
  inverse?: boolean;
  className?: string;
  /** Override the description paragraph classes (defaults to theme description style) */
  descriptionClassName?: string;
  /** Inline style for the description paragraph (e.g. animation delay) */
  descriptionStyle?: React.CSSProperties;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  title,
  description,
  align = 'center',
  inverse = false,
  className = '',
  descriptionClassName,
  descriptionStyle,
}) => {
  const alignment = align === 'center' ? 'text-center mx-auto' : 'text-left';
  const titleColor = inverse ? 'text-white' : 'text-neutral-900';
  const descColor = inverse ? 'text-primary-100' : 'text-neutral-600';

  return (
    <div className={`max-w-2xl ${alignment} mb-12 sm:mb-16 ${className}`.trim()}>
      {eyebrow && (
        <span
          className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-4 ${
            inverse
              ? 'bg-white/15 text-white'
              : 'bg-primary-50 text-primary-700 border border-primary-100'
          }`}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${titleColor} ${
          align === 'center' ? '' : 'mb-4'
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={descriptionClassName ?? `mt-4 text-lg sm:text-xl leading-relaxed ${descColor}`.trim()}
          style={descriptionStyle}
        >
          {description}
        </p>
      )}
    </div>
  );
};

SectionHeading.displayName = 'SectionHeading';
