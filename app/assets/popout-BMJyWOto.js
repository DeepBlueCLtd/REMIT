import{n as e}from"./roles-Dz8ggIcI.js";var t=e=>window.__remitFault?.(e);function n(){let n=document.getElementById(`popout-root`),r=location.hash.match(/tab=([\w-]+)/)?.[1]??null,i=window.opener,a=i&&i.__remit;if(!a){n.innerHTML=`<div class="popped-placeholder">
      <h2>Disconnected</h2>
      <p class="muted">The main REMIT window is closed or unavailable. Re-open this
         view from the app's tab bar.</p></div>`;return}let o=e().find(e=>e.id===r);if(!o||!o.poppable||!o.mount){n.innerHTML=`<div class="popped-placeholder">
      <h2>Unknown view</h2>
      <p class="muted">No poppable role “${r??``}”.</p></div>`;return}document.title=`REMIT — ${o.label}`,Promise.resolve(o.mount(n,a)).catch(e=>{t(`mounting ${o.label}: ${e?.message??e}`),console.error(e)}),window.addEventListener(`beforeunload`,()=>{try{i.__remitShell?.popIn?.(r,!0)}catch{}})}n();
//# sourceMappingURL=popout-BMJyWOto.js.map