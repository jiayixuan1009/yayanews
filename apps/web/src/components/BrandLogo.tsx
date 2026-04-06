import Image from 'next/image';
import LocalizedLink from './LocalizedLink';

interface BrandLogoProps {
  variant?: 'header' | 'footer';
  className?: string;
  lang?: string;
}

export default function BrandLogo({ variant = 'header', className = '', lang = 'zh' }: BrandLogoProps) {
  const isFooter = variant === 'footer';
  
  return (
    <LocalizedLink href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image 
        src="/brand/logo-square.svg" 
        alt="YayaNews Logo" 
        width={isFooter ? 36 : 40} 
        height={isFooter ? 36 : 40} 
        className="object-contain"
        priority={!isFooter}
      />
      <span className={`yn-brand leading-none ${isFooter ? 'text-[1.5rem] sm:text-[2rem] lg:text-[2.2rem] text-[#dfffe0]' : 'text-[1.5rem] sm:text-[2rem] lg:text-[2.8rem] text-[#0d3b30]'}`}>
        Yaya Financial News
      </span>
    </LocalizedLink>
  );
}
