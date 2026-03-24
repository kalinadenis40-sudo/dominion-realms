'use client';
import dynamic from 'next/dynamic';
const Page = dynamic(() => import('./ResearchClient'), { ssr: false });
export default Page;
