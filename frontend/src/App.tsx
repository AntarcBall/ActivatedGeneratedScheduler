import { AppProvider, useApp } from './context/AppContext';
import { LectureList } from './components/LectureList';
import { PreferenceList } from './components/PreferenceList';
import { TimeSelector } from './components/TimeSelector';
import { WeightSettings } from './components/WeightSettings';
import { ResultsView } from './components/ResultsView';
import LandingPage from './components/LandingPage';
import { translations } from './translations';

const Content = () => {
  const { currentPage, totalPages, nextPage, prevPage, generateTimetables, isGenerating, language } = useApp();
  const t = translations[language];

  const handleNext = () => {
    if (currentPage === 5) {
      generateTimetables();
    } else {
      nextPage();
    }
  };

  const getPageTitle = (page: number) => {
    switch(page) {
      case 0: return t.landing.title;
      case 1: return t.steps.step1;
      case 2: return t.steps.step2;
      case 3: return t.steps.step3;
      case 4: return t.steps.step4;
      case 5: return t.steps.step5;
      case 6: return t.steps.step6;
      default: return "";
    }
  };

  const renderStep = () => {
    switch(currentPage) {
      case 0: return <LandingPage />;
      case 1: return <LectureList />;
      case 2: return <PreferenceList />;
      case 3: return <TimeSelector type="good" />;
      case 4: return <TimeSelector type="bad" />;
      case 5: return <WeightSettings />;
      case 6: return <ResultsView />;
      default: return (
        <div className="border border-dashed border-gray-300 rounded-lg h-64 flex items-center justify-center text-gray-500">
           Component for Page {currentPage} goes here.
        </div>
      );
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col items-center p-8 overflow-hidden">
      <div className="w-full max-w-5xl bg-white shadow-lg rounded-xl overflow-hidden flex flex-col h-full">
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 h-2">
          <div 
            className="bg-blue-500 h-2 transition-all duration-300"
            style={{ width: `${(currentPage / totalPages) * 100}%` }}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4">
              {currentPage === 0 ? t.landing.title : `Step ${currentPage}: ${getPageTitle(currentPage)}`}
          </h2>
          {renderStep()}
        </div>

        {/* Footer / Navigation */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={prevPage} 
              disabled={currentPage === 0 || isGenerating}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage === 0 
                  ? 'opacity-0 cursor-default' 
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.common.prev}
            </button>
            <div className="hidden sm:block">
               <h1 className="text-sm font-bold text-gray-700">AGS for DGIST</h1>
               <p className="text-[10px] text-gray-400">by H.J.</p>
            </div>
          </div>

          <button 
            onClick={handleNext} 
            disabled={currentPage === totalPages || isGenerating}
            className={`px-6 py-2 rounded-lg font-medium transition-colors text-white ${
              isGenerating
                ? 'bg-blue-400 cursor-wait'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isGenerating ? t.common.generating : currentPage === 0 ? t.landing.start : currentPage === 5 ? t.common.generate : currentPage === 6 ? t.common.finished : t.common.next}
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <Content />
    </AppProvider>
  );
}

export default App;