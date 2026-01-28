import React, { useState } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { FocusedSegment, Marker, Subtitle, PlayerState, TagType, View } from '../../types';
import { GoalVideo, GoalVideoDetail, api } from '../../db';

// Views
import LoopView from './LoopView';
import DashboardView from './DashboardView';
import HistoryView from './HistoryView';
import FlashcardPractice from './FlashcardPractice';
import LearningHome from './LearningHome';
import CourseDashboard from './CourseDashboard';
import LearningSession from './LearningSession';
import VocabularyManager from './VocabularyManager';
import SelfAssessment from './SelfAssessment';
import MiniTest from './MiniTest';
import ListeningCompose from './ListeningCompose';

interface ListeningModuleProps {
  view: View;
  setView: (view: View) => void;
  targetLanguage: string;
  
  // Video player props
  videoId: string;
  videoTitle: string;
  inputUrl: string;
  setInputUrl: (url: string) => void;
  isFetchingSubs: boolean;
  fetchSubtitles: (id: string, shouldNavigate?: boolean) => Promise<void>;
  player: YouTubePlayer | null;
  setPlayer: (player: YouTubePlayer | null) => void;
  state: PlayerState;
  setState: (state: Partial<PlayerState>) => void;
  subtitles: Subtitle[];
  subtitlesVisible: boolean;
  setSubtitlesVisible: (visible: boolean) => void;
  isPeekingSubs: boolean;
  getCurrentSubtitle: () => Subtitle | null;
  focusedSegment: FocusedSegment | null;
  setFocusedSegment: (segment: FocusedSegment | null) => void;
  
  // Marker props
  markers: Marker[];
  currentLoopId: string | null;
  handlePlayLoop: (marker: Marker) => void;
  handleStopLoop: () => void;
  handleDeleteMarker: (id: string) => void;
  handleAddTag: (id: string, tag: TagType) => void;
  handleRemoveTag: (id: string, tag: TagType) => void;
  handleToggleWord: (id: string, wordIndex: number) => void;
  handleToggleRange: (id: string, start: number, end: number) => void;
  handleRemoveWord: (wordToRemove: string) => void;
  handleUpdateVocabData: (markerId: string, index: number, field: 'definition' | 'notes', value: string) => void;
  handleToggleWordForSegment: (segment: FocusedSegment | null, index: number) => void;
  handleToggleRangeForSegment: (segment: FocusedSegment | null, start: number, end: number) => void;
  
  // Playback controls
  handlePrevSubtitle: () => void;
  handleNextSubtitle: () => void;
  handlePlaySegment: (start: number, end: number, targetVideoId?: string) => void;
  changePlaybackRate: (rate: number) => void;
  
  // Deck
  savedCards: Marker[];
  handleSaveToDeck: (marker: Marker) => void;
  handleDeleteFromDeck: (id: string) => void;
  handleUpdateCard: (id: string, updates: Partial<Marker>) => void;
  
  // Learning data
  assessmentProfile: any;
  setAssessmentProfile: (profile: any) => void;
  assessmentResults: any[] | null;
  setAssessmentResults: (results: any[] | null) => void;
  assessmentLoaded: boolean;
  learningGoals: GoalVideo[];
  setLearningGoals: (goals: GoalVideo[]) => void;
  goalsLoaded: boolean;
  goalDetailsCache: Record<string, GoalVideoDetail>;
  refreshAssessmentData: () => Promise<void>;
  refreshGoalDetails: (goalId: string) => Promise<void>;
}

