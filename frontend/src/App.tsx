import { AppProvider, useApp } from './context/AppContext';
import { LectureList } from './components/LectureList';
import { PreferenceList } from './components/PreferenceList';
import { TimeSelector } from './components/TimeSelector';
import { WeightSettings } from './components/WeightSettings';
import { ResultsView } from './components/ResultsView';
import { LandingPage } from './components/LandingPage';

const Content = () => {
  const { currentPage, totalPages, nextPage, prevPage, generateTimetables, isGenerating } = useApp();

  const handleNext = () => {
    if (currentPage === 5) {
      generateTimetables();
    } else {
      nextPage();
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
              {currentPage === 0 ? "Welcome" : `Step ${currentPage}: ${getPageTitle(currentPage)}`}
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
              Previous
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
            {isGenerating ? 'Generating...' : currentPage === 0 ? 'Start' : currentPage === 5 ? 'Generate Timetable' : currentPage === 6 ? 'Finished' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

const getPageTitle = (page: number) => {
  switch(page) {
    case 0: return "Welcome";
    case 1: return "Select Lectures";
    case 2: return "Set Preferences";
    case 3: return "Select Preferred Times";
    case 4: return "Select Avoided Times";
    case 5: return "Set Weights";
    case 6: return "Results";
    default: return "";
  }
}

function App() {
  return (
    <AppProvider>
      <Content />
    </AppProvider>
  );
}

export default App;