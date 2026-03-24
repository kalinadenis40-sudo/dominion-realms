'use client';
// Full dashboard page — see dashboard.store.ts for data fetching
// Replaced by full implementation below

import dynamic from 'next/dynamic';
const DashboardPage = dynamic(() => import('./dashboard'), { ssr: false });
export default DashboardPage;
