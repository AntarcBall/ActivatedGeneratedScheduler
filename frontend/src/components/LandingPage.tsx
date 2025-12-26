import { useApp } from '../context/AppContext';
import { HelpCircle } from 'lucide-react';

export const LandingPage = () => {
    const { language, setLanguage } = useApp();

    return (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-fade-in">
            
            <div className="space-y-4">
                <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">
                    AGS for DGIST
                </h1>
                <p className="text-gray-500 text-lg">
                    Activated Generated Scheduler
                </p>
            </div>

            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 max-w-md">
                <div className="flex items-center justify-center mb-4 text-blue-600">
                    <HelpCircle size={32} />
                </div>
                <p className="text-gray-700 font-medium mb-2">
                    도움이 필요하신가요?
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                    각 페이지 우측 상단의 <strong className="text-blue-600">? 버튼</strong>을 누르면<br/>
                    자세한 사용 가이드를 확인할 수 있습니다.
                </p>
            </div>

            <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Select Language
                </p>
                <div className="flex items-center space-x-6 p-4 bg-white rounded-lg shadow-sm border">
                    <label className={`cursor-pointer flex flex-col items-center space-y-2 p-3 rounded-lg transition-all ${language === 'ko' ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}>
                        <input 
                            type="radio" 
                            name="language" 
                            value="ko" 
                            checked={language === 'ko'} 
                            onChange={() => setLanguage('ko')}
                            className="sr-only"
                        />
                        <span className="text-3xl">🇰🇷</span>
                        <span className={`text-sm font-medium ${language === 'ko' ? 'text-blue-700' : 'text-gray-600'}`}>한국어</span>
                    </label>

                    <label className={`cursor-pointer flex flex-col items-center space-y-2 p-3 rounded-lg transition-all ${language === 'en' ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}>
                        <input 
                            type="radio" 
                            name="language" 
                            value="en" 
                            checked={language === 'en'} 
                            onChange={() => setLanguage('en')}
                            className="sr-only"
                        />
                        <span className="text-3xl">🇺🇸</span>
                        <span className={`text-sm font-medium ${language === 'en' ? 'text-blue-700' : 'text-gray-600'}`}>English</span>
                    </label>
                </div>
                {language === 'en' && (
                    <p className="text-xs text-orange-500 font-medium animate-pulse">
                        * English translation is coming soon.
                    </p>
                )}
            </div>
        </div>
    );
};
