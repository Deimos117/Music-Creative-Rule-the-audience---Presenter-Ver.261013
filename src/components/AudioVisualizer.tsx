import { useEffect, useRef, useState } from 'react';

interface RowValues {
  left: string;
  mid: string;
  right: string;
}

interface AudioVisualizerProps {
  onResetToHome: () => void;
}

function generateRowValues(): RowValues {
  // 1. 왼쪽 팝업: 반드시 음수("-"), 0과 가장 먼 수치(절댓값이 큰 수치), 절댓값 <= 10.0
  const leftInt = -(Math.floor(Math.random() * 49) + 50); // -50 ~ -98 -> -5.0 ~ -9.8
  const leftVal = leftInt / 10;

  // 2. 오른쪽 팝업: 반드시 양수("+"), 0과 가장 가까운 수치(절댓값이 작은 수치), 절댓값 <= 10.0
  const rightInt = Math.floor(Math.random() * 27) + 2; // +2 ~ +28 -> +0.2 ~ +2.8
  const rightVal = rightInt / 10;

  // 3. 가운데 팝업: 부호(+ 또는 -) 랜덤, 왼쪽 < 가운데 < 오른쪽 (절대값 <= 10.0)
  const minMidInt = leftInt + 8;
  const maxMidInt = rightInt - 2;

  let midInt = Math.floor(Math.random() * (maxMidInt - minMidInt + 1)) + minMidInt;
  if (midInt === 0) {
    midInt = Math.random() < 0.5 ? -1 : 1;
  }
  const midVal = midInt / 10;

  const format = (v: number) => {
    const sign = v >= 0 ? '+' : '-';
    return `${sign}${Math.abs(v).toFixed(1)} m/s`;
  };

  return {
    left: format(leftVal),
    mid: format(midVal),
    right: format(rightVal),
  };
}

