'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import ProjectOverview from './ProjectOverview';

export default function ProjectIntroduction() {
  const rootRef = useRef<HTMLElement>(null);
  const [paused,setPaused] = useState(false);
  useEffect(() => {
    const root=rootRef.current;
    if (!root) return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const hero=root.querySelector<HTMLElement>('.project-hero');
    const sections=[...root.querySelectorAll<HTMLElement>('.project-story > section:not(.project-hero)')];
    let frame=0;
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if (entry.isIntersecting) { entry.target.classList.add('is-revealed');observer.unobserve(entry.target); }
    }),{threshold:.08});
    sections.forEach(section=>{section.classList.add('reveal-section');observer.observe(section);});
    function move(event:PointerEvent) {
      if (!hero || reduced.matches || root!.classList.contains('motion-paused') || event.pointerType !== 'mouse') return;
      if (frame) cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const rect=hero.getBoundingClientRect();
        const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
        const y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
        root!.style.setProperty('--pointer-x',`${x*100}%`);root!.style.setProperty('--pointer-y',`${y*100}%`);
        root!.style.setProperty('--tilt-x',`${(y-.5)*-4}deg`);root!.style.setProperty('--tilt-y',`${(x-.5)*5}deg`);
      });
    }
    function reset() { if(frame)cancelAnimationFrame(frame);root!.style.setProperty('--tilt-x','0deg');root!.style.setProperty('--tilt-y','0deg'); }
    hero?.addEventListener('pointermove',move);hero?.addEventListener('pointerleave',reset);
    return ()=>{observer.disconnect();hero?.removeEventListener('pointermove',move);hero?.removeEventListener('pointerleave',reset);if(frame)cancelAnimationFrame(frame);};
  },[]);
  const openApp = (view: string) => window.location.assign(`/dashboard/#${view}`);
  return <main ref={rootRef} className={`standalone-project kinetic-project${paused?' motion-paused':''}`}><button className="motion-toggle" onClick={()=>setPaused(!paused)} aria-pressed={paused} aria-label={paused?'Bật chuyển động':'Tạm dừng chuyển động'}>{paused?<Play size={13}/>:<Pause size={13}/>}<span>{paused?'Bật chuyển động':'Dừng chuyển động'}</span></button><ProjectOverview onSignals={()=>openApp('alerts')} onMatches={()=>openApp('matches')} onPlan={()=>openApp('planning')} onQuality={()=>openApp('quality')}/><footer className="standalone-project-footer"><span>Mavericks · Market Intelligence · MVP</span><a href="/dashboard/#overview">Mở ứng dụng →</a></footer></main>;
}
