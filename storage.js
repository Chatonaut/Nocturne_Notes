'use strict';
// SQLite file format for .ns projects. No runtime third-party module is required;
// Node 22+ (bundled with Electron 39) provides node:sqlite.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');
const FORMAT = 'nocturne-notes-v1';
const LEGACY_FORMAT = 'glass-notes-v1'; // Historical SQLite marker: read-only compatibility with older .ns files.

function id() { return crypto.randomUUID(); }
function exists(filePath) { return fs.existsSync(filePath); }
function newProject(filePath, notes = [{title:'Без названия',html:'<p></p>'}]) {
  fs.mkdirSync(path.dirname(filePath), {recursive:true});
  if (fs.existsSync(filePath)) throw new Error('Файл проекта уже существует');
  const db = new DatabaseSync(filePath);
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
      entries.forEach((n,i)=>insert.run(id(),n.title,n.html,i,Date.now()));
      db.exec('COMMIT');
    } catch (error) {db.exec('ROLLBACK');throw error;}
    const first = db.prepare('SELECT id FROM notes ORDER BY sort_order LIMIT 1').get();
    db.prepare('INSERT INTO project_meta(key,value) VALUES(?,?)').run('active_note',first.id);
  } finally {db.close();}
  return filePath;
}
class ProjectStore {
  constructor(filePath) {
    this.path = filePath;
    // Reject non-SQLite .ns files before opening and never mutate an unrecognized DB.
    const header = Buffer.alloc(16);
    const fd = fs.openSync(filePath,'r');
    try {fs.readSync(fd,header,0,16,0);} finally {fs.closeSync(fd);}
    if (header.toString('utf8') !== 'SQLite format 3\u0000') throw new Error('Неподдерживаемый файл проекта .ns');
    this.db = new DatabaseSync(filePath);
    try {
      const fmt = this.meta('format');
      if (fmt !== FORMAT && fmt !== LEGACY_FORMAT) throw new Error('Это не проект Nocturne Notes');
      // Validate the required note columns and nonempty project before accepting
      // a file or changing any journal settings. A foreign/corrupt database
      // must never replace the current open project or leave a Windows lock.
      if (!this.db.prepare('SELECT id,title,html,sort_order,updated_at FROM notes LIMIT 1').get())
        throw new Error('Проект не содержит заметок');
    } catch (cause) {
      this.close();
      throw new Error('Это не проект Nocturne Notes или файл поврежден', {cause});
    }
    try {this.db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');}
    catch (error) {this.close();throw error;}
  }
  close() { if(this.db) {this.db.close(); this.db=null;} }
  meta(key) { const row = this.db.prepare('SELECT value FROM project_meta WHERE key=?').get(key); return row?.value ?? null; }
  setMeta(key,val) { this.db.prepare('INSERT INTO project_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,String(val)); }
  snapshot() {
    const notes = this.db.prepare('SELECT id,title,html,sort_order AS sortOrder,updated_at AS updatedAt FROM notes ORDER BY sort_order,id').all();
    const selected = this.meta('active_note');
    return {path:this.path, name:path.basename(this.path,'.ns'), notes, activeId:notes.some(n=>n.id===selected) ? selected : notes[0]?.id ?? null};
  }
  addNote(title='Новая заметка') {
    const order = (this.db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM notes').get()).next;
    const note={id:id(),title,html:'<p></p>',sortOrder:order,updatedAt:Date.now()};
    this.db.prepare('INSERT INTO notes(id,title,html,sort_order,updated_at) VALUES(?,?,?,?,?)').run(note.id,note.title,note.html,order,note.updatedAt);
    this.setMeta('active_note',note.id);
    return note;
  }
  updateNote({id:noteId,title,html}) {
    if(!noteId || typeof title!=='string' || typeof html!=='string') throw new Error('Некорректные данные заметки');
    if(title.length>250 || html.length>5_000_000) throw new Error('Заметка слишком большая');
    const time=Date.now();
    const info=this.db.prepare('UPDATE notes SET title=?,html=?,updated_at=? WHERE id=?').run(title.trim()||'Без названия',html,time,noteId);
    if(!info.changes) throw new Error('Заметка не найдена');
    return {id:noteId, title:title.trim()||'Без названия',html,updatedAt:time};
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
      const ids=this.db.prepare('SELECT id FROM notes ORDER BY sort_order,id').all().map(n=>n.id);
      const pos=ids.indexOf(noteId)+1;ids.splice(pos,0,note.id);
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
      const count=this.db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
      if(count<=1)throw new Error('Нельзя удалить последнюю заметку');
      const note=this.db.prepare('SELECT * FROM notes WHERE id=?').get(noteId);
      if(!note)throw new Error('Заметка не найдена');
      this.db.exec('CREATE TABLE IF NOT EXISTS note_trash(id TEXT PRIMARY KEY,title TEXT NOT NULL,html TEXT NOT NULL,sort_order INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER NOT NULL)');
      this.db.prepare('INSERT INTO note_trash VALUES(?,?,?,?,?,?)').run(note.id,note.title,note.html,note.sort_order,note.updated_at,Date.now());
      this.db.prepare('DELETE FROM notes WHERE id=?').run(noteId);
      if(this.meta('active_note')===noteId)this.setMeta('active_note',this.db.prepare('SELECT id FROM notes ORDER BY sort_order,id LIMIT 1').get().id);
      return this.snapshot();
    });
  }
  restoreTrash(noteId){
    return this.transaction(()=>{
      if(!this.hasTrash())throw new Error('Корзина пуста');
      const n=this.db.prepare('SELECT * FROM note_trash WHERE id=?').get(noteId);
      if(!n)throw new Error('Заметка не найдена');
      const ids=this.db.prepare('SELECT id FROM notes ORDER BY sort_order,id').all().map(x=>x.id);
      const pos=Math.max(0,Math.min(ids.length,n.sort_order));ids.splice(pos,0,n.id);
      this.db.prepare('INSERT INTO notes VALUES(?,?,?,?,?)').run(n.id,n.title,n.html,pos,n.updated_at);
      const update=this.db.prepare('UPDATE notes SET sort_order=? WHERE id=?');
      ids.forEach((key,i)=>update.run(i,key));
      this.db.prepare('DELETE FROM note_trash WHERE id=?').run(noteId);
      this.setMeta('active_note',n.id);return this.snapshot();
    });
  }
  purgeTrash(noteId){
    if(!this.hasTrash())return;
    this.transaction(()=>{if(noteId===null)this.db.exec('DELETE FROM note_trash');else this.db.prepare('DELETE FROM note_trash WHERE id=?').run(noteId);});
  }
  reorder(ids) {
    if(!Array.isArray(ids)) throw new Error('Некорректный порядок заметок');
    const current=this.db.prepare('SELECT id FROM notes').all().map(n=>n.id);
    if(ids.length!==current.length || new Set(ids).size!==ids.length || !ids.every(i=>current.includes(i))) throw new Error('Некорректный порядок заметок');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const q=this.db.prepare('UPDATE notes SET sort_order=? WHERE id=?');
      ids.forEach((v,i)=>q.run(i,v));
      this.db.exec('COMMIT');
    } catch(e){this.db.exec('ROLLBACK');throw e;}
  }
}
module.exports={ProjectStore,newProject,exists,FORMAT};
