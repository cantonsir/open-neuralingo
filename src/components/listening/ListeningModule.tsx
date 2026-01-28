import React, { useMemo, useState } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { FocusedSegment, ListeningFeedbackSession, Marker, Subtitle, PlayerState, TagType, View } from '../../types';
import { GoalVideo, GoalVideoDetail, api } from '../../db';
import { formatTime } from '../../utils';

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

function formatDateTime(ts: number): string {
  const date = new Date(ts);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const TAG_LABELS: Record<TagType, string> = {
  'too-fast': 'Too Fast',
  unclear: 'Unclear',
  accent: 'Accent',
  grammar: 'Grammar',
  vocabulary: 'Vocab',
};

const TAG_STYLES: Record<TagType, string> = {
  'too-fast': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800',
  unclear: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-200 dark:border-orange-800',
  accent: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-200 dark:border-purple-800',
  grammar: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800',
  vocabulary: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800',
};

function getTagCounts(markers: Marker[]): Record<TagType, number> {
  return markers.reduce((acc, marker) => {
    marker.tags.forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {} as Record<TagType, number>);
}

function getMisunderstoodWords(markers: Marker[]): string[] {
  const words = new Set<string>();

  markers.forEach(marker => {
    if (!marker.subtitleText || !marker.misunderstoodIndices?.length) return;
    const parts = marker.subtitleText.trim().split(/\s+/);
    marker.misunderstoodIndices.forEach(idx => {
      const word = parts[idx];
      if (!word) return;
      const cleaned = word.replace(/[^\w'-]/g, '');
      if (cleaned) words.add(cleaned);
    });
  });

  return Array.from(words);
}

function getHotSpots(markers: Marker[]): Marker[] {
  return markers
    .filter(m => (m.pressCount || 1) > 1)
    .sort((a, b) => (b.pressCount || 1) - (a.pressCount || 1))
    .slice(0, 3);
}

function FeedbackHistoryView() {
  const [sessions, setSessions] = useState<ListeningFeedbackSession[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      const data = await api.fetchListeningFeedbackSessions();
      setSessions(data);
      setLoading(false);
    };

    loadSessions();
  }, []);

  const totalMarkers = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.markers?.length || 0), 0),
    [sessions]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Loading feedback history...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback History</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Saved feedback sessions based on your Review Points
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{sessions.length} sessions</span>
            <span>{totalMarkers} markers</span>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center text-gray-500">
            No feedback sessions yet. Generate feedback from Review Points to build history.
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => {
              const isExpanded = expandedId === session.id;
              const tagCounts = getTagCounts(session.markers || []);
              const misunderstoodWords = getMisunderstoodWords(session.markers || []);
              const hotSpots = getHotSpots(session.markers || []);
              const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

              return (
                <div key={session.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {session.videoTitle || session.videoId}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(session.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{session.markers.length} markers</span>
                      <span>{isExpanded ? 'Hide' : 'Show'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                          Tag distribution
                        </div>
                        {sortedTags.length === 0 ? (
                          <div className="text-xs text-gray-500">No tags applied.</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {sortedTags.map(([tag, count]) => (
                              <span
                                key={tag}
                                className={`text-[11px] px-2 py-1 rounded-full border ${TAG_STYLES[tag as TagType]}`}
                              >
                                {TAG_LABELS[tag as TagType]}: {count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                          Repeated segments
                        </div>
                        {hotSpots.length === 0 ? (
                          <div className="text-xs text-gray-500">No repeated segments yet.</div>
                        ) : (
                          <div className="space-y-2">
                            {hotSpots.map(marker => (
                              <div key={marker.id} className="text-xs text-gray-600 dark:text-gray-300">
                                {formatTime(marker.start)} - {formatTime(marker.end)} (x{marker.pressCount || 1})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Misunderstood words</div>
                        {misunderstoodWords.length === 0 ? (
                          <div className="text-xs text-gray-500">No word-level marks yet.</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {misunderstoodWords.slice(0, 12).map(word => (
                              <span
                                key={word}
                                className="text-[11px] px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {session.feedback?.summary && (
                        <div className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          {session.feedback.summary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
          onShadowSegment={setFocusedSegment}
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

      {/* Feedback History View */}
      {view === 'feedback' && (
        <FeedbackHistoryView />
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