export default function AudioVisualizer({ onResetToHome }: AudioVisualizerProps) {
  const [statusText, setStatusText] = useState<'Ready?' | 'Drop 타이밍에 맞춰 버튼을 눌러주세요!'>('Ready?');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showPopups, setShowPopups] = useState(false);
  const [popupsOpacity, setPopupsOpacity] = useState(false);

  // 팝업 텍스트 순차 페이드 인 (왼쪽 -> 가운데 -> 오른쪽)
  const [leftVisible, setLeftVisible] = useState(false);
  const [midVisible, setMidVisible] = useState(false);
  const [rightVisible, setRightVisible] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  // 재시도 확인 팝업 모달 상태
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 1st 및 2nd 행의 수치 데이터
  const [row1Values, setRow1Values] = useState<RowValues>({ left: '-7.5 m/s', mid: '-2.1 m/s', right: '+0.8 m/s' });
  const [row2Values, setRow2Values] = useState<RowValues>({ left: '-8.2 m/s', mid: '+0.4 m/s', right: '+1.1 m/s' });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>([]);
  const isEndingRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  };

  // Setup Audiofile/Ready.mp3
  useEffect(() => {
    const audio = new Audio('/Audiofile/Ready.mp3');
    audio.preload = 'auto';
    audio.addEventListener('ended', handleAudioEnd);
    audioElementRef.current = audio;

    return () => {
      timersRef.current.forEach(clearTimeout);
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.removeEventListener('ended', handleAudioEnd);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Triggered when audio playback ends naturally or is forced
  const startFadeOutSequence = () => {
    // 수치 새로 생성
    setRow1Values(generateRowValues());
    setRow2Values(generateRowValues());

    // 3초 후 자동으로 페이드 아웃
    addTimer(() => {
      setIsFadingOut(true);

      // 페이드 아웃 완료(700ms) 후 팝업 생성 및 페이드 인 (Results 텍스트와 6개 팝업 동시 페이드 인)
      addTimer(() => {
        setShowPopups(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPopupsOpacity(true);

            // 각 팝업의 텍스트: 왼쪽 -> 가운데 -> 오른쪽 순차 페이드 인
            addTimer(() => setLeftVisible(true), 400);
            addTimer(() => setMidVisible(true), 800);
            addTimer(() => {
              setRightVisible(true);

              // "n" 의 수치가 정해진 후 약 3초 뒤 화면 아래 오른쪽 "재시도" 버튼 생성
              addTimer(() => {
                setShowRetry(true);
              }, 3000);
            }, 1200);
          });
        });
      }, 700);
    }, 3000);
  };

  const handleAudioEnd = () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    startFadeOutSequence();
  };

  // "강제 넘김" 버튼 클릭 핸들러
  const handleForceSkip = () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    // Ready.mp3 음원 강제 끝맞춤하여 스킵
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      try {
        audioElementRef.current.currentTime = audioElementRef.current.duration || 0;
      } catch {
        // ignore
      }
    }

    startFadeOutSequence();
  };

  // "재시도" 버튼 클릭 시 확인 팝업 모달 표시
  const handleRetryClick = () => {
    setShowConfirmModal(true);
  };

  // "ㄴㅔ" 클릭 시: 사이트 전체 기능 초기화하여 첫 화면으로 변환
  const handleConfirmReset = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    setShowConfirmModal(false);
    onResetToHome();
  };

  // "ㅇㅏ니요" 클릭 시: 모달 닫기 (취소)
  const handleCancelReset = () => {
    setShowConfirmModal(false);
  };

  const startPlayback = async () => {
    if (isPlaying || isEndingRef.current) return;

    // 1. Update text immediately
    setStatusText('Drop 타이밍에 맞춰 버튼을 눌러주세요!');
    setIsPlaying(true);

    // 2. Setup AudioContext and Analyser connected to Ready.mp3
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128; // gives 64 frequency bins
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
      }

      if (!sourceNodeRef.current && audioElementRef.current) {
        const source = ctx.createMediaElementSource(audioElementRef.current);
        source.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
        sourceNodeRef.current = source;
      }

      if (audioElementRef.current) {
        await audioElementRef.current.play();
      }
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  };

  // Keyboard listener for Space and Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPopups && (e.code === 'Space' || e.key === ' ' || e.code === 'Enter' || e.key === 'Enter')) {
        e.preventDefault();
        startPlayback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, showPopups]);

  // Canvas 8-bit Dot Matrix Visualizer Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const barCount = 24;
    const dataArray = new Uint8Array(barCount);

    if (peaksRef.current.length !== barCount) {
      peaksRef.current = new Array(barCount).fill(0);
    }

    let frame = 0;

    const render = () => {
      frame++;
      const width = canvas.width;
      const height = canvas.height;

      // Pure black canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      if (analyserRef.current && isPlaying && !isEndingRef.current) {
        const binCount = analyserRef.current.frequencyBinCount;
        const rawFft = new Uint8Array(binCount);
        analyserRef.current.getByteFrequencyData(rawFft);

        // Map audio frequency spectrum accurately to the 24 8-bit visualizer bars
        for (let i = 0; i < barCount; i++) {
          const startBin = Math.floor(Math.pow(i / barCount, 1.4) * (binCount * 0.8)) + 1;
          const endBin = Math.floor(Math.pow((i + 1) / barCount, 1.4) * (binCount * 0.8)) + 1;
          let sum = 0;
          let count = 0;
          for (let b = startBin; b <= endBin && b < binCount; b++) {
            sum += rawFft[b];
            count++;
          }
          const avg = count > 0 ? sum / count : rawFft[startBin] || 0;
          dataArray[i] = Math.min(255, Math.floor(avg * 1.3));
        }
      } else {
        // Idle subtle dot pulse before Ready.mp3 plays
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(frame * 0.05 + i * 0.4) * 16 + 20;
          dataArray[i] = Math.max(0, Math.min(255, wave));
        }
      }

      // Visualizer grid metrics
      const paddingX = 16;
      const paddingBottom = 16;
      const availableWidth = width - paddingX * 2;
      const barSpacing = Math.floor(availableWidth / barCount);
      const dotSize = Math.max(4, Math.floor(barSpacing * 0.7));
      const dotGap = 3;
      const maxDots = Math.floor((height - paddingBottom - 16) / (dotSize + dotGap));

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i];
        const activeDots = Math.round((val / 255) * maxDots);

        // Update peak dot
        if (activeDots >= peaksRef.current[i]) {
          peaksRef.current[i] = activeDots;
        } else {
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 0.25);
        }

        const x = paddingX + i * barSpacing + Math.floor((barSpacing - dotSize) / 2);

        // Draw vertical column of square 8-bit dots
        for (let d = 0; d < maxDots; d++) {
          const y = height - paddingBottom - (d + 1) * (dotSize + dotGap);

          if (d < activeDots) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, dotSize, dotSize);
          } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(x, y, dotSize, dotSize);
          }
        }

        // Draw Peak hold dot
        const peakIndex = Math.floor(peaksRef.current[i]);
        if (peakIndex > 0 && peakIndex < maxDots) {
          const peakY = height - paddingBottom - (peakIndex + 1) * (dotSize + dotGap);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, peakY, dotSize, dotSize);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // When visualizer has faded out and popups are active:
  if (showPopups) {
    return (
      <div 
        className={`relative z-10 flex flex-col items-center justify-center px-4 w-full max-w-4xl transition-opacity duration-700 ${
          popupsOpacity ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* 6개 팝업 화면 가장 위 큰 텍스트: Results (6개의 팝업과 같이 페이드 인) */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-wider text-center text-white mb-6 sm:mb-8 uppercase drop-shadow-[0_2px_0_#000]">
          Results
        </h1>

        {/* 중앙 위 팝업 3개 그룹 */}
        <div className="flex flex-col items-center w-full mb-6 sm:mb-8">
          {/* 중앙 위 팝업 3개의 윗 중앙 텍스트 */}
          <div className="text-xs sm:text-sm md:text-base font-bold tracking-wider text-center text-white mb-2 sm:mb-3 uppercase drop-shadow-[0_2px_0_#000]">
            1st - Fake Drop
          </div>
          {/* 가로x세로 비율 약 3x1인 팝업 3개 (좌, 중, 우) */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6 w-full max-w-2xl">
            {/* 좌 */}
            <div className="aspect-[3/1] pixel-box bg-black flex items-center justify-center">
              <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wider text-white transition-opacity duration-500 ${leftVisible ? 'opacity-100' : 'opacity-0'}`}>
                {row1Values.left}
              </span>
            </div>
            {/* 중 */}
            <div className="aspect-[3/1] pixel-box bg-black flex items-center justify-center">
              <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wider text-white transition-opacity duration-500 ${midVisible ? 'opacity-100' : 'opacity-0'}`}>
                {row1Values.mid}
              </span>
            </div>
            {/* 우 */}
            <div className="aspect-[3/1] pixel-box bg-black flex items-center justify-center">
              <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wider text-white transition-opacity duration-500 ${rightVisible ? 'opacity-100' : 'opacity-0'}`}>
                {row1Values.right}
              </span>
            </div>
          </div>
        </div>

        {/* 중앙 아래 팝업 3개 그룹 */}
        <div className="flex flex-col items-center w-full">
          {/* 중앙 아래 팝업 3개의 윗 중앙 텍스트 */}
          <div className="text-xs sm:text-sm md:text-base font-bold tracking-wider text-center text-white mb-2 sm:mb-3 uppercase drop-shadow-[0_2px_0_#000]">
            2nd - Fake Drop
          </div>
          {/* 가로x세로 비율 약 3x1인 팝업 3개 (좌, 중, 우) */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6 w-full max-w-2xl">
            {/* 좌 */}
            <div className="aspect-[3/1] pixel-box bg-black flex items-center justify-center">
              <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wider text-white transition-opacity duration-500 ${leftVisible ? 'opacity-100' : 'opacity-0'}`}>
                {row2Values.left}
              </span>
            </div>
            {/* 중 */}
            <div className="aspect-[3/1] pixel-box bg-black flex items-center justify-center">
              <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wider text-white transition-opacity duration-500 ${midVisible ? 'opacity-100' : 'opacity-0'}`}>
                {row2Values.mid}
              </span>
            </div>
            {/* 우 */}
            <div className="aspect-[3/1] pixel-box bg-black flex items-center justify-center">
              <span className={`text-xs sm:text-sm md:text-base font-bold tracking-wider text-white transition-opacity duration-500 ${rightVisible ? 'opacity-100' : 'opacity-0'}`}>
                {row2Values.right}
              </span>
            </div>
          </div>
        </div>

        {/* 화면 아래 오른쪽 "재시도" 버튼 */}
        <div 
          className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 transition-opacity duration-500 ${
            showRetry ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <button
            onClick={handleRetryClick}
            className="pixel-box bg-black text-white px-5 py-2.5 text-xs sm:text-sm font-bold tracking-widest cursor-pointer hover:bg-white hover:text-black active:scale-95 transition-all uppercase select-none"
          >
            재시도
          </button>
        </div>

        {/* 재시도 확인 팝업 모달 */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 select-none">
            <div className="pixel-box bg-black p-6 sm:p-8 flex flex-col items-center justify-center max-w-sm sm:max-w-md w-[85%]">
              <p className="text-sm sm:text-base md:text-lg font-bold tracking-wider text-center text-white mb-6">
                정말정말로 다시 하시겠어요?
              </p>
              <div className="flex items-center justify-center gap-6 sm:gap-8">
                <button
                  onClick={handleConfirmReset}
                  className="pixel-box bg-black text-white px-5 py-2 text-xs sm:text-sm font-bold tracking-widest cursor-pointer hover:bg-white hover:text-black active:scale-95 transition-all select-none"
                >
                  ㄴㅔ
                </button>
                <button
                  onClick={handleCancelReset}
                  className="pixel-box bg-black text-white px-5 py-2 text-xs sm:text-sm font-bold tracking-widest cursor-pointer hover:bg-white hover:text-black active:scale-95 transition-all select-none"
                >
                  ㅇㅏ니요
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Audio Visualizer Screen
  return (
    <div 
      className={`relative z-10 flex flex-col items-center justify-center px-4 w-full max-w-2xl transition-opacity duration-700 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Text Above Visualizer */}
      <h2 
        className="text-base sm:text-lg md:text-xl font-bold tracking-wider text-center text-white mb-6 sm:mb-8 min-h-[2.5rem] flex items-center justify-center transition-all drop-shadow-[0_2px_0_#000]"
        role="status"
        aria-live="polite"
      >
        {statusText}
      </h2>

      {/* 8-bit Dot Audio Visualizer Frame */}
      <div 
        className="w-[300px] h-[200px] sm:w-[440px] sm:h-[250px] md:w-[520px] md:h-[280px] pixel-box bg-black flex items-center justify-center p-3 sm:p-4 my-2 cursor-pointer"
        role="region"
        aria-label="8-bit Audio Visualizer"
        onClick={startPlayback}
      >
        <div className="w-full h-full pixel-inner-frame bg-black flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={520}
            height={280}
            className="w-full h-full block [image-rendering:pixelated]"
          />
        </div>
      </div>

      {/* 화면 가장 아래 "강제 넘김" 버튼 */}
      <div className="mt-8 sm:mt-10 flex justify-center">
        <button
          onClick={handleForceSkip}
          className="pixel-box bg-black text-white px-5 py-2.5 text-xs sm:text-sm font-bold tracking-widest cursor-pointer hover:bg-white hover:text-black active:scale-95 transition-all uppercase select-none"
        >
          강제 넘김
        </button>
      </div>
    </div>
  );
}
