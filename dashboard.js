function dashboard(){
  return {
    activeTab:'opportunities', search:'', filterSE:'', filterQuarter:[], filterStage:'', filterWarnings:false, filterEventType:[], filterEventSE:[], filterEventMonth:'', filterPlatform:'', filter100k:false,
    dealColumns:['name','amount','closeDate','quarter','platform','se','stage','techWinDate','seNote','vfNote','sfdc'],
    hiddenCols:{}, colPickerOpen:false,
    draggingCol:null, dragOverColId:null,
    visibleCols(){ return this.dealColumns.filter(c=>!this.hiddenCols[c]); },
    toggleCol(id){
      if(id==='name') return; // name always visible
      this.hiddenCols={...this.hiddenCols, [id]: !this.hiddenCols[id]};
      localStorage.setItem('se-dash-hidden-cols', JSON.stringify(this.hiddenCols));
    },
    loading:true, loadError:false, updatedAt:'', darkMode:false,
    projects:[], filterProjectStatus:'', activeProject:null,
    people:[], expandedPerson:{}, peopleNotes:{}, peopleNoteTimers:{},
    ytd:null, ytdCharts:{},
    ytdFilterTypes:[], ytdFilterSEs:[], ytdFilterPlatforms:[], ytdFilterQs:[], ytdSortCol:'date', ytdSortAsc:true,
    ytdToggle(arr, val){ const i=arr.indexOf(val); i===-1?arr.push(val):arr.splice(i,1); },
    ytdFilteredDeals(){
      if(!this.ytd) return [];
      let d = [...this.ytd.deals];
      if(this.ytdFilterTypes.length)     d = d.filter(x => this.ytdFilterTypes.includes(x.type));
      if(this.ytdFilterSEs.length)       d = d.filter(x => this.ytdFilterSEs.includes(x.se==='none'?'none':(x.se||'none')) || (this.ytdFilterSEs.includes('none') && !x.se) || this.ytdFilterSEs.some(s => s!=='none' && (x.se||'').includes(s)));
      if(this.ytdFilterPlatforms.length) d = d.filter(x => this.ytdFilterPlatforms.includes(x.platform));
      if(this.ytdFilterQs.length)        d = d.filter(x => this.ytdFilterQs.includes(x.quarter));
      const col = this.ytdSortCol, asc = this.ytdSortAsc;
      d.sort((a,b) => {
        const va = col==='amount' ? (a.amount||0) : (a[col]||'');
        const vb = col==='amount' ? (b.amount||0) : (b[col]||'');
        return asc ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
      });
      return d;
    },
    ytdSort(col){ if(this.ytdSortCol===col) this.ytdSortAsc=!this.ytdSortAsc; else { this.ytdSortCol=col; this.ytdSortAsc=col!=='amount'; } },
    ytdSortIcon(col){ return this.ytdSortCol===col ? (this.ytdSortAsc?'↑':'↓') : '↕'; },
    partners:[], filterPartnerType:'', filterPartnerTier:'', filterPartnerGSI:false, sortPartners:'relevance', partnerSearch:'', activePartner:null, expandedPartners:{},
    sortCol:'amount', sortAsc:false, modalDeal:null, currentUpdate:'',
    exportModal:false, exportText:'', copyDone:false,

    config: null,
    seList: [],  // populated from config.json

    events:[],

    deals:[],

    // All filter keys that should be persisted across refreshes
    _filterKeys: ['search','filterSE','filterQuarter','filterStage','filterWarnings','filterPlatform','filter100k',
                  'sortCol','sortAsc','filterEventType','filterEventSE','filterEventMonth',
                  'filterPartnerType','filterPartnerTier','filterPartnerGSI','sortPartners','partnerSearch',
                  'filterProjectStatus'],

    _saveFilters(){
      const state = {};
      for(const k of this._filterKeys) state[k] = this[k];
      localStorage.setItem('se-dash-filters', JSON.stringify(state));
    },
    _restoreFilters(){
      try {
        const raw = localStorage.getItem('se-dash-filters');
        if(!raw) return;
        const state = JSON.parse(raw);
        for(const k of this._filterKeys){
          if(state[k] !== undefined) this[k] = state[k];
        }
      } catch(e){}
    },

    // computed
    async init(){
      // Restore last active tab
      const savedTab = localStorage.getItem('se-dash-tab');
      if (savedTab) this.activeTab = savedTab;
      this.$watch('activeTab', t => localStorage.setItem('se-dash-tab', t));

      // Restore saved column order + visibility
      try { const c=localStorage.getItem('se-dash-deal-cols'); if(c) this.dealColumns=JSON.parse(c); } catch(e){}
      try { const h=localStorage.getItem('se-dash-hidden-cols'); if(h) this.hiddenCols=JSON.parse(h); } catch(e){}

      // Restore all filters
      this._restoreFilters();
      for(const k of this._filterKeys) this.$watch(k, () => this._saveFilters());

      // Restore dark mode preference
      const saved = localStorage.getItem('se-dash-dark');
      if (saved === '1' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        this.darkMode = true;
        document.documentElement.classList.add('dark');
      }
      // Load config first so seList and alignment are ready
      try {
        const cfg = await fetch('/api/config').then(r=>r.json());
        this.config = cfg;
        this.seList = (cfg.team||[]).map(m=>({name:m.name, match:m.match||m.name.split(' ')[0], color:m.color||'#94A3B8'}));
      } catch(e){ console.warn('Config load failed:', e); }

      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error('HTTP '+res.status);
        const data = await res.json();
        this.deals    = data.deals    || [];
        this.events   = data.events   || [];
        this.projects = data.projects || [];
        this.partners = data.partners || [];
        this.people   = data.people   || [];
        this.ytd      = data.ytd      || null;
        // Load per-person notes from disk
        for (const p of this.people) {
          fetch('/api/notes/'+p.id).then(r=>r.json()).then(d=>{ this.peopleNotes[p.id]=d.content||''; }).catch(()=>{});
        }
        this.updatedAt = data.updatedAt ? new Date(data.updatedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
      } catch(e) {
        this.loadError = true;
        console.error('Failed to load data:', e);
      } finally {
        this.loading = false;
      }
    },
    toggleDark(){
      this.darkMode = !this.darkMode;
      document.documentElement.classList.toggle('dark', this.darkMode);
      localStorage.setItem('se-dash-dark', this.darkMode ? '1' : '0');
    },
    clearAllFilters(){
      this.filterQuarter=[];this.filterSE='';this.filterPlatform='';
      this.filterStage='';this.filterWarnings=false;this.search='';
    },
    togglePlatform(p){
      this.filterPlatform = this.filterPlatform===p ? '' : p;
    },
    toggleSE(match){
      this.filterSE = this.filterSE===match ? '' : match;
    },
    toggleEventSE(se){
      const i=this.filterEventSE.indexOf(se);
      if(i===-1)this.filterEventSE.push(se);
      else this.filterEventSE.splice(i,1);
    },
    toggleOkta(){
      const oktas=['Okta Event','Okta Internal','Okta Training'];
      if(this.hasOkta()){this.filterEventType=this.filterEventType.filter(t=>!oktas.includes(t));}
      else{oktas.forEach(t=>{if(!this.filterEventType.includes(t))this.filterEventType.push(t);});}
    },
    hasOkta(){return ['Okta Event','Okta Internal','Okta Training'].some(t=>this.filterEventType.includes(t));},
    toggleEventType(t){
      const i=this.filterEventType.indexOf(t);
      if(i===-1)this.filterEventType.push(t);
      else this.filterEventType.splice(i,1);
    },
    toggleQuarter(q){
      const i=this.filterQuarter.indexOf(q);
      if(i===-1)this.filterQuarter.push(q);
      else this.filterQuarter.splice(i,1);
    },
    sort(col){if(this.sortCol===col)this.sortAsc=!this.sortAsc;else{this.sortCol=col;this.sortAsc=(col==='closeDate'||col==='techWinDate');}},
    dealColLabel(id){return{name:'Opportunity',amount:'Amount',closeDate:'Close',quarter:'Q',platform:'Platform',se:'Lead SE',stage:'PreSales Stage',techWinDate:'FTW Date',seNote:'SE Note',vfNote:'VF Notes',sfdc:'SFDC'}[id]||id;},
    sfdcUrl(id, type){
      if(!id) return '';
      const obj = type==='account' ? 'Account' : 'Opportunity';
      return 'https://okta.lightning.force.com/lightning/r/'+obj+'/'+id+'/view';
    },
    dealColSortKey(id){return{name:'name',amount:'amount',closeDate:'closeDate',techWinDate:'techWinDate'}[id]||null;},
    colDragStart(id){this.draggingCol=id;},
    colDragOver(e,id){e.preventDefault();this.dragOverColId=id;},
    colDrop(id){
      if(!this.draggingCol||this.draggingCol===id){this.draggingCol=null;this.dragOverColId=null;return;}
      const cols=[...this.dealColumns];
      const fi=cols.indexOf(this.draggingCol),ti=cols.indexOf(id);
      if(fi<0||ti<0){this.draggingCol=null;this.dragOverColId=null;return;}
      cols.splice(fi,1);cols.splice(ti,0,this.draggingCol);
      this.dealColumns=cols;this.draggingCol=null;this.dragOverColId=null;
      localStorage.setItem('se-dash-deal-cols',JSON.stringify(cols));
    },
    colDragEnd(){this.draggingCol=null;this.dragOverColId=null;},
    techWinGap(d){if(!d.techWinDate||!d.closeDate)return null;return Math.round((new Date(d.closeDate+'T12:00:00')-new Date(d.techWinDate+'T12:00:00'))/86400000);},
    techWinStatus(d){const g=this.techWinGap(d);if(g===null)return 'none';if(g<0)return 'danger';if(g<30)return 'warn';return 'ok';},
    dealWarningTags(d){
      const tags=[];
      if(!d.techWinDate) tags.push({label:'No TW Date',style:'background:#fef3c7;color:#92400e'});
      else if(this.techWinStatus(d)==='danger') tags.push({label:'🚨 TW after close',style:'background:#fee2e2;color:#dc2626'});
      else if(this.techWinStatus(d)==='warn') tags.push({label:'⚠️ '+this.techWinGap(d)+'d buffer',style:'background:#fef3c7;color:#92400e'});
      if(!d.se) tags.push({label:'No SE assigned',style:'background:#fee2e2;color:#dc2626'});
      if(!d.presalesStage) tags.push({label:'No PreSales Stage',style:'background:#fef3c7;color:#92400e'});
      return tags;
    },
    warningDeals(){return this.deals.filter(d=>this.dealWarningTags(d).length>0);},
    filteredDeals(){
      let d=this.deals.filter(deal=>{
        const q=this.search.toLowerCase();
        if(q&&!deal.name.toLowerCase().includes(q)&&!(deal.se||'').toLowerCase().includes(q)&&!(deal.vfNotes||'').toLowerCase().includes(q))return false;
        if(this.filterSE&&!(deal.se||'').includes(this.filterSE)&&!(this.filterSE==='UNASSIGNED'&&!deal.se))return false;
        if(this.filterQuarter.length>0&&!this.filterQuarter.includes(deal.quarter))return false;
        if(this.filterStage&&!(deal.presalesStage||'').includes(this.filterStage))return false;
        if(this.filterPlatform&&!(deal.platform||'').includes(this.filterPlatform))return false;
        if(this.filterWarnings&&this.dealWarningTags(deal).length===0)return false;
        if(this.filter100k&&deal.amount<100000)return false;
        return true;
      });
      const col=this.sortCol,asc=this.sortAsc;
      d.sort((a,b)=>{let va=a[col]||'',vb=b[col]||'';if(col==='closeDate'||col==='techWinDate'){va=va||'9999';vb=vb||'9999';}if(va<vb)return asc?-1:1;if(va>vb)return asc?1:-1;return 0;});
      return d;
    },
    partnerScore(p){
      const tierW={Apex:100,Amplify:60,Activate:20,Distributor:40,Incubate:5};
      const rev  = Math.min((p.revenueCurrentYear||0)/10000, 80);
      const deals= Math.min((p.activeDeals?.length||0)*15, 30);
      const conts= Math.min((p.contacts?.length||0)*1.5, 20);
      const notes= (p.notes?.length||0)>10 ? 10 : 0;
      const gsi  = p.gsi ? 20 : 0;
      return (tierW[p.tier]||0) + rev + deals + conts + notes + gsi;
    },
    filteredPartners(){
      const list = this.partners.filter(p=>{
        const q=this.partnerSearch.toLowerCase();
        if(q){
          const matchesMeta = p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q) || (p.region||'').toLowerCase().includes(q);
          const matchesContact = (p.contacts||[]).some(c => (c.name||'').toLowerCase().includes(q) || (c.title||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q));
          if(!matchesMeta && !matchesContact) return false;
        }
        if(this.filterPartnerType&&p.type!==this.filterPartnerType) return false;
        if(this.filterPartnerTier&&p.tier!==this.filterPartnerTier) return false;
        if(this.filterPartnerGSI&&!p.gsi) return false;
        return true;
      });
      const s = this.sortPartners;
      if(s==='revenue')   list.sort((a,b)=>(b.revenueCurrentYear||0)-(a.revenueCurrentYear||0));
      if(s==='relevance') list.sort((a,b)=>this.partnerScore(b)-this.partnerScore(a));
      if(s==='name')      list.sort((a,b)=>a.name.localeCompare(b.name));
      if(s==='tier'){
        const order={Apex:0,Amplify:1,Distributor:2,Activate:3,Incubate:4};
        list.sort((a,b)=>(order[a.tier]??5)-(order[b.tier]??5)||a.name.localeCompare(b.name));
      }
      if(s==='country')   list.sort((a,b)=>a.country.localeCompare(b.country)||a.name.localeCompare(b.name));
      return list;
    },
    tierColor(t){
      const m={'Apex':'background:#fef3c7;color:#92400e','Amplify':'background:#dbeafe;color:#1d4ed8',
               'Activate':'background:#f3f4f6;color:#374155','Distributor':'background:#d1fae5;color:#065f46'};
      return m[t]||'background:#f3f4f6;color:#374155';
    },
    fmt$(n){ return n ? '$'+Math.round(n).toLocaleString('en-US') : '—'; },
    filteredProjects(){
      if(!this.filterProjectStatus) return this.projects;
      return this.projects.filter(p=>p.status===this.filterProjectStatus);
    },
    statusColor(s){
      const m={'Active':'background:#dcfce7;color:#166534','Near Complete':'background:#dbeafe;color:#1d4ed8',
               'Completed':'background:#f3f4f6;color:#374151','Planning':'background:#fef3c7;color:#92400e',
               'On Hold':'background:#fee2e2;color:#dc2626'};
      return m[s]||'background:#f3f4f6;color:#374151';
    },
    categoryColor(c){
      const m={'Strategic':'background:#ede9fe;color:#5b21b6','Enablement':'background:#dbeafe;color:#1d4ed8',
               'Demand Gen':'background:#d1fae5;color:#065f46','Compliance':'background:#fef3c7;color:#92400e',
               'Operational':'background:#f3f4f6;color:#374151'};
      return m[c]||'background:#f3f4f6;color:#374151';
    },
    filteredEvents(){
      return this.events.filter(ev=>{
        if(this.filterEventType.length>0&&!this.filterEventType.includes(ev.type)) return false;
        if(this.filterEventSE.length>0&&!this.filterEventSE.some(se=>ev.team.includes(se))) return false;
        if(this.filterEventMonth){const m=(ev.date.match(/^([A-Za-z]+)/)||[])[1]||'TBD';if(m!==this.filterEventMonth)return false;}
        return true;
      });
    },
    availableMonths(){
      const monthOrder=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const seen=new Set();
      for(const ev of this.events){const m=(ev.date.match(/^([A-Za-z]+)/)||[])[1];if(m)seen.add(m);}
      return [...seen].sort((a,b)=>monthOrder.indexOf(a)-monthOrder.indexOf(b));
    },
    eventsByMonth(){
      const monthOrder=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const groups={};
      for(const ev of this.filteredEvents()){
        const m=(ev.date.match(/^([A-Za-z]+)/)||[])[1]||'TBD';
        if(!groups[m])groups[m]=[];
        groups[m].push(ev);
      }
      return Object.keys(groups)
        .sort((a,b)=>monthOrder.indexOf(a)-monthOrder.indexOf(b))
        .map(m=>({month:m,events:groups[m]}));
    },
    totalPipeline(){return this.deals.reduce((s,d)=>s+d.amount,0);},
    q2Total(){return this.deals.filter(d=>d.quarter==='Q2').reduce((s,d)=>s+d.amount,0);},
    q3Total(){return this.deals.filter(d=>d.quarter==='Q3').reduce((s,d)=>s+d.amount,0);},
    q4Total(){return this.deals.filter(d=>d.quarter==='Q4').reduce((s,d)=>s+d.amount,0);},
    auth0Total(){return this.deals.filter(d=>(d.platform||'').includes('Auth0')).reduce((s,d)=>s+d.amount,0);},
    oktaTotal(){return this.deals.filter(d=>(d.platform||'').includes('Okta')).reduce((s,d)=>s+d.amount,0);},
    auth0Count(){return this.deals.filter(d=>(d.platform||'').includes('Auth0')).length;},
    oktaCount(){return this.deals.filter(d=>(d.platform||'').includes('Okta')).length;},
    seTotal(m){return this.deals.filter(d=>(d.se||'').includes(m)).reduce((s,d)=>s+d.amount,0);},
    seColor(se){
      if(!se) return '#94A3B8';
      const found = this.seList.find(m=>(se||'').includes(m.match));
      if(found) return found.color;
      if(se.includes('Victor')) return '#6366F1';
      return '#94A3B8';
    },
    stageBadgeClass(s){if(!s)return 'badge';if(s.includes('Technical Win'))return 'badge';if(s.includes('Final Due'))return 'badge';if(s.includes('Zombies'))return 'badge';if(s.includes('Loss'))return 'badge';if(s.includes('Scoping')||s.includes('Validate'))return 'badge';return 'badge';},
    stageBgStyle(s){if(!s)return 'background:#fef3c7;color:#92400e';if(s.includes('Technical Win'))return 'background:#d1fae5;color:#065f46';if(s.includes('Final Due'))return 'background:#dbeafe;color:#1d4ed8';if(s.includes('Zombies'))return 'background:#ffedd5;color:#c2410c';if(s.includes('Loss'))return 'background:#fee2e2;color:#dc2626';if(s.includes('Scoping')||s.includes('Validate'))return 'background:#fef3c7;color:#92400e';return 'background:#f1f5f9;color:#475569';},
    stageShort(s){if(!s)return '⚠️ No Stage';if(s.includes('Technical Win'))return '✅ Tech Win';if(s.includes('Final Due'))return '🔵 Final DD';if(s.includes('Zombies'))return '⚠️ Zombies';if(s.includes('Loss'))return '🚫 No Bid';if(s.includes('Scoping')||s.includes('Validate'))return '🟡 Scoping';return s.replace(/^\d+ - /,'');},
    latestNote(n){
      if(!n)return '';
      const first=(n.split(/\r?\n\r?\n/)[0]||n).split(/\r?\n/)[0].trim();
      return first.length>90?first.substring(0,87)+'...':first;
    },
    fmt(n){return n?'$'+Math.round(n).toLocaleString('en-US'):'$0';},
    fmtDate(d){if(!d)return '—';return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'});},
    isOverdue(d){if(!d)return false;return new Date(d+'T23:59:59')<new Date('2026-07-01');},
    openModal(deal){this.modalDeal=deal;this.currentUpdate='';document.body.style.overflow='hidden';},
    closeModal(){this.modalDeal=null;document.body.style.overflow='';},
    getSavedUpdate(name){if(!name)return '';return localStorage.getItem('upd_'+name)||'';},
    saveUpdate(name){if(!name||!this.currentUpdate.trim())return;localStorage.setItem('upd_'+name,this.currentUpdate.trim());this.currentUpdate='';},
    clearUpdate(name){if(name)localStorage.removeItem('upd_'+name);},
    hasPendingUpdate(name){return !!(name&&localStorage.getItem('upd_'+name));},
    pendingUpdatesCount(){return this.deals.filter(d=>this.hasPendingUpdate(d.name)).length;},
    exportUpdates(){
      const inst='Instructions: For each opportunity find the matching row in the VF Context Notes tab '+
        '(Sheet ID: 1gyJteTxJ-Kv2rOsnszpSbnJVarOFhI0JbAUNDspY7oA) and append the update to '+
        'column B (VF Additional Context / Notes). Update column C to today date. Do NOT modify CSM_Notes__c.';
      const lines=['UPDATES TO WRITE TO VF CONTEXT NOTES',
        'Source: SE Manager Dashboard - '+new Date().toLocaleDateString('en-US'),inst,''];
      let found=false;
      for(const d of this.deals){const u=this.getSavedUpdate(d.name);if(u){found=true;lines.push('---','OPPORTUNITY: '+d.name,'UPDATE:',u,'');}}
      if(!found)lines.push('No pending updates.');
      this.exportText=lines.join('\n');this.exportModal=true;this.copyDone=false;
    },
    async copyExport(){try{await navigator.clipboard.writeText(this.exportText);this.copyDone=true;setTimeout(()=>this.copyDone=false,2500);}catch(e){}},
    clearUpdates(){for(const d of this.deals)localStorage.removeItem('upd_'+d.name);this.exportModal=false;},
    // SE Alignment: given AE owner + platform, return the expected SE name
    suggestSE(deal){
      if(!this.config) return null;
      const ae      = (deal.ae || '').toLowerCase();
      const platform= (deal.platform || '').toLowerCase();
      const isAuth0 = platform.includes('auth0') || platform.includes('oci') || platform.includes('customer identity') || platform.includes('cic');

      // Check config alignment rules
      const rules = this.config.alignment || [];
      for(const rule of rules){
        const aeKey = (rule.ae||'').toLowerCase();
        if(aeKey && ae.includes(aeKey)){
          const seName = isAuth0 ? rule.auth0_se : rule.okta_se;
          return seName || null;
        }
      }
      return null;
    },
    // Returns 'match' | 'mismatch' | 'unassigned' | 'unknown'
    seAlignmentStatus(deal){
      const suggested = this.suggestSE(deal);
      if(!suggested) return 'unknown';
      const assigned  = (deal.se || '').toLowerCase();
      if(!assigned)   return 'unassigned';
      // Match if assigned SE contains the first name of the suggestion
      const suggestedFirst = suggested.split(' ')[0].toLowerCase();
      return assigned.includes(suggestedFirst) ? 'match' : 'mismatch';
    },
    seIndividualTarget(se){
      if(!se || !this.config) return null;
      const member = (this.config.team||[]).find(m=>(se||'').includes(m.match||m.name.split(' ')[0]));
      return member?.individualTarget || null;
    },
    ytdSeAttainment(se){
      if(!this.ytd) return null;
      const row = this.ytd.bySE.find(r=>r.se===se);
      const amt = row ? row.amount : 0;
      const target = this.seIndividualTarget(se);
      return target ? {amount:amt, target, pct: Math.round(amt/target*1000)/10} : null;
    },
    fmt$k(n){ return n>=1000000 ? '$'+(n/1000000).toFixed(2)+'M' : n>=1000 ? '$'+(n/1000).toFixed(0)+'K' : '$'+Math.round(n); },
    initYtdCharts(){
      if(!this.ytd || typeof Chart==='undefined') return;
      const destroy = id => { if(this.ytdCharts[id]){this.ytdCharts[id].destroy();delete this.ytdCharts[id];} };
      const SE_COLORS = {'Gabriel Valdez':'#8B5CF6','Victor Fuenmayor':'#6366F1','Isvi Acuna':'#F97316','Matt Gueiros':'#3B82F6','Adriana Rojas':'#EC4899','Gaston Rodriguez':'#14B8A6'};
      setTimeout(()=>{
        // SE Contribution bar
        destroy('se'); const cSE = document.getElementById('chart-se');
        if(cSE){ this.ytdCharts['se'] = new Chart(cSE,{type:'bar',data:{labels:this.ytd.bySE.map(r=>r.se.split(' ')[0]),datasets:[{label:'Closed Won',data:this.ytd.bySE.map(r=>r.amount),backgroundColor:this.ytd.bySE.map(r=>SE_COLORS[r.se]||'#94A3B8'),borderRadius:6,order:2},{label:'Individual Target',data:this.ytd.bySE.map(r=>this.seIndividualTarget(r.se)||0),type:'line',borderColor:'#475569',borderWidth:2,borderDash:[6,3],pointRadius:5,pointBackgroundColor:'#475569',pointBorderColor:'#fff',pointBorderWidth:2,fill:false,order:1}]},options:{responsive:true,plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>this.fmt$k(v)}}}}}); }
        // Type doughnut
        destroy('type'); const cType = document.getElementById('chart-type');
        if(cType){ this.ytdCharts['type'] = new Chart(cType,{type:'doughnut',data:{labels:this.ytd.byType.map(r=>r.type),datasets:[{data:this.ytd.byType.map(r=>r.amount),backgroundColor:['#3B82F6','#10B981','#F59E0B'],borderWidth:2}]},options:{responsive:true,plugins:{legend:{position:'bottom'}}}}); }
        // Platform doughnut
        destroy('plat'); const cPlat = document.getElementById('chart-platform');
        if(cPlat){ this.ytdCharts['plat'] = new Chart(cPlat,{type:'doughnut',data:{labels:this.ytd.byPlatform.map(r=>r.platform),datasets:[{data:this.ytd.byPlatform.map(r=>r.amount),backgroundColor:['#8B5CF6','#14B8A6','#CBD5E1'],borderWidth:2}]},options:{responsive:true,plugins:{legend:{position:'bottom'}}}}); }
        // Quarter trend
        destroy('qtr'); const cQtr = document.getElementById('chart-quarter');
        if(cQtr){ this.ytdCharts['qtr'] = new Chart(cQtr,{type:'bar',data:{labels:this.ytd.byQuarter.map(r=>r.quarter),datasets:[{label:'Closed Won',data:this.ytd.byQuarter.map(r=>r.amount),backgroundColor:['#3B82F6','#10B981','#F59E0B','#EF4444'],borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>this.fmt$k(v)}}}}}); }
      }, 100);
    },
    getPeopleNote(id){return this.peopleNotes[id]||'';},
    savePeopleNote(id, text){
      this.peopleNotes[id]=text;
      clearTimeout(this.peopleNoteTimers[id]);
      this.peopleNoteTimers[id]=setTimeout(()=>{
        fetch('/api/notes/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text})})
          .then(()=>{ this.peopleNotes[id+'__saved']=new Date().toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); })
          .catch(()=>{});
      }, 800);
    },
    getPeopleNoteSaved(id){return this.peopleNotes[id+'__saved']||'';},
  };
}