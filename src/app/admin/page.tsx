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

export default function AdminSPA() {
  const [activeTab, setActiveTab] = useState('pipeline');

  let Content = DashboardView;
  switch (activeTab) {
    case 'pipeline': Content = PipelineView; break;
    case 'analytics': Content = AnalyticsView; break;
    case 'speed': Content = SpeedView; break;
    case 'benchmark': Content = BenchmarkView; break;
    case 'articles': Content = ArticlesView; break;
    case 'flash': Content = FlashView; break;
    case 'dashboard':
    default: Content = DashboardView; break;
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
          <Content onNavigate={setActiveTab} />
        </main>
      </div>
    </div>
  );
}
