'use client';


import { useState } from 'react';
import AdminSidebar from './components/AdminSidebar';
import DashboardView from './components/views/DashboardView';
import PipelineView from './components/views/PipelineView';
import AnalyticsView from './components/views/AnalyticsView';
import SpeedView from './components/views/SpeedView';
import BenchmarkView from './components/views/BenchmarkView';
import ArticlesView from './components/views/ArticlesView';
import FlashView from './components/views/FlashView';
import TopicsView from './components/views/TopicsView';
import CleanupView from './components/views/CleanupView';

export default function AdminSPA() {
  const [activeTab, setActiveTab] = useState('pipeline');

  function renderView() {
    switch (activeTab) {
      case 'pipeline':  return <PipelineView />;
      case 'analytics': return <AnalyticsView />;
      case 'speed':     return <SpeedView />;
      case 'benchmark': return <BenchmarkView />;
      case 'articles':  return <ArticlesView />;
      case 'flash':     return <FlashView />;
      case 'topics':    return <TopicsView />;
      case 'cleanup':   return <CleanupView />;
      case 'dashboard':
      default:          return <DashboardView onNavigate={setActiveTab} />;
    }
  }

  return (
    <div className="admin-shell fixed inset-0 z-[100] flex bg-slate-950 text-gray-100">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 flex flex-col min-h-screen ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm px-6">
          <h1 className="text-sm font-medium text-slate-400">YayaNews 管理后台</h1>
          <a href="/" className="text-xs text-slate-500 hover:text-slate-300" target="_blank" rel="noopener noreferrer">
            查看前台 &rarr;
          </a>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

