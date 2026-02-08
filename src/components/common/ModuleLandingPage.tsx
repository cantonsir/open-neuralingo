import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Book, Headphones, Mic, PenTool, RotateCcw } from 'lucide-react';
import { Module } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../utils/languageOptions';

interface ModuleLandingPageProps {
  onSelectModule: (module: Module) => void;
  firstLanguage: string;
  targetLanguage: string;
  isSetupComplete: boolean;
  onCompleteSetup: (firstLanguage: string, targetLanguage: string) => void;
  onResetSetup: () => void;
}

const moduleData: Array<{
  id: Module;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: 'listening',
    label: 'Listening',
    description: 'Practice with loops and focused replay.',
    icon: Headphones,
  },
  {
    id: 'reading',
    label: 'Reading',
    description: 'Build comprehension with rich content.',
    icon: Book,
  },
  {
    id: 'speaking',
    label: 'Speaking',
    description: 'Improve fluency with roleplay prompts.',
    icon: Mic,
  },
  {
    id: 'writing',
    label: 'Writing',
    description: 'Draft responses and refine your style.',
    icon: PenTool,
  },
];

const ModuleLandingPage: React.FC<ModuleLandingPageProps> = ({
  onSelectModule,
  firstLanguage,
  targetLanguage,
  isSetupComplete,
  onCompleteSetup,
  onResetSetup,
}) => {
  const [step, setStep] = useState<'setup' | 'module'>(isSetupComplete ? 'module' : 'setup');
  const [selectedFirstLanguage, setSelectedFirstLanguage] = useState(firstLanguage || 'en');
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState(targetLanguage || 'en');
  const [error, setError] = useState('');

  useEffect(() => {
    setStep(isSetupComplete ? 'module' : 'setup');
  }, [isSetupComplete]);

  useEffect(() => {
    setSelectedFirstLanguage(firstLanguage || 'en');
  }, [firstLanguage]);

  useEffect(() => {
    setSelectedTargetLanguage(targetLanguage || 'en');
  }, [targetLanguage]);

  const firstLanguageName = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((lang) => lang.code === selectedFirstLanguage)?.name || 'English';
  }, [selectedFirstLanguage]);

  const targetLanguageName = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((lang) => lang.code === selectedTargetLanguage)?.name || 'English';
  }, [selectedTargetLanguage]);

  const isSameLanguage = selectedFirstLanguage === selectedTargetLanguage;

  const handleContinue = () => {
    if (isSameLanguage) {
      setError('Please choose different languages for native and learning language.');
      return;
    }

    setError('');
    onCompleteSetup(selectedFirstLanguage, selectedTargetLanguage);
    setStep('module');
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-[#f5f5f7] dark:bg-[#0b0b0f]">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-8 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',Helvetica,Arial,sans-serif] md:py-12">
        <section className="w-full rounded-[28px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_20px_44px_-30px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-[#111113] md:px-8 md:py-8">
          <div className="border-b border-slate-200/80 pb-5 dark:border-slate-800">
            <h1 className="text-center text-[2rem] font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100 md:text-[2.7rem]">
              OpenNeuralingo
            </h1>
          </div>

          {step === 'setup' ? (
            <div className="mt-8">
              <h2 className="text-[1.55rem] font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
                Set your language pair
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Set your native and learning language once. You can change this later in Settings.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-[#f8f8fa] p-4 dark:border-slate-800 dark:bg-[#17171b]">
                  <label htmlFor="native-language" className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Native language
                  </label>
                  <select
                    id="native-language"
                    value={selectedFirstLanguage}
                    onChange={(e) => {
                      setSelectedFirstLanguage(e.target.value);
                      setError('');
                    }}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:ring-3 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-[#f8f8fa] p-4 dark:border-slate-800 dark:bg-[#17171b]">
                  <label htmlFor="learning-language" className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Learning language
                  </label>
                  <select
                    id="learning-language"
                    value={selectedTargetLanguage}
                    onChange={(e) => {
                      setSelectedTargetLanguage(e.target.value);
                      setError('');
                    }}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400 focus:ring-3 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {error}
                </div>
              )}

              <button
                onClick={handleContinue}
                className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Continue
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-[#f8f8fa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#17171b]">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {firstLanguageName} {'->'} {targetLanguageName}
                </p>

                <button
                  onClick={() => {
                    onResetSetup();
                    setStep('setup');
                  }}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <RotateCcw size={13} />
                  Change
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {moduleData.map((module) => (
                  <button
                    key={module.id}
                    onClick={() => onSelectModule(module.id)}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_14px_28px_-22px_rgba(15,23,42,0.55)] dark:border-slate-800 dark:bg-[#111113] dark:hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <module.icon size={18} />
                      </div>
                      <ArrowRight size={17} className="text-slate-300 transition-colors group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{module.label}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{module.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ModuleLandingPage;