export default function ListeningModule({
  view,
  setView,
  targetLanguage,
  videoId,
  videoTitle,
  inputUrl,
  setInputUrl,
  isFetchingSubs,
  fetchSubtitles,
  player,
  setPlayer,
  state,
  setState,
  subtitles,
  subtitlesVisible,
  setSubtitlesVisible,
  isPeekingSubs,
  getCurrentSubtitle,
  focusedSegment,
  setFocusedSegment,
  markers,
  currentLoopId,
  handlePlayLoop,
  handleStopLoop,
  handleDeleteMarker,
  handleAddTag,
  handleRemoveTag,
  handleToggleWord,
  handleToggleRange,
  handleRemoveWord,
  handleUpdateVocabData,
  handleToggleWordForSegment,
  handleToggleRangeForSegment,
  handlePrevSubtitle,
  handleNextSubtitle,
  handlePlaySegment,
  changePlaybackRate,
  savedCards,
  handleSaveToDeck,
  handleDeleteFromDeck,
  handleUpdateCard,
  assessmentProfile,
  setAssessmentProfile,
  assessmentResults,
  setAssessmentResults,
  assessmentLoaded,
  learningGoals,
  setLearningGoals,
  goalsLoaded,
  goalDetailsCache,
  refreshAssessmentData,
  refreshGoalDetails,
}: ListeningModuleProps) {
  // Learning Section navigation state
  const [learningView, setLearningView] = useState<'home' | 'course' | 'lesson'>('home');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState<number>(0);
  const [selectedSegmentData, setSelectedSegmentData] = useState<{
    videoId: string;
    subtitle: string[];
    startTime: number;
    endTime: number;
  } | null>(null);

  // Key to force MiniTest remount
  const [miniTestKey, setMiniTestKey] = useState(0);

  const handleLoadVideo = () => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = inputUrl.match(regExp);
    const id = match && match[2].length === 11 ? match[2] : null;
    if (id) fetchSubtitles(id);
    else alert('Please enter a valid YouTube URL');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Loop View - ALWAYS MOUNTED, but hidden if not active */}
      <div className={`flex-1 flex flex-col overflow-hidden ${view === 'loop' ? 'flex' : 'hidden'}`}>
        <LoopView
          videoId={videoId}
          videoTitle={videoTitle}
          inputUrl={inputUrl}
          setInputUrl={setInputUrl}
          isFetchingSubs={isFetchingSubs}
          onLoadVideo={handleLoadVideo}
          player={player}
          onPlayerReady={setPlayer}
          onStateChange={(s) => setState({ ...state, ...s })}
          state={state}
          currentSubtitle={getCurrentSubtitle()}
          subtitles={subtitles}
          subtitlesVisible={subtitlesVisible}
          isPeekingSubs={isPeekingSubs}
          setSubtitlesVisible={setSubtitlesVisible}
          focusedSegment={focusedSegment}
          markers={markers}
          currentLoopId={currentLoopId}
          onPlayLoop={handlePlayLoop}
          onStopLoop={handleStopLoop}
          onDeleteMarker={handleDeleteMarker}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onToggleWord={handleToggleWord}
          onToggleRange={handleToggleRange}
          onPlayOnce={handlePlaySegment}
          onPlayPause={() => state.isPlaying ? player?.pauseVideo() : player?.playVideo()}
          onPrevSubtitle={handlePrevSubtitle}
          onNextSubtitle={handleNextSubtitle}
          onChangePlaybackRate={changePlaybackRate}
          onSeek={(t) => player?.seekTo(t, true)}
          onFocusSegment={setFocusedSegment}
          onToggleSegmentWord={handleToggleWordForSegment}
          onToggleSegmentRange={handleToggleRangeForSegment}
        />
      </div>

      {/* Dashboard View */}
      {view === 'home' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
          <DashboardView
            onPlayVideo={(videoId) => fetchSubtitles(videoId)}
            onNavigate={(v) => setView(v as View)}
            savedCardsCount={savedCards.length}
            markersCount={markers.length}
          />
        </div>
      )}

      {/* Compose View - Generate Audio Discussions */}
      {view === 'compose' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
          <ListeningCompose setView={setView} />
        </div>
      )}

      {/* History View */}
      {view === 'history' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <HistoryView
            onPlayVideo={(videoId) => fetchSubtitles(videoId)}
            savedCardsCount={savedCards.length}
            markersCount={markers.length}
          />
        </div>
      )}

      {/* Flashcards View */}
      {view === 'flashcards' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <FlashcardPractice
            savedCards={savedCards}
            onExit={() => setView('home')}
            onPlayAudio={handlePlaySegment}
          />
        </div>
      )}

      {/* Learning Section - 3 Level Hierarchy */}
      {view === 'learning' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Level 1: Goal Videos List */}
          {learningView === 'home' && (
            <LearningHome
              defaultLanguage={targetLanguage}
              cachedGoals={learningGoals}
              isLoaded={goalsLoaded}
              onGoalsUpdate={setLearningGoals}
              onSelectGoal={(goalId) => {
                setSelectedGoalId(goalId);
                setLearningView('course');
              }}
            />
          )}

          {/* Level 2: Course Dashboard (Segments) */}
          {learningView === 'course' && selectedGoalId && (
            <CourseDashboard
              goalId={selectedGoalId}
              cachedGoal={goalDetailsCache[selectedGoalId]}
              onCacheUpdate={refreshGoalDetails}
              onBack={() => {
                setLearningView('home');
                setSelectedGoalId(null);
              }}
              onWatchVideo={async (videoId) => {
                await fetchSubtitles(videoId);
                setView('loop');
              }}
              onStartLesson={async (goalId, segmentIndex, videoId, startTime, endTime) => {
                setSelectedSegmentIndex(segmentIndex);

                try {
                  const data = await api.fetchSegmentSentences(goalId, segmentIndex);
                  setSelectedSegmentData({
                    videoId,
                    subtitle: data.sentences || [],
                    startTime,
                    endTime
                  });
                  setLearningView('lesson');
                } catch (error) {
                  console.error('Failed to load segment:', error);
                }
              }}
            />
          )}

          {/* Level 3: Lesson Drills */}
          {learningView === 'lesson' && selectedGoalId && selectedSegmentData && (
            <LearningSession
              goalId={selectedGoalId}
              videoId={selectedSegmentData.videoId}
              segmentIndex={selectedSegmentIndex}
              segmentSubtitle={selectedSegmentData.subtitle}
              segmentStartTime={selectedSegmentData.startTime}
              segmentEndTime={selectedSegmentData.endTime}
              onExit={() => {
                setLearningView('course');
                setSelectedSegmentData(null);
              }}
              onComplete={() => {
                refreshGoalDetails(selectedGoalId);
                setLearningView('course');
                setSelectedSegmentData(null);
              }}
            />
          )}
        </div>
      )}

      {/* Vocabulary Manager View */}
      {view === 'vocab' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <VocabularyManager
            markers={markers}
            savedCards={savedCards}
            onRemoveWord={handleRemoveWord}
            onUpdateVocabData={handleUpdateVocabData}
            onPlaySegment={handlePlaySegment}
            onSaveToDeck={handleSaveToDeck}
            onDeleteCard={handleDeleteFromDeck}
            onUpdateCard={handleUpdateCard}
            onDiscardSessionMarker={handleDeleteMarker}
          />
        </div>
      )}

      {/* Self-Assessment View */}
      {view === 'assessment' && (
        <SelfAssessment
          onComplete={() => setView('home')}
          onStartTest={() => {
            setMiniTestKey(prev => prev + 1);
            setView('minitest');
          }}
          cachedProfile={assessmentProfile}
          cachedResults={assessmentResults}
          isLoaded={assessmentLoaded}
          onProfileUpdate={setAssessmentProfile}
          onResultsUpdate={setAssessmentResults}
        />
      )}

      {/* Mini-Test View */}
      {view === 'minitest' && (
        <MiniTest
          key={miniTestKey}
          onComplete={() => {
            refreshAssessmentData();
            setView('assessment');
          }}
          onBack={() => setView('assessment')}
        />
      )}
    </div>
  );
}
