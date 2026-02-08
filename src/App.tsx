import React, { useCallback, useState } from 'react';
import { View, Module, Marker, PlayerState } from './types';
import { FlashcardModule } from './db';

// Components
import Sidebar from './components/common/Sidebar';
import SettingsPanel from './components/common/SettingsPanel';
import FlashcardPractice from './components/common/FlashcardPractice';
import VocabularyManager from './components/common/VocabularyManager';
import ListeningModule from './components/listening/ListeningModule';
import ReadingView from './components/reading/ReadingView';
import SpeakingView from './components/speaking/SpeakingView';
import WritingView from './components/writing/WritingView';
import ReadingDashboard from './components/reading/ReadingDashboard';
import ReadingLibrary from './components/reading/ReadingLibrary';
import ReadingLessons from './components/reading/ReadingLessons';
import ReadingAssessmentPage from './components/reading/ReadingAssessmentPage';
import ReadingCompose from './components/reading/ReadingCompose';
import ReadingWebPage from './components/reading/ReadingWebPage';
import ReadingProfile from './components/reading/ReadingProfile';
import ReadingStatistics from './components/reading/ReadingStatistics';
import SpeakingDashboard from './components/speaking/SpeakingDashboard';
import SpeakingScenario from './components/speaking/SpeakingScenario';
import SpeakingLessons from './components/speaking/SpeakingLessons';
import SpeakingAssessment from './components/speaking/SpeakingAssessment';
import WritingDashboard from './components/writing/WritingDashboard';
import WritingCompose from './components/writing/WritingCompose';
import WritingLessons from './components/writing/WritingLessons';
import WritingAssessmentPage from './components/writing/WritingAssessmentPage';
import ModuleLandingPage from './components/common/ModuleLandingPage';

// Hooks
import { useTheme } from './hooks/useTheme';
import { useTargetLanguage } from './hooks/useTargetLanguage';
import { useFirstLanguage } from './hooks/useFirstLanguage';
import { useSubtitles } from './hooks/useSubtitles';
import { useVideoPlayer } from './hooks/useVideoPlayer';
import { useMarkers } from './hooks/useMarkers';
import { useLearningData } from './hooks/useLearningData';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useDeck } from './hooks/useDeck';

const INITIAL_SETUP_STORAGE_KEY = 'initialSetupComplete';

