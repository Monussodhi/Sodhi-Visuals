"use strict";
const C=window.SB;const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
if(!C||!C.url||!C.key){document.body.innerHTML='<p style="padding:30px">Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in Netlify and redeploy.</p>'}
const sb=supabase.createClient(C.url,C.key,{auth:{persistSession:true,autoRefreshToken:true}});
const BUCKET="portfolio",MAX=10*1024*1024,EXT={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
let S={cats:[],projects:[],tab:"dash",filter:"all",session:null},idle;
const TABS=[["dash","Dashboard"],["all","All Projects"],["video","Video Editing"],["design","Graphic Design"],["cats","Categories"],["media","Media Library"],["acct","Account"]];

function toast(m,err){const t=$("#toast");t.textContent=m;t.className=err?"err":"";t.style.display="block";clearTimeout(t._t);t._t=setTimeout(()=>t.style.display="none",4500)}
const fail=(e,ctx)=>toast((ctx?ctx+": ":"")+(e?.message||"Something went wrong"),true);

// ---- auth ----
function showLogin(msg){$("#app").hidden=true;$("#login").hidden=false;$("#le").textContent=msg||"";$("#pw").value="";clearTimeout(idle)}
function armIdle(){clearTimeout(idle);idle=setTimeout(()=>sb.auth.signOut(),30*60*1000)} // 30 min inactivity
["click","keydown","pointermove"].forEach(ev=>document.addEventListener(ev,()=>S.session&&armIdle(),{passive:true}));
sb.auth.onAuthStateChange((ev,s)=>{S.session=s;if(ev==="SIGNED_OUT")showLogin("Signed out. Sign in again to continue.")});
$("#lf").onsubmit=async e=>{e.preventDefault();$("#lb").disabled=true;$("#le").textContent="";
 const {data,error}=await sb.auth.signInWithPassword({email:$("#em").value.trim(),password:$("#pw").value});
 $("#lb").disabled=false;
 if(error)return $("#le").textContent="Sign in failed. Check your email and password.";
 enter(data.session)};
async function enter(session){
 S.session=session;
 const {data,error}=await sb.rpc("is_admin"); // UI convenience only; RLS enforces every write
 if(error||data!==true){await sb.auth.signOut();return showLogin("This account is not authorised for admin access.")}
 $("#login").hidden=true;$("#app").hidden=false;armIdle();
 $("#tabs").innerHTML=TABS.map(([k,l])=>`<button data-tab="${k}">${l}</button>`).join("")+'<button data-tab="out">Log out</button>';
 await refresh();go("dash")}
async function refresh(){
 const [c,p]=await Promise.all([sb.from("categories").select("*").order("type").order("sort_order"),sb.from("projects").select("*").order("sort_order").order("created_at",{ascending:false})]);
 if(c.error||p.error)return fail(c.error||p.error,"Load failed");S.cats=c.data;S.projects=p.data}
function go(t){
 if(t==="out")return sb.auth.signOut();
 S.tab=t;document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===t));
 ({dash,all:()=>projects("all"),video:()=>projects("video"),design:()=>projects("design"),cats,media,acct})[t]()}
const V=h=>$("#view").innerHTML=h;
const catName=id=>S.cats.find(c=>c.id===id)?.name||"—";

// ---- views ----
function dash(){const p=S.projects,n=f=>p.filter(f).length;
 V(`<h1>Dashboard</h1><div class="cards">${[["Projects",p.length],["Published",n(x=>x.status==="published")],["Drafts",n(x=>x.status==="draft")],["Video",n(x=>x.type==="video")],["Design",n(x=>x.type==="design")],["Categories",S.cats.length]].map(([l,v])=>`<div class="card"><b>${v}</b>${l}</div>`).join("")}</div><button class="b p" data-act="new" data-type="video">New video project</button> <button class="b p" data-act="new" data-type="design">New design project</button>`)}
