import{i as e}from"./canonical-DbepWco5.js";import{i as t}from"./hexgrid-Sb_iiCNz.js";import{c as n,d as r,f as i,h as a,i as o,m as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"./orbat-_7tL0K6H.js";var h=`remit:orbat-select`;function g(e){window.dispatchEvent(new CustomEvent(h,{detail:{id:e}}))}var _=[{allegiance:`blue`,title:`Blue (own force)`},{allegiance:`red`,title:`Red (hostile)`},{allegiance:`green`,title:`Green (neutral)`}],v=e=>String(e??``).replace(/[<&"]/g,e=>({"<":`&lt;`,"&":`&amp;`,'"':`&quot;`})[e]??e);function y(h,y){let{objects:b,world:x}=y,S=null,C=e=>e?e.h3?x.ao.idOf.has(e.h3):typeof e.lat==`number`&&typeof e.lng==`number`?t(x.ao,e.lat,e.lng)!==void 0:!1:!1,w=e=>{let t=x.ao,n=(Math.floor(t.N/2)+e*11)%t.N,[r,i]=t.centers[n];return{h3:t.indexes[n],lat:r,lng:i}},T=x.places?.base;i(m(n(),{label:`Own force · ROVER-1`,position:T?{h3:T.h3,lat:T.lat,lng:T.lng}:void 0}));let E=(e,t=null)=>{try{let t=e();return i(t&&t.orbat?t.orbat:t),D(),t}catch(e){return t&&(t.textContent=`⚠ ${e instanceof Error?e.message:String(e)}`,t.classList.add(`orbat-msg-err`)),null}};function D(){let t=n().assets??[];h.innerHTML=`
      <div class="orbat-panel" data-testid="orbat-panel">
        <header class="orbat-head">
          <h2>ORBAT <span class="muted">— authoring (display-only, NF9)</span></h2>
          <p class="muted">Add, tune, duplicate and remove the scenario's own-force, threat and
            neutral assets. Authoring never changes the route or plan; the planned own-force
            (ROVER-1) is reconciled as the canonical blue asset and protected from removal.</p>
          <div class="row orbat-actions">
            <button class="primary" data-testid="orbat-commit" id="orbat-commit">Commit ORBAT</button>
            <span class="result" id="orbat-commit-result" data-testid="orbat-commit-result"></span>
          </div>
        </header>
        ${_.map(e=>O(e,t)).join(``)}
      </div>`;for(let e of _)h.querySelector(`#orbat-add-${e.allegiance}`)?.addEventListener(`click`,()=>{let t=(n().assets??[]).length;E(()=>o(n(),{allegiance:e.allegiance,position:w(t)},{inAO:C}))});for(let e of t)N(e);h.querySelector(`#orbat-commit`)?.addEventListener(`click`,async()=>{let t=await l(n(),b);i({...n(),lineage:{previous_version:t.id}});let r=h.querySelector(`#orbat-commit-result`);r.innerHTML=`committed <code class="hash">${e(t.id)}</code>${t.existed?` (unchanged)`:``}`})}function O(e,t){let n=t.filter(t=>t.allegiance===e.allegiance),r=p[e.allegiance];return`
      <section class="orbat-group" data-testid="orbat-group-${e.allegiance}" data-allegiance="${e.allegiance}">
        <div class="orbat-group-head">
          <h3><i class="dot" style="background:${r}"></i>${e.title}</h3>
          <button data-testid="orbat-add-${e.allegiance}" id="orbat-add-${e.allegiance}">+ Add ${e.allegiance}</button>
        </div>
        ${n.length?`<ul class="orbat-rows">${n.map(k).join(``)}</ul>`:`<p class="muted orbat-none" data-testid="orbat-none-${e.allegiance}">none</p>`}
      </section>`}function k(e){let t=!!e.canonical_own_force;return`
      <li class="orbat-row${S===e.id?` orbat-row-sel`:``}" data-testid="orbat-row-${e.id}" data-id="${e.id}" data-allegiance="${e.allegiance}">
        <div class="orbat-row-top">
          <button class="orbat-select" data-act="select" title="Highlight on the map / Sync Matrix">◎</button>
          <input class="orbat-label" data-act="label" type="text" value="${v(e.label)}"
            data-testid="orbat-label-${e.id}" aria-label="label" />
          ${t?`<span class="chip orbat-canon" data-testid="orbat-canon">canonical own-force</span>`:``}
          <button class="orbat-dup" data-act="dup" data-testid="orbat-dup-${e.id}" title="Duplicate">⧉</button>
          <button class="orbat-remove" data-act="remove" data-testid="orbat-remove-${e.id}"
            title="${t?`the canonical own-force cannot be removed`:`Remove`}" ${t?`disabled`:``}>✕</button>
        </div>
        <div class="orbat-tuners">
          <label>extent
            <input data-act="extent" type="range" min="${c.extent_m[0]}" max="${c.extent_m[1]}" step="50"
              value="${e.extent_m??800}" data-testid="orbat-extent-${e.id}" />
            <span class="orbat-extent-val">${e.extent_m??800} m</span>
          </label>
          ${e.allegiance===`red`?A(e):``}
          ${e.allegiance===`green`?j(e):``}
          ${e.allegiance===`blue`?M(e):``}
        </div>
        <div class="orbat-msg" data-testid="orbat-msg-${e.id}"></div>
      </li>`}function A(e){let t=(e.red?.active_windows??[])[0];return`
      <label>severity
        <input data-act="severity" type="range" min="${c.severity[0]}" max="${c.severity[1]}" step="1"
          value="${e.red?.severity??3}" data-testid="orbat-severity-${e.id}" />
        <span class="orbat-sev-val">${e.red?.severity??3}</span>
      </label>
      <label class="orbat-window">
        <input data-act="redwin-on" type="checkbox" ${t?`checked`:``} data-testid="orbat-redwin-${e.id}" /> active window
        <input data-act="redwin-start" type="number" placeholder="H+start" value="${t?.start_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
        <input data-act="redwin-end" type="number" placeholder="H+end" value="${t?.end_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
      </label>`}function j(e){return`
      <label>sensitivity
        <input data-act="sensitivity" type="range" min="${c.sensitivity[0]}" max="${c.sensitivity[1]}" step="1"
          value="${e.green?.sensitivity??3}" data-testid="orbat-sensitivity-${e.id}" />
        <span class="orbat-sens-val">${e.green?.sensitivity??3}</span>
      </label>
      <label>protection
        <select data-act="protection" data-testid="orbat-protection-${e.id}">
          ${d.map(t=>`<option value="${t}" ${e.green?.protection===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>`}function M(e){let t=e.blue?.window;return`
      <label>availability
        <select data-act="availability" data-testid="orbat-availability-${e.id}">
          ${[`available`,`down`].map(t=>`<option value="${t}" ${e.blue?.availability===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>capabilities
        <input data-act="capabilities" type="text" value="${v((e.blue?.capabilities??[]).join(`, `))}"
          placeholder="recce, comms" data-testid="orbat-capabilities-${e.id}" />
      </label>
      <label class="orbat-window">
        <input data-act="bluewin-on" type="checkbox" ${t?`checked`:``} data-testid="orbat-bluewin-${e.id}" /> availability window
        <input data-act="bluewin-start" type="number" placeholder="H+start" value="${t?.start_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
        <input data-act="bluewin-end" type="number" placeholder="H+end" value="${t?.end_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
      </label>`}function N(e){let t=h.querySelector(`[data-testid="orbat-row-${e.id}"]`);if(!t)return;let i=t.querySelector(`.orbat-msg`),o=(e,n,r)=>t.querySelector(`[data-act="${e}"]`)?.addEventListener(n,e=>r(e.currentTarget));if(t.querySelector(`[data-act="select"]`)?.addEventListener(`click`,()=>{S=S===e.id?null:e.id,g(S),D()}),o(`label`,`change`,t=>E(()=>s(n(),e.id,{label:t.value}),i)),o(`extent`,`change`,t=>E(()=>s(n(),e.id,{extent_m:Number(t.value)}),i)),o(`dup`,`click`,()=>E(()=>f(n(),e.id),i)),o(`remove`,`click`,()=>E(()=>r(n(),e.id),i)),e.allegiance===`red`){o(`severity`,`change`,t=>E(()=>s(n(),e.id,{red:{severity:Number(t.value)}}),i));let r=()=>t.querySelector(`[data-act="redwin-on"]`).checked?[{start_min:Number(t.querySelector(`[data-act="redwin-start"]`).value||0),end_min:Number(t.querySelector(`[data-act="redwin-end"]`).value||0)}]:[];for(let t of[`redwin-on`,`redwin-start`,`redwin-end`])o(t,`change`,()=>E(()=>s(n(),e.id,{red:{active_windows:r()}}),i))}if(e.allegiance===`green`&&(o(`sensitivity`,`change`,t=>E(()=>s(n(),e.id,{green:{sensitivity:Number(t.value)}}),i)),o(`protection`,`change`,t=>E(()=>s(n(),e.id,{green:{protection:t.value}}),i))),e.allegiance===`blue`){o(`availability`,`change`,t=>E(()=>s(n(),e.id,{blue:{availability:t.value}}),i)),o(`capabilities`,`change`,t=>E(()=>s(n(),e.id,{blue:{capabilities:t.value.split(`,`).map(e=>e.trim()).filter(Boolean)}}),i));let r=()=>{if(!t.querySelector(`[data-act="bluewin-on"]`).checked)return;let e=Number(t.querySelector(`[data-act="bluewin-start"]`).value||0),n=Number(t.querySelector(`[data-act="bluewin-end"]`).value||0);return{start_min:Math.min(e,n),end_min:Math.max(e,n)}};for(let t of[`bluewin-on`,`bluewin-start`,`bluewin-end`])o(t,`change`,()=>E(()=>{let t=n(),i={...(t.assets??[]).find(t=>t.id===e.id)?.blue??{},window:r()};return i.window===void 0&&delete i.window,s(t,e.id,{blue:i})},i))}let c=(n().assets??[]).find(t=>t.id===e.id);if(c){let e=a(c,{inAO:C});e.ok||(i.textContent=`⚠ ${e.issues.join(`; `)}`,i.classList.add(`orbat-msg-err`))}}let P=u(()=>{h.isConnected&&D()});h.addEventListener(`tab:activated`,D);let F=new MutationObserver(()=>{h.isConnected||(P(),F.disconnect())});h.parentNode&&F.observe(h.parentNode,{childList:!0}),D()}export{y as mountOrbatPanel};
//# sourceMappingURL=orbat-panel-nfROXcxd.js.map