function App() {
  // --- Core App State ---
  const [activeModule, setActiveModule] = useState<Module>('landing');
  const [view, setView] = useState<View>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // --- Theme & Language ---
  const { theme, toggleTheme } = useTheme();
  const { targetLanguage, setTargetLanguage } = useTargetLanguage();
  const { firstLanguage, setFirstLanguage } = useFirstLanguage();
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => {
    try {
      const setupValue = localStorage.getItem(INITIAL_SETUP_STORAGE_KEY);
      if (setupValue === 'true') return true;
      if (setupValue === 'false') return false;

      const hasLegacyPreferences = Boolean(
        localStorage.getItem('firstLanguage') || localStorage.getItem('targetLanguage')
      );
      return hasLegacyPreferences;
    } catch {
      return true;
    }
  });

  const handleCompleteSetup = useCallback((nextFirstLanguage: string, nextTargetLanguage: string) => {
    setFirstLanguage(nextFirstLanguage);
    setTargetLanguage(nextTargetLanguage);
    setIsSetupComplete(true);

    try {
      localStorage.setItem(INITIAL_SETUP_STORAGE_KEY, 'true');
    } catch {
      // Ignore localStorage write errors
    }
  }, [setFirstLanguage, setTargetLanguage]);

  const handleResetSetup = useCallback(() => {
    setIsSetupComplete(false);
    setActiveModule('landing');
    setView('home');

    try {
      localStorage.setItem(INITIAL_SETUP_STORAGE_KEY, 'false');
    } catch {
      // Ignore localStorage write errors
    }
  }, []);

  // --- Subtitles ---
  const { subtitles, setSubtitles } = useSubtitles();

  // --- Video Player ---
  const videoPlayer = useVideoPlayer({
    targetLanguage,
    subtitles,
    view,
    setView,
    setSubtitles,
  });

  const { setState: setPlayerState } = videoPlayer;
  const handlePlayerStateChange = useCallback((patch: Partial<PlayerState>) => {
    setPlayerState(prev => ({ ...prev, ...patch }));
  }, [setPlayerState]);

  // --- Markers ---
  const markersHook = useMarkers({
    player: videoPlayer.player,
    videoId: videoPlayer.videoId,
    subtitles,
  });

  // --- Deck (Flashcards) ---
  const { savedCards, saveCard, deleteCard, updateCard } = useDeck(activeModule as FlashcardModule);

  // --- Learning Data ---
  const learningData = useLearningData();

  // --- Keyboard Shortcuts ---
  useKeyboardShortcuts({
    enabled: activeModule === 'listening' && view === 'loop',
    isSetupMode: videoPlayer.isSetupMode,
    player: videoPlayer.player,
    isPlaying: videoPlayer.state.isPlaying,
    addMarker: markersHook.addMarker,
    handlePrevSubtitle: videoPlayer.handlePrevSubtitle,
    handleNextSubtitle: videoPlayer.handleNextSubtitle,
    setIsPeekingSubs: videoPlayer.setIsPeekingSubs,
  });

  // --- Deck Handlers with UI feedback ---
  const handleSaveToDeck = async (marker: any) => {
    try {
      await saveCard(marker);
    } catch (e) {
      alert("Failed to save to database");
    }
  };

  const handleDeleteFromDeck = async (id: string) => {
    try {
      await deleteCard(id);
    } catch (e) {
      alert("Failed to delete from database");
    }
  };

  const handleUpdateCard = async (id: string, updates: any) => {
    try {
      await updateCard(id, updates);
    } catch (e) {
      // Error handled in hook
    }
  };

  // --- Delete marker with loop stop ---
  const handleDeleteMarker = (id: string) => {
    if (videoPlayer.currentLoop?.id === id) videoPlayer.handleStopLoop();
    markersHook.handleDeleteMarker(id);
  };

  // --- Reading/Speaking/Writing Data ---
  const [readingData, setReadingData] = useState<{ libraryId: string; title: string; content?: string } | null>(null);
  const [readingMarkers, setReadingMarkers] = useState<Marker[]>([]);
  const [speakingData, setSpeakingData] = useState<{ mode: 'live' | 'tts'; topic: string; contextId?: string } | null>(null);
  const [writingData, setWritingData] = useState<{ id?: string; topic: string; contextId?: string; content?: string } | null>(null);

  const handleDiscardReadingMarker = (id: string) => {
    setReadingMarkers((prev) => prev.filter((marker) => marker.id !== id));
  };

  const handleNavigateWithData = (navView: View, data?: any) => {
    if (navView === 'reader' && data) {
      setReadingData(data);
    }
    setView(navView);
  };

  const handleLibraryNavigate = (navView: View, data?: any) => {
    setActiveModule('reading');
    handleNavigateWithData(navView, data);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden transition-colors">
      {/* Left Sidebar - Hidden on landing page */}
      {activeModule !== 'landing' && (
        <Sidebar
          view={view}
          setView={setView}
          theme={theme}
          onOpenSettings={() => setIsSettingsOpen(true)}
          savedCardsCount={savedCards.length}
          markersCount={markersHook.markers.length}
          videoId={videoPlayer.videoId}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          readerAvailable={Boolean(readingData)}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        targetLanguage={targetLanguage}
        onLanguageChange={setTargetLanguage}
        firstLanguage={firstLanguage}
        onFirstLanguageChange={setFirstLanguage}
        onResetSetup={() => {
          handleResetSetup();
          setIsSettingsOpen(false);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Landing Page */}
        {activeModule === 'landing' && (
          <ModuleLandingPage
            onSelectModule={setActiveModule}
            firstLanguage={firstLanguage}
            targetLanguage={targetLanguage}
            isSetupComplete={isSetupComplete}
            onCompleteSetup={handleCompleteSetup}
            onResetSetup={handleResetSetup}
          />
        )}

        {/* Reading Module */}
        {activeModule === 'reading' && (
          <>
            {/* Persist WebPage in background to avoid reload - MOVED OUTSIDE TERNARY */}
            <div className={view === 'webpage' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
              <ReadingWebPage
                onNavigate={setView}
                firstLanguage={firstLanguage}
                onMarkersUpdate={setReadingMarkers}
                onSaveToDeck={handleSaveToDeck}
                speechLanguage={targetLanguage}
              />
            </div>

            {/* Persist Library in background to avoid reload */}
            <div className={view === 'library' ? 'flex-1 overflow-hidden' : 'hidden'}>
              <ReadingLibrary onNavigate={handleLibraryNavigate} />
            </div>

            {/* Persist Reading Generator in background to avoid reload */}
            <div className={view === 'compose' || view === 'generator' ? 'flex-1 flex overflow-hidden' : 'hidden'}>
              <ReadingCompose setView={setView} setReadingData={setReadingData} />
            </div>

            {/* Persist Reader in background to avoid reload */}
              <div className={view === 'reader' ? 'flex-1 flex overflow-hidden' : 'hidden'}>
                <ReadingView
                  libraryId={readingData?.libraryId || ''}
                  title={readingData?.title || ''}
                  content={readingData?.content}
                  onNavigate={setView}
                  onMarkersUpdate={setReadingMarkers}
                  onSaveToDeck={handleSaveToDeck}
                  firstLanguage={firstLanguage}
                  speechLanguage={targetLanguage}
                />
              </div>

            {/* Persist Reading Flashcards in background to avoid reload */}
            <div className={view === 'flashcards' ? 'flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden' : 'hidden'}>
              <FlashcardPractice
                module="reading"
                savedCards={savedCards}
                onExit={() => setView('home')}
                onPlayAudio={() => { }}
              />
            </div>

            {view !== 'webpage' && view !== 'library' && view !== 'compose' && view !== 'generator' && view !== 'reader' && view !== 'flashcards' && (
              view === 'learning' ? <ReadingLessons /> :
                view === 'assessment' ? <ReadingAssessmentPage /> :
                  view === 'statistics' ? (
                    <ReadingStatistics
                      onTakeNewAssessment={() => setView('assessment')}
                      onViewAssessment={(id) => {
                        // TODO: Navigate to specific assessment view
                        console.log('View assessment:', id);
                      }}
                    />
                  ) :
                  view === 'vocab' ? (
                    <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
                      <VocabularyManager
                        module="reading"
                        markers={readingMarkers}
                        savedCards={savedCards}
                        onRemoveWord={() => { }}
                        onUpdateVocabData={() => { }}
                        onPlaySegment={() => { }}
                        onSaveToDeck={handleSaveToDeck}
                        onDeleteCard={handleDeleteFromDeck}
                        onUpdateCard={handleUpdateCard}
                        onDiscardSessionMarker={handleDiscardReadingMarker}
                        onProcessQueue={() => setView('flashcards')}
                      />
                    </div>
                  ) :
                      // view === 'webpage', 'library', generator, reader, and flashcards are handled above
                      <ReadingDashboard onNavigate={setView} />
            )}
          </>
        )}

        {/* Speaking Module */}
        {activeModule === 'speaking' && (
          <>
            {/* Persist Speaking Flashcards in background to avoid reload */}
            <div className={view === 'flashcards' ? 'flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden' : 'hidden'}>
              <FlashcardPractice
                module="speaking"
                savedCards={savedCards}
                onExit={() => setView('home')}
                onPlayAudio={() => { }}
              />
            </div>

            {view !== 'flashcards' && (
              view === 'library' ? (
                <ReadingLibrary onNavigate={handleLibraryNavigate} />
              ) :
              view === 'learning' ? <SpeakingLessons /> :
                view === 'assessment' ? <SpeakingAssessment /> :
                  view === 'vocab' ? (
                    <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
                      <VocabularyManager
                        module="speaking"
                        markers={[]}
                        savedCards={savedCards}
                        onRemoveWord={() => { }}
                        onUpdateVocabData={() => { }}
                        onPlaySegment={() => { }}
                        onSaveToDeck={handleSaveToDeck}
                        onDeleteCard={handleDeleteFromDeck}
                        onUpdateCard={handleUpdateCard}
                        onProcessQueue={() => setView('flashcards')}
                      />
                    </div>
                  ) :
                    view === 'scenario' ? <SpeakingScenario setView={setView} setSpeakingData={setSpeakingData} speechLanguage={targetLanguage} /> :
                  view === 'conversation' && speakingData ? (
                    <SpeakingView
                      mode={speakingData.mode}
                      topic={speakingData.topic}
                      contextId={speakingData.contextId}
                      onNavigate={setView}
                    />
                  ) : (
                    <SpeakingDashboard
                      setView={setView}
                      setSpeakingData={setSpeakingData}
                    />
                  )
            )}
          </>
        )}

        {/* Writing Module */}
        {activeModule === 'writing' && (
          <>
            {/* Persist Writing Flashcards in background to avoid reload */}
            <div className={view === 'flashcards' ? 'flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden' : 'hidden'}>
              <FlashcardPractice
                module="writing"
                savedCards={savedCards}
                onExit={() => setView('home')}
                onPlayAudio={() => { }}
              />
            </div>

            {view !== 'flashcards' && (
              view === 'library' ? (
                <ReadingLibrary onNavigate={handleLibraryNavigate} />
              ) :
              view === 'learning' ? <WritingLessons /> :
                view === 'assessment' ? <WritingAssessmentPage /> :
                  view === 'vocab' ? (
                    <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
                      <VocabularyManager
                        module="writing"
                        markers={[]}
                        savedCards={savedCards}
                        onRemoveWord={() => { }}
                        onUpdateVocabData={() => { }}
                        onPlaySegment={() => { }}
                        onSaveToDeck={handleSaveToDeck}
                        onDeleteCard={handleDeleteFromDeck}
                        onUpdateCard={handleUpdateCard}
                        onProcessQueue={() => setView('flashcards')}
                      />
                    </div>
                  ) :
                    view === 'compose' || view === 'correction' ? <WritingCompose setView={setView} setWritingData={setWritingData} /> :
                  view === 'writer' && writingData ? (
                    <WritingView
                      sessionId={writingData.id}
                      topic={writingData.topic}
                      contextId={writingData.contextId}
                      initialContent={writingData.content}
                      onBack={setView}
                    />
                  ) : (
                    <WritingDashboard
                      setView={setView}
                      setWritingData={setWritingData}
                    />
                  )
            )}
          </>
        )}

        {/* Listening Module */}
        {activeModule === 'listening' && (
          view === 'library' ? (
            <ReadingLibrary onNavigate={handleLibraryNavigate} />
          ) : (
          <ListeningModule
            view={view}
            setView={setView}
            targetLanguage={targetLanguage}
            // Video player
            videoId={videoPlayer.videoId}
            videoTitle={videoPlayer.videoTitle}
            inputUrl={videoPlayer.inputUrl}
            setInputUrl={videoPlayer.setInputUrl}
            isFetchingSubs={videoPlayer.isFetchingSubs}
            fetchSubtitles={videoPlayer.fetchSubtitles}
            player={videoPlayer.player}
            setPlayer={videoPlayer.setPlayer}
            state={videoPlayer.state}
            setState={handlePlayerStateChange}
            subtitles={subtitles}
            setSubtitles={setSubtitles}
            setVideoId={videoPlayer.setVideoId}
            setIsSetupMode={videoPlayer.setIsSetupMode}
            subtitlesVisible={videoPlayer.subtitlesVisible}
            setSubtitlesVisible={videoPlayer.setSubtitlesVisible}
            isPeekingSubs={videoPlayer.isPeekingSubs}
            getCurrentSubtitle={videoPlayer.getCurrentSubtitle}
            focusedSegment={videoPlayer.focusedSegment}
            setFocusedSegment={videoPlayer.setFocusedSegment}
            // Markers
            markers={markersHook.markers}
            currentLoopId={videoPlayer.currentLoop?.id || null}
            handlePlayLoop={videoPlayer.handlePlayLoop}
            handleStopLoop={videoPlayer.handleStopLoop}
            handleDeleteMarker={handleDeleteMarker}
            handleAddTag={markersHook.handleAddTag}
            handleRemoveTag={markersHook.handleRemoveTag}
            handleToggleWord={markersHook.handleToggleWord}
            handleToggleRange={markersHook.handleToggleRange}
            handleRemoveWord={markersHook.handleRemoveWord}
            handleUpdateVocabData={markersHook.handleUpdateVocabData}
            handleToggleWordForSegment={markersHook.handleToggleWordForSegment}
            handleToggleRangeForSegment={markersHook.handleToggleRangeForSegment}
            // Controls
            handlePrevSubtitle={videoPlayer.handlePrevSubtitle}
            handleNextSubtitle={videoPlayer.handleNextSubtitle}
            handlePlaySegment={videoPlayer.handlePlaySegment}
            changePlaybackRate={videoPlayer.changePlaybackRate}
            // Deck
            savedCards={savedCards}
            handleSaveToDeck={handleSaveToDeck}
            handleDeleteFromDeck={handleDeleteFromDeck}
            handleUpdateCard={handleUpdateCard}
            // Learning data
            assessmentProfile={learningData.assessmentProfile}
            setAssessmentProfile={learningData.setAssessmentProfile}
            assessmentResults={learningData.assessmentResults}
            setAssessmentResults={learningData.setAssessmentResults}
            assessmentLoaded={learningData.assessmentLoaded}
            learningGoals={learningData.learningGoals}
            setLearningGoals={learningData.setLearningGoals}
            goalsLoaded={learningData.goalsLoaded}
            goalDetailsCache={learningData.goalDetailsCache}
            refreshAssessmentData={learningData.refreshAssessmentData}
            refreshGoalDetails={learningData.refreshGoalDetails}
          />
          )
        )}
      </div>
    </div>
  );
}

export default App;
