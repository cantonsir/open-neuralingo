/**
 * ModuleLandingPage - Clean landing page with full multilingual rotation
 *
 * Features:
 * - ALL content rotates through 10 languages every 5 seconds
 * - Clean, simple design optimized for mobile
 * - Smooth fade animations between language changes
 * - Responsive and accessible
 */
import React, { useState, useEffect } from 'react';
import { Module, Theme } from '../../types';
import { Headphones, BookOpen, Mic, Edit3, Globe } from 'lucide-react';

interface ModuleLandingPageProps {
  onSelectModule: (module: Module) => void;
  theme: Theme;
}

interface LanguageContent {
  language: string;
  code: string;
  headline: string;
  subtitle: string;
  modules: {
    listening: string;
    reading: string;
    speaking: string;
    writing: string;
  };
}

const ModuleLandingPage: React.FC<ModuleLandingPageProps> = ({ onSelectModule, theme }) => {
  const [currentLanguageIndex, setCurrentLanguageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const languages: LanguageContent[] = [
    {
      language: 'English',
      code: '🇬🇧',
      headline: 'Master Your Language Skills',
      subtitle: 'Choose a module to begin',
      modules: { listening: 'Listening', reading: 'Reading', speaking: 'Speaking', writing: 'Writing' }
    },
    {
      language: 'Español',
      code: '🇪🇸',
      headline: 'Domina Tus Habilidades Lingüísticas',
      subtitle: 'Elige un módulo para comenzar',
      modules: { listening: 'Escuchar', reading: 'Leer', speaking: 'Hablar', writing: 'Escribir' }
    },
    {
      language: 'Français',
      code: '🇫🇷',
      headline: 'Maîtrisez Vos Compétences',
      subtitle: 'Choisissez un module',
      modules: { listening: 'Écouter', reading: 'Lire', speaking: 'Parler', writing: 'Écrire' }
    },
    {
      language: 'Deutsch',
      code: '🇩🇪',
      headline: 'Beherrsche Deine Sprachfähigkeiten',
      subtitle: 'Wähle ein Modul',
      modules: { listening: 'Hören', reading: 'Lesen', speaking: 'Sprechen', writing: 'Schreiben' }
    },
    {
      language: 'Italiano',
      code: '🇮🇹',
      headline: 'Padroneggia Le Tue Abilità',
      subtitle: 'Scegli un modulo',
      modules: { listening: 'Ascolto', reading: 'Lettura', speaking: 'Parlato', writing: 'Scrittura' }
    },
    {
      language: 'Português',
      code: '🇵🇹',
      headline: 'Domine Suas Habilidades',
      subtitle: 'Escolha um módulo',
      modules: { listening: 'Escuta', reading: 'Leitura', speaking: 'Fala', writing: 'Escrita' }
    },
    {
      language: 'Русский',
      code: '🇷🇺',
      headline: 'Овладейте Языковыми Навыками',
      subtitle: 'Выберите модуль',
      modules: { listening: 'Аудирование', reading: 'Чтение', speaking: 'Говорение', writing: 'Письмо' }
    },
    {
      language: '日本語',
      code: '🇯🇵',
      headline: '言語スキルをマスター',
      subtitle: 'モジュールを選択',
      modules: { listening: 'リスニング', reading: '読解', speaking: 'スピーキング', writing: 'ライティング' }
    },
    {
      language: '한국어',
      code: '🇰🇷',
      headline: '언어 능력 마스터',
      subtitle: '모듈을 선택하세요',
      modules: { listening: '듣기', reading: '읽기', speaking: '말하기', writing: '쓰기' }
    },
    {
      language: '中文',
      code: '🇨🇳',
      headline: '掌握语言技能',
      subtitle: '选择一个模块',
      modules: { listening: '听力', reading: '阅读', speaking: '口语', writing: '写作' }
    },
    {
      language: 'हिन्दी',
      code: '🇮🇳',
      headline: 'अपने भाषा कौशल में महारत हासिल करें',
      subtitle: 'एक मॉड्यूल चुनें',
      modules: { listening: 'सुनना', reading: 'पढ़ना', speaking: 'बोलना', writing: 'लिखना' }
    },
    {
      language: 'العربية',
      code: '🇸🇦',
      headline: 'أتقن مهاراتك اللغوية',
      subtitle: 'اختر وحدة للبدء',
      modules: { listening: 'الاستماع', reading: 'القراءة', speaking: 'التحدث', writing: 'الكتابة' }
    },
    {
      language: 'Türkçe',
      code: '🇹🇷',
      headline: 'Dil Becerilerinizde Ustalaşın',
      subtitle: 'Bir modül seçin',
      modules: { listening: 'Dinleme', reading: 'Okuma', speaking: 'Konuşma', writing: 'Yazma' }
    },
    {
      language: 'Tiếng Việt',
      code: '🇻🇳',
      headline: 'Thành Thạo Kỹ Năng Ngôn Ngữ',
      subtitle: 'Chọn một mô-đun',
      modules: { listening: 'Nghe', reading: 'Đọc', speaking: 'Nói', writing: 'Viết' }
    },
    {
      language: 'ไทย',
      code: '🇹🇭',
      headline: 'เชี่ยวชาญทักษะภาษา',
      subtitle: 'เลือกโมดูล',
      modules: { listening: 'การฟัง', reading: 'การอ่าน', speaking: 'การพูด', writing: 'การเขียน' }
    },
    {
      language: 'Nederlands',
      code: '🇳🇱',
      headline: 'Beheers Je Taalvaardigheden',
      subtitle: 'Kies een module',
      modules: { listening: 'Luisteren', reading: 'Lezen', speaking: 'Spreken', writing: 'Schrijven' }
    },
    {
      language: 'Polski',
      code: '🇵🇱',
      headline: 'Opanuj Swoje Umiejętności Językowe',
      subtitle: 'Wybierz moduł',
      modules: { listening: 'Słuchanie', reading: 'Czytanie', speaking: 'Mówienie', writing: 'Pisanie' }
    },
    {
      language: 'Svenska',
      code: '🇸🇪',
      headline: 'Bemästra Dina Språkfärdigheter',
      subtitle: 'Välj en modul',
      modules: { listening: 'Lyssna', reading: 'Läsa', speaking: 'Tala', writing: 'Skriva' }
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentLanguageIndex((prev) => (prev + 1) % languages.length);
        setIsTransitioning(false);
      }, 500);
    }, 8000);

    return () => clearInterval(interval);
  }, [languages.length]);

  const currentLang = languages[currentLanguageIndex];

  const moduleData = [
    {
      id: 'listening' as Module,
      icon: Headphones,
      gradient: 'from-orange-500 to-amber-500',
      hoverShadow: 'hover:shadow-[0_0_30px_rgba(251,146,60,0.4)]',
      hoverBorder: 'hover:border-orange-300 dark:hover:border-orange-600'
    },
    {
      id: 'reading' as Module,
      icon: BookOpen,
      gradient: 'from-blue-500 to-indigo-500',
      hoverShadow: 'hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]',
      hoverBorder: 'hover:border-indigo-300 dark:hover:border-indigo-600'
    },
    {
      id: 'speaking' as Module,
      icon: Mic,
      gradient: 'from-emerald-500 to-teal-500',
      hoverShadow: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]',
      hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-600'
    },
    {
      id: 'writing' as Module,
      icon: Edit3,
      gradient: 'from-purple-500 to-fuchsia-500',
      hoverShadow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]',
      hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-600'
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center px-4 sm:px-6 md:px-8 py-4 sm:py-8 md:py-12">
      <div className="max-w-4xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center mb-4 sm:mb-6 md:mb-10">
          {/* Language indicator */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 mb-2 sm:mb-3">
            <Globe size={12} className="sm:w-3.5 sm:h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {currentLang.code} {currentLang.language}
            </span>
          </div>

          {/* Animated headline - only text changes */}
          <div>
            <h1 className={`text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2 tracking-tight leading-[1.1] transition-all duration-500 ease-in-out ${isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
              {currentLang.headline}
            </h1>
            <p className={`text-xs sm:text-sm md:text-base text-gray-500 dark:text-gray-400 font-light transition-all duration-500 ease-in-out ${isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
              {currentLang.subtitle}
            </p>
          </div>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 max-w-2xl mx-auto">
          {moduleData.map((module, idx) => (
            <button
              key={module.id}
              onClick={() => onSelectModule(module.id)}
              className={`group relative bg-gray-50/50 dark:bg-gray-900/30
                         rounded-xl sm:rounded-2xl
                         p-4 sm:p-5 md:p-6 lg:p-8
                         border-2 border-gray-200/40 dark:border-gray-800/40
                         hover:bg-gray-50 dark:hover:bg-gray-900/50
                         ${module.hoverBorder}
                         ${module.hoverShadow}
                         transition-all duration-300 ease-out cursor-pointer
                         active:scale-[0.98]
                         focus:outline-none focus:ring-2 focus:ring-indigo-400/20 focus:ring-offset-2
                         motion-reduce:transition-none motion-reduce:hover:transform-none
                         min-h-[100px] sm:min-h-[120px] md:min-h-[140px]
                         flex flex-col items-center justify-center text-center`}
              aria-label={`Navigate to ${module.id} module`}
              tabIndex={0}
            >
              {/* Icon */}
              <div className="relative mb-2 sm:mb-3 text-gray-700 dark:text-gray-300 group-hover:scale-105 transition-transform duration-300 ease-out motion-reduce:transition-none">
                <module.icon
                  size={28}
                  strokeWidth={1.5}
                  className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors duration-300"
                />
              </div>

              {/* Module Title - only text changes */}
              <h3 className={`text-base sm:text-lg md:text-xl font-medium text-gray-900 dark:text-white tracking-tight leading-tight transition-all duration-500 ease-in-out ${isTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
                {currentLang.modules[module.id]}
              </h3>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModuleLandingPage;
