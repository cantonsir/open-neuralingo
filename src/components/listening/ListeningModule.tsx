import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { FocusedSegment, Marker, Subtitle, PlayerState, TagType, View, ListeningSession } from '../../types';
import { GoalVideo, GoalVideoDetail, api } from '../../db';
import { generateSubtitles } from '../../services/subtitleGenerationService';

// Views
import LoopView from './LoopView';
import DashboardView from './DashboardView';
import HistoryView from './HistoryView';
import FlashcardPractice from '../common/FlashcardPractice';
import LearningHome from './LearningHome';
import CourseDashboard from './CourseDashboard';
import LearningSession from './LearningSession';
import VocabularyManager from '../common/VocabularyManager';
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
  fetchSubtitles: (id: string, shouldNavigate?: boolean) => Promise<any>;
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

  setSubtitles: (subtitles: Subtitle[]) => void;
  setVideoId: (id: string) => void;
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
  setSubtitles,
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
  setVideoId,
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

  // Audio state (local to module if not passed from parent, but simpler to manage here for now if parent doesn't have it)
  // Actually, for cleaner architecture, let's add audioUrl to the parent App state or manage it here.
  // Since ListeningModuleProps defined it, we assume it comes from parent or we add it to the state management.
  // Wait, I see I didn't update App.tsx. I should probably manage audioUrl state here in ListeningModule if possible
  // or add it to the Props.
  // Let's add local state for audioUrl for now to avoid changing App.tsx if not strictly necessary,
  // BUT ListeningModule is a controlled component by App.tsx generally.
  // Let's check App.tsx. It renders ListeningModule.
  // I'll add the audioUrl state to ListeningModule for now, as it seems to be the main controller for the listening view.

  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [audioTitle, setAudioTitle] = useState<string>('');
  const [localSubtitles, setLocalSubtitles] = useState<Subtitle[]>(subtitles); // To override parent subtitles if needed
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);

  // Update local subtitles when parent subtitles change
  // BUT only when NOT in audio mode (don't overwrite audio session subtitles)
  React.useEffect(() => {
    if (!audioUrl) {
      setLocalSubtitles(subtitles);
    }
  }, [subtitles, audioUrl]);

  // Handle subtitle generation for videos without subtitles
  const handleGenerateSubtitles = useCallback(async (targetVideoId: string) => {
    console.log('[ListeningModule] Starting subtitle generation for:', targetVideoId);
    setIsGeneratingSubtitles(true);

    try {
      const generatedSubs = await generateSubtitles(targetVideoId);
      console.log('[ListeningModule] Generated subtitles:', generatedSubs.length);

      // Update both parent and local subtitles
      setSubtitles(generatedSubs);
      setLocalSubtitles(generatedSubs);

    } catch (error) {
      console.error('[ListeningModule] Subtitle generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Show detailed error with setup instructions if needed
      if (errorMessage.includes('not configured') || errorMessage.includes('not installed')) {
        alert(`Subtitle Generation Setup Required:\n\n${errorMessage}\n\nSetup Instructions:\n1. pip install google-cloud-speech yt-dlp\n2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable\n3. Restart the backend server`);
      } else {
        alert(`Failed to generate subtitles:\n\n${errorMessage}`);
      }
    } finally {
      setIsGeneratingSubtitles(false);
    }
  }, [setSubtitles]);

  // Track previous subtitle to avoid logging every frame
  const prevSubtitleRef = useRef<Subtitle | null>(null);

  // Compute current subtitle locally for audio sessions
  // This fixes the issue where getCurrentSubtitle() from parent uses parent's subtitles
  // but audio sessions manage their own localSubtitles
  const localCurrentSubtitle = useMemo(() => {
    if (!audioUrl) return null; // For YouTube videos, use parent's getCurrentSubtitle

    // Debug logging for audio sessions only
    if (localSubtitles.length === 0) {
      console.warn('[Subtitle Matching] No subtitles available yet');
      return null;
    }

    // Find matching subtitle
    const found = localSubtitles.find(
      s => state.currentTime >= s.start && state.currentTime <= s.end
    );

    // Only log when subtitle changes or when there's a mismatch
    if (found) {
      if (!prevSubtitleRef.current || prevSubtitleRef.current.id !== found.id) {
        console.log('[Subtitle Matching] ✅ Match found:', {
          text: found.text.substring(0, 50) + '...',
          start: found.start,
          end: found.end,
          currentTime: state.currentTime
        });
        prevSubtitleRef.current = found;
      }
    } else {
      if (prevSubtitleRef.current) {
        console.log('[Subtitle Matching] ⚠️ No match at time:', state.currentTime, 'between', localSubtitles[0]?.start, 'and', localSubtitles[localSubtitles.length - 1]?.end);
        prevSubtitleRef.current = null;
      }
    }

    return found || null;
  }, [audioUrl, localSubtitles, state.currentTime]);

  // Pause player when navigating away from loop view
  useEffect(() => {
    if (view !== 'loop' && player) {
      // Safe check for pauseVideo function
      if (typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      } else if (player.pause) {
        // Handle HTMLAudioElement mock or other player types
        player.pause();
      }
    }
  }, [view, player]);

  // Key to force MiniTest remount
  const [miniTestKey, setMiniTestKey] = useState(0);

  // Audio Generator initial data from test results
  const [audioGeneratorInitialData, setAudioGeneratorInitialData] = useState<{
    markedWords: string[];
    testSentences: string[];
    aiFeedback: string;
    strengths?: string[];
    weaknesses?: string[];
    recommendations?: string[];
    context: string;
  } | undefined>(undefined);

  const handleLoadVideo = () => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = inputUrl.match(regExp);
    const id = match && match[2].length === 11 ? match[2] : null;
    if (id) {
      fetchSubtitles(id);
      setAudioUrl(undefined); // Clear audio url when loading video
      setAudioTitle('');
    }
    else alert('Please enter a valid YouTube URL');
  };

  const handleLoadSession = (session: ListeningSession) => {
    console.log('[handleLoadSession] ========== LOADING SESSION ==========');
    console.log('[handleLoadSession] Session ID:', session.id);
    console.log('[handleLoadSession] Session prompt:', session.prompt);
    console.log('[handleLoadSession] Session audioUrl type:', session.audioUrl?.startsWith('blob:') ? 'Blob URL' : session.audioUrl?.startsWith('data:') ? 'Data URL' : 'Other');
    console.log('[handleLoadSession] Session audioUrl (first 100 chars):', session.audioUrl?.substring(0, 100));
    console.log('[handleLoadSession] Session subtitles:', session.subtitles);
    console.log('[handleLoadSession] Session subtitles count:', session.subtitles?.length || 0);
    console.log('[handleLoadSession] Session transcript count:', session.transcript?.length || 0);

    // 1. Set Audio URL
    setAudioUrl(session.audioUrl);
    setAudioTitle(session.prompt || 'Audio Session');
    console.log('[handleLoadSession] ✅ Audio URL set');

    // 2. Use stored subtitles if available, otherwise generate estimation
    let subtitlesToUse: Subtitle[] = [];
    if (session.subtitles && session.subtitles.length > 0) {
      subtitlesToUse = session.subtitles;
      console.log('[handleLoadSession] ✅ Using stored subtitles:', subtitlesToUse.length);
      console.log('[handleLoadSession] First subtitle:', subtitlesToUse[0]);
      console.log('[handleLoadSession] Last subtitle:', subtitlesToUse[subtitlesToUse.length - 1]);
    } else {
      // Fallback: Generate Subtitles with estimated timestamps
      const generatedSubtitles: Subtitle[] = [];
      let currentTime = 0;

      session.transcript.forEach((line, index) => {
        const text = `${line.speaker}: ${line.text}`;
        const wordCount = text.split(' ').length;
        // Estimate duration: ~150 words per minute => ~2.5 words per second
        // Minimum duration 2 seconds
        const duration = Math.max(2, wordCount / 2.5);

        generatedSubtitles.push({
          id: `gen-${session.id}-${index}`,
          start: currentTime,
          end: currentTime + duration,
          text: text
        });

        currentTime += duration;
      });

      subtitlesToUse = generatedSubtitles;
      console.log('[handleLoadSession] Generated fallback subtitles:', subtitlesToUse.length);
    }

    // Emergency Fallback if still empty
    if (subtitlesToUse.length === 0) {
      console.warn('[handleLoadSession] Subtitles still empty. Checking transcript:', session.transcript);
      if (session.transcript && Array.isArray(session.transcript) && session.transcript.length > 0) {
        let currentTime = 0;
        session.transcript.forEach((line, i) => {
          const text = line.text ? `${line.speaker || 'Speaker'}: ${line.text}` : JSON.stringify(line);
          const duration = Math.max(3, text.length / 15);
          subtitlesToUse.push({
            id: `emergency-fallback-${i}`,
            start: currentTime,
            end: currentTime + duration,
            text: text
          });
          currentTime += duration;
        });
      } else {
        subtitlesToUse.push({
          id: 'error-no-data',
          start: 0,
          end: 3600,
          text: 'Error: No transcript data found for this session.'
        });
      }
    }

    console.log('[handleLoadSession] Final subtitlesToUse:', subtitlesToUse);
    console.log('[handleLoadSession] Final subtitles count:', subtitlesToUse.length);

    // Sync subtitles with parent so Space key markers work
    setSubtitles(subtitlesToUse);
    setLocalSubtitles(subtitlesToUse);
    console.log('[handleLoadSession] ✅ Subtitles synced to state');

    // Use session ID as videoId so markers are tied to this session
    setVideoId(session.id);
    console.log('[handleLoadSession] ✅ Video ID set to session ID:', session.id);

    // 3. Switch View
    setView('loop');
    console.log('[handleLoadSession] ✅ Switched to loop view');
    console.log('[handleLoadSession] ========== SESSION LOADED ==========');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Loop View - ALWAYS MOUNTED, but hidden if not active */}
      <div className={`flex-1 flex flex-col overflow-hidden ${view === 'loop' ? 'flex' : 'hidden'} relative`}>
        <LoopView
          videoId={audioUrl ? '' : videoId} // Hide videoId if audio is playing
          audioUrl={audioUrl}
          videoTitle={audioUrl ? (audioTitle || 'Audio Session') : videoTitle}
          inputUrl={inputUrl}
          setInputUrl={setInputUrl}
          isFetchingSubs={isFetchingSubs}
          onLoadVideo={handleLoadVideo}
          player={player}
          onPlayerReady={setPlayer}
          onStateChange={setState}
          state={state}
          currentSubtitle={audioUrl ? localCurrentSubtitle : getCurrentSubtitle()}
          subtitles={localSubtitles} // Use local subtitles
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
          onGenerateSubtitles={handleGenerateSubtitles}
          isGeneratingSubtitles={isGeneratingSubtitles}
        />
      </div>

      {/* Dashboard View */}
      {view === 'home' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
          <DashboardView
            onPlayVideo={(videoId) => {
              setAudioUrl(undefined);
              setAudioTitle('');
              fetchSubtitles(videoId);
            }}
            onNavigate={(v) => setView(v as View)}
            savedCardsCount={savedCards.length}
            markersCount={markers.length}
          />
        </div>
      )}

      {/* Compose View - Generate Audio Discussions (keep mounted) */}
      <div className={`flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto ${view === 'compose' ? 'flex' : 'hidden'}`}>
        <ListeningCompose
          setView={setView}
          onLoadSession={handleLoadSession}
          targetLanguage={targetLanguage}
          initialData={audioGeneratorInitialData}
        />
      </div>

      {/* History View */}
      {view === 'history' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <HistoryView
            onPlayVideo={(videoId) => {
              setAudioUrl(undefined);
              setAudioTitle('');
              fetchSubtitles(videoId);
            }}
            savedCardsCount={savedCards.length}
            markersCount={markers.length}
          />
        </div>
      )}

      {/* Flashcards View - keep-alive to preserve stage */}
      <div className={`flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-hidden ${view === 'flashcards' ? 'flex' : 'hidden'}`}>
        <FlashcardPractice
          module="listening"
          savedCards={savedCards}
          onExit={() => setView('home')}
          onPlayAudio={handlePlaySegment}
        />
      </div>

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
                setAudioUrl(undefined);
                setAudioTitle('');
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
              onLoadSession={handleLoadSession}
              onNavigateToAudioGenerator={(testData) => {
                setAudioGeneratorInitialData(testData);
                setView('compose');
              }}
            />
          )}
        </div>
      )}

      {/* Vocabulary Manager View */}
      {view === 'vocab' && (
        <div className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-hidden">
          <VocabularyManager
            module="listening"
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
