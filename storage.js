'use strict';
// Plain SQLite and SQLCipher encrypted projects share the same schema.
const {sanitizeHTML}=require('./html-content');
const {note:validNote}=require('./ipc-contract');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');
const {CipherDB}=require('./cipher-db');
const FORMAT = 'nocturne-notes-v1';

function id() { return crypto.randomUUID(); }
function exists(filePath) { return fs.existsSync(filePath); }
function encryptedFile(file){const fd=fs.openSync(file,'r');try{const header=Buffer.alloc(16);const size=fs.fstatSync(fd).size;fs.readSync(fd,header,0,16,0);return header.toString('utf8')!=='SQLite format 3\u0000'&&size>=4096&&size%4096===0;}finally{fs.closeSync(fd);}}
function passwordBuffer(password){if(!Buffer.isBuffer(password)||password.length===0||password.length>4096)throw new Error('Неверный пароль');return Buffer.from(password);}
function sameFile(a,b){
 // Windows file IDs may exceed Number.MAX_SAFE_INTEGER; never round them.
 const x=fs.statSync(a,{bigint:true,throwIfNoEntry:false}),y=fs.statSync(b,{bigint:true,throwIfNoEntry:false});
 if(!x||!y){
  const normalized=value=>{const p=path.resolve(value);return process.platform==='win32'?p.toLowerCase():p;};
  return normalized(a)===normalized(b);
 }
 if(x.ino!==0n&&y.ino!==0n)return x.dev===y.dev&&x.ino===y.ino;
 // If the filesystem supplies no reliable ID, an identical canonical path
 // is sufficient; otherwise refuse the operation rather than risk an alias.
 if(fs.realpathSync.native(a)===fs.realpathSync.native(b))return true;
 throw new Error('Выберите другое имя файла');
}
function assertReplaceable(file,checkSidecars=true){if(!exists(file))return;const st=fs.lstatSync(file);if(st.nlink>1)throw new Error('Нельзя заменить проект с несколькими жесткими ссылками');if(!st.isFile()||st.isSymbolicLink()||(checkSidecars&&['-journal','-wal','-shm'].some(s=>exists(file+s))))throw new Error('Проект уже открыт или заблокирован');}
function publishCopy(tmp,file,overwrite){if(overwrite){assertReplaceable(file);fs.renameSync(tmp,file);}else{if(exists(file))throw new Error('Файл проекта уже существует');try{fs.linkSync(tmp,file);}catch(e){if(!['EPERM','ENOTSUP','EOPNOTSUPP','EXDEV'].includes(e.code))throw e;const fd=fs.openSync(file,'wx');fs.closeSync(fd);try{fs.renameSync(tmp,file);}catch(err){if(exists(file)&&fs.statSync(file).size===0)fs.unlinkSync(file);throw err;}}}}

function newProject(filePath, notes = [{title:'Без названия',html:'<p></p>'}], password=null) {
  fs.mkdirSync(path.dirname(filePath), {recursive:true});
  if (fs.existsSync(filePath)) throw new Error('Файл проекта уже существует');
  const db = password?new CipherDB(filePath,password,true):new DatabaseSync(filePath);
  try {
    db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;
      CREATE TABLE project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT NOT NULL, html TEXT NOT NULL, sort_order INTEGER NOT NULL, updated_at INTEGER NOT NULL);
      CREATE INDEX notes_order_idx ON notes(sort_order);
      PRAGMA user_version=1;`);
    db.prepare('INSERT INTO project_meta(key,value) VALUES(?,?)').run('format',FORMAT);
    db.prepare('INSERT INTO project_meta(key,value) VALUES(?,?)').run('created_at',String(Date.now()));
    const insert = db.prepare('INSERT INTO notes (id,title,html,sort_order,updated_at) VALUES (?,?,?,?,?)');
    const entries = notes.length ? notes : [{title:'Без названия',html:'<p></p>'}];
    db.exec('BEGIN IMMEDIATE');
    try {
      entries.forEach((n,i)=>insert.run(id(),n.title,sanitizeHTML(n.html),i,Date.now()));
      db.exec('COMMIT');
    } catch (error) {db.exec('ROLLBACK');throw error;}
    const first = db.prepare('SELECT id FROM notes ORDER BY sort_order LIMIT 1').get();
    db.prepare('INSERT INTO project_meta(key,value) VALUES(?,?)').run('active_note',first.id);
  } finally {db.close();}
  return filePath;
}
class ProjectStore {
  constructor(filePath,password=null) {
    this.path = filePath;this.encrypted=encryptedFile(filePath);this.password=null;
    // Reject non-SQLite .ns files before opening and never mutate an unrecognized DB.
    const header = Buffer.alloc(16);
    const fd = fs.openSync(filePath,'r');
    try {fs.readSync(fd,header,0,16,0);} finally {fs.closeSync(fd);}
    if(header.toString('utf8')!=='SQLite format 3\u0000'&&!this.encrypted)throw new Error('Неподдерживаемый файл проекта .ns');
    if(this.encrypted&&!password)throw new Error('Требуется пароль');
    if(this.encrypted){this.password=passwordBuffer(password);try{this.db=new CipherDB(filePath,this.password);}catch(e){this.password.fill(0);this.password=null;throw new Error(/locked|busy/i.test(e.message)?'Проект уже открыт или заблокирован':'Неверный пароль или файл поврежден',{cause:e});}}
    else this.db=new DatabaseSync(filePath);
    try {
      const fmt = this.meta('format');
      if (fmt !== FORMAT) throw new Error('Это не проект Nocturne Notes');
      // Validate the required note columns and nonempty project before accepting
      // a file or changing any journal settings. A foreign/corrupt database
      // must never replace the current open project or leave a Windows lock.
      if (!this.db.prepare('SELECT id,title,html,sort_order,updated_at FROM notes LIMIT 1').get())
        throw new Error('Проект не содержит заметок');
    } catch (cause) {
      this.close();
      if(/locked|busy/i.test(String(cause.message)))throw new Error('Проект уже открыт или заблокирован',{cause});
      throw new Error('Это не проект Nocturne Notes или файл поврежден', {cause});
    }
    try {this.db.exec('PRAGMA busy_timeout=0; PRAGMA trusted_schema=OFF; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA locking_mode=EXCLUSIVE; BEGIN EXCLUSIVE; COMMIT;');}
    catch (error) {this.close();if(/locked|busy/i.test(String(error.message)))throw new Error('Проект уже открыт или заблокирован',{cause:error});throw error;}
    try{this.normalizePinnedOrder();}catch(error){this.close();throw error;}
  }
  close() { if(this.db){this.db.close();this.db=null;}if(this.password){this.password.fill(0);this.password=null;} }
  verifyPassword(password){return !!this.password&&Buffer.isBuffer(password)&&password.length===this.password.length&&crypto.timingSafeEqual(password,this.password);}
  meta(key) { const row = this.db.prepare('SELECT value FROM project_meta WHERE key=?').get(key); return row?.value ?? null; }
  setMeta(key,val) { this.db.prepare('INSERT INTO project_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(val)); }
  pinnedIds(){
    const raw=this.meta('pinned_notes');if(raw===null)return new Set();
    let ids;try{ids=JSON.parse(raw);}catch{throw new Error('Некорректные данные закрепления');}
    if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw new Error('Некорректные данные закрепления');
    return new Set(ids);
  }
  orderedIds(){return this.db.prepare('SELECT id FROM notes ORDER BY sort_order,id').all().map(n=>n.id);}
  writeOrder(ids){
    const update=this.db.prepare('UPDATE notes SET sort_order=? WHERE id=?');
    ids.forEach((key,i)=>update.run(i,key));
  }
  // Normalize the pinned note group, preserving relative
  // order inside both groups. No schema change or rewrite of note content.
  normalizePinnedOrder(){
    const pinned=this.pinnedIds();if(!pinned.size)return;
    const current=this.orderedIds();
    const ordered=[...current.filter(id=>pinned.has(id)),...current.filter(id=>!pinned.has(id))];
    if(ordered.some((id,i)=>id!==current[i]))this.transaction(()=>this.writeOrder(ordered));
  }
  setPinned(noteId,pinned){
    return this.transaction(()=>{
      const current=this.orderedIds();
      if(!current.includes(noteId))throw new Error('Заметка не найдена');
      if(typeof pinned!=='boolean')throw new Error('Некорректные данные закрепления');
      const ids=this.pinnedIds(),known=new Set(current);
      if(ids.has(noteId)===pinned)return this.snapshot();
      for(const id of ids)if(!known.has(id))ids.delete(id);
      if(pinned)ids.add(noteId);else ids.delete(noteId);
      const ordered=current.filter(id=>id!==noteId),boundary=ordered.filter(id=>ids.has(id)).length;
      ordered.splice(boundary,0,noteId);
      this.writeOrder(ordered);
      this.setMeta('pinned_notes',JSON.stringify([...ids]));return this.snapshot();
    });
  }
  snapshot() {
    const pinned=this.pinnedIds();
    const notes = this.db.prepare('SELECT id,title,html,sort_order AS sortOrder,updated_at AS updatedAt FROM notes ORDER BY sort_order,id').all().map(n=>pinned.has(n.id)?{...n,pinned:true}:n);
    const selected = this.meta('active_note');
    return {path:this.path, name:path.basename(this.path,'.ns'), encrypted:this.encrypted, notes, activeId:notes.some(n=>n.id===selected) ? selected : notes[0]?.id ?? null};
  }
  addNote(title='Новая заметка') {
    return this.transaction(()=>{
      const order = (this.db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM notes').get()).next;
      const note={id:id(),title,html:'<p></p>',sortOrder:order,updatedAt:Date.now()};
      this.db.prepare('INSERT INTO notes(id,title,html,sort_order,updated_at) VALUES(?,?,?,?,?)').run(note.id,note.title,note.html,order,note.updatedAt);
      this.setMeta('active_note',note.id);
      return note;
    });
  }
  hasNote(noteId){return !!this.db.prepare('SELECT 1 FROM notes WHERE id=?').get(noteId);}
  // Logical copies preserve all project rows, IDs, order, active note and trash.
  // A protected destination is encrypted from its first write; no plaintext temp.
  makeCopy(tmp,password){
    if(exists(tmp))throw new Error('Файл проекта уже существует');
    let target,check;
    const source=this.snapshot(),meta=this.db.prepare('SELECT key,value FROM project_meta ORDER BY key').all();
    const trash=this.hasTrash()?this.db.prepare('SELECT * FROM note_trash ORDER BY id').all():null;
    try{
      newProject(tmp,undefined,password);
      target=new ProjectStore(tmp,password);
      target.transaction(()=>{
        target.db.exec('DELETE FROM notes; DELETE FROM project_meta;');
        const m=target.db.prepare('INSERT INTO project_meta(key,value) VALUES(?,?)');
        for(const row of meta)m.run(row.key,row.value);
        const add=target.db.prepare('INSERT INTO notes VALUES(?,?,?,?,?)');
        for(const n of source.notes)add.run(n.id,n.title,n.html,n.sortOrder,n.updatedAt);
        if(trash){
          target.db.exec('CREATE TABLE note_trash(id TEXT PRIMARY KEY,title TEXT NOT NULL,html TEXT NOT NULL,sort_order INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER NOT NULL)');
          const insert=target.db.prepare('INSERT INTO note_trash VALUES(?,?,?,?,?,?)');
          for(const n of trash)insert.run(n.id,n.title,n.html,n.sort_order,n.updated_at,n.deleted_at);
        }
      });
      const integrity=target.db.prepare('PRAGMA integrity_check').get();
      if(integrity?.integrity_check!=='ok')throw new Error('Проверка проекта не пройдена');
      if(password){const errors=target.db.prepare('PRAGMA cipher_integrity_check').all();if(errors.some(row=>Object.values(row).some(v=>v!=='ok')))throw new Error('Проверка проекта не пройдена');}
      target.close();target=null;
      check=new ProjectStore(tmp,password);
      const actual=check.snapshot();
      if(actual.encrypted!==!!password||JSON.stringify(actual.notes)!==JSON.stringify(source.notes)||actual.activeId!==source.activeId||
         JSON.stringify(check.db.prepare('SELECT key,value FROM project_meta ORDER BY key').all())!==JSON.stringify(meta)||
         JSON.stringify(check.hasTrash()?check.db.prepare('SELECT * FROM note_trash ORDER BY id').all():null)!==JSON.stringify(trash))throw new Error('Проверка проекта не пройдена');
    }finally{check?.close();target?.close();}
  }
  copyTo(file,{overwrite=false,password=this.password}={}){
    if(sameFile(this.path,file))throw new Error('Выберите другое имя файла');
    if(exists(file)&&!overwrite)throw new Error('Файл проекта уже существует');
    assertReplaceable(file);
    const tmp=file+'.'+crypto.randomUUID()+'.tmp';
    try{this.makeCopy(tmp,password);publishCopy(tmp,file,overwrite);}
    finally{if(exists(tmp))fs.unlinkSync(tmp);}
  }
  // Recovery snapshots for protected projects never leave the encrypted DB.
  saveProtectedRecovery(note){
    if(!this.encrypted||!validNote(note)||!this.hasNote(note.id))throw new Error('Некорректный восстановительный черновик');
    this.db.exec('CREATE TABLE IF NOT EXISTS protected_recovery(id TEXT PRIMARY KEY,title TEXT NOT NULL,html TEXT NOT NULL,updated_at INTEGER NOT NULL)');
    this.db.prepare('INSERT INTO protected_recovery VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,html=excluded.html,updated_at=excluded.updated_at').run(note.id,note.title,sanitizeHTML(note.html),Date.now());
  }
  hasProtectedRecovery(){return !!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='protected_recovery'").get();}
  removeProtectedRecovery(id){if(this.hasProtectedRecovery())this.db.prepare('DELETE FROM protected_recovery WHERE id=?').run(id);}
  restoreProtectedRecovery(){
    if(!this.encrypted||!this.hasProtectedRecovery())return 0;
    return this.transaction(()=>{
      let count=0;
      for(const n of this.db.prepare('SELECT * FROM protected_recovery').all()){
        const saved=this.db.prepare('SELECT updated_at FROM notes WHERE id=?').get(n.id);
        if(saved&&n.updated_at>=saved.updated_at&&validNote(n)){this.updateNote(n);count++;}
      }
      this.db.exec('DELETE FROM protected_recovery');return count;
    });
  }
  updateNote({id:noteId,title,html}) {
    if(!validNote({id:noteId,title,html}))throw new Error('Некорректные данные заметки');
    html=sanitizeHTML(html);
    if(html.length>5_000_000)throw new Error('Заметка слишком большая');
    const time=Date.now();
    const info=this.db.prepare('UPDATE notes SET title=?,html=?,updated_at=? WHERE id=?').run(title.trim()||'Без названия',html,time,noteId);
    if(!info.changes) throw new Error('Заметка не найдена');
    return {id:noteId, title:title.trim()||'Без названия',html,updatedAt:time};
  }
  updateNotes(notes) {
    if(!Array.isArray(notes)||!notes.length||!notes.every(validNote)||new Set(notes.map(n=>n.id)).size!==notes.length)throw new Error('Некорректные данные заметки');
    return this.transaction(()=>{
      const saved=notes.map(n=>this.updateNote(n));
      if(this.encrypted)for(const n of saved)this.removeProtectedRecovery(n.id);
      return saved;
    });
  }
  selectNote(noteId) {
    if(!this.db.prepare('SELECT 1 FROM notes WHERE id=?').get(noteId)) throw new Error('Заметка не найдена');
    this.setMeta('active_note',noteId);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {const result=fn();this.db.exec('COMMIT');return result;}
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  duplicateNote(noteId,suffix=' — копия') {
    return this.transaction(()=>{
      const source=this.db.prepare('SELECT * FROM notes WHERE id=?').get(noteId);
      if(!source)throw new Error('Заметка не найдена');
      const note={id:id(),title:source.title.slice(0,250-suffix.length)+suffix,html:source.html,updatedAt:Date.now()};
      const ids=this.orderedIds(),pinned=this.pinnedIds();
      const pos=Math.max(ids.indexOf(noteId)+1,ids.filter(id=>pinned.has(id)).length);ids.splice(pos,0,note.id);
      this.db.prepare('INSERT INTO notes(id,title,html,sort_order,updated_at) VALUES(?,?,?,?,?)').run(note.id,note.title,note.html,pos,note.updatedAt);
      const update=this.db.prepare('UPDATE notes SET sort_order=? WHERE id=?');
      ids.forEach((key,i)=>update.run(i,key));
      this.setMeta('active_note',note.id);return this.snapshot();
    });
  }
  hasTrash(){return !!this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='note_trash'").get();}
  listTrash(){
    if(!this.hasTrash())return [];
    return this.db.prepare('SELECT id,title,deleted_at AS deletedAt FROM note_trash ORDER BY deleted_at DESC,id').all();
  }
  trashNote(noteId){
    return this.transaction(()=>{
      if(this.pinnedIds().has(noteId))throw new Error('Сначала открепите заметку');
      const count=this.db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
      if(count<=1)throw new Error('Нельзя удалить последнюю заметку');
      const note=this.db.prepare('SELECT * FROM notes WHERE id=?').get(noteId);
      if(!note)throw new Error('Заметка не найдена');
      this.db.exec('CREATE TABLE IF NOT EXISTS note_trash(id TEXT PRIMARY KEY,title TEXT NOT NULL,html TEXT NOT NULL,sort_order INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER NOT NULL)');
      this.db.prepare('INSERT INTO note_trash VALUES(?,?,?,?,?,?)').run(note.id,note.title,note.html,note.sort_order,note.updated_at,Date.now());
      this.db.prepare('DELETE FROM notes WHERE id=?').run(noteId);
      if(this.encrypted)this.removeProtectedRecovery(noteId);
      if(this.meta('active_note')===noteId)this.setMeta('active_note',this.db.prepare('SELECT id FROM notes ORDER BY sort_order,id LIMIT 1').get().id);
      return this.snapshot();
    });
  }
  restoreTrash(noteId){
    return this.transaction(()=>{
      if(!this.hasTrash())throw new Error('Корзина пуста');
      const n=this.db.prepare('SELECT * FROM note_trash WHERE id=?').get(noteId);
      if(!n)throw new Error('Заметка не найдена');
      const ids=this.orderedIds(),pinned=this.pinnedIds();
      // Restored notes are ordinary; discard inconsistent pin metadata.
      if(pinned.delete(n.id))this.setMeta('pinned_notes',JSON.stringify([...pinned]));
      const pos=Math.max(ids.filter(id=>pinned.has(id)).length,Math.min(ids.length,n.sort_order));ids.splice(pos,0,n.id);
      this.db.prepare('INSERT INTO notes VALUES(?,?,?,?,?)').run(n.id,n.title,n.html,pos,n.updated_at);
      const update=this.db.prepare('UPDATE notes SET sort_order=? WHERE id=?');
      ids.forEach((key,i)=>update.run(i,key));
      this.db.prepare('DELETE FROM note_trash WHERE id=?').run(noteId);
      if(this.encrypted)this.removeProtectedRecovery(noteId);
      this.setMeta('active_note',n.id);return this.snapshot();
    });
  }
  purgeTrash(noteId){
    if(!this.hasTrash())return;
    this.transaction(()=>{if(noteId===null)this.db.exec('DELETE FROM note_trash');else this.db.prepare('DELETE FROM note_trash WHERE id=?').run(noteId);});
  }
  reorder(ids) {
    if(!Array.isArray(ids)) throw new Error('Некорректный порядок заметок');
    this.transaction(()=>{
      const current=this.db.prepare('SELECT id FROM notes ORDER BY sort_order,id').all().map(n=>n.id),known=new Set(current);
      if(ids.length!==current.length||new Set(ids).size!==ids.length||!ids.every(i=>known.has(i)))throw new Error('Некорректный порядок заметок');
      const pinned=this.pinnedIds(),prefix=current.filter(id=>pinned.has(id));
      if(prefix.some((id,i)=>ids[i]!==id))throw new Error('Сначала открепите заметку');
      this.writeOrder(ids);
    });
  }
}
module.exports={ProjectStore,newProject,exists,FORMAT,encryptedFile,sameFile,assertReplaceable,publishCopy};