function projects(type){S.filter=type;const rows=S.projects.filter(p=>type==="all"||p.type===type);
 V(`<h1>${{all:"All Projects",video:"Video Editing",design:"Graphic Design"}[type]}</h1><p><button class="b p" data-act="new" data-type="${type==="all"?"video":type}">New project</button></p>
 ${rows.length?`<table><tr><th>Title</th><th>Type</th><th>Category</th><th>Status</th><th>Order</th><th></th></tr>${rows.map(p=>`<tr><td>${esc(p.title)}${p.featured?' <span class="tag on">featured</span>':""}</td><td>${p.type}</td><td>${esc(catName(p.category_id))}</td><td><span class="tag ${p.status==="published"?"on":""}">${p.status}</span></td><td>${p.sort_order}</td><td>
 <button class="b s" data-act="edit" data-id="${p.id}">Edit</button><button class="b s" data-act="prev" data-id="${p.id}">Preview</button><button class="b s" data-act="pub" data-id="${p.id}">${p.status==="published"?"Unpublish":"Publish"}</button><button class="b s d" data-act="del" data-id="${p.id}">Delete</button></td></tr>`).join("")}</table>`:'<p class="mut">No projects yet. Create your first one.</p>'}`)}
function cats(){V(`<h1>Categories</h1><form class="row" id="cf"><label>Name<input name="name" maxlength="60" required></label><label>Type<select name="type"><option value="video">Video Editing</option><option value="design">Graphic Design</option></select></label><button class="b p">Add category</button></form>
 ${["video","design"].map(t=>`<h3>${t==="video"?"Video Editing":"Graphic Design"}</h3><table>${S.cats.filter(c=>c.type===t).map(c=>`<tr><td>${esc(c.name)}</td><td>${S.projects.filter(p=>p.category_id===c.id).length} projects</td><td><button class="b s" data-act="up" data-id="${c.id}" aria-label="Move up">↑</button><button class="b s" data-act="down" data-id="${c.id}" aria-label="Move down">↓</button><button class="b s" data-act="ren" data-id="${c.id}">Rename</button><button class="b s d" data-act="cdel" data-id="${c.id}">Delete</button></td></tr>`).join("")}</table>`).join("")}`);
 $("#cf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),t=f.get("type"),mx=Math.max(0,...S.cats.filter(c=>c.type===t).map(c=>c.sort_order));
  const {error}=await sb.from("categories").insert({name:String(f.get("name")).trim(),type:t,sort_order:mx+1});
  if(error)return fail(error,"Couldn’t add category");toast("Category added");await refresh();cats()}}
async function media(){V('<h1>Media Library</h1><p class="mut">Loading…</p>');
 const all=[];for(const f of ["video","design","misc"]){const {data,error}=await sb.storage.from(BUCKET).list(f,{limit:200,sortBy:{column:"created_at",order:"desc"}});if(error)return fail(error,"Couldn’t list media");(data||[]).filter(o=>o.id).forEach(o=>all.push(f+"/"+o.name))}
 V(`<h1>Media Library</h1><div class="row"><label>Folder<select id="mf"><option>misc</option><option>video</option><option>design</option></select></label><label>Images (JPG, PNG, WebP, GIF · max 10 MB)<input id="mu" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label></div>
 <p class="mut">Videos are not uploaded here. Host them on YouTube or Vimeo and paste the link into the project.</p>
 <div class="media">${all.map(p=>{const u=sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;return `<div><img src="${esc(u)}" alt="" loading="lazy">${esc(p)}<br><button class="b s" data-act="copy" data-u="${esc(u)}">Copy URL</button><button class="b s d" data-act="mdel" data-p="${esc(p)}">Delete</button></div>`}).join("")||'<p class="mut">No files yet.</p>'}</div>`);
 $("#mu").onchange=async e=>{for(const f of e.target.files){try{await upload(f,$("#mf").value)}catch(x){fail(x)}}toast("Upload finished");media()}}
