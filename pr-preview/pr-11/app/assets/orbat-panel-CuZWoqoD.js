import{i as e}from"./canonical-DbepWco5.js";import{i as t}from"./hexgrid-Sb_iiCNz.js";import{_ as n,a as r,b as i,d as a,f as o,g as s,h as c,i as l,l as u,m as d,n as f,o as p,r as m,s as h,t as g,v as _,y as v}from"./orbat-Dv6ioLNa.js";var y=`remit:orbat-select`;function b(e){window.dispatchEvent(new CustomEvent(y,{detail:{id:e}}))}var x=[{allegiance:`blue`,title:`Blue (own force)`},{allegiance:`red`,title:`Red (hostile)`},{allegiance:`green`,title:`Green (neutral)`}],S=e=>String(e??``).replace(/[<&"]/g,e=>({"<":`&lt;`,"&":`&amp;`,'"':`&quot;`})[e]??e);function C(y,C){let{objects:w,world:T}=C,E=null,D=e=>e?e.h3?T.ao.idOf.has(e.h3):typeof e.lat==`number`&&typeof e.lng==`number`?t(T.ao,e.lat,e.lng)!==void 0:!1:!1,O=e=>{let t=T.ao,n=(Math.floor(t.N/2)+e*11)%t.N,[r,i]=t.centers[n];return{h3:t.indexes[n],lat:r,lng:i}},k=T.places?.base;s(d(o(),{label:`Own force · ROVER-1`,position:k?{h3:k.h3,lat:k.lat,lng:k.lng}:void 0}));let A=(e,t=null)=>{try{let t=e();return s(t&&t.orbat?t.orbat:t),t}catch(e){return t&&(t.textContent=`⚠ ${e instanceof Error?e.message:String(e)}`,t.classList.add(`orbat-msg-err`)),null}};function j(){let t=o().assets??[];y.innerHTML=`
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
        ${x.map(e=>M(e,t)).join(``)}
      </div>`;for(let e of x)y.querySelector(`#orbat-add-${e.allegiance}`)?.addEventListener(`click`,()=>{let t=(o().assets??[]).length;A(()=>h(o(),{allegiance:e.allegiance,position:O(t)},{inAO:D}))});for(let e of t)z(e);y.querySelector(`#orbat-commit`)?.addEventListener(`click`,async()=>{let t=await u(o(),w);s({...o(),lineage:{previous_version:t.id}});let n=y.querySelector(`#orbat-commit-result`);n.innerHTML=`committed <code class="hash">${e(t.id)}</code>${t.existed?` (unchanged)`:``}`})}function M(e,t){let n=t.filter(t=>t.allegiance===e.allegiance),r=g[e.allegiance];return`
      <section class="orbat-group" data-testid="orbat-group-${e.allegiance}" data-allegiance="${e.allegiance}">
        <div class="orbat-group-head">
          <h3><i class="dot" style="background:${r}"></i>${e.title}</h3>
          <button data-testid="orbat-add-${e.allegiance}" id="orbat-add-${e.allegiance}">+ Add ${e.allegiance}</button>
        </div>
        ${n.length?`<ul class="orbat-rows">${n.map(N).join(``)}</ul>`:`<p class="muted orbat-none" data-testid="orbat-none-${e.allegiance}">none</p>`}
      </section>`}function N(e){let t=!!e.canonical_own_force;return`
      <li class="orbat-row${E===e.id?` orbat-row-sel`:``}" data-testid="orbat-row-${e.id}" data-id="${e.id}" data-allegiance="${e.allegiance}">
        <div class="orbat-row-top">
          <button class="orbat-select" data-act="select" title="Highlight on the map / Sync Matrix">◎</button>
          <input class="orbat-label" data-act="label" type="text" value="${S(e.label)}"
            data-testid="orbat-label-${e.id}" aria-label="label" />
          ${t?`<span class="chip orbat-canon" data-testid="orbat-canon">canonical own-force</span>`:``}
          <button class="orbat-dup" data-act="dup" data-testid="orbat-dup-${e.id}" title="Duplicate">⧉</button>
          <button class="orbat-remove" data-act="remove" data-testid="orbat-remove-${e.id}"
            title="${t?`the canonical own-force cannot be removed`:`Remove`}" ${t?`disabled`:``}>✕</button>
        </div>
        <div class="orbat-tuners">
          ${P(e)}
          ${e.allegiance===`red`?``:F(e)}
          ${e.allegiance===`red`?I(e):``}
          ${e.allegiance===`green`?L(e):``}
          ${e.allegiance===`blue`?R(e):``}
        </div>
        <div class="orbat-msg" data-testid="orbat-msg-${e.id}"></div>
      </li>`}function P(e){return`
      <label>kind
        <select data-act="kind" data-testid="orbat-kind-${e.id}">
          <option value="">—</option>
          ${r.map(t=>`<option value="${t}" ${e.kind===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>icon
        <input data-act="symbol" class="orbat-icon" type="text" maxlength="3" value="${S(e.symbol??``)}"
          placeholder="${S(_(e))}" data-testid="orbat-symbol-${e.id}" aria-label="icon override" />
        <button data-act="symbol-clear" title="Clear icon override" data-testid="orbat-symbol-clear-${e.id}">⌫</button>
      </label>
      <label>confidence
        <select data-act="confidence" data-testid="orbat-confidence-${e.id}">
          <option value="">—</option>
          ${m.map(t=>`<option value="${t}" ${e.confidence===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>strength
        <input data-act="strength" type="text" class="orbat-desc" value="${S(e.strength??``)}"
          placeholder="×3" data-testid="orbat-strength-${e.id}" />
      </label>
      <label>notes
        <input data-act="notes" type="text" class="orbat-notes" value="${S(e.notes??``)}"
          placeholder="notes" data-testid="orbat-notes-${e.id}" />
      </label>`}function F(e){return`
      <label>extent
        <input data-act="extent" type="range" min="${f.extent_m[0]}" max="${f.extent_m[1]}" step="50"
          value="${e.extent_m??800}" data-testid="orbat-extent-${e.id}" />
        <span class="orbat-extent-val">${e.extent_m??800} m</span>
      </label>`}function I(e){let t=(e.red?.active_windows??[])[0],n=e.red?.detection_range_m??1500,r=e.red?.engagement_range_m??Math.round(n*.5);return`
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
        <input data-act="threat" type="text" class="orbat-desc" value="${S(e.red?.threat_type??``)}"
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
      </label>`}function L(e){return`
      <label>sensitivity
        <input data-act="sensitivity" type="range" min="${f.sensitivity[0]}" max="${f.sensitivity[1]}" step="1"
          value="${e.green?.sensitivity??3}" data-testid="orbat-sensitivity-${e.id}" />
        <span class="orbat-sens-val">${e.green?.sensitivity??3}</span>
      </label>
      <label>protection
        <select data-act="protection" data-testid="orbat-protection-${e.id}">
          ${p.map(t=>`<option value="${t}" ${e.green?.protection===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>category
        <select data-act="category" data-testid="orbat-category-${e.id}">
          <option value="">—</option>
          ${l.map(t=>`<option value="${t}" ${e.green?.category===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>`}function R(e){let t=e.blue?.availability_window;return`
      <label>availability
        <select data-act="availability" data-testid="orbat-availability-${e.id}">
          ${[`available`,`down`].map(t=>`<option value="${t}" ${e.blue?.availability===t?`selected`:``}>${t}</option>`).join(``)}
        </select>
      </label>
      <label>capabilities
        <input data-act="capabilities" type="text" value="${S((e.blue?.capabilities??[]).join(`, `))}"
          placeholder="recce, comms" data-testid="orbat-capabilities-${e.id}" />
      </label>
      <label>role
        <input data-act="role" type="text" class="orbat-desc" value="${S(e.blue?.role??``)}"
          placeholder="recce" data-testid="orbat-role-${e.id}" />
      </label>
      <label class="orbat-window">
        <input data-act="bluewin-on" type="checkbox" ${t?`checked`:``} data-testid="orbat-bluewin-${e.id}" /> availability window
        <input data-act="bluewin-start" type="number" placeholder="H+start" value="${t?.start_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
        <input data-act="bluewin-end" type="number" placeholder="H+end" value="${t?.end_min??``}" class="orbat-win-num" ${t?``:`disabled`} />
      </label>`}function z(e){let t=y.querySelector(`[data-testid="orbat-row-${e.id}"]`);if(!t)return;let n=t.querySelector(`.orbat-msg`),r=(e,n,r)=>t.querySelector(`[data-act="${e}"]`)?.addEventListener(n,e=>r(e.currentTarget));if(t.querySelector(`[data-act="select"]`)?.addEventListener(`click`,()=>{E=E===e.id?null:e.id,b(E),j()}),r(`label`,`change`,t=>A(()=>v(o(),e.id,{label:t.value}),n)),r(`extent`,`change`,t=>A(()=>v(o(),e.id,{extent_m:Number(t.value)}),n)),r(`dup`,`click`,()=>A(()=>a(o(),e.id),n)),r(`remove`,`click`,()=>A(()=>c(o(),e.id),n)),r(`kind`,`change`,t=>A(()=>v(o(),e.id,{kind:t.value}),n)),r(`symbol`,`change`,t=>A(()=>v(o(),e.id,{symbol:t.value}),n)),t.querySelector(`[data-act="symbol-clear"]`)?.addEventListener(`click`,()=>A(()=>v(o(),e.id,{symbol:``}),n)),r(`confidence`,`change`,t=>A(()=>v(o(),e.id,{confidence:t.value}),n)),r(`strength`,`change`,t=>A(()=>v(o(),e.id,{strength:t.value}),n)),r(`notes`,`change`,t=>A(()=>v(o(),e.id,{notes:t.value}),n)),e.allegiance===`red`){r(`severity`,`change`,t=>A(()=>v(o(),e.id,{red:{severity:Number(t.value)}}),n)),r(`detection`,`change`,t=>A(()=>v(o(),e.id,{red:{detection_range_m:Number(t.value)}}),n)),r(`engagement`,`change`,t=>A(()=>v(o(),e.id,{red:{engagement_range_m:Number(t.value)}}),n)),r(`threat`,`change`,t=>A(()=>v(o(),e.id,{red:{threat_type:t.value}}),n));let i=()=>t.querySelector(`[data-act="redwin-on"]`).checked?[{start_min:Number(t.querySelector(`[data-act="redwin-start"]`).value||0),end_min:Number(t.querySelector(`[data-act="redwin-end"]`).value||0)}]:[];for(let t of[`redwin-on`,`redwin-start`,`redwin-end`])r(t,`change`,()=>A(()=>v(o(),e.id,{red:{active_windows:i()}}),n))}if(e.allegiance===`green`&&(r(`sensitivity`,`change`,t=>A(()=>v(o(),e.id,{green:{sensitivity:Number(t.value)}}),n)),r(`protection`,`change`,t=>A(()=>v(o(),e.id,{green:{protection:t.value}}),n)),r(`category`,`change`,t=>A(()=>v(o(),e.id,{green:{category:t.value}}),n))),e.allegiance===`blue`){r(`availability`,`change`,t=>A(()=>v(o(),e.id,{blue:{availability:t.value}}),n)),r(`role`,`change`,t=>A(()=>v(o(),e.id,{blue:{role:t.value}}),n)),r(`capabilities`,`change`,t=>A(()=>v(o(),e.id,{blue:{capabilities:t.value.split(`,`).map(e=>e.trim()).filter(Boolean)}}),n));let i=()=>{if(!t.querySelector(`[data-act="bluewin-on"]`).checked)return;let e=Number(t.querySelector(`[data-act="bluewin-start"]`).value||0),n=Number(t.querySelector(`[data-act="bluewin-end"]`).value||0);return{start_min:Math.min(e,n),end_min:Math.max(e,n)}};for(let t of[`bluewin-on`,`bluewin-start`,`bluewin-end`])r(t,`change`,()=>A(()=>v(o(),e.id,{blue:{availability_window:i()}}),n))}let s=(o().assets??[]).find(t=>t.id===e.id);if(s){let e=i(s,{inAO:D});e.ok||(n.textContent=`⚠ ${e.issues.join(`; `)}`,n.classList.add(`orbat-msg-err`))}}let B=n(()=>{y.isConnected&&j()});y.addEventListener(`tab:activated`,j);let V=new MutationObserver(()=>{y.isConnected||(B(),V.disconnect())});y.parentNode&&V.observe(y.parentNode,{childList:!0}),j()}export{C as mountOrbatPanel};
//# sourceMappingURL=orbat-panel-CuZWoqoD.js.map