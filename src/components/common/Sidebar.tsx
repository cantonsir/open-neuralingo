import React, { useState, useEffect } from 'react';
import { Zap, LayoutDashboard, PlayCircle, BookOpen, Layers, Settings, GraduationCap, ClipboardCheck, ChevronRight, ChevronLeft, Mic, PenTool, Book, ChevronDown, Volume2, Globe, Home } from 'lucide-react';
import { Module, View, Theme } from '../../types';
import { api, FlashcardModule } from '../../db';




interface SidebarProps {
    view: View;
    setView: (view: View) => void;
    theme: Theme;
    onOpenSettings: () => void;
    savedCardsCount: number;
    markersCount: number;
    videoId?: string;
    activeModule: Module;
    setActiveModule: (module: Module) => void;
    readerAvailable?: boolean;
}

// Section header component
function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
    if (collapsed) return <div className="h-2" />;
    return (
        <div className="px-3 pt-4 pb-2">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                {label}
            </span>
        </div>
    );
}

// Nav item component
function NavItem({
    icon,
    label,
    isActive,
    isDisabled,
    badge,
    comingSoon,
    collapsed,
    onClick,
    activeColorTheme = 'orange', // Default to existing behavior
}: {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    isDisabled?: boolean;
    badge?: number;
    comingSoon?: boolean;
    collapsed: boolean;
    onClick: () => void;
    activeColorTheme?: 'orange' | 'blue' | 'green' | 'purple';
}) {
    // Theme maps
    const activeBgColors = {
        orange: 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10',
        blue: 'bg-gradient-to-r from-blue-400/10 to-indigo-500/10',
        green: 'bg-gradient-to-r from-green-400/10 to-emerald-500/10',
        purple: 'bg-gradient-to-r from-purple-400/10 to-pink-500/10',
    };

    const activeTextColors = {
        orange: 'text-yellow-600 dark:text-yellow-400',
        blue: 'text-blue-600 dark:text-blue-400',
        green: 'text-green-600 dark:text-green-400',
        purple: 'text-purple-600 dark:text-purple-400',
    };

    const activeIconColors = {
        orange: 'text-yellow-500',
        blue: 'text-blue-500',
        green: 'text-green-500',
        purple: 'text-purple-500',
    };

    // Badge colors could also be themed, but yellow default is okay for now or we can theme it too
    const badgeBgColors = {
        orange: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
        blue: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
        green: 'bg-green-500/20 text-green-600 dark:text-green-400',
        purple: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    };


    return (
        <button
            onClick={onClick}
            disabled={isDisabled || comingSoon}
            title={collapsed ? label : undefined}
            className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
        ${collapsed ? 'justify-center' : ''}
        ${isActive
                    ? `${activeBgColors[activeColorTheme]} ${activeTextColors[activeColorTheme]}`
                    : isDisabled || comingSoon
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }
      `}
        >
            <span className={`${isActive ? activeIconColors[activeColorTheme] : ''} ${collapsed ? '' : ''}`}>{icon}</span>
            {!collapsed && (
                <>
                    <span className="flex-1 text-left">{label}</span>
                    {badge !== undefined && badge > 0 && (
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${badgeBgColors[activeColorTheme]}`}>
                            {badge}
                        </span>
                    )}
                    {comingSoon && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                            Soon
                        </span>
                    )}
                    {isActive && <ChevronRight size={14} className={`${activeIconColors[activeColorTheme]} opacity-50`} />}
                </>
            )}
            {collapsed && badge !== undefined && badge > 0 && (
                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${activeIconColors[activeColorTheme].replace('text-', 'bg-')}`} />
            )}
        </button>
    );
}

export default function Sidebar({
    view,
    setView,
    theme,
    onOpenSettings,
    savedCardsCount,
    markersCount,
    videoId,
    activeModule,
    setActiveModule,
    readerAvailable = false,
}: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [isModuleMenuOpen, setIsModuleMenuOpen] = useState(false);
    const [dueCount, setDueCount] = useState(0);

    // Fetch due count for flashcards
    useEffect(() => {
        const srsModules: Module[] = ['listening', 'reading', 'speaking', 'writing'];

        if (!srsModules.includes(activeModule)) {
            setDueCount(0);
            return;
        }

        const fetchDueCount = async () => {
            try {
                const stats = await api.fetchSrsStats(activeModule as FlashcardModule);
                setDueCount(stats.dueToday);
            } catch (error) {
                console.error('Failed to fetch due count:', error);
                setDueCount(0);
            }
        };

        fetchDueCount();
        // Refresh every minute to keep count accurate
        const interval = setInterval(fetchDueCount, 60000);
        return () => clearInterval(interval);
    }, [activeModule, savedCardsCount]);

    const modules: { id: Module; label: string; icon: React.ReactNode }[] = [
        { id: 'listening', label: 'Listening Trainer', icon: <Zap size={18} /> },
        { id: 'reading', label: 'Reading Practice', icon: <Book size={18} /> },
        { id: 'speaking', label: 'Speaking Roleplay', icon: <Mic size={18} /> },
        { id: 'writing', label: 'Writing Assistant', icon: <PenTool size={18} /> },
    ];

    const currentModule = modules.find(m => m.id === activeModule) || modules[0];

    const handleModuleSelect = (m: Module) => {
        setActiveModule(m);
        setIsModuleMenuOpen(false);
        setView('home'); // Reset view to dashboard
    };

    return (
        <div
            className={`
        ${collapsed ? 'w-16' : 'w-64'} 
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
        flex flex-col h-full transition-all duration-200 relative
      `}
        >
            {/* Logo Header / Module Switcher */}
            <div className={`relative h-16 border-b border-gray-100 dark:border-gray-800`}>
                <button
                    onClick={() => !collapsed && setIsModuleMenuOpen(!isModuleMenuOpen)}
                    className={`w-full h-full flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-5'} hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors`}
                    disabled={collapsed}
                >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-colors
                        ${activeModule === 'listening' ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-yellow-500/20' : ''}
                        ${activeModule === 'reading' ? 'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/20' : ''}
                        ${activeModule === 'speaking' ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-green-500/20' : ''}
                        ${activeModule === 'writing' ? 'bg-gradient-to-br from-purple-400 to-pink-500 shadow-purple-500/20' : ''}
                    `}>
                        {/* Dynamic Icon based on module */}
                        <div className="text-white">
                            {currentModule.icon}
                        </div>
                    </div>
                    {!collapsed && (
                        <div className="flex-1 flex items-center justify-between overflow-hidden">
                            <span className="font-bold text-sm text-gray-900 dark:text-white truncate">
                                {currentModule.label}
                            </span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isModuleMenuOpen ? 'rotate-180' : ''}`} />
                        </div>
                    )}
                </button>

                {/* Module Dropdown */}
                {isModuleMenuOpen && !collapsed && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsModuleMenuOpen(false)} />
                        <div className="absolute top-14 left-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 z-20 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
                            {/* Home Button */}
                            <button
                                onClick={() => {
                                    setActiveModule('landing');
                                    setIsModuleMenuOpen(false);
                                }}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                    text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-gray-900 dark:hover:text-gray-200 border-b border-gray-100 dark:border-gray-700 mb-1"
                            >
                                <Home size={18} className="text-gray-400 dark:text-gray-500" />
                                Home
                            </button>

                            {/* Module List */}
                            {modules.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => handleModuleSelect(m.id)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                                        ${activeModule === m.id
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 hover:text-gray-900 dark:hover:text-gray-200'
                                        }
                                    `}
                                >
                                    <span className={
                                        activeModule === m.id
                                            ? 'text-gray-900 dark:text-white'
                                            : 'text-gray-400 dark:text-gray-500'
                                    }>{m.icon}</span>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Collapse Toggle Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-10"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
                {collapsed ? (
                    <ChevronRight size={14} className="text-gray-500" />
                ) : (
                    <ChevronLeft size={14} className="text-gray-500" />
                )}
            </button>

            {/* Navigation */}
            <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} py-2 overflow-y-auto`}>

                {activeModule === 'listening' && (
                    <>
                        {/* Dashboard */}
                        <NavItem
                            icon={<LayoutDashboard size={20} />}
                            label="Dashboard"
                            isActive={view === 'home'}
                            collapsed={collapsed}
                            onClick={() => setView('home')}
                            activeColorTheme="orange"
                        />

                        {/* PRACTICE Section */}
                        <SectionHeader label="Practice" collapsed={collapsed} />
                        <NavItem
                            icon={<PlayCircle size={20} />}
                            label="Listen & Loop"
                            isActive={view === 'loop'}
                            collapsed={collapsed}
                            onClick={() => setView('loop')}
                            activeColorTheme="orange"
                        />
                        <NavItem
                            icon={<Volume2 size={20} />}
                            label="Audio Generator"
                            isActive={view === 'compose'}
                            collapsed={collapsed}
                            onClick={() => setView('compose')}
                            activeColorTheme="orange"
                        />

                        {/* LEARNING Section */}
                        <SectionHeader label="Learning" collapsed={collapsed} />
                        <NavItem
                            icon={<GraduationCap size={20} />}
                            label="Lessons"
                            isActive={view === 'learning'}
                            collapsed={collapsed}
                            onClick={() => setView('learning')}
                            activeColorTheme="orange"
                        />
                        <NavItem
                            icon={<ClipboardCheck size={20} />}
                            label="Assessment"
                            isActive={view === 'assessment'}
                            collapsed={collapsed}
                            onClick={() => setView('assessment')}
                            activeColorTheme="orange"
                        />

                        <SectionHeader label="Library" collapsed={collapsed} />
                        <NavItem
                            icon={<Book size={20} />}
                            label="Library"
                            isActive={view === 'library'}
                            collapsed={collapsed}
                            onClick={() => setView('library')}
                            activeColorTheme="orange"
                        />

                        {/* DATABASE Section */}
                        <SectionHeader label="Database" collapsed={collapsed} />
                        <NavItem
                            icon={<BookOpen size={20} />}
                            label="My Words"
                            isActive={view === 'vocab'}
                            badge={savedCardsCount}
                            collapsed={collapsed}
                            onClick={() => setView('vocab')}
                            activeColorTheme="orange"
                        />

                        {/* REVIEW Section */}
                        <SectionHeader label="Review" collapsed={collapsed} />
                        <NavItem
                            icon={<Layers size={20} />}
                            label="Flashcards"
                            isActive={view === 'flashcards'}
                            badge={dueCount}
                            collapsed={collapsed}
                            onClick={() => setView('flashcards')}
                            activeColorTheme="orange"
                        />
                    </>
                )}

                {activeModule === 'reading' && (
                    <>
                        <NavItem
                            icon={<LayoutDashboard size={20} />}
                            label="Dashboard"
                            isActive={view === 'home'}
                            collapsed={collapsed}
                            onClick={() => setView('home')}
                            activeColorTheme="blue"
                        />
                        <SectionHeader label="Tools" collapsed={collapsed} />
                        <NavItem
                            icon={<BookOpen size={20} />}
                            label="Reader"
                            isActive={view === 'reader'}
                            collapsed={collapsed}
                            onClick={() => setView('reader')}
                            activeColorTheme="blue"
                        />
                        <NavItem
                            icon={<Globe size={20} />}
                            label="Online Webpage"
                            isActive={view === 'webpage'}
                            collapsed={collapsed}
                            onClick={() => setView('webpage')}
                            activeColorTheme="blue"
                        />
                        <NavItem
                            icon={<Book size={20} />}
                            label="Reading Generator"
                            isActive={view === 'generator'}
                            collapsed={collapsed}
                            onClick={() => setView('generator')}
                            activeColorTheme="blue"
                        />
                        <SectionHeader label="Library" collapsed={collapsed} />
                        <NavItem
                            icon={<Layers size={20} />}
                            label="Library"
                            isActive={view === 'library'}
                            collapsed={collapsed}
                            onClick={() => setView('library')}
                            activeColorTheme="blue"
                        />
                        <SectionHeader label="Learning" collapsed={collapsed} />
                        <NavItem
                            icon={<GraduationCap size={20} />}
                            label="Lessons"
                            isActive={view === 'learning'}
                            collapsed={collapsed}
                            onClick={() => setView('learning')}
                            activeColorTheme="blue"
                        />
                        <NavItem
                            icon={<ClipboardCheck size={20} />}
                            label="Assessment"
                            isActive={view === 'assessment'}
                            collapsed={collapsed}
                            onClick={() => setView('assessment')}
                            activeColorTheme="blue"
                        />
                        <SectionHeader label="DATABASE" collapsed={collapsed} />
                        <NavItem
                            icon={<BookOpen size={20} />}
                            label="My Words"
                            isActive={view === 'vocab'}
                            collapsed={collapsed}
                            onClick={() => setView('vocab')}
                            badge={savedCardsCount}
                            activeColorTheme="blue"
                        />
                        <SectionHeader label="REVIEW" collapsed={collapsed} />
                        <NavItem
                            icon={<Layers size={20} />}
                            label="Flashcards"
                            isActive={view === 'flashcards'}
                            collapsed={collapsed}
                            onClick={() => setView('flashcards')}
                            badge={dueCount}
                            activeColorTheme="blue"
                        />
                    </>
                )}

                {activeModule === 'speaking' && (
                    <>
                        <NavItem
                            icon={<LayoutDashboard size={20} />}
                            label="Dashboard"
                            isActive={view === 'home'}
                            collapsed={collapsed}
                            onClick={() => setView('home')}
                            activeColorTheme="green"
                        />
                        <SectionHeader label="Learning" collapsed={collapsed} />
                        <NavItem
                            icon={<GraduationCap size={20} />}
                            label="Lessons"
                            isActive={view === 'learning'}
                            collapsed={collapsed}
                            onClick={() => setView('learning')}
                            activeColorTheme="green"
                        />
                        <NavItem
                            icon={<ClipboardCheck size={20} />}
                            label="Assessment"
                            isActive={view === 'assessment'}
                            collapsed={collapsed}
                            onClick={() => setView('assessment')}
                            activeColorTheme="green"
                        />

                        <SectionHeader label="Library" collapsed={collapsed} />
                        <NavItem
                            icon={<Book size={20} />}
                            label="Library"
                            isActive={view === 'library'}
                            collapsed={collapsed}
                            onClick={() => setView('library')}
                            activeColorTheme="green"
                        />
                        <SectionHeader label="Practice" collapsed={collapsed} />
                        <NavItem
                            icon={<Mic size={20} />}
                            label="Conversation"
                            isActive={view === 'scenario'}
                            collapsed={collapsed}
                            onClick={() => setView('scenario')}
                            activeColorTheme="green"
                        />
                    </>
                )}

                {activeModule === 'writing' && (
                    <>
                        <NavItem
                            icon={<LayoutDashboard size={20} />}
                            label="Dashboard"
                            isActive={view === 'home'}
                            collapsed={collapsed}
                            onClick={() => setView('home')}
                            activeColorTheme="purple"
                        />
                        <SectionHeader label="Learning" collapsed={collapsed} />
                        <NavItem
                            icon={<GraduationCap size={20} />}
                            label="Lessons"
                            isActive={view === 'learning'}
                            collapsed={collapsed}
                            onClick={() => setView('learning')}
                            activeColorTheme="purple"
                        />
                        <NavItem
                            icon={<ClipboardCheck size={20} />}
                            label="Assessment"
                            isActive={view === 'assessment'}
                            collapsed={collapsed}
                            onClick={() => setView('assessment')}
                            activeColorTheme="purple"
                        />

                        <SectionHeader label="Library" collapsed={collapsed} />
                        <NavItem
                            icon={<Book size={20} />}
                            label="Library"
                            isActive={view === 'library'}
                            collapsed={collapsed}
                            onClick={() => setView('library')}
                            activeColorTheme="purple"
                        />
                        <SectionHeader label="Tools" collapsed={collapsed} />
                        <NavItem
                            icon={<PenTool size={20} />}
                            label="Composition"
                            isActive={view === 'compose' || view === 'writer' || view === 'correction'}
                            collapsed={collapsed}
                            onClick={() => setView('compose')}
                            activeColorTheme="purple"
                        />
                    </>
                )}

            </nav>

            {/* Footer - Settings */}
            <div className={`${collapsed ? 'px-2' : 'px-3'} py-3 border-t border-gray-100 dark:border-gray-800`}>
                <button
                    onClick={onOpenSettings}
                    title={collapsed ? 'Settings' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors ${collapsed ? 'justify-center' : ''}`}
                >
                    <Settings size={20} />
                    {!collapsed && 'Settings'}
                </button>
            </div>
        </div>
    );
}
