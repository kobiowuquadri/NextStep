/**
 * Inline <head> scripts that must run before first paint.
 * Kept in a plain (non-'use client') module: values exported from a client module
 * reach Server Components as client references, not strings, and would render as a
 * broken script.
 */
export const THEME_KEY = 'nextstep-theme';

/** Applies the stored theme before first paint. */
export const themeBootScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

/**
 * Turns scroll reveals on only when JavaScript runs and the visitor hasn't asked
 * for reduced motion. If the app never hydrates (slow or failed script load),
 * it turns them off again so no content stays hidden.
 */
export const motionBootScript = `try{var d=document.documentElement;if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){d.setAttribute('data-motion','on');setTimeout(function(){if(!window.__nsReveal)d.removeAttribute('data-motion')},4000)}}catch(e){}`;
