import React, { useState } from 'react';
import { Zap, Home, PlayCircle, BookOpen, Layers, Settings, History, GraduationCap, ChevronRight, ChevronLeft, PanelLeftClose, PanelLeft } from 'lucide-react';

type View = 'home' | 'loop' | 'vocab' | 'flashcards' | 'history';
type Theme = 'dark' | 'light';

interface SidebarProps {
    view: View;
    setView: (view: View) => void;
    theme: Theme;
    onOpenSettings: () => void;
    savedCardsCount: number;
    markersCount: number;
    videoId?: string;
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
}: {
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    isDisabled?: boolean;
    badge?: number;
    comingSoon?: boolean;
    collapsed: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            disabled={isDisabled || comingSoon}
            title={collapsed ? label : undefined}
            className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
        ${collapsed ? 'justify-center' : ''}
        ${isActive
                    ? 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 text-yellow-600 dark:text-yellow-400'
                    : isDisabled || comingSoon
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }
      `}
        >
            <span className={`${isActive ? 'text-yellow-500' : ''} ${collapsed ? '' : ''}`}>{icon}</span>
            {!collapsed && (
                <>
                    <span className="flex-1 text-left">{label}</span>
                    {badge !== undefined && badge > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded">
                            {badge}
                        </span>
                    )}
                    {comingSoon && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                            Soon
                        </span>
                    )}
                    {isActive && <ChevronRight size={14} className="text-yellow-500/50" />}
                </>
            )}
            {collapsed && badge !== undefined && badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full" />
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
}: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div
            className={`
        ${collapsed ? 'w-16' : 'w-64'} 
        bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
        flex flex-col h-full transition-all duration-200 relative
      `}
        >
            {/* Logo Header */}
            <div className={`h-16 flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-5'} border-b border-gray-100 dark:border-gray-800`}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    <Zap size={20} className="text-white" fill="currentColor" />
                </div>
                {!collapsed && (
                    <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">
                        EchoLoop
                    </span>
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
                {/* Home */}
                <NavItem
                    icon={<Home size={20} />}
                    label="Home"
                    isActive={view === 'home'}
                    collapsed={collapsed}
                    onClick={() => setView('home')}
                />

                {/* PRACTICE Section */}
                <SectionHeader label="Practice" collapsed={collapsed} />
                <NavItem
                    icon={<PlayCircle size={20} />}
                    label="Listen & Loop"
                    isActive={view === 'loop'}
                    isDisabled={!videoId}
                    collapsed={collapsed}
                    onClick={() => setView('loop')}
                />
                <NavItem
                    icon={<History size={20} />}
                    label="History"
                    isActive={view === 'history'}
                    collapsed={collapsed}
                    onClick={() => setView('history')}
                />

                {/* LEARNING Section */}
                <SectionHeader label="Learning" collapsed={collapsed} />
                <NavItem
                    icon={<GraduationCap size={20} />}
                    label="Lessons"
                    isActive={false}
                    comingSoon
                    collapsed={collapsed}
                    onClick={() => { }}
                />

                {/* DATABASE Section */}
                <SectionHeader label="Database" collapsed={collapsed} />
                <NavItem
                    icon={<BookOpen size={20} />}
                    label="My Words"
                    isActive={view === 'vocab'}
                    isDisabled={!videoId}
                    badge={savedCardsCount}
                    collapsed={collapsed}
                    onClick={() => setView('vocab')}
                />

                {/* REVIEW Section */}
                <SectionHeader label="Review" collapsed={collapsed} />
                <NavItem
                    icon={<Layers size={20} />}
                    label="Flashcards"
                    isActive={view === 'flashcards'}
                    badge={savedCardsCount}
                    collapsed={collapsed}
                    onClick={() => setView('flashcards')}
                />
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
