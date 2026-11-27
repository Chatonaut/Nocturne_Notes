{
  "variables": {
    "openssl_dir": "<!(node -p \"process.env.NOCTURNE_OPENSSL_DIR || ''\")"
  },
  "targets": [
    {
      "target_name": "nocturne_cipher",
      "sources": [
        "cipher.cc",
        "vendor/sqlite3.c"
      ],
      "include_dirs": [
        "vendor",
        "<(openssl_dir)/include"
      ],
      "defines": [
        "NAPI_VERSION=8",
        "SQLITE_HAS_CODEC",
        "SQLITE_EXTRA_INIT=sqlcipher_extra_init",
        "SQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown",
        "SQLITE_TEMP_STORE=3",
        "SQLCIPHER_CRYPTO_OPENSSL",
        "SQLITE_THREADSAFE=1",
        "SQLITE_OMIT_LOAD_EXTENSION",
        "SQLITE_DQS=0"
      ],
      "libraries": [
        "<(openssl_dir)/lib/libcrypto.lib",
        "crypt32.lib",
        "bcrypt.lib",
        "ws2_32.lib",
        "advapi32.lib",
        "user32.lib"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": [
            "/utf-8"
          ]
        }
      },
      "configurations": {
        "Release": {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "RuntimeLibrary": 0
            }
          }
        }
      },
      "win_delay_load_hook": "true"
    }
  ]
}
