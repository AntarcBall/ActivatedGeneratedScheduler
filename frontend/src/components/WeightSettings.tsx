import { useApp } from '../context/AppContext';

export const WeightSettings = () => {
    const { weights, setWeight, toggleRss } = useApp();

    const labels = [
        "Fit Good range (Preferred times)",
        "Fit Bad range (Avoided times)",
        "Break time (Gap minimization)",
        "Prefer lectures (Individual pref)"
    ];

    return (
        <div className="flex flex-col h-full space-y-8 p-4">
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
