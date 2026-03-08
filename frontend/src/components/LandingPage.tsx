import { DoorOpen, GraduationCap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';


export default function LandingPage() {
    const { language, setLanguage, nextPage } = useApp();
    const t = translations[language].landing;
    const baseUrl = import.meta.env.BASE_URL || '/';
    const professorDirectoryUrl = `${baseUrl}#/professor/kim-sohee`;
    const roomDirectoryUrl = `${baseUrl}#/room/${encodeURIComponent('E7 - 233')}`;

    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
            {/* Language Switcher */}
            <div className="absolute top-4 right-4 flex items-center bg-white rounded-full shadow-sm border border-gray-100 p-1">
                <button
                    onClick={() => setLanguage('ko')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${language === 'ko' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    한국어
                </button>
                <button
                    onClick={() => setLanguage('en')}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${language === 'en' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    English
                </button>
            </div>

            <h1 className="text-5xl md:text-6xl font-black text-yellow-200 mb-6 tracking-tight">
                {t.title}
            </h1>
            <p className="text-xl text-yellow-200 mb-8 max-w-2xl leading-relaxed">
                {t.subtitle}
            </p>

            <img src="logo1.png" alt="Logo" className="w-48 h-auto mb-12 rounded-xl" />

            <div className="flex flex-col lg:flex-row items-center gap-4 mb-10">
                <button
                    onClick={nextPage}
                    className="group relative px-10 py-5 bg-gray-900 text-white rounded-2xl font-bold text-xl hover:bg-blue-600 transition-all duration-300 shadow-xl hover:shadow-blue-200 hover:-translate-y-1"
                >
                    {t.start}
                    <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                </button>

                <a
                    href={professorDirectoryUrl}
                    className="group inline-flex items-center gap-3 px-7 py-4 rounded-2xl border border-white/50 bg-white/90 text-gray-900 shadow-lg shadow-black/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                        <GraduationCap className="h-5 w-5" />
                    </span>
                    <span className="text-left">
                        <span className="block text-base font-black leading-tight">{t.professorButton}</span>
                        <span className="block text-xs font-medium text-gray-500 group-hover:text-blue-600">
                            {t.professorButtonHint}
                        </span>
                    </span>
                </a>

                <a
                    href={roomDirectoryUrl}
                    className="group inline-flex items-center gap-3 px-7 py-4 rounded-2xl border border-white/50 bg-white/90 text-gray-900 shadow-lg shadow-black/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-700"
                >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 transition-colors group-hover:bg-cyan-600 group-hover:text-white">
                        <DoorOpen className="h-5 w-5" />
                    </span>
                    <span className="text-left">
                        <span className="block text-base font-black leading-tight">{t.roomButton}</span>
                        <span className="block text-xs font-medium text-gray-500 group-hover:text-cyan-600">
                            {t.roomButtonHint}
                        </span>
                    </span>
                </a>
            </div>

            <div className="pt-10 border-t border-gray-100 w-full max-w-md">
                <p className="text-sm text-gray-400 font-medium uppercase tracking-widest">{t.helpTitle}</p>
                <div className="bg-blue-50 rounded-2xl p-6 text-blue-800 text-sm leading-relaxed flex flex-col items-center gap-3">
                    <span>{t.helpDesc}</span>
                    <a
                        href="https://velog.io/@bouncy/p2-%EA%B0%9C%EC%9D%B8%ED%99%94%EB%90%9C-%EC%88%98%EA%B0%95-%EA%B3%84%ED%9A%8D-%EC%A0%9C%EC%95%88"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 font-bold hover:underline"
                    >
                        설명 링크로 이동하기
                        <span className="ml-1">↗</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
