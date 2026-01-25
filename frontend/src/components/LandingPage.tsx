import { useApp } from '../context/AppContext';
import { translations } from '../translations';


export default function LandingPage() {
    const { language, setLanguage, nextPage } = useApp();
    const t = translations[language].landing;

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

            <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight">
                {t.title}
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl leading-relaxed">
                {t.subtitle}
            </p>

            <img src="logo1.png" alt="Logo" className="w-48 h-auto mb-12 rounded-xl" />

            <button
                onClick={nextPage}
                className="group relative px-10 py-5 bg-gray-900 text-white rounded-2xl font-bold text-xl hover:bg-blue-600 transition-all duration-300 shadow-xl hover:shadow-blue-200 hover:-translate-y-1"
            >
                {t.start}
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </button>

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
