import {useState,useEffect,useCallback} from 'react';
const api=async(p,m='GET',b)=>{const r=await fetch('/api'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('t')||'')},body:b&&JSON.stringify(b)});
  const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d;};
const useLoad=p=>{const[d,s]=useState([]);const l=useCallback(()=>api(p).then(s).catch(()=>{}),[p]);useEffect(()=>{l()},[l]);return[d,l];};
const useRun=()=>{const[m,s]=useState('');return[m,async(f,ok='Saved')=>{try{await f();s(ok)}catch(e){s(e.message)}}];};
const Tube=({full})=><span className={'tube'+(full?' full':'')}><i/></span>;
const Chip=({s})=><span className={'chip '+s}>{s.replace('_',' ')}</span>;
const day=d=>new Date(d.slice(0,10)+'T00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});

function Report(){const[bins]=useLoad('/bins');const[areas]=useLoad('/areas');const[area,setArea]=useState(0);const[bin,setBin]=useState(0);const[text,setText]=useState('');const[m,run]=useRun();
  const shown=bins.filter(b=>!area||b.area_id==area);
  return<section><h1>Report an overflowing bin</h1>
    <select value={area} onChange={e=>{setArea(e.target.value);setBin(0)}}><option value={0}>All areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <div className="bins">{shown.map(b=><button key={b.id} className={'bin'+(bin===b.id?' sel':'')} onClick={()=>setBin(b.id)}><Tube full={b.status==='overflowing'}/><b>{b.location}</b><small>{b.area} · {b.capacity_l} L</small></button>)}</div>
    <textarea placeholder="What did you see? (optional)" value={text} onChange={e=>setText(e.target.value)}/>
    <button className="go" onClick={()=>run(async()=>{await api('/complaints','POST',{bin_id:bin,description:text});setText('');setBin(0)},'Report sent. You will be notified when the bin is cleaned.')}>Send report</button><p className="msg">{m}</p></section>;}

function Schedule(){const[areas]=useLoad('/areas');const[area,setArea]=useState(0);const[rows]=useLoad('/schedules?area='+area);const[rem,loadRem]=useLoad('/reminders');
  const on=rem.includes(+area);
  return<section><h1>Collection schedule</h1>
    <select value={area} onChange={e=>setArea(e.target.value)}><option value={0}>All areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    {+area>0&&<label className="row"><input type="checkbox" checked={on} onChange={async()=>{await api('/reminders/'+area,on?'DELETE':'POST');loadRem()}}/> Remind me the day before collection</label>}
    <ul className="list">{rows.map(r=><li key={r.id}><b>{day(r.collection_date)}</b><span>{r.area}</span><em>{r.waste_type}</em></li>)}</ul></section>;}

function History(){const[rows,load]=useLoad('/complaints');const[open,setOpen]=useState(0);
  return<section><h1>My reports</h1><button className="ghost" onClick={load}>Refresh</button>{!rows.length&&<p>No reports yet. Use "Report a bin" to send your first one.</p>}
    <ul className="list">{rows.map(c=><li key={c.id} className="tap" onClick={()=>setOpen(open===c.id?0:c.id)}><b>{c.location}</b><span>{c.area}</span><Chip s={c.status}/>
      {open===c.id&&<div className="detail">Sent {c.created_at}<br/>{c.description||'No description'}</div>}</li>)}</ul></section>;}

function Bins(){const[bins,load]=useLoad('/bins');const[areas]=useLoad('/areas');const blank={area_id:'',location:'',capacity_l:240};const[f,setF]=useState(blank);const[m,run]=useRun();
  const save=()=>run(async()=>{await api(f.id?'/bins/'+f.id:'/bins',f.id?'PUT':'POST',f);setF(blank);load()});
  return<section><h1>Manage bins</h1><div className="form">
    <select value={f.area_id} onChange={e=>setF({...f,area_id:e.target.value})}><option value="">Area</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
    <input placeholder="Location" value={f.location} onChange={e=>setF({...f,location:e.target.value})}/>
    <input type="number" value={f.capacity_l} onChange={e=>setF({...f,capacity_l:e.target.value})}/>
    <button className="go" onClick={save}>{f.id?'Save changes':'Add bin'}</button></div><p className="msg">{m}</p>
    <ul className="list">{bins.map(b=><li key={b.id}><Tube full={b.status==='overflowing'}/><b>{b.location}</b><span>{b.area} · {b.capacity_l} L</span>
      <button className="ghost" onClick={()=>setF(b)}>Edit</button><button className="ghost red" onClick={()=>run(async()=>{await api('/bins/'+b.id,'DELETE');load()},'Bin removed')}>Remove</button></li>)}</ul></section>;}

function Tasks(){const[tasks,load]=useLoad('/tasks');const[ws]=useLoad('/workers');const[bins]=useLoad('/bins');const[f,setF]=useState({worker_id:'',route:'',bin_ids:[]});const[m,run]=useRun();
  const tog=id=>setF({...f,bin_ids:f.bin_ids.includes(id)?f.bin_ids.filter(x=>x!==id):[...f.bin_ids,id]});
  return<section><h1>Assign routes</h1><div className="form col">
    <select value={f.worker_id} onChange={e=>setF({...f,worker_id:e.target.value})}><option value="">Worker</option>{ws.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
    <input placeholder="Route name, e.g. Market Road morning" value={f.route} onChange={e=>setF({...f,route:e.target.value})}/>
    <div className="checks">{bins.map(b=><label key={b.id}><input type="checkbox" checked={f.bin_ids.includes(b.id)} onChange={()=>tog(b.id)}/> {b.location}{b.status==='overflowing'&&' (overflowing)'}</label>)}</div>
    <button className="go" onClick={()=>run(async()=>{await api('/tasks','POST',f);setF({worker_id:'',route:'',bin_ids:[]});load()},'Route assigned')}>Assign route</button></div><p className="msg">{m}</p>
    <ul className="list">{tasks.map(t=><li key={t.id}><b>{t.route}</b><span>{t.worker} · {t.bins.filter(b=>b.status!=='pending').length}/{t.bins.length} bins done</span><Chip s={t.status}/>
      {t.status!=='completed'&&<button className="ghost" onClick={()=>{const r=prompt('New route name',t.route);r&&run(async()=>{await api('/tasks/'+t.id,'PUT',{route:r});load()})}}>Edit</button>}</li>)}</ul></section>;}

function Reports(){const[rows,load]=useLoad('/complaints');const[sch,loadS]=useLoad('/schedules');const[m,run]=useRun();
  return<section><h1>Reports and schedule</h1><p className="msg">{m}</p>
    <ul className="list">{rows.map(c=><li key={c.id}><b>{c.location}</b><span>{c.area} · {c.resident}</span>
      <select value={c.status} onChange={e=>run(async()=>{await api('/complaints/'+c.id,'PUT',{status:e.target.value});load()},'Status updated')}><option value="pending">pending</option><option value="in_progress">in progress</option><option value="resolved">resolved</option></select></li>)}</ul>
    <h2>Collection dates</h2><ul className="list">{sch.map(s=><li key={s.id}><b>{s.area}</b><span>{s.waste_type}</span>
      <input type="date" defaultValue={s.collection_date.slice(0,10)} onChange={e=>run(async()=>{await api('/schedules/'+s.id,'PUT',{collection_date:e.target.value});loadS()},'Schedule updated')}/></li>)}</ul></section>;}

function MyRoutes(){const[tasks,load]=useLoad('/tasks');const[m,run]=useRun();
  const act=(f,ok)=>run(async()=>{await f();load()},ok);
  return<section><h1>My routes</h1><p className="msg">{m}</p>{!tasks.length&&<p>No routes assigned yet.</p>}
    {tasks.map(t=><div key={t.id} className="route"><h2>{t.route} <Chip s={t.status}/></h2>
      {t.status==='assigned'&&<button className="go" onClick={()=>act(()=>api('/tasks/'+t.id+'/accept','PUT'),'Route accepted')}>Accept route</button>}
      <ul className="list">{t.bins.map(b=><li key={b.id}><Tube full={b.status==='pending'}/><b>{b.location}</b><span>{b.reason||''}</span><Chip s={b.status}/>
        {t.status==='accepted'&&<><button className="ghost" onClick={()=>act(()=>api('/task-bins/'+b.id,'PUT',{status:'collected'}))}>Collected</button>
        <button className="ghost red" onClick={()=>{const r=prompt('Why could it not be collected?');r&&act(()=>api('/task-bins/'+b.id,'PUT',{status:'failed',reason:r}))}}>Not collected</button></>}</li>)}</ul>
      {t.status==='accepted'&&<button className="go" onClick={()=>act(()=>api('/tasks/'+t.id+'/complete','PUT'),'Route completed')}>Complete route</button>}</div>)}</section>;}

function Login({onIn}){const[f,setF]=useState({email:'',password:''});const[err,setErr]=useState('');
  const go=async()=>{try{const d=await api('/login','POST',f);localStorage.setItem('t',d.token);onIn(d.user)}catch(e){setErr(e.message)}};
  return<div className="login"><div className="hero"><h1>Kerbside</h1><p>Every bin, every route, one view.</p></div>
    <div className="form col"><input placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/><input type="password" placeholder="Password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} onKeyDown={e=>e.key==='Enter'&&go()}/>
    <button className="go" onClick={go}>Sign in</button><p className="msg">{err}</p><small>Demo: resident@, admin@ or worker@kerbside.test / pass123</small></div></div>;}

const NAV={resident:[['Report a bin',Report],['Schedule',Schedule],['My reports',History]],admin:[['Bins',Bins],['Routes',Tasks],['Reports',Reports]],worker:[['My routes',MyRoutes]]};
export default function App(){const[user,setUser]=useState(()=>JSON.parse(localStorage.getItem('u')||'null'));const[tab,setTab]=useState(0);const[ns,loadN]=useLoad('/notifications');const[show,setShow]=useState(false);
  useEffect(()=>{user?localStorage.setItem('u',JSON.stringify(user)):localStorage.clear()},[user]);
  useEffect(()=>{if(user){const i=setInterval(loadN,15000);return()=>clearInterval(i)}},[user,loadN]);
  if(!user)return<Login onIn={setUser}/>;
  const nav=NAV[user.role],Page=nav[tab][1],unread=ns.filter(n=>!n.is_read).length;
  return<div className="app"><aside><h2>Kerbside</h2><p>{user.name}<br/><small>{user.role}</small></p>
    <nav>{nav.map(([n],i)=><button key={n} className={i===tab?'on':''} onClick={()=>setTab(i)}>{n}</button>)}</nav>
    <button className="bell" onClick={async()=>{setShow(!show);if(!show){await api('/notifications/read','PUT');setTimeout(loadN,500)}}}>Updates{unread>0&&<b>{unread}</b>}</button>
    <button className="out" onClick={()=>setUser(null)}>Sign out</button></aside>
    <main>{show&&<ul className="list notes">{ns.length?ns.map(n=><li key={n.id}>{n.message}<small>{n.created_at}</small></li>):<li>No updates yet</li>}</ul>}<Page key={user.role+tab}/></main></div>;}
