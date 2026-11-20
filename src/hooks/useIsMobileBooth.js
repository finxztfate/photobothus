import { useEffect, useState } from 'react';
import { isMobileViewport } from '../utils/mobileFullscreen';

export default function useIsMobileBooth() {
  const [isMobile, setIsMobile] = useState(isMobileViewport);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px), ((pointer: coarse) and (max-width: 1100px))');
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
