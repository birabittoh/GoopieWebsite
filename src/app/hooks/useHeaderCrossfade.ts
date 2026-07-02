import { useState, useEffect, useRef } from 'react';

interface CrossfadeSlot {
  src: string;
}

export function useHeaderCrossfade(
  selectedGameId: string | undefined,
  headerImages: string[],
) {
  const [headerIdx, setHeaderIdx] = useState(0);
  const [slotA, setSlotA] = useState<CrossfadeSlot>({ src: '' });
  const [slotB, setSlotB] = useState<CrossfadeSlot>({ src: '' });
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const activeSlotRef = useRef<'A' | 'B'>('A');
  const pendingCrossfadeRef = useRef(0);

  useEffect(() => {
    setHeaderIdx(0);
  }, [selectedGameId]);

  useEffect(() => {
    const src = headerImages[headerIdx];
    if (!src) return;
    const token = ++pendingCrossfadeRef.current;
    const incoming: 'A' | 'B' = activeSlotRef.current === 'A' ? 'B' : 'A';
    if (incoming === 'A') setSlotA({ src }); else setSlotB({ src });
    const img = new Image();
    img.src = src;
    const decodeP = typeof img.decode === 'function'
      ? img.decode().catch(() => {})
      : new Promise<void>(r => { img.complete ? r() : (img.onload = img.onerror = () => r()); });
    decodeP.then(() => {
      if (token !== pendingCrossfadeRef.current) return;
      activeSlotRef.current = incoming;
      setActiveSlot(incoming);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId, headerIdx]);

  useEffect(() => {
    if (headerImages.length <= 1) return;
    const timer = setInterval(() => {
      setHeaderIdx(prev => (prev + 1) % headerImages.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [headerImages.length]);

  return { slotA, slotB, activeSlot };
}
