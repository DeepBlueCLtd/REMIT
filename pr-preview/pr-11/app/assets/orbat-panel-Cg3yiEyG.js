import{i as e}from"./canonical-DbepWco5.js";import{i as t}from"./hexgrid-Sb_iiCNz.js";import{S as n,_ as r,a as i,b as a,c as o,d as s,g as c,i as l,l as u,m as d,n as f,o as p,p as m,r as h,s as g,t as _,v,x as y,y as b}from"./orbat-CaTuA8eH.js";var x=`remit:orbat-select`;function S(e){window.dispatchEvent(new CustomEvent(x,{detail:{id:e}}))}var C=[{allegiance:`blue`,title:`Blue (own force)`},{allegiance:`red`,title:`Red (hostile)`},{allegiance:`green`,title:`Green (neutral)`}],w=e=>String(e??``).replace(/[<&"]/g,e=>({"<":`&lt;`,"&":`&amp;`,'"':`&quot;`})[e]??e);function T(x,T){let{objects:E,world:D}=T,O=null,k=e=>e?e.h3?D.ao.idOf.has(e.h3):typeof e.lat==`number`&&typeof e.lng==`number`?t(D.ao,e.lat,e.lng)!==void 0:!1:!1,A=e=>{let t=D.ao,n=(Math.floor(t.N/2)+e*11)%t.N,[r,i]=t.centers[n];return{h3:t.indexes[n],lat:r,lng:i}},j=D.places?.base;v(c(d(),{label:`Own force · ROVER-1`,position:j?{h3:j.h3,lat:j.lat,lng:j.lng}:void 0}));let M=(e,t=null)=>{try{let t=e();return v(t&&t.orbat?t.orbat:t),t}catch(e){return t&&(t.textContent=`⚠ ${e instanceof Error?e.message:String(e)}`,t.classList.add(`orbat-msg-err`)),null}};function N(){let t=d().assets??[];x.innerHTML=`
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
        ${C.map(e=>P(e,t)).join(``)}
      </div>`;for(let e of C)x.querySelector(`#orbat-add-${e.allegiance}`)?.addEventListener(`click`,()=>{let t=(d().assets??[]).length;M(()=>u(d(),{allegiance:e.allegiance,position:A(t)},{inAO:k}))});for(let e of t)V(e);x.querySelector(`#orbat-commit`)?.addEventListener(`click`,async()=>{let t=await s(d(),E);v({...d(),lineage:{previous_version:t.id}});let n=x.querySelector(`#orbat-commit-result`);n.innerHTML=`committed <code class="hash">${e(t.id)}</code>${t.existed?` (unchanged)`:``}`})}function P(e,t){let n=t.filter(t=>t.allegiance===e.allegiance),r=_[e.allegiance];return`
      <section class="orbat-group" data-testid="orbat-group-${e.allegiance}" data-allegiance="${e.allegiance}">
        <div class="orbat-group-head">
          <h3><i class="dot" style="background:${r}"></i>${e.title}</h3>
          <button data-testid="orbat-add-${e.allegiance}" id="orbat-add-${e.allegiance}">+ Add ${e.allegiance}</button>
        </div>
        ${n.length?`<ul class="orbat-rows">${n.map(F).join(``)}</ul>`:`<p class="muted orbat-none" data-testid="orbat-none-${e.allegiance}">none</p>`}
      </section>`}function F(e){let t=!!e.canonical_own_force;return`
      <li class="orbat-row${O===e.id?` orbat-row-sel`:``}" data-testid="orbat-row-${e.id}" data-id="${e.id}" data-allegiance="${e.allegiance}">
        <div class="orbat-row-top">
          <button class="orbat-select" data-act="select" title="Highlight on the map / Sync Matrix">◎</button>
          <input class="orbat-label" data-act="label" type="text" value="${w(e.label)}"
            data-testid="orbat-label-${e.id}" aria-label="label" />
          ${t?`<span class="chip orbat-canon" data-testid="orbat-canon">canonical own-force</span>`:``}
          <button class="orbat-dup" data-act="dup" data-testid="orbat-dup-${e.id}" title="Duplicate">⧉</button>
          <button class="orbat-remove" data-act="remove" data-testid="orbat-remove-${e.id}"
            title="${t?`the canonical own-force cannot be removed`:`Remove`}" ${t?`disabled`:``}>✕</button>
        </div>
        <div class="orbat-tuners">
          ${I(e)}
          ${e.allegiance===`red`?``:L(e)}
          ${e.allegiance===`red`?R(e):``}
          ${e.allegiance===`green`?z(e):``}
          ${e.allegiance===`blue`?B(e):``}
        </div>
        <div class="orbat-msg" data-testid="orbat-msg-${e.id}"></div>
      </li>`}function I(e){return`
      <label>kind
        <select data-act="kind" data-testid="orbat-kind-${e.id}">
          <option value="">—</option>
          ${g.map(t=>`<option value="${t}" ${e.kind===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>icon
        <select data-act="symbol" class="orbat-icon" data-testid="orbat-symbol-${e.id}" aria-label="icon override">
          <option value="">— ${w(a({...e,symbol:void 0}))}</option>
          ${p.map(t=>`<option value="${w(t)}" ${e.symbol===t?`selected`:``}>${w(t)}</option>`).join(``)}
        </select>
      </label>
      <label>confidence
        <select data-act="confidence" data-testid="orbat-confidence-${e.id}">
          <option value="">—</option>
          ${l.map(t=>`<option value="${t}" ${e.confidence===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>strength
        <input data-act="strength" type="text" class="orbat-desc" value="${w(e.strength??``)}"
          placeholder="×3" data-testid="orbat-strength-${e.id}" />
      </label>
      <label>notes
        <input data-act="notes" type="text" class="orbat-notes" value="${w(e.notes??``)}"
          placeholder="notes" data-testid="orbat-notes-${e.id}" />
      </label>`}function L(e){return`
      <label>extent
        <input data-act="extent" type="range" min="${f.extent_m[0]}" max="${f.extent_m[1]}" step="50"
          value="${e.extent_m??800}" data-testid="orbat-extent-${e.id}" />
        <span class="orbat-extent-val">${e.extent_m??800} m</span>
      </label>`}function R(e){let t=(e.red?.active_windows??[])[0],n=e.red?.detection_range_m??1500,r=e.red?.engagement_range_m??Math.round(n*.5);return`
      <label>detection
        <input data-act="detection" type="range" min="${f.extent_m[0]}" max="${f.extent_m[1]}" step="50"
          value="${n}" data-testid="orbat-detection-${e.id}" />
        <span class="orbat-det-val">${n} m</span>
      </label>
      <label>engagement
        <input data-act="engagement" type="range" min="${f.extent_m[0]}" max="${f.extent_m[1]}" step="50"
          value="${r}" data-testid="orbat-engagement-${e.id}" />
        <span class="orbat-eng-val">${r} m</span>
      </label>
      <label>threat type
        <input data-act="threat" type="text" class="orbat-desc" value="${w(e.red?.threat_type??``)}"
          placeholder="SAM" data-testid="orbat-threat-${e.id}" />
      </label>
      <label>severity
        <input data-act="severity" type="range" min="${f.severity[0]}" max="${f.severity[1]}" step="1"
          value="${e.red?.severity??3}" data-testid="orbat-severity-${e.id}" />
        <span class="orbat-sev-val">${e.red?.severity??3}</span>
      </label>
      <label class="orbat-window">
        <input data-act="redwin-on" type="checkbox" ${t?`checked`:``} data-testid="orbat-redwin-${e.id}" /> active window
        <input data-act="redwin-start" type="number" placeholder="H+start" value="${t?.start_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
        <input data-act="redwin-end" type="number" placeholder="H+end" value="${t?.end_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
      </label>`}function z(e){return`
      <label>sensitivity
        <input data-act="sensitivity" type="range" min="${f.sensitivity[0]}" max="${f.sensitivity[1]}" step="1"
          value="${e.green?.sensitivity??3}" data-testid="orbat-sensitivity-${e.id}" />
        <span class="orbat-sens-val">${e.green?.sensitivity??3}</span>
      </label>
      <label>protection
        <select data-act="protection" data-testid="orbat-protection-${e.id}">
          ${o.map(t=>`<option value="${t}" ${e.green?.protection===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>category
        <select data-act="category" data-testid="orbat-category-${e.id}">
          <option value="">—</option>
          ${i.map(t=>`<option value="${t}" ${e.green?.category===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>`}function B(e){let t=e.blue?.availability_window;return`
      <label>availability
        <select data-act="availability" data-testid="orbat-availability-${e.id}">
          ${[`available`,`down`].map(t=>`<option value="${t}" ${e.blue?.availability===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>capabilities
        <select data-act="capabilities" class="orbat-caps" multiple size="4" data-testid="orbat-capabilities-${e.id}">
          ${[...new Set([...h,...e.blue?.capabilities??[]])].map(t=>`<option value="${w(t)}" ${(e.blue?.capabilities??[]).includes(t)?`selected`:``}>${w(t)}</option>`).join(``)}
        </select>
      </label>
      <label>role
        <input data-act="role" type="text" class="orbat-desc" value="${w(e.blue?.role??``)}"
          placeholder="recce" data-testid="orbat-role-${e.id}" />
      </label>
      <label class="orbat-window">
        <input data-act="bluewin-on" type="checkbox" ${t?`checked`:``} data-testid="orbat-bluewin-${e.id}" /> availability window
        <input data-act="bluewin-start" type="number" placeholder="H+start" value="${t?.start_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
        <input data-act="bluewin-end" type="number" placeholder="H+end" value="${t?.end_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
      </label>`}function V(e){let t=x.querySelector(`[data-testid="orbat-row-${e.id}"]`);if(!t)return;let i=t.querySelector(`.orbat-msg`),a=(e,n,r)=>t.querySelector(`[data-act="${e}"]`)?.addEventListener(n,e=>r(e.currentTarget));if(t.querySelector(`[data-act="select"]`)?.addEventListener(`click`,()=>{O=O===e.id?null:e.id,S(O),N()}),a(`label`,`change`,t=>M(()=>y(d(),e.id,{label:t.value}),i)),a(`extent`,`change`,t=>M(()=>y(d(),e.id,{extent_m:Number(t.value)}),i)),a(`dup`,`click`,()=>M(()=>m(d(),e.id),i)),a(`remove`,`click`,()=>M(()=>r(d(),e.id),i)),a(`kind`,`change`,t=>M(()=>y(d(),e.id,{kind:t.value}),i)),a(`symbol`,`change`,t=>M(()=>y(d(),e.id,{symbol:t.value}),i)),a(`confidence`,`change`,t=>M(()=>y(d(),e.id,{confidence:t.value}),i)),a(`strength`,`change`,t=>M(()=>y(d(),e.id,{strength:t.value}),i)),a(`notes`,`change`,t=>M(()=>y(d(),e.id,{notes:t.value}),i)),e.allegiance===`red`){a(`severity`,`change`,t=>M(()=>y(d(),e.id,{red:{severity:Number(t.value)}}),i)),a(`detection`,`change`,t=>M(()=>y(d(),e.id,{red:{detection_range_m:Number(t.value)}}),i)),a(`engagement`,`change`,t=>M(()=>y(d(),e.id,{red:{engagement_range_m:Number(t.value)}}),i)),a(`threat`,`change`,t=>M(()=>y(d(),e.id,{red:{threat_type:t.value}}),i));let n=()=>t.querySelector(`[data-act="redwin-on"]`).checked?[{start_min:Number(t.querySelector(`[data-act="redwin-start"]`).value||0),end_min:Number(t.querySelector(`[data-act="redwin-end"]`).value||0)}]:[];for(let t of[`redwin-on`,`redwin-start`,`redwin-end`])a(t,`change`,()=>M(()=>y(d(),e.id,{red:{active_windows:n()}}),i))}if(e.allegiance===`green`&&(a(`sensitivity`,`change`,t=>M(()=>y(d(),e.id,{green:{sensitivity:Number(t.value)}}),i)),a(`protection`,`change`,t=>M(()=>y(d(),e.id,{green:{protection:t.value}}),i)),a(`category`,`change`,t=>M(()=>y(d(),e.id,{green:{category:t.value}}),i))),e.allegiance===`blue`){a(`availability`,`change`,t=>M(()=>y(d(),e.id,{blue:{availability:t.value}}),i)),a(`role`,`change`,t=>M(()=>y(d(),e.id,{blue:{role:t.value}}),i)),a(`capabilities`,`change`,t=>M(()=>y(d(),e.id,{blue:{capabilities:[...t.selectedOptions].map(e=>e.value)}}),i));let n=()=>{if(!t.querySelector(`[data-act="bluewin-on"]`).checked)return;let e=Number(t.querySelector(`[data-act="bluewin-start"]`).value||0),n=Number(t.querySelector(`[data-act="bluewin-end"]`).value||0);return{start_min:Math.min(e,n),end_min:Math.max(e,n)}};for(let t of[`bluewin-on`,`bluewin-start`,`bluewin-end`])a(t,`change`,()=>M(()=>y(d(),e.id,{blue:{availability_window:n()}}),i))}let o=(d().assets??[]).find(t=>t.id===e.id);if(o){let e=n(o,{inAO:k});e.ok||(i.textContent=`⚠ ${e.issues.join(`; `)}`,i.classList.add(`orbat-msg-err`))}}let H=b(()=>{x.isConnected&&N()});x.addEventListener(`tab:activated`,N);let U=new MutationObserver(()=>{x.isConnected||(H(),U.disconnect())});x.parentNode&&U.observe(x.parentNode,{childList:!0}),N()}export{T as mountOrbatPanel};
//# sourceMappingURL=orbat-panel-Cg3yiEyG.js.map