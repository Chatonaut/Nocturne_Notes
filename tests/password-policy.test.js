'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {valid}=require('../ipc-contract'),{text}=require('../i18n');
test('new password policy accepts eight Unicode code points and rejects seven',()=>{
 for(const pass of ['1234567','😀'.repeat(7),'']){
  assert.equal(valid('protect-project',pass),false);
  assert.equal(valid('change-password',{current:'old password',password:pass}),false);
 }
 for(const pass of ['12345678','пароль12','😀'.repeat(8),'previous-long-password']){
  assert.equal(valid('protect-project',pass),true);
  assert.equal(valid('change-password',{current:'old password',password:pass}),true);
 }
 assert.equal(valid('protect-project','😀'.repeat(1025)),false);
 assert.equal(valid('unlock-project',{token:'x',password:'previous-long-password'}),true);
 assert.equal(valid('remove-protection','previous-long-password'),true);
});
test('password hints and protection submenu are bilingual',()=>{
 for(const [ru,en] of [['Установить пароль','Set password'],['Заблокировать','Lock'],['Разблокировать','Unlock'],['Изменить пароль','Change password'],['Удалить пароль','Remove password'],['Не менее 8 символов','At least 8 characters'],['Не менее 8 символов. При потере пароля доступ невозможен','At least 8 characters. A lost password cannot be recovered']]){
  assert.equal(text('en',ru),en);assert.equal(text('ru',ru),ru);
 }
});

test('localized dialog instructions omit sentence-ending periods without losing content',()=>{
 for(const [ru,en] of [['Все удаленные заметки будут удалены окончательно','All notes in Trash will be permanently deleted'],['Не менее 8 символов. При потере пароля доступ невозможен','At least 8 characters. A lost password cannot be recovered'],['Проект станет доступен без пароля','The project will be accessible without a password'],['Экспортируемый файл не защищен паролем','The exported file will not be password protected'],['Интерфейс не смог запуститься. Попробуйте открыть приложение снова','The interface could not start. Try opening the app again'],['Не удалось открыть JSON-файл предварительной версии. Файлы .ns открываются в версии для Windows','Could not open the preview JSON file. Open .ns files in the Windows app']]){assert.equal(text('en',ru),en);assert.equal(text('ru',ru),ru);assert.ok(!/[.]$/.test(ru)&&!/[.]$/.test(en));}
});
