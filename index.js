import express from 'express';import cors from 'cors';import mysql from 'mysql2/promise';import crypto from 'crypto';
const app=express();app.use(cors(),express.json());
const db=mysql.createPool({host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASS||'gokul',database:'kerbside',dateStrings:true});
const q=async(s,p)=>(await db.query(s,p))[0];
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sessions=new Map();
const W=f=>(req,res)=>f(req,res).catch(e=>res.status(500).json({error:e.message}));
const auth=(...roles)=>(req,res,next)=>{const u=sessions.get((req.headers.authorization||'').slice(7));
  if(!u||(roles.length&&!roles.includes(u.role)))return res.status(401).json({error:'Please sign in again'});req.user=u;next();};
const notify=(uid,m)=>q('INSERT INTO notifications(user_id,message) VALUES(?,?)',[uid,m]);
async function resolveBin(bid){
  await q("UPDATE bins SET status='ok' WHERE id=?",[bid]);
  for(const c of await q("SELECT id,user_id FROM complaints WHERE bin_id=? AND status<>'resolved'",[bid])){
    await q("UPDATE complaints SET status='resolved' WHERE id=?",[c.id]);await notify(c.user_id,'The bin you reported has been cleaned.');}}

app.post('/api/login',W(async(req,res)=>{const[u]=await q('SELECT id,name,role FROM users WHERE email=? AND password_hash=?',[req.body.email,sha(req.body.password||'')]);
  if(!u)return res.status(401).json({error:'Wrong email or password'});const t=crypto.randomUUID();sessions.set(t,u);res.json({token:t,user:u});}));
app.get('/api/areas',auth(),W(async(_,res)=>res.json(await q('SELECT * FROM areas'))));

// bins (admin manages, everyone reads)
app.get('/api/bins',auth(),W(async(_,res)=>res.json(await q('SELECT b.*,a.name area FROM bins b JOIN areas a ON a.id=b.area_id ORDER BY b.id'))));
app.post('/api/bins',auth('admin'),W(async(req,res)=>{const{area_id,location,capacity_l}=req.body;
  if(!area_id||!location)return res.status(400).json({error:'Area and location are required'});
  await q('INSERT INTO bins(area_id,location,capacity_l) VALUES(?,?,?)',[area_id,location,capacity_l||240]);res.json({ok:1});}));
app.put('/api/bins/:id',auth('admin'),W(async(req,res)=>{const{area_id,location,capacity_l}=req.body;
  await q('UPDATE bins SET area_id=?,location=?,capacity_l=? WHERE id=?',[area_id,location,capacity_l,req.params.id]);res.json({ok:1});}));
app.delete('/api/bins/:id',auth('admin'),W(async(req,res)=>{await q('DELETE FROM bins WHERE id=?',[req.params.id]);res.json({ok:1});}));

// complaints
app.post('/api/complaints',auth('resident'),W(async(req,res)=>{const{bin_id,description}=req.body;
  const[b]=await q('SELECT id FROM bins WHERE id=?',[bin_id]);if(!b)return res.status(400).json({error:'Pick a bin from the list'});
  await q('INSERT INTO complaints(user_id,bin_id,description) VALUES(?,?,?)',[req.user.id,bin_id,description||'']);
  await q("UPDATE bins SET status='overflowing' WHERE id=?",[bin_id]);res.json({ok:1});}));
app.get('/api/complaints',auth('resident','admin'),W(async(req,res)=>{const own=req.user.role==='resident';
  res.json(await q(`SELECT c.*,b.location,a.name area,u.name resident FROM complaints c JOIN bins b ON b.id=c.bin_id JOIN areas a ON a.id=b.area_id JOIN users u ON u.id=c.user_id ${own?'WHERE c.user_id=?':''} ORDER BY c.id DESC`,[req.user.id]));}));
app.put('/api/complaints/:id',auth('admin'),W(async(req,res)=>{const{status}=req.body;
  await q('UPDATE complaints SET status=? WHERE id=?',[status,req.params.id]);
  if(status==='resolved'){const[c]=await q('SELECT bin_id FROM complaints WHERE id=?',[req.params.id]);await resolveBin(c.bin_id);}res.json({ok:1});}));

