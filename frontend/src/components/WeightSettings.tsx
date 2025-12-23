import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HelpCircle, X } from 'lucide-react';

export const WeightSettings = () => {
    const { weights, setWeight, toggleRss } = useApp();
    const [showHelp, setShowHelp] = useState(false);

    const labels = [
        "Fit Good range (Preferred times)",
        "Fit Bad range (Avoided times)",
        "Break time (Gap minimization)",
        "Prefer lectures (Individual pref)"
    ];

    return (
        <div className="flex flex-col h-full space-y-8 p-4 relative">
            {/* Help Button */}
            <button 
                onClick={() => setShowHelp(true)}
                className="absolute top-0 right-0 p-2 text-gray-400 hover:text-blue-600 transition-colors z-10"
                title="Help & Explanations"
            >
                <HelpCircle size={24} />
            </button>

            {/* Help Modal */}
            {showHelp && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-xl" onClick={() => setShowHelp(false)} />
                    <div className="bg-white w-full max-w-lg max-h-full overflow-y-auto rounded-xl shadow-2xl border border-gray-200 relative animate-fade-in p-6 text-sm">
                        <button 
                            onClick={() => setShowHelp(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
                        >
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-lg font-bold text-gray-800 mb-4">도움말 (Help)</h3>
                        
                        <div className="space-y-4 text-gray-600">
                            <div>
                                <h4 className="font-bold text-blue-600 mb-1">Loss (불만족도) & Weight (가중치)</h4>
                                <p>
                                    이 프로그램은 <strong>"불만족도(Loss)"가 0에 가까운</strong> 시간표를 찾습니다.<br/>
                                    <strong>가중치(Weight)</strong>를 높이면, 해당 항목을 어겼을 때 불만족도가 확 올라갑니다. 즉, 가중치가 높은 항목은 <strong>"절대 어기기 싫다!"</strong>는 뜻입니다.
                                </p>
                            </div>

                            <hr />

                            <div>
                                <h4 className="font-bold text-blue-600 mb-1">4가지 설정 항목</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li><strong>Fit Good range:</strong> 내가 선호하는 시간에 수업이 <strong> 들어가면</strong> 얼마나 좋은지.(음의 Loss)</li>
                                    <li><strong>Fit Bad range:</strong> 내가 피하고 싶은 시간에 수업이 <strong>들어가면</strong> 얼마나 싫은지.</li>
                                    <li><strong>Break time:</strong> 공강이 생기는 것을 얼마나 싫어하는지.</li>
                                    <li><strong>Prefer lectures:</strong> 내가 선호하는(Preference 점수) 과목이 포함되면 얼마나 좋은지.)음의 Loss가능)(and vice versa.)</li>
                                </ul>
                            </div>

                            <hr />

                            <div>
                                <h4 className="font-bold text-blue-600 mb-1">RSS (Root Sum Square) Mode</h4>
                                <p className="mb-2">
                                    <span className="font-semibold">OFF (Linear):</span> 단순히 횟수로 계산합니다.<br/>
                                    <span className="text-xs bg-gray-100 p-1 rounded">예: "1시간 위반 2번"과 "2시간 위반 1번"을 비슷하게 싫어함.</span>
                                </p>
                                <p>
                                    <span className="font-semibold">ON (Squared):</span> 위반 크기를 제곱해서 계산합니다.<br/>
                                    <span className="text-xs bg-gray-100 p-1 rounded">예: "조금씩 자주 어긋나는 건 참을 만하지만, 한 번에 왕창 어긋나는 건 용납 못 함!"</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {weights.map((w, idx) => (
                <div key={idx} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <label className="font-bold text-gray-700">{labels[idx]}</label>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">RSS Mode</span>
                            <button 
                                onClick={() => toggleRss(idx)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${w.rss ? 'bg-blue-500' : 'bg-gray-300'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${w.rss ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                        <input 
                            type="range" 
                            min="0" 
                            max="10" 
                            step="1"
                            value={w.weight}
                            onChange={(e) => setWeight(idx, parseInt(e.target.value))}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="w-8 text-right font-mono font-bold text-blue-600">{w.weight}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
