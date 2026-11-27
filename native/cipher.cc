// Narrow synchronous Node-API binding to the pinned SQLCipher amalgamation.
// Passwords are bytes passed to sqlite3_key, never SQL or a command line.
#include <node_api.h>
#include "sqlite3.h"
#include <string>
#include <vector>
#include <cmath>
#include <memory>
struct Handle { sqlite3* db=nullptr; };
static napi_value fail(napi_env e,const char* m){napi_throw_error(e,nullptr,m);return nullptr;}
static napi_value undef(napi_env e){napi_value v;napi_get_undefined(e,&v);return v;}
static bool str(napi_env e,napi_value v,std::string& s){
 size_t n=0;if(napi_get_value_string_utf8(e,v,nullptr,0,&n)!=napi_ok)return false;
 std::vector<char> b(n+1);size_t written=0;
 if(napi_get_value_string_utf8(e,v,b.data(),b.size(),&written)!=napi_ok)return false;
 s.assign(b.data(),written);return true;
}
static void finalize(napi_env,void* p,void*){auto h=static_cast<Handle*>(p);if(h->db)sqlite3_close_v2(h->db);delete h;}
static Handle* handle(napi_env e,napi_value v){void* p=nullptr;if(napi_get_value_external(e,v,&p)!=napi_ok||!p)return nullptr;return static_cast<Handle*>(p);}
static napi_value openDb(napi_env e,napi_callback_info info){
 size_t n=3;napi_value a[3];napi_get_cb_info(e,info,&n,a,nullptr,nullptr);
 std::string file;void* key=nullptr;size_t len=0;bool create=false;
 if(n!=3||!str(e,a[0],file)||file.find('\0')!=std::string::npos||napi_get_buffer_info(e,a[1],&key,&len)!=napi_ok||len==0||len>4096||napi_get_value_bool(e,a[2],&create)!=napi_ok)return fail(e,"Invalid database arguments");
 auto h=std::make_unique<Handle>();int rc=sqlite3_open_v2(file.c_str(),&h->db,SQLITE_OPEN_READWRITE|(create?SQLITE_OPEN_CREATE:0)|SQLITE_OPEN_FULLMUTEX,nullptr);
 if(rc==SQLITE_OK)rc=sqlite3_key(h->db,key,static_cast<int>(len));
 if(rc==SQLITE_OK)rc=sqlite3_exec(h->db,"PRAGMA temp_store=MEMORY; PRAGMA trusted_schema=OFF; PRAGMA cipher_memory_security=ON;",nullptr,nullptr,nullptr);
 if(rc==SQLITE_OK)rc=sqlite3_exec(h->db,"SELECT count(*) FROM sqlite_master;",nullptr,nullptr,nullptr);
 if(rc!=SQLITE_OK){if(h->db)sqlite3_close_v2(h->db);return fail(e,rc==SQLITE_BUSY||rc==SQLITE_LOCKED?"Database locked":"Cannot open encrypted database");}
 if(sqlite3_db_config(h->db,SQLITE_DBCONFIG_DEFENSIVE,1,nullptr)!=SQLITE_OK){
  sqlite3_close_v2(h->db);return fail(e,"Cannot enable defensive database configuration");
 }
 sqlite3_busy_timeout(h->db,0);
 napi_value out;if(napi_create_external(e,h.get(),finalize,nullptr,&out)!=napi_ok){sqlite3_close_v2(h->db);return fail(e,"Native handle creation failed");}
 h.release();return out;
}
static napi_value closeDb(napi_env e,napi_callback_info info){
 size_t n=1;napi_value a[1];napi_get_cb_info(e,info,&n,a,nullptr,nullptr);auto h=n==1?handle(e,a[0]):nullptr;
 if(h&&h->db){if(sqlite3_close(h->db)!=SQLITE_OK)return fail(e,"Database close failed");h->db=nullptr;}return undef(e);
}
static napi_value execDb(napi_env e,napi_callback_info info){
 size_t n=2;napi_value a[2];napi_get_cb_info(e,info,&n,a,nullptr,nullptr);auto h=n==2?handle(e,a[0]):nullptr;std::string sql;
 if(!h||!h->db||!str(e,a[1],sql)||sql.find('\0')!=std::string::npos)return fail(e,"Invalid SQL");
 if(sqlite3_exec(h->db,sql.c_str(),nullptr,nullptr,nullptr)!=SQLITE_OK)return fail(e,sqlite3_errmsg(h->db));
 return undef(e);
}
static napi_value cell(napi_env e,sqlite3_stmt* s,int i){
 napi_value v;switch(sqlite3_column_type(s,i)){
 case SQLITE_NULL:napi_get_null(e,&v);break;
 case SQLITE_INTEGER:napi_create_double(e,static_cast<double>(sqlite3_column_int64(s,i)),&v);break;
 case SQLITE_FLOAT:napi_create_double(e,sqlite3_column_double(s,i),&v);break;
 case SQLITE_BLOB:napi_create_buffer_copy(e,sqlite3_column_bytes(s,i),sqlite3_column_blob(s,i),nullptr,&v);break;
 default:{const unsigned char* p=sqlite3_column_text(s,i);napi_create_string_utf8(e,reinterpret_cast<const char*>(p),sqlite3_column_bytes(s,i),&v);break;}
 }return v;
}
static napi_value query(napi_env e,napi_callback_info info){
 size_t n=4;napi_value a[4];napi_get_cb_info(e,info,&n,a,nullptr,nullptr);auto h=n==4?handle(e,a[0]):nullptr;std::string sql,mode;bool arr=false;
 if(!h||!h->db||!str(e,a[1],sql)||sql.find('\0')!=std::string::npos||napi_is_array(e,a[2],&arr)!=napi_ok||!arr||!str(e,a[3],mode))return fail(e,"Invalid query");
 if(mode!="run"&&mode!="get"&&mode!="all")return fail(e,"Invalid query mode");
 sqlite3_stmt* raw=nullptr;const char* tail=nullptr;
 if(sqlite3_prepare_v2(h->db,sql.c_str(),-1,&raw,&tail)!=SQLITE_OK||!raw){if(raw)sqlite3_finalize(raw);return fail(e,sqlite3_errmsg(h->db));}
 std::unique_ptr<sqlite3_stmt,decltype(&sqlite3_finalize)> s(raw,sqlite3_finalize);
 uint32_t count=0;napi_get_array_length(e,a[2],&count);
 if(count!=static_cast<uint32_t>(sqlite3_bind_parameter_count(raw)))return fail(e,"Incorrect SQL parameter count");
 for(uint32_t i=0;i<count;i++){
  napi_value v;napi_get_element(e,a[2],i,&v);napi_valuetype t;napi_typeof(e,v,&t);int rc=SQLITE_MISMATCH;
  if(t==napi_null)rc=sqlite3_bind_null(raw,i+1);
  else if(t==napi_string){std::string x;if(str(e,v,x))rc=sqlite3_bind_text(raw,i+1,x.data(),static_cast<int>(x.size()),SQLITE_TRANSIENT);}
  else if(t==napi_number){double x;napi_get_value_double(e,v,&x);if(std::isfinite(x))rc=(std::floor(x)==x&&std::abs(x)<=9007199254740991.0)?sqlite3_bind_int64(raw,i+1,static_cast<sqlite3_int64>(x)):sqlite3_bind_double(raw,i+1,x);}
  else if(t==napi_object){bool b=false;napi_is_buffer(e,v,&b);if(b){void* p;size_t size;napi_get_buffer_info(e,v,&p,&size);rc=sqlite3_bind_blob64(raw,i+1,p,size,SQLITE_TRANSIENT);}}
  if(rc!=SQLITE_OK)return fail(e,"Invalid SQL parameter");
 }
 napi_value out;if(mode=="all")napi_create_array(e,&out);else out=undef(e);uint32_t row=0;int rc;
 while((rc=sqlite3_step(raw))==SQLITE_ROW){
  if(mode=="run")continue;
  napi_value obj;napi_create_object(e,&obj);
  for(int i=0;i<sqlite3_column_count(raw);i++){napi_value k;napi_create_string_utf8(e,sqlite3_column_name(raw,i),NAPI_AUTO_LENGTH,&k);napi_set_property(e,obj,k,cell(e,raw,i));}
  if(mode=="get"){if(row++==0)out=obj;}else napi_set_element(e,out,row++,obj);
 }
 if(rc!=SQLITE_DONE)return fail(e,sqlite3_errmsg(h->db));
 if(mode=="run"){napi_create_object(e,&out);napi_value changes;napi_create_int64(e,sqlite3_changes64(h->db),&changes);napi_set_named_property(e,out,"changes",changes);}
 return out;
}
static napi_value init(napi_env e,napi_value exports){
 napi_property_descriptor p[]={{"open",nullptr,openDb,nullptr,nullptr,nullptr,napi_default,nullptr},{"close",nullptr,closeDb,nullptr,nullptr,nullptr,napi_default,nullptr},{"exec",nullptr,execDb,nullptr,nullptr,nullptr,napi_default,nullptr},{"query",nullptr,query,nullptr,nullptr,nullptr,napi_default,nullptr}};
 napi_define_properties(e,exports,4,p);return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,init)
