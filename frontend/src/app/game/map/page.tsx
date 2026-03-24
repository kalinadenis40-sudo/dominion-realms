'use client';
import dynamic from 'next/dynamic';
const MapPage = dynamic(() => import('./MapClient'), { ssr: false });
export default MapPage;
