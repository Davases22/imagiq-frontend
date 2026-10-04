/**
 * Script inline (va primero en <head>) que corre aunque el bundle de Next no cargue.
 *
 * - Si un JS/CSS de /_next/static falla o hay ChunkLoadError, recarga UNA vez
 *   (máx. una cada 60 s) para reintentar; lo ya descargado sale de caché.
 * - Telemetría directa a us.i.posthog.com (no por /ingest, que pasa por Vercel,
 *   el mismo camino que está fallando), porque posthog-js vive dentro del bundle
 *   y no ve a quien no logra hidratar:
 *     chunk_load_failed  un archivo no llegó (y si se va a recargar)
 *     chunk_recovered    la app hidrató después de esa recarga sin que fallara
 *                        otro archivo (si falla, React igual monta global-error)
 *     boot_timeout       la app no hidrató en 20 s
 * - "Hidratada" = React montó la raíz sobre document (__reactContainer$…).
 */
export function chunkRecoveryScript(posthogKey: string): string {
  return `(function(){
var K="imagiq_chunk_reload",P=${JSON.stringify(posthogKey)},H="https://us.i.posthog.com/capture/",t0=Date.now(),sent={};
function last(){try{return +sessionStorage.getItem(K)||0}catch(e){return 0}}
function did(){var n="ph_"+P+"_posthog";try{var s=localStorage.getItem(n);if(s&&JSON.parse(s).distinct_id)return JSON.parse(s).distinct_id}catch(e){}
try{var m=document.cookie.match(new RegExp(n+"=([^;]+)"));if(m&&JSON.parse(decodeURIComponent(m[1])).distinct_id)return JSON.parse(decodeURIComponent(m[1])).distinct_id}catch(e){}
try{var b=sessionStorage.getItem("imagiq_boot_id");if(!b){b="boot_"+Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem("imagiq_boot_id",b)}return b}catch(e){return "boot_anon"}}
function cap(ev,p){if(!P||sent[ev])return;sent[ev]=1;try{var c=navigator.connection||{};p.$current_url=location.href;p.$pathname=location.pathname;p.effective_type=c.effectiveType;p.downlink=c.downlink;p.visibility=document.visibilityState;p.ms_since_start=Date.now()-t0;
fetch(H,{method:"POST",keepalive:true,body:JSON.stringify({api_key:P,event:ev,distinct_id:did(),properties:p,timestamp:new Date().toISOString()})}).catch(function(){})}catch(e){}}
function fail(u){var will=Date.now()-last()>=6e4;if(will){try{sessionStorage.setItem(K,String(Date.now()))}catch(e){will=false}}
cap("chunk_load_failed",{failed_url:u,will_reload:will});if(will)location.reload()}
window.addEventListener("error",function(e){var t=e.target;var u=t&&(t.src||t.href);if(u&&u.indexOf("/_next/static/")!==-1)fail(u)},true);
window.addEventListener("unhandledrejection",function(e){var m=e.reason&&(e.reason.name+" "+e.reason.message)||"";if(/ChunkLoadError|load(ing)? chunk/i.test(m))fail(m.slice(0,300))});
function booted(){var k=Object.keys(document);for(var i=0;i<k.length;i++)if(k[i].indexOf("__reactContainer$")===0)return true;return false}
var iv=setInterval(function(){var t=last();
if(booted()){clearInterval(iv);if(t&&Date.now()-t<12e4&&!sent.chunk_load_failed){var dk="imagiq_chunk_recovered_"+t;try{if(!sessionStorage.getItem(dk)){sessionStorage.setItem(dk,"1");cap("chunk_recovered",{ms_since_reload:Date.now()-t})}}catch(e){}}return}
if(Date.now()-t0>2e4){clearInterval(iv);cap("boot_timeout",{reloaded_recently:!!(t&&Date.now()-t<12e4)})}},1000);
})();`;
}