function acct(){V(`<h1>Account</h1><p>Signed in as <b>${esc(S.session?.user?.email)}</b></p><p class="mut">Session refreshes automatically and ends after 30 minutes of inactivity.</p><button class="b d" data-act="out">Log out</button> <button class="b" data-act="outall">Log out everywhere</button>`)}

// ---- upload ----
async function upload(file,folder){
 if(!EXT[file.type])throw new Error(`${file.name}: only JPG, PNG, WebP or GIF are allowed`);
 if(file.size>MAX)throw new Error(`${file.name}: larger than 10 MB`);
 const path=`${folder}/${crypto.randomUUID()}.${EXT[file.type]}`;
 const {error}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
 if(error)throw error;return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}

// ---- project form ----
const dlg=$("#dlg");
function form(p,type){const t=p?.type||type,cs=S.cats.filter(c=>c.type===t),v=p||{tools:[],gallery:[],status:"draft",featured:false,sort_order:S.projects.length+1,aspect_ratio:t==="video"?"16:9":""};
 dlg.innerHTML=`<h2>${p?"Edit":"New"} ${t==="video"?"video":"design"} project</h2><form class="f" id="pf" data-type="${t}" data-id="${p?.id||""}">
 <label>Title<input name="title" maxlength="120" required value="${esc(v.title)}"></label>
 <label>Description<textarea name="description" maxlength="5000">${esc(v.description)}</textarea></label>
 <label>Category<select name="category_id" required>${cs.map(c=>`<option value="${c.id}" ${c.id===v.category_id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
 <label>${t==="video"?"Thumbnail":"Cover image"} URL<input name="cover_url" type="url" placeholder="https://…" value="${esc(v.cover_url)}"></label>
 <label>Upload image<input type="file" id="cu" accept="image/jpeg,image/png,image/webp,image/gif"></label>
 ${t==="video"?`<label>Video URL (YouTube, Vimeo…)<input name="video_url" type="url" placeholder="https://…" value="${esc(v.video_url)}"></label>
 <label>Aspect ratio<select name="aspect_ratio">${["16:9","9:16","1:1","4:5","21:9"].map(a=>`<option ${a===v.aspect_ratio?"selected":""}>${a}</option>`).join("")}</select></label>`:
 `<label>Gallery image URLs (one per line)<textarea name="gallery">${esc((v.gallery||[]).join("\n"))}</textarea></label><label>Upload gallery images<input type="file" id="gu" multiple accept="image/jpeg,image/png,image/webp,image/gif"></label>`}
 <label>Tools used (comma separated)<input name="tools" value="${esc((v.tools||[]).join(", "))}"></label>
 <label>Display order<input name="sort_order" type="number" min="0" max="9999" value="${v.sort_order}"></label>
 <label>Status<select name="status"><option value="draft" ${v.status==="draft"?"selected":""}>Draft</option><option value="published" ${v.status==="published"?"selected":""}>Published</option></select></label>
 <label><span><input type="checkbox" name="featured" ${v.featured?"checked":""}> Featured (shown large)</span></label>
 <div class="row"><button class="b p">Save</button><button type="button" class="b" data-act="close">Cancel</button></div></form>`;
 dlg.showModal();
 $("#cu").onchange=async e=>{try{$("#pf").cover_url.value=await upload(e.target.files[0],t);toast("Image uploaded")}catch(x){fail(x)}};
 const gu=$("#gu");if(gu)gu.onchange=async e=>{try{const g=$("#pf").gallery;for(const f of e.target.files)g.value+=(g.value?"\n":"")+await upload(f,t);toast("Images uploaded")}catch(x){fail(x)}};
 $("#pf").onsubmit=save}
async function save(e){e.preventDefault();const f=e.target,d=new FormData(f),t=f.dataset.type,id=f.dataset.id;
 const lines=s=>String(s||"").split(/\n/).map(x=>x.trim()).filter(Boolean);
 const row={type:t,title:d.get("title").trim(),description:d.get("description").trim(),category_id:d.get("category_id"),cover_url:d.get("cover_url").trim()||null,
  tools:String(d.get("tools")).split(",").map(x=>x.trim()).filter(Boolean),sort_order:parseInt(d.get("sort_order"),10)||0,status:d.get("status"),featured:d.get("featured")==="on",
  video_url:t==="video"?(d.get("video_url").trim()||null):null,aspect_ratio:t==="video"?d.get("aspect_ratio"):null,gallery:t==="design"?lines(d.get("gallery")):[]};
 if(row.status==="published"&&!row.cover_url)return toast("Add a cover image before publishing",true);
 const {error}=id?await sb.from("projects").update(row).eq("id",id):await sb.from("projects").insert(row);
 if(error)return fail(error,"Save failed");dlg.close();toast("Project saved");await refresh();go(S.tab)}

// ---- actions (event delegation; no inline handlers) ----
document.addEventListener("click",async e=>{
 const tb=e.target.closest("#tabs button");if(tb)return go(tb.dataset.tab);
 const b=e.target.closest("[data-act]");if(!b)return;const a=b.dataset.act,id=b.dataset.id,p=S.projects.find(x=>x.id===id);
 try{
 if(a==="close")dlg.close();
 else if(a==="new")form(null,b.dataset.type);
 else if(a==="edit")form(p);
 else if(a==="prev"){dlg.innerHTML=`<h2>${esc(p.title)}</h2>${p.cover_url?`<img src="${esc(p.cover_url)}" alt="" style="max-width:100%;border-radius:12px">`:""}<p class="mut">${esc(catName(p.category_id))} · ${p.status}</p><p>${esc(p.description)}</p><p>${esc((p.tools||[]).join(", "))}</p><button class="b" data-act="close">Close</button>`;dlg.showModal()}
 else if(a==="pub"){const to=p.status==="published"?"draft":"published";if(to==="published"&&!p.cover_url)return toast("Add a cover image before publishing",true);
  const {error}=await sb.from("projects").update({status:to}).eq("id",id);if(error)throw error;toast(to==="published"?"Published":"Unpublished");await refresh();go(S.tab)}
 else if(a==="del"){if(!confirm(`Delete “${p.title}”? This can’t be undone. Its image files stay in the Media Library.`))return;
  const {error}=await sb.from("projects").delete().eq("id",id);if(error)throw error;toast("Project deleted");await refresh();go(S.tab)}
 else if(a==="up"||a==="down"){const l=S.cats.filter(c=>c.type===S.cats.find(x=>x.id===id).type),i=l.findIndex(c=>c.id===id),j=a==="up"?i-1:i+1;if(j<0||j>=l.length)return;
  const r=await Promise.all([sb.from("categories").update({sort_order:j+1}).eq("id",l[i].id),sb.from("categories").update({sort_order:i+1}).eq("id",l[j].id)]);if(r.some(x=>x.error))throw r.find(x=>x.error).error;await refresh();cats()}
 else if(a==="ren"){const c=S.cats.find(x=>x.id===id),n=prompt("New name",c.name);if(!n||!n.trim())return;const {error}=await sb.from("categories").update({name:n.trim().slice(0,60)}).eq("id",id);if(error)throw error;toast("Renamed");await refresh();cats()}
 else if(a==="cdel"){if(!confirm("Delete this category? It can only be deleted when no projects use it."))return;const {error}=await sb.from("categories").delete().eq("id",id);if(error)throw new Error("Category is still used by projects, or you aren’t authorised.");toast("Category deleted");await refresh();cats()}
 else if(a==="copy"){await navigator.clipboard.writeText(b.dataset.u);toast("URL copied")}
 else if(a==="mdel"){if(!confirm("Delete this file? Any project still using it will show a broken image."))return;const {error}=await sb.storage.from(BUCKET).remove([b.dataset.p]);if(error)throw error;toast("File deleted");media()}
 else if(a==="out")sb.auth.signOut();else if(a==="outall")sb.auth.signOut({scope:"global"});
 }catch(x){fail(x)}});
sb.auth.getSession().then(({data})=>data.session?enter(data.session):showLogin());
