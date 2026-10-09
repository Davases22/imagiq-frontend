/**
 * Script inline (va en <head>, antes que el bundle) que vacía el almacenamiento
 * local del visitante cuando sube VERSION_ALMACENAMIENTO.
 *
 * Por qué inline y no un useEffect: los providers de React leen localStorage al
 * montar. Si la limpieza corriera después, el carrito y la sesión ya se habrían
 * leído de los datos viejos y la pantalla se pintaría con ellos.
 *
 * Qué NO hace falta invalidar aquí: el JavaScript y el CSS. Next cambia el id
 * de compilación en cada despliegue y con él las URLs de /_next/static, así que
 * nadie se queda con código viejo. Esto es solo para los datos del navegador.
 *
 * Cuándo subir la versión: cuando un cambio deje inservible lo que la gente
 * tiene guardado. Por ejemplo, al borrar cuentas en la base —quien tuviera esa
 * sesión guardada arrastra un usuario que ya no existe— o al cambiar la forma
 * de alguna de las claves de abajo.
 *
 * Lo que se respeta siempre: el consentimiento de cookies y las preferencias de
 * analítica. Borrarlos obligaría a la persona a volver a decidir algo que ya
 * decidió, y eso no es un dato caducado, es su elección.
 */

/** Súbela para forzar la limpieza en todos los navegadores. */
export const VERSION_ALMACENAMIENTO = '2026-10-09';

/** Claves que sobreviven a la limpieza: son decisiones de la persona, no caché. */
const SE_CONSERVAN = [
  'consent',
  'imagiq_consent',
  'clarity_consent',
  'chatbot-button-position',
];

export function storageVersionScript(): string {
  return `(function(){
try{
  var K="imagiq_storage_version",V=${JSON.stringify(VERSION_ALMACENAMIENTO)};
  if(localStorage.getItem(K)===V)return;
  var guardar=${JSON.stringify(SE_CONSERVAN)},salvados={};
  for(var i=0;i<guardar.length;i++){var v=localStorage.getItem(guardar[i]);if(v!==null)salvados[guardar[i]]=v}
  localStorage.clear();
  try{sessionStorage.clear()}catch(e){}
  for(var k in salvados)localStorage.setItem(k,salvados[k]);
  localStorage.setItem(K,V);
}catch(e){}
})();`;
}
