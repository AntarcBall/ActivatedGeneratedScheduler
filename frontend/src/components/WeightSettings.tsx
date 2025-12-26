import { useApp } from '../context/AppContext';
import { HelpCircle, X } from 'lucide-react';
import { useState } from 'react';
import { translations } from '../translations';

export const WeightSettings = () => {
    const { weights, setWeight, toggleRss, language } = useApp();
    const t = translations[language].weight;
    const [showHelp, setShowHelp] = useState(false);

    const labels = [t.fitGood, t.fitBad, t.breakTime, t.preferLectures];

    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{t.title}</h3>
                    <p className="text-gray-500 text-sm">{t.desc}</p>
                </div>
                <button 
                    onClick={() => setShowHelp(true)}
                    className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
                >
                    <HelpCircle className="w-6 h-6" />
                </button>
            </div>

            <div className="grid gap-6">
                {weights.map((w, i) => (
                    <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-gray-800">{labels[i]}</span>
                            <div className="flex items-center gap-4 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                <button 
                                    onClick={() => toggleRss(i)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        w.rss 
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    RSS (Squared)
                                </button>
                                <span className="pr-4 text-blue-600 font-black text-xl w-8 text-center">{w.weight}</span>
                            </div>
                        </div>
                        <input 
                            type="range" min="0" max="10" step="1"
                            value={w.weight}
                            onChange={(e) => setWeight(i, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest">
                            <span>Relaxed</span>
                            <span>Strict</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Help Modal */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative animate-in zoom-in-95 duration-300">
                        <button 
                            onClick={() => setShowHelp(false)}
                            className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>

                        <h3 className="text-2xl font-black text-gray-900 mb-8">{t.helpTitle}</h3>
                        
                        <div className="space-y-8">
                            <div>
                                <h4 className="font-bold text-blue-600 mb-2 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                    {t.lossTitle}
                                </h4>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {t.lossDesc}
                                </p>
                            </div>

                            <div>
                                <h4 className="font-bold text-blue-600 mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                    {t.rssTitle}
                                </h4>
                                <div className="space-y-3">
                                    <div className="p-3 bg-gray-50 rounded-xl">
                                        <p className="text-sm font-bold text-gray-800 mb-1">{t.rssOff}</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-xl">
                                        <p className="text-sm font-bold text-blue-800 mb-1">{t.rssOn}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};