import { useApp } from '../context/AppContext';
import { TimetableRenderer } from './TimetableRenderer';
import { translations } from '../translations';

export const ResultsView = () => {
    const { generatedTimetables, language, preferences } = useApp();
    const t = translations[language].results;

    return (
        <TimetableRenderer
            timetables={generatedTimetables}
            preferences={preferences}
            labels={{
                title: t.title,
                subtitle: t.desc,
                rank: t.rank,
                total: language === 'ko' ? '총 조합' : 'Total',
                totalLoss: t.loss,
                totalCredits: t.totalCredits,
                noResults: t.noResults,
            }}
        />
    );
};
