import { useState, useEffect, useRef } from 'react';
import AudioVisualizer from './components/AudioVisualizer';

type StatusType = 'waiting' | '0' | '2' | '4' | '5+' | 'full';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'waiting-room' | 'visualizer'>('waiting-room');
  const [dots, setDots] = useState<string>('.');
  const [status, setStatus] = useState<StatusType>('waiting');
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Animate dots: "." -> ".." -> "..." cycling seamlessly while waiting
  useEffect(() => {
    if (status !== 'waiting') return;

    const dotSequence = ['.', '..', '...'];
    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % dotSequence.length;
      setDots(dotSequence[currentIndex]);
    }, 500);

    return () => clearInterval(interval);
  }, [status]);

  // Clean up all active timeouts on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const handleResetToHome = () => {
    clearAllTimers();
    setStatus('waiting');
    setCurrentScreen('waiting-room');
  };

  const handleImageClick = () => {
    // If already in "접속자 인원 충족!" status, clicking the image switches to Audio Visualizer screen
    if (status === 'full') {
      setCurrentScreen('visualizer');
      return;
    }

    clearAllTimers();

    // 1. Image 클릭 즉시 "접속자 0명" 으로 변환
    setStatus('0');

    // 2. 5초 후 숫자 "0"이 "2" -> "4" -> "5+" 로 점차 변환
    const t1 = setTimeout(() => {
      setStatus('2');
    }, 5000);

    const t2 = setTimeout(() => {
      setStatus('4');
    }, 6000);

    const t3 = setTimeout(() => {
      setStatus('5+');
    }, 7000);

    // 3. "접속자 5+명" 으로 변환 후, "접속자 인원 충족!" 으로 변환
    const t4 = setTimeout(() => {
      setStatus('full');
    }, 8200);

    timersRef.current = [t1, t2, t3, t4];
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white flex flex-col items-center justify-center pixel-dot-background select-none">
      {/* 8-bit CRT Scanlines effect */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {currentScreen === 'visualizer' ? (
        <AudioVisualizer onResetToHome={handleResetToHome} />
      ) : (
        /* Screen 1: Waiting Room */
        <div className="relative z-10 flex flex-col items-center justify-center px-4 w-full max-w-xl">
          {/* Top Text: Music Creative Lab */}
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-wider text-center text-white mb-8 sm:mb-10 uppercase drop-shadow-[0_2px_0_#000]">
            Music Creative Lab
          </h1>

          {/* Center Space for Image (QR code) */}
          <div
            className="w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 pixel-box bg-black flex items-center justify-center p-3 sm:p-4 my-2 cursor-pointer transition-transform active:scale-95"
            role="button"
            tabIndex={0}
            onClick={handleImageClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleImageClick();
              }
            }}
            aria-label="26.MCL.Audience"
          >
            <div className="w-full h-full pixel-inner-frame bg-black flex items-center justify-center overflow-hidden pointer-events-none">
              <img
                src="/QRImage/26.MCL.Audience.png"
                alt="26.MCL.Audience"
                className="w-full h-full object-contain [image-rendering:pixelated]"
              />
            </div>
          </div>

          {/* Bottom Text */}
          <div className="mt-8 sm:mt-10 text-xs sm:text-sm md:text-base font-normal tracking-wider text-center text-white min-h-[1.75rem] flex items-center justify-center">
            {status === 'waiting' && (
              <>
                <span>접속자 대기중</span>
                {/* Fixed-width container for dots to prevent horizontal jitter */}
                <span className="inline-block w-[3ch] text-left">
                  {dots}
                </span>
              </>
            )}

            {(status === '0' || status === '2' || status === '4' || status === '5+') && (
              <span>접속자 {status}명</span>
            )}

            {status === 'full' && (
              <span>접속자 인원 충족!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