// schedules + reminders
app.get('/api/schedules',auth(),W(async(req,res)=>res.json(await q('SELECT s.*,a.name area FROM schedules s JOIN areas a ON a.id=s.area_id WHERE (?=0 OR s.area_id=?) ORDER BY collection_date',[+req.query.area||0,+req.query.area||0]))));
app.put('/api/schedules/:id',auth('admin'),W(async(req,res)=>{await q('UPDATE schedules SET collection_date=? WHERE id=?',[req.body.collection_date,req.params.id]);res.json({ok:1});}));
app.get('/api/reminders',auth('resident'),W(async(req,res)=>res.json((await q('SELECT area_id FROM reminders WHERE user_id=?',[req.user.id])).map(r=>r.area_id))));
app.post('/api/reminders/:area',auth('resident'),W(async(req,res)=>{await q('INSERT IGNORE INTO reminders VALUES(?,?)',[req.user.id,req.params.area]);res.json({ok:1});}));
app.delete('/api/reminders/:area',auth('resident'),W(async(req,res)=>{await q('DELETE FROM reminders WHERE user_id=? AND area_id=?',[req.user.id,req.params.area]);res.json({ok:1});}));
const msg="CONCAT('Collection tomorrow in ',a.name,' (',s.waste_type,')')";
const remind=()=>q(`INSERT INTO notifications(user_id,message) SELECT r.user_id,${msg} FROM reminders r JOIN schedules s ON s.area_id=r.area_id JOIN areas a ON a.id=r.area_id WHERE s.collection_date=CURDATE()+INTERVAL 1 DAY AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.user_id=r.user_id AND n.created_at>=CURDATE() AND n.message=${msg})`);
setInterval(()=>remind().catch(()=>{}),36e5);remind().catch(()=>{});
app.get('/api/notifications',auth(),W(async(req,res)=>res.json(await q('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 15',[req.user.id]))));
app.put('/api/notifications/read',auth(),W(async(req,res)=>{await q('UPDATE notifications SET is_read=1 WHERE user_id=?',[req.user.id]);res.json({ok:1});}));

// tasks
app.get('/api/workers',auth('admin'),W(async(_,res)=>res.json(await q("SELECT id,name FROM users WHERE role='worker'"))));
app.post('/api/tasks',auth('admin'),W(async(req,res)=>{const{worker_id,route,bin_ids=[]}=req.body;
  if(!worker_id||!route||!bin_ids.length)return res.status(400).json({error:'Choose a worker, name the route and tick at least one bin'});
  const r=await q('INSERT INTO tasks(worker_id,route) VALUES(?,?)',[worker_id,route]);
  for(const b of bin_ids)await q('INSERT INTO task_bins(task_id,bin_id) VALUES(?,?)',[r.insertId,b]);
  await notify(worker_id,'New route assigned: '+route);res.json({ok:1});}));
app.put('/api/tasks/:id',auth('admin'),W(async(req,res)=>{await q("UPDATE tasks SET route=? WHERE id=? AND status<>'completed'",[req.body.route,req.params.id]);res.json({ok:1});}));
app.get('/api/tasks',auth('admin','worker'),W(async(req,res)=>{const w=req.user.role==='worker';
  const ts=await q(`SELECT t.*,u.name worker FROM tasks t JOIN users u ON u.id=t.worker_id ${w?'WHERE t.worker_id=?':''} ORDER BY t.id DESC`,[req.user.id]);
  const bs=ts.length?await q('SELECT tb.*,b.location FROM task_bins tb JOIN bins b ON b.id=tb.bin_id WHERE tb.task_id IN (?)',[ts.map(t=>t.id)]):[];
  res.json(ts.map(t=>({...t,bins:bs.filter(b=>b.task_id===t.id)})));}));
app.put('/api/tasks/:id/accept',auth('worker'),W(async(req,res)=>{await q("UPDATE tasks SET status='accepted' WHERE id=? AND worker_id=? AND status='assigned'",[req.params.id,req.user.id]);res.json({ok:1});}));
app.put('/api/task-bins/:id',auth('worker'),W(async(req,res)=>{const{status,reason}=req.body;
  const[tb]=await q('SELECT tb.bin_id FROM task_bins tb JOIN tasks t ON t.id=tb.task_id WHERE tb.id=? AND t.worker_id=?',[req.params.id,req.user.id]);
  if(!tb)return res.status(404).json({error:'Not your task'});
  if(status==='failed'&&!reason)return res.status(400).json({error:'Give a reason'});
  await q('UPDATE task_bins SET status=?,reason=? WHERE id=?',[status,reason||null,req.params.id]);
  if(status==='collected')await resolveBin(tb.bin_id);res.json({ok:1});}));
app.put('/api/tasks/:id/complete',auth('worker'),W(async(req,res)=>{
  const[p]=await q("SELECT COUNT(*) n FROM task_bins WHERE task_id=? AND status='pending'",[req.params.id]);
  if(p.n)return res.status(400).json({error:p.n+' bin(s) still need a status'});
  const[t]=await q('SELECT route FROM tasks WHERE id=? AND worker_id=?',[req.params.id,req.user.id]);if(!t)return res.status(404).json({error:'Not your task'});
  await q("UPDATE tasks SET status='completed' WHERE id=?",[req.params.id]);
  for(const a of await q("SELECT id FROM users WHERE role='admin'"))await notify(a.id,`${req.user.name} completed: ${t.route}`);res.json({ok:1});}));
app.listen(5000,()=>console.log('API on :5000'));
