export interface NotePayload { id: string; title: string; html: string; }
export interface Note extends NotePayload { sortOrder: number; updatedAt: number; pinned?:boolean; }
export interface Project { path: string; name: string; notes: Note[]; activeId: string | null; isDraft?: boolean; encrypted?: boolean; locked?: boolean; }
export interface Settings { language: 'en'|'ru'; minimizeToTray: boolean; editorFont: string; fontSize: number; titleSize: number; lineHeight: number; autosaveMs: number; restoreLastProject: boolean; sidebarWidth: number; formatToolbarEnabled: boolean; saveIndicatorsEnabled: boolean; spellcheckEnabled: boolean; }
export type SettingsPatch=Partial<Settings>;
export interface PasswordRequest { passwordRequired: true; token:string; name:string; }
export interface Bootstrap { pendingOpen?: PasswordRequest|null; project: Project; sidebarCollapsed: boolean; recent: string[]; settings: Settings; }
export interface RecoveryDraft extends NotePayload { updatedAt: number; }
export interface DesktopAPI {
 isDesktop: true; bootstrap(): Promise<Bootstrap>; updateSettings(s:SettingsPatch):Promise<Settings>;
 saveRecoveryDraft(n:NotePayload):Promise<boolean>; updateNote(n:NotePayload):Promise<NotePayload & {updatedAt:number}>; updateNotes(notes:NotePayload[]):Promise<Array<NotePayload & {updatedAt:number}>>;
 createProject():Promise<Project|null>; onDraftDecision(fn:(request:{token:string})=>void):void; respondDraft(request:{token:string;choice:'save'|'discard'|'cancel'}):Promise<boolean>; openProject():Promise<Project|PasswordRequest|null>; openRecent(p:string):Promise<Project|PasswordRequest|null>; openExternal():Promise<Project|PasswordRequest|null>;
 selectNote(id:string):Promise<boolean>; reorderNotes(ids:string[]):Promise<boolean>;
 createNote():Promise<Note>; deleteNote(id:string):Promise<Project>; duplicateNote(id:string):Promise<Project>; setNotePinned(id:string,pinned:boolean):Promise<Project>;
 restoreTrash(id:string):Promise<Project>; purgeTrash(id:string|null):Promise<boolean>;
 alwaysOnTop(v:boolean):Promise<boolean>; setSidebarCollapsed(v:boolean):Promise<boolean>;
 exportNote(id:string,format:'txt'|'html'|'md',confirmPlaintext?:boolean):Promise<string|null>;
 unlockProject(request:{token:string;password:string}):Promise<Project>; cancelUnlock(token:string):Promise<boolean>;
 protectProject(password:string):Promise<Project>; changePassword(request:{current:string;password:string}):Promise<Project>; removeProtection(password:string):Promise<Project>; lockProject():Promise<{project:Project;request:PasswordRequest}>;
}
