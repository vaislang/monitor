/*
 * monitor_runtime.c — Vais monitor-server runtime functions
 *
 * Implements all external (X F) functions declared in runtime.vais
 * that are NOT handled by pure-vais (see ROADMAP Phase 2 #12 A1)
 * or by std library wrappers (see ROADMAP Phase 2 #14 B2_wrapper).
 *
 * ABI note: vaisc generates i8* (null-terminated C string) for all str
 * arguments and return values in this project (confirmed from main_runtime.ll).
 * Fat-pointer (vais_str_t) is NOT used here.
 *
 * Groups (이 파일은 여러 C tasks #16~#20에 걸쳐 append됨):
 *   C1 (이 섹션): io/socket — server_listen/stop, println, read_file/write_file, sleep_ms, env_get
 *   C2: db (sqlite3) — db_* 9 symbols
 *   C3: random/uuid — random_i64/f64, generate_uuid
 *   C4: crypto/jwt (OpenSSL) — hash_password, verify_password, jwt_encode/decode
 *   C5: json — json_parse/stringify/get/set
 */

#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <unistd.h>
#include <signal.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <time.h>
#include <strings.h>  /* strncasecmp */
#include <sqlite3.h>

/* =========================================================================
 * Forward declarations of vaisc-generated functions
 * (signatures confirmed from main_dispatcher.ll and main_runtime.ll)
 * ========================================================================= */

/* dispatch_handler: declared as i8* @dispatch_handler(i8*, i8*, i8*, i8*)
 * args: method, path, headers, body — all null-terminated C strings
 * returns: null-terminated JSON response string (malloc'd by Vais GC) */
extern char *dispatch_handler(const char *method, const char *path,
                               const char *headers, const char *body);

/* =========================================================================
 * C1: io / socket
 * ========================================================================= */

/* ---------- Shutdown flag (server_stop / signal handler) ------------------ */

static volatile sig_atomic_t g_shutdown = 0;

static void handle_signal(int sig) {
    (void)sig;
    g_shutdown = 1;
}

/* =========================================================================
 * server_stop — set g_shutdown flag
 * LLVM decl: declare void @server_stop()
 * ========================================================================= */
void server_stop(void) {
    g_shutdown = 1;
}

/* ---------- HTTP parsing helpers ----------------------------------------- */

static void parse_request_line(const char *line,
                                char **method_out,
                                char **path_out,
                                char **query_out) {
    *method_out = strdup("GET");
    *path_out   = strdup("/");
    *query_out  = strdup("");

    char buf[4096];
    strncpy(buf, line, sizeof(buf) - 1);
    buf[sizeof(buf) - 1] = '\0';

    char *end = buf + strlen(buf) - 1;
    while (end >= buf && (*end == '\r' || *end == '\n')) *end-- = '\0';

    char *save = NULL;
    char *tok  = strtok_r(buf, " ", &save);
    if (!tok) return;
    free(*method_out);
    *method_out = strdup(tok);

    tok = strtok_r(NULL, " ", &save);
    if (!tok) return;

    char *q = strchr(tok, '?');
    if (q) {
        free(*query_out);
        *query_out = strdup(q + 1);
        *q = '\0';
    }
    free(*path_out);
    *path_out = strdup(tok);
}

static char *build_http_response(int status, const char *content_type,
                                  const char *body) {
    if (!body)          body         = "";
    if (!content_type)  content_type = "application/json";

    const char *status_text = "OK";
    if      (status == 201) status_text = "Created";
    else if (status == 204) status_text = "No Content";
    else if (status == 400) status_text = "Bad Request";
    else if (status == 401) status_text = "Unauthorized";
    else if (status == 403) status_text = "Forbidden";
    else if (status == 404) status_text = "Not Found";
    else if (status == 405) status_text = "Method Not Allowed";
    else if (status == 409) status_text = "Conflict";
    else if (status == 500) status_text = "Internal Server Error";

    size_t body_len  = strlen(body);
    size_t buf_size  = body_len + 512;
    char  *response  = malloc(buf_size);
    if (!response) return NULL;

    snprintf(response, buf_size,
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %zu\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
        "Connection: close\r\n"
        "\r\n"
        "%s",
        status, status_text, content_type, body_len, body);

    return response;
}

/* =========================================================================
 * server_listen — HTTP server main loop
 * LLVM decl: declare void @server_listen(i8*, i64)
 * ========================================================================= */
void server_listen(const char *host, int64_t port) {
    /* Install signal handlers so g_shutdown gets set on Ctrl-C / SIGTERM */
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = handle_signal;
    sigemptyset(&sa.sa_mask);
    sigaction(SIGINT,  &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("[monitor-runtime] socket");
        exit(1);
    }

    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port   = htons((uint16_t)port);

    if (!host || host[0] == '\0' || strcmp(host, "0.0.0.0") == 0) {
        addr.sin_addr.s_addr = INADDR_ANY;
    } else {
        if (inet_pton(AF_INET, host, &addr.sin_addr) <= 0) {
            fprintf(stderr, "[monitor-runtime] invalid host: %s\n", host);
            close(server_fd);
            exit(1);
        }
    }

    if (bind(server_fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
        if (errno == EADDRINUSE) {
            fprintf(stderr, "[monitor-runtime] port %lld already in use\n",
                    (long long)port);
        } else {
            perror("[monitor-runtime] bind");
        }
        close(server_fd);
        exit(1);
    }

    if (listen(server_fd, 128) < 0) {
        perror("[monitor-runtime] listen");
        close(server_fd);
        exit(1);
    }

    printf("[monitor-runtime] HTTP server listening on %s:%lld\n",
           host ? host : "0.0.0.0", (long long)port);
    fflush(stdout);

    /* Set server socket non-blocking so accept() doesn't block forever
     * when g_shutdown is set. */
    fcntl(server_fd, F_SETFL, O_NONBLOCK);

    char req_buf[65536];

    while (!g_shutdown) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        int client_fd = accept(server_fd, (struct sockaddr *)&client_addr,
                               &client_len);
        if (client_fd < 0) {
            if (errno == EAGAIN || errno == EWOULDBLOCK) {
                /* No connection ready; sleep briefly and re-check shutdown */
                struct timespec ts = { 0, 10000000L }; /* 10ms */
                nanosleep(&ts, NULL);
                continue;
            }
            if (errno == EINTR) continue;
            perror("[monitor-runtime] accept");
            continue;
        }

        ssize_t nread = read(client_fd, req_buf, sizeof(req_buf) - 1);
        if (nread <= 0) {
            close(client_fd);
            continue;
        }
        req_buf[nread] = '\0';

        /* Parse request line */
        char *method = NULL, *path = NULL, *query = NULL;
        parse_request_line(req_buf, &method, &path, &query);

        /* Parse headers (collect Authorization header for auth_guard) */
        char headers_buf[4096] = "";
        {
            char *p = strchr(req_buf, '\n');
            if (p) p++;
            while (p && *p && !(*p == '\r' && *(p+1) == '\n') && *p != '\n') {
                char *nl = strchr(p, '\n');
                size_t line_len = nl ? (size_t)(nl - p) : strlen(p);
                /* Accumulate all headers as a simple key:value\n block */
                size_t cur = strlen(headers_buf);
                if (cur + line_len + 2 < sizeof(headers_buf)) {
                    strncat(headers_buf, p, line_len);
                    headers_buf[cur + line_len] = '\n';
                    headers_buf[cur + line_len + 1] = '\0';
                }
                p = nl ? nl + 1 : NULL;
            }
        }

        /* Extract body (after blank line) */
        const char *body_str = "";
        char *body_start = strstr(req_buf, "\r\n\r\n");
        if (!body_start) body_start = strstr(req_buf, "\n\n");
        if (body_start) {
            body_start += (body_start[0] == '\r') ? 4 : 2;
            body_str = body_start;
        }

        /* CORS preflight */
        if (strcmp(method, "OPTIONS") == 0) {
            const char *preflight =
                "HTTP/1.1 204 No Content\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS\r\n"
                "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
                "Content-Length: 0\r\n"
                "Connection: close\r\n"
                "\r\n";
            write(client_fd, preflight, strlen(preflight));
            close(client_fd);
            free(method); free(path); free(query);
            continue;
        }

        /* Call vaisc-generated dispatch_handler(method, path, headers, body) */
        char *resp_json = dispatch_handler(method, path, headers_buf, body_str);

        /* Build HTTP response — dispatch_handler returns JSON string */
        const char *resp_body = (resp_json && resp_json[0]) ? resp_json : "{}";
        char *http_response = build_http_response(200, "application/json", resp_body);

        if (http_response) {
            write(client_fd, http_response, strlen(http_response));
            free(http_response);
        }

        close(client_fd);
        free(method);
        free(path);
        free(query);
    }

    printf("[monitor-runtime] server shutting down\n");
    close(server_fd);
}

/* =========================================================================
 * println — print a C string followed by newline
 * LLVM decl: declare void @println(i8*, ...)
 * Called from Vais as: println(some_str)  — str is passed as i8*
 * ========================================================================= */
void println(const char *s, ...) {
    if (s) {
        fputs(s, stdout);
    }
    fputc('\n', stdout);
    fflush(stdout);
}

/* =========================================================================
 * read_file — read entire file into a malloc'd null-terminated string
 * LLVM decl: declare i8* @read_file(i8*)
 * ========================================================================= */
char *read_file(const char *path) {
    if (!path) {
        char *empty = malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    FILE *f = fopen(path, "rb");
    if (!f) {
        fprintf(stderr, "[monitor-runtime] read_file: cannot open '%s': %s\n",
                path, strerror(errno));
        char *empty = malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    if (fseek(f, 0, SEEK_END) != 0) {
        fclose(f);
        char *empty = malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    long size = ftell(f);
    if (size < 0) {
        fclose(f);
        char *empty = malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    fseek(f, 0, SEEK_SET);

    char *buf = malloc((size_t)(size + 1));
    if (!buf) {
        fclose(f);
        return NULL;
    }

    size_t nread = fread(buf, 1, (size_t)size, f);
    buf[nread] = '\0';
    fclose(f);
    return buf;
}

/* =========================================================================
 * write_file — write bytes to a file (overwrite)
 * LLVM decl: declare void @write_file(i8*, i8*)
 * ========================================================================= */
void write_file(const char *path, const char *content) {
    if (!path) {
        fprintf(stderr, "[monitor-runtime] write_file: null path\n");
        return;
    }

    FILE *f = fopen(path, "wb");
    if (!f) {
        fprintf(stderr, "[monitor-runtime] write_file: cannot open '%s': %s\n",
                path, strerror(errno));
        return;
    }

    if (content) {
        size_t len = strlen(content);
        if (len > 0) {
            size_t nwritten = fwrite(content, 1, len, f);
            if (nwritten != len) {
                fprintf(stderr, "[monitor-runtime] write_file: partial write to '%s'\n",
                        path);
            }
        }
    }

    fclose(f);
}

/* =========================================================================
 * sleep_ms — sleep for ms milliseconds (POSIX nanosleep for full range)
 * LLVM decl: declare void @sleep_ms(i64)
 * ========================================================================= */
void sleep_ms(int64_t ms) {
    if (ms <= 0) return;

    struct timespec ts;
    ts.tv_sec  = (time_t)(ms / 1000);
    ts.tv_nsec = (long)((ms % 1000) * 1000000L);
    nanosleep(&ts, NULL);
}

/* =========================================================================
 * env_get — get environment variable value as malloc'd C string
 * LLVM decl: declare i8* @env_get(i8*)
 * Returns malloc'd copy; caller owns. Returns "" (not NULL) if not set.
 * ========================================================================= */
char *env_get(const char *key) {
    if (!key) {
        char *empty = malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    const char *value = getenv(key);
    if (!value) {
        char *empty = malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    return strdup(value);
}

/* ====================== C2: db (sqlite3) ====================== */

/* ---------- Global state -------------------------------------------------- */

static sqlite3 *g_db = NULL;

static struct {
    char         *name;
    sqlite3_stmt *stmt;
} g_prepared[64];
static int g_prepared_count = 0;

/* ---------- Growable string buffer (shared by db_query) ------------------- */

typedef struct {
    char  *data;
    size_t len;
    size_t cap;
} C2GrowBuf;

static void c2_gb_init(C2GrowBuf *g) {
    g->cap  = 256;
    g->data = malloc(g->cap);
    if (g->data) g->data[0] = '\0';
    g->len  = 0;
}

static void c2_gb_append(C2GrowBuf *g, const char *s) {
    if (!s || !g->data) return;
    size_t slen = strlen(s);
    while (g->len + slen + 1 > g->cap) {
        g->cap *= 2;
        g->data = realloc(g->data, g->cap);
        if (!g->data) return;
    }
    memcpy(g->data + g->len, s, slen);
    g->len += slen;
    g->data[g->len] = '\0';
}

static void c2_gb_append_char(C2GrowBuf *g, char c) {
    if (!g->data) return;
    if (g->len + 2 > g->cap) {
        g->cap *= 2;
        g->data = realloc(g->data, g->cap);
        if (!g->data) return;
    }
    g->data[g->len++] = c;
    g->data[g->len]   = '\0';
}

/* JSON-escape a string and append it (with surrounding double-quotes) */
static void c2_gb_append_json_str(C2GrowBuf *g, const char *s) {
    c2_gb_append_char(g, '"');
    if (!s) {
        c2_gb_append_char(g, '"');
        return;
    }
    for (const char *p = s; *p; p++) {
        unsigned char c = (unsigned char)*p;
        if      (c == '"')  c2_gb_append(g, "\\\"");
        else if (c == '\\') c2_gb_append(g, "\\\\");
        else if (c == '\n') c2_gb_append(g, "\\n");
        else if (c == '\r') c2_gb_append(g, "\\r");
        else if (c == '\t') c2_gb_append(g, "\\t");
        else if (c < 0x20) {
            char esc[8];
            snprintf(esc, sizeof(esc), "\\u%04x", c);
            c2_gb_append(g, esc);
        } else {
            c2_gb_append_char(g, (char)c);
        }
    }
    c2_gb_append_char(g, '"');
}

/* =========================================================================
 * db_connect — open SQLite3 database at path
 * LLVM decl: declare void @db_connect(i8*)
 * ========================================================================= */
void db_connect(char *path) {
    if (g_db) {
        sqlite3_close(g_db);
        g_db = NULL;
    }
    if (!path || path[0] == '\0') path = ":memory:";
    int rc = sqlite3_open(path, &g_db);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[monitor-runtime] db_connect failed: %s\n",
                sqlite3_errmsg(g_db));
        sqlite3_close(g_db);
        g_db = NULL;
        exit(1);
    }
    sqlite3_exec(g_db, "PRAGMA journal_mode=WAL;", NULL, NULL, NULL);
    sqlite3_exec(g_db, "PRAGMA foreign_keys=ON;", NULL, NULL, NULL);
}

/* =========================================================================
 * db_close — close the global SQLite3 connection
 * LLVM decl: declare void @db_close()
 * ========================================================================= */
void db_close(void) {
    if (g_db) {
        sqlite3_close(g_db);
        g_db = NULL;
    }
}

/* =========================================================================
 * db_execute — run a non-SELECT SQL statement
 * LLVM decl: declare i64 @db_execute(i8*)
 * Returns: affected row count on success, -1 on error.
 * ========================================================================= */
int64_t db_execute(char *sql) {
    if (!g_db) {
        fprintf(stderr, "[monitor-runtime] db_execute: no open database\n");
        return -1;
    }
    if (!sql) return -1;
    char *errmsg = NULL;
    int rc = sqlite3_exec(g_db, sql, NULL, NULL, &errmsg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[monitor-runtime] db_execute error: %s\nSQL: %.200s\n",
                errmsg ? errmsg : "unknown", sql);
        if (errmsg) sqlite3_free(errmsg);
        return -1;
    }
    return (int64_t)sqlite3_changes(g_db);
}

/* =========================================================================
 * db_query — run a SELECT and return results as a JSON array string
 * LLVM decl: declare i8* @db_query(i8*)
 * Returns: malloc'd JSON array string; empty result → "[]".
 * ========================================================================= */
char *db_query(char *sql) {
    if (!g_db || !sql) {
        char *empty = malloc(3);
        if (empty) strcpy(empty, "[]");
        return empty;
    }

    sqlite3_stmt *stmt = NULL;
    int rc = sqlite3_prepare_v2(g_db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[monitor-runtime] db_query prepare error: %s\nSQL: %.200s\n",
                sqlite3_errmsg(g_db), sql);
        char *empty = malloc(3);
        if (empty) strcpy(empty, "[]");
        return empty;
    }

    C2GrowBuf gb;
    c2_gb_init(&gb);
    c2_gb_append(&gb, "[");

    int col_count = sqlite3_column_count(stmt);
    int first_row = 1;

    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        if (!first_row) c2_gb_append(&gb, ",");
        first_row = 0;
        c2_gb_append(&gb, "{");
        for (int i = 0; i < col_count; i++) {
            if (i > 0) c2_gb_append(&gb, ",");
            /* key */
            c2_gb_append_json_str(&gb, sqlite3_column_name(stmt, i));
            c2_gb_append(&gb, ":");
            /* value */
            int col_type = sqlite3_column_type(stmt, i);
            if (col_type == SQLITE_NULL) {
                c2_gb_append(&gb, "null");
            } else if (col_type == SQLITE_INTEGER) {
                char nbuf[32];
                snprintf(nbuf, sizeof(nbuf), "%lld",
                         (long long)sqlite3_column_int64(stmt, i));
                c2_gb_append(&gb, nbuf);
            } else if (col_type == SQLITE_FLOAT) {
                char nbuf[64];
                snprintf(nbuf, sizeof(nbuf), "%g",
                         sqlite3_column_double(stmt, i));
                c2_gb_append(&gb, nbuf);
            } else if (col_type == SQLITE_BLOB) {
                c2_gb_append(&gb, "\"[blob]\"");
            } else {
                /* TEXT */
                c2_gb_append_json_str(
                    &gb, (const char *)sqlite3_column_text(stmt, i));
            }
        }
        c2_gb_append(&gb, "}");
    }

    c2_gb_append(&gb, "]");
    sqlite3_finalize(stmt);
    return gb.data; /* caller owns */
}

/* =========================================================================
 * db_begin_transaction
 * LLVM decl: declare void @db_begin_transaction()
 * ========================================================================= */
void db_begin_transaction(void) {
    if (!g_db) {
        fprintf(stderr, "[monitor-runtime] db_begin_transaction: no open database\n");
        return;
    }
    char *errmsg = NULL;
    int rc = sqlite3_exec(g_db, "BEGIN TRANSACTION;", NULL, NULL, &errmsg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[monitor-runtime] db_begin_transaction error: %s\n",
                errmsg ? errmsg : "unknown");
        if (errmsg) sqlite3_free(errmsg);
    }
}

/* =========================================================================
 * db_commit
 * LLVM decl: declare void @db_commit()
 * ========================================================================= */
void db_commit(void) {
    if (!g_db) {
        fprintf(stderr, "[monitor-runtime] db_commit: no open database\n");
        return;
    }
    char *errmsg = NULL;
    int rc = sqlite3_exec(g_db, "COMMIT;", NULL, NULL, &errmsg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[monitor-runtime] db_commit error: %s\n",
                errmsg ? errmsg : "unknown");
        if (errmsg) sqlite3_free(errmsg);
    }
}

/* =========================================================================
 * db_rollback
 * LLVM decl: declare void @db_rollback()
 * ========================================================================= */
void db_rollback(void) {
    if (!g_db) {
        fprintf(stderr, "[monitor-runtime] db_rollback: no open database\n");
        return;
    }
    char *errmsg = NULL;
    int rc = sqlite3_exec(g_db, "ROLLBACK;", NULL, NULL, &errmsg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[monitor-runtime] db_rollback error: %s\n",
                errmsg ? errmsg : "unknown");
        if (errmsg) sqlite3_free(errmsg);
    }
}

/* =========================================================================
 * db_prepare — compile a named prepared statement
 * LLVM decl: declare void @db_prepare(i8*, i8*)
 * Stores name → sqlite3_stmt* in g_prepared[]. Max 64 slots.
 * ========================================================================= */
void db_prepare(char *name, char *sql) {
    if (!g_db || !name || !sql) {
        fprintf(stderr, "[monitor-runtime] db_prepare: invalid args\n");
        return;
    }

    /* Check for existing slot with same name (update) */
    for (int i = 0; i < g_prepared_count; i++) {
        if (g_prepared[i].name && strcmp(g_prepared[i].name, name) == 0) {
            sqlite3_finalize(g_prepared[i].stmt);
            g_prepared[i].stmt = NULL;
            int rc = sqlite3_prepare_v2(g_db, sql, -1, &g_prepared[i].stmt, NULL);
            if (rc != SQLITE_OK) {
                fprintf(stderr, "[monitor-runtime] db_prepare error for '%s': %s\n",
                        name, sqlite3_errmsg(g_db));
            }
            return;
        }
    }

    /* New slot */
    if (g_prepared_count >= 64) {
        fprintf(stderr, "[monitor-runtime] db_prepare: max 64 prepared statements reached\n");
        return;
    }
    sqlite3_stmt *stmt = NULL;
    int rc = sqlite3_prepare_v2(g_db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "[monitor-runtime] db_prepare error for '%s': %s\n",
                name, sqlite3_errmsg(g_db));
        return;
    }
    g_prepared[g_prepared_count].name = strdup(name);
    g_prepared[g_prepared_count].stmt = stmt;
    g_prepared_count++;
}

/* =========================================================================
 * db_execute_prepared — execute a named prepared statement with JSON params
 * LLVM decl: declare i64 @db_execute_prepared(i8*, i8*)
 * params: JSON array of strings: ["val1","val2"] — bound as text in order.
 * Returns: affected row count on success, -1 on error.
 * ========================================================================= */
int64_t db_execute_prepared(char *name, char *params) {
    if (!g_db || !name) {
        fprintf(stderr, "[monitor-runtime] db_execute_prepared: invalid args\n");
        return -1;
    }

    /* Find prepared statement by name */
    sqlite3_stmt *stmt = NULL;
    for (int i = 0; i < g_prepared_count; i++) {
        if (g_prepared[i].name && strcmp(g_prepared[i].name, name) == 0) {
            stmt = g_prepared[i].stmt;
            break;
        }
    }
    if (!stmt) {
        fprintf(stderr, "[monitor-runtime] db_execute_prepared: '%s' not found\n", name);
        return -1;
    }

    sqlite3_reset(stmt);
    sqlite3_clear_bindings(stmt);

    /* Parse JSON array params: ["v1","v2",...] — simple extraction */
    if (params && params[0] == '[') {
        int param_idx = 1; /* sqlite3 bind index is 1-based */
        const char *p = params + 1; /* skip '[' */
        while (*p && *p != ']') {
            /* Skip whitespace and commas */
            while (*p == ' ' || *p == ',' || *p == '\t') p++;
            if (*p == '"') {
                p++; /* skip opening quote */
                const char *start = p;
                /* Find closing quote (no escape handling for simplicity) */
                while (*p && *p != '"') p++;
                size_t vlen = (size_t)(p - start);
                char *val = malloc(vlen + 1);
                if (val) {
                    memcpy(val, start, vlen);
                    val[vlen] = '\0';
                    sqlite3_bind_text(stmt, param_idx++, val, -1, SQLITE_TRANSIENT);
                    free(val);
                }
                if (*p == '"') p++; /* skip closing quote */
            } else if (*p == 'n' && strncmp(p, "null", 4) == 0) {
                sqlite3_bind_null(stmt, param_idx++);
                p += 4;
            } else if (*p != ']' && *p != '\0') {
                p++; /* skip unexpected char */
            }
        }
    }

    /* Step through all rows */
    int rc;
    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) { /* consume rows */ }

    if (rc != SQLITE_DONE) {
        fprintf(stderr, "[monitor-runtime] db_execute_prepared '%s' step error: %s\n",
                name, sqlite3_errmsg(g_db));
        return -1;
    }

    return (int64_t)sqlite3_changes(g_db);
}

/* ====================== C3: random / uuid ====================== */

#ifdef __linux__
#  include <sys/types.h>
static void _fill_random(void *buf, size_t len) {
    FILE *f = fopen("/dev/urandom", "rb");
    if (f) {
        (void)fread(buf, 1, len, f);
        fclose(f);
    }
}
#else
/* macOS / BSD: arc4random_buf — declare explicitly in case _POSIX_C_SOURCE hides it */
extern void arc4random_buf(void *buf, size_t nbytes);
static void _fill_random(void *buf, size_t len) {
    arc4random_buf(buf, len);
}
#endif

int64_t random_i64(int64_t min, int64_t max) {
    if (min > max) {
        return min;
    }
    uint64_t range = (uint64_t)(max - min) + 1ULL;
    /* Special case: full uint64 range */
    if (range == 0ULL) {
        uint64_t raw;
        _fill_random(&raw, 8);
        return (int64_t)raw;
    }
    /* Rejection sampling to avoid modulo bias */
    uint64_t limit = UINT64_MAX - (UINT64_MAX % range);
    uint64_t raw;
    do {
        _fill_random(&raw, 8);
    } while (raw >= limit);
    return min + (int64_t)(raw % range);
}

double random_f64(void) {
    uint64_t raw;
    _fill_random(&raw, 8);
    /* Use upper 53 bits for IEEE 754 double precision */
    return (double)(raw >> 11) / (double)(1ULL << 53);
}

char *generate_uuid(void) {
    unsigned char uuid[16];
    _fill_random(uuid, 16);
    /* Set version 4 */
    uuid[6] = (uuid[6] & 0x0f) | 0x40;
    /* Set variant 1 (10xx xxxx) */
    uuid[8] = (uuid[8] & 0x3f) | 0x80;
    /* 36 chars + NUL */
    char *out = (char *)malloc(37);
    if (!out) return NULL;
    snprintf(out, 37,
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        uuid[0],  uuid[1],  uuid[2],  uuid[3],
        uuid[4],  uuid[5],
        uuid[6],  uuid[7],
        uuid[8],  uuid[9],
        uuid[10], uuid[11], uuid[12], uuid[13], uuid[14], uuid[15]);
    return out;
}

/* =========================================================================
 * C4 helpers: tiny base64url + JSON string helpers used by jwt_encode/decode
 * and by C5 json_* if it wants to reuse them.
 * ========================================================================= */

/* Standard base64 alphabet + URL-safe variant */
static const char B64URL_ALPHABET[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/* Reverse map: char -> 0..63, or -1 for invalid. Filled at first use. */
static signed char g_b64url_rev[256];
static int g_b64url_rev_init = 0;
static void _b64url_init_rev(void) {
    if (g_b64url_rev_init) return;
    for (int i = 0; i < 256; i++) g_b64url_rev[i] = -1;
    for (int i = 0; i < 64; i++) {
        g_b64url_rev[(unsigned char)B64URL_ALPHABET[i]] = (signed char)i;
    }
    g_b64url_rev_init = 1;
}

/* Encode `len` bytes at `in` to base64url without padding. Returns malloc'd
 * null-terminated C string. */
static char *b64url_encode(const unsigned char *in, size_t len) {
    size_t out_len = (len + 2) / 3 * 4;
    char *out = (char *)malloc(out_len + 1);
    if (!out) return NULL;
    size_t i = 0, j = 0;
    while (i + 2 < len) {
        unsigned v = (unsigned)(in[i] << 16) | (unsigned)(in[i + 1] << 8) | in[i + 2];
        out[j++] = B64URL_ALPHABET[(v >> 18) & 63];
        out[j++] = B64URL_ALPHABET[(v >> 12) & 63];
        out[j++] = B64URL_ALPHABET[(v >> 6) & 63];
        out[j++] = B64URL_ALPHABET[v & 63];
        i += 3;
    }
    if (i < len) {
        unsigned v = (unsigned)(in[i] << 16);
        if (i + 1 < len) v |= (unsigned)(in[i + 1] << 8);
        out[j++] = B64URL_ALPHABET[(v >> 18) & 63];
        out[j++] = B64URL_ALPHABET[(v >> 12) & 63];
        if (i + 1 < len) out[j++] = B64URL_ALPHABET[(v >> 6) & 63];
    }
    out[j] = 0;
    return out;
}

/* Decode base64url string. Returns malloc'd buffer of *out_len bytes.
 * NULL on error. */
static unsigned char *b64url_decode(const char *in, size_t *out_len) {
    _b64url_init_rev();
    size_t in_len = strlen(in);
    /* base64url has no padding; remove any '=' just in case */
    while (in_len > 0 && in[in_len - 1] == '=') in_len--;
    size_t buf_len = (in_len / 4) * 3 + 3;
    unsigned char *out = (unsigned char *)malloc(buf_len + 1);
    if (!out) return NULL;
    size_t i = 0, j = 0;
    unsigned v = 0;
    int bits = 0;
    while (i < in_len) {
        signed char c = g_b64url_rev[(unsigned char)in[i++]];
        if (c < 0) { free(out); return NULL; }
        v = (v << 6) | (unsigned)c;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out[j++] = (unsigned char)((v >> bits) & 0xff);
        }
    }
    out[j] = 0;
    if (out_len) *out_len = j;
    return out;
}

/* Find a top-level string field in a flat JSON object. On hit, returns a
 * newly-allocated C string with the value. On miss, returns NULL. This is a
 * deliberately minimal parser: it looks for `"key"` followed by `:` then a
 * `"..."` string, handling simple `\\` and `\"` escapes. Numeric and nested
 * values are not decoded — use `strtoll` on the raw slice if needed.
 *
 * Used by jwt_decode to read the `exp` claim.
 */
static char *json_get_string_field(const char *obj, const char *key) {
    if (!obj || !key) return NULL;
    size_t klen = strlen(key);
    const char *p = obj;
    while ((p = strchr(p, '"')) != NULL) {
        p++;  /* opening quote of candidate key */
        if (strncmp(p, key, klen) == 0 && p[klen] == '"') {
            const char *q = p + klen + 1;  /* after closing quote of key */
            while (*q && (*q == ' ' || *q == '\t')) q++;
            if (*q != ':') { p = q; continue; }
            q++;
            while (*q && (*q == ' ' || *q == '\t')) q++;
            if (*q != '"') return NULL;  /* not a string value */
            q++;
            const char *start = q;
            while (*q && *q != '"') {
                if (*q == '\\' && q[1]) q += 2;
                else q++;
            }
            if (*q != '"') return NULL;
            size_t n = (size_t)(q - start);
            char *v = (char *)malloc(n + 1);
            if (!v) return NULL;
            /* copy with minimal escape handling */
            size_t oi = 0;
            for (size_t i = 0; i < n; i++) {
                if (start[i] == '\\' && i + 1 < n) {
                    char next = start[i + 1];
                    if (next == '"' || next == '\\' || next == '/') {
                        v[oi++] = next;
                    } else if (next == 'n') {
                        v[oi++] = '\n';
                    } else if (next == 't') {
                        v[oi++] = '\t';
                    } else {
                        v[oi++] = next;
                    }
                    i++;
                } else {
                    v[oi++] = start[i];
                }
            }
            v[oi] = 0;
            return v;
        }
        /* advance past this string literal (keys are the only strings we expect
         * here but we skip over values too just in case) */
    }
    return NULL;
}

/* Read a numeric top-level field such as `exp` as int64. Returns 1 on hit
 * and stores the parsed value in *out; 0 on miss. */
static int json_get_int_field(const char *obj, const char *key, int64_t *out) {
    if (!obj || !key || !out) return 0;
    size_t klen = strlen(key);
    const char *p = obj;
    while ((p = strchr(p, '"')) != NULL) {
        p++;
        if (strncmp(p, key, klen) == 0 && p[klen] == '"') {
            const char *q = p + klen + 1;
            while (*q && (*q == ' ' || *q == '\t')) q++;
            if (*q != ':') { p = q; continue; }
            q++;
            while (*q && (*q == ' ' || *q == '\t')) q++;
            char *end = NULL;
            long long v = strtoll(q, &end, 10);
            if (end == q) return 0;
            *out = (int64_t)v;
            return 1;
        }
    }
    return 0;
}

/* Constant-time memory compare — identical to CRYPTO_memcmp but avoids
 * pulling the whole libcrypto util header. Returns 0 on match. */
static int ct_memcmp(const void *a, const void *b, size_t n) {
    const unsigned char *pa = (const unsigned char *)a;
    const unsigned char *pb = (const unsigned char *)b;
    unsigned char diff = 0;
    for (size_t i = 0; i < n; i++) diff |= (unsigned char)(pa[i] ^ pb[i]);
    return (int)diff;
}

/* =========================================================================
 * C4: crypto / jwt  (OpenSSL -lcrypto)
 * =========================================================================
 *
 * Design decisions (Phase 2 #19 — 2026-04-11):
 *
 * 1. Password hashing uses PBKDF2-HMAC-SHA256 rather than bcrypt. OpenSSL's
 *    public API does not ship a bcrypt primitive, and pulling `libbcrypt`
 *    would be a third-party dependency. PBKDF2-HMAC-SHA256 is the industry
 *    fallback when bcrypt/argon2 aren't available (e.g. Django's default
 *    `pbkdf2_sha256` hasher, Python's passlib, AWS Cognito) and provides
 *    equivalent security at high iteration counts.
 *
 *    Output format:  pbkdf2_sha256$<iter>$<salt_b64>$<hash_b64>
 *    Iterations: 100_000 (Django 4.2 default). Salt: 16 random bytes.
 *    Hash: 32 bytes (full SHA-256 output).
 *
 * 2. JWT uses HS256 (HMAC-SHA256) because it's the simplest interoperable
 *    algorithm and matches the "shared secret" model most vais-server apps
 *    expect. RS256 would require key parsing and is out of scope here.
 *
 *    Header: {"alg":"HS256","typ":"JWT"}  (hardcoded — no negotiation).
 *    Claims body: copied verbatim from the caller.
 *    Signature: HMAC-SHA256 over `${header_b64}.${claims_b64}`.
 *    `exp` claim check: jwt_decode parses the decoded claims body for an
 *    integer `exp` field and rejects the token if `exp <= now()`.
 *
 *    Compatibility: signed tokens are verifiable by any HS256 JWT library
 *    (jsonwebtoken@Node, PyJWT, golang-jwt, etc.).
 * ========================================================================= */

#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/rand.h>

#define PBKDF2_ITER   100000
#define PBKDF2_SALT_N 16
#define PBKDF2_HASH_N 32   /* SHA-256 output size */
#define HMAC_SHA256_N 32

char *hash_password(const char *password) {
    if (!password) return NULL;
    unsigned char salt[PBKDF2_SALT_N];
    if (RAND_bytes(salt, PBKDF2_SALT_N) != 1) {
        fprintf(stderr, "[monitor_runtime] hash_password: RAND_bytes failed\n");
        return NULL;
    }
    unsigned char hash[PBKDF2_HASH_N];
    if (PKCS5_PBKDF2_HMAC(password, (int)strlen(password),
                          salt, PBKDF2_SALT_N,
                          PBKDF2_ITER, EVP_sha256(),
                          PBKDF2_HASH_N, hash) != 1) {
        fprintf(stderr, "[monitor_runtime] hash_password: PBKDF2 failed\n");
        return NULL;
    }
    char *salt_b64 = b64url_encode(salt, PBKDF2_SALT_N);
    char *hash_b64 = b64url_encode(hash, PBKDF2_HASH_N);
    if (!salt_b64 || !hash_b64) {
        free(salt_b64); free(hash_b64); return NULL;
    }
    size_t n = strlen(salt_b64) + strlen(hash_b64) + 64;
    char *out = (char *)malloc(n);
    if (!out) { free(salt_b64); free(hash_b64); return NULL; }
    snprintf(out, n, "pbkdf2_sha256$%d$%s$%s", PBKDF2_ITER, salt_b64, hash_b64);
    free(salt_b64);
    free(hash_b64);
    return out;
}

/* Parse a `pbkdf2_sha256$iter$salt$hash` string into its components. On
 * success returns 1 and populates out-params (caller frees salt/hash).
 * The hash and salt are returned as decoded binary buffers. */
static int _parse_pbkdf2_hash(const char *s, int *iter,
                              unsigned char **salt, size_t *salt_len,
                              unsigned char **hash, size_t *hash_len) {
    if (!s) return 0;
    if (strncmp(s, "pbkdf2_sha256$", 14) != 0) return 0;
    const char *p = s + 14;
    char *end = NULL;
    long it = strtol(p, &end, 10);
    if (end == p || *end != '$') return 0;
    p = end + 1;
    const char *sep = strchr(p, '$');
    if (!sep) return 0;
    size_t salt_b64_len = (size_t)(sep - p);
    char *salt_b64 = (char *)malloc(salt_b64_len + 1);
    if (!salt_b64) return 0;
    memcpy(salt_b64, p, salt_b64_len); salt_b64[salt_b64_len] = 0;
    *salt = b64url_decode(salt_b64, salt_len);
    free(salt_b64);
    if (!*salt) return 0;
    *hash = b64url_decode(sep + 1, hash_len);
    if (!*hash) { free(*salt); *salt = NULL; return 0; }
    *iter = (int)it;
    return 1;
}

int64_t verify_password(const char *password, const char *stored_hash) {
    if (!password || !stored_hash) return 0;
    int iter;
    unsigned char *salt = NULL, *expected = NULL;
    size_t salt_len = 0, expected_len = 0;
    if (!_parse_pbkdf2_hash(stored_hash, &iter, &salt, &salt_len,
                            &expected, &expected_len)) {
        return 0;
    }
    if (expected_len != PBKDF2_HASH_N) {
        free(salt); free(expected); return 0;
    }
    unsigned char derived[PBKDF2_HASH_N];
    int ok = PKCS5_PBKDF2_HMAC(password, (int)strlen(password),
                               salt, (int)salt_len, iter, EVP_sha256(),
                               PBKDF2_HASH_N, derived);
    int match = ok && ct_memcmp(derived, expected, PBKDF2_HASH_N) == 0;
    free(salt); free(expected);
    return match ? 1 : 0;
}

/* Compute HMAC-SHA256(secret, msg) and write 32 bytes to out. */
static int _hmac_sha256(const unsigned char *secret, size_t secret_len,
                        const unsigned char *msg, size_t msg_len,
                        unsigned char out[HMAC_SHA256_N]) {
    unsigned int out_len = HMAC_SHA256_N;
    unsigned char *r = HMAC(EVP_sha256(), secret, (int)secret_len,
                             msg, msg_len, out, &out_len);
    return (r != NULL && out_len == HMAC_SHA256_N) ? 1 : 0;
}

/* Hardcoded JWT header. Emitted verbatim so its base64url form is stable and
 * matches every reference implementation. */
static const char JWT_HEADER_JSON[] = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";

char *jwt_encode(const char *claims, const char *secret) {
    if (!claims || !secret) return NULL;
    char *header_b64 = b64url_encode((const unsigned char *)JWT_HEADER_JSON,
                                     strlen(JWT_HEADER_JSON));
    char *claims_b64 = b64url_encode((const unsigned char *)claims, strlen(claims));
    if (!header_b64 || !claims_b64) { free(header_b64); free(claims_b64); return NULL; }

    size_t signing_len = strlen(header_b64) + 1 + strlen(claims_b64);
    char *signing = (char *)malloc(signing_len + 1);
    if (!signing) { free(header_b64); free(claims_b64); return NULL; }
    snprintf(signing, signing_len + 1, "%s.%s", header_b64, claims_b64);

    unsigned char mac[HMAC_SHA256_N];
    if (!_hmac_sha256((const unsigned char *)secret, strlen(secret),
                      (const unsigned char *)signing, strlen(signing), mac)) {
        free(header_b64); free(claims_b64); free(signing); return NULL;
    }
    char *sig_b64 = b64url_encode(mac, HMAC_SHA256_N);
    if (!sig_b64) { free(header_b64); free(claims_b64); free(signing); return NULL; }

    size_t out_len = strlen(signing) + 1 + strlen(sig_b64);
    char *out = (char *)malloc(out_len + 1);
    if (!out) { free(header_b64); free(claims_b64); free(signing); free(sig_b64); return NULL; }
    snprintf(out, out_len + 1, "%s.%s", signing, sig_b64);
    free(header_b64); free(claims_b64); free(signing); free(sig_b64);
    return out;
}

/* Decode a JWT. On success returns a malloc'd C string containing the
 * decoded claims JSON. On signature mismatch, malformed token, or expired
 * `exp` claim, returns an empty malloc'd string "" (caller still owns it).
 *
 * The empty-string-on-failure convention matches how signature/runtime.c
 * handles auth errors from vais: the vais side checks `str_len(result) == 0`.
 */
char *jwt_decode(const char *token, const char *secret) {
    if (!token || !secret) {
        char *e = (char *)malloc(1); if (e) e[0] = 0; return e;
    }

    /* Split on '.' — expect exactly 3 parts. */
    const char *dot1 = strchr(token, '.');
    if (!dot1) { char *e = (char *)malloc(1); if (e) e[0] = 0; return e; }
    const char *dot2 = strchr(dot1 + 1, '.');
    if (!dot2) { char *e = (char *)malloc(1); if (e) e[0] = 0; return e; }

    size_t h_len = (size_t)(dot1 - token);
    size_t c_len = (size_t)(dot2 - dot1 - 1);
    const char *sig_b64 = dot2 + 1;
    size_t sig_b64_len = strlen(sig_b64);

    /* Signing input is header.claims (the substring of token before the
     * last dot). */
    size_t signing_len = h_len + 1 + c_len;

    /* Recompute HMAC and compare. */
    unsigned char mac[HMAC_SHA256_N];
    if (!_hmac_sha256((const unsigned char *)secret, strlen(secret),
                      (const unsigned char *)token, signing_len, mac)) {
        char *e = (char *)malloc(1); if (e) e[0] = 0; return e;
    }
    size_t provided_len = 0;
    char *sig_b64_copy = (char *)malloc(sig_b64_len + 1);
    if (!sig_b64_copy) { char *e = (char *)malloc(1); if (e) e[0] = 0; return e; }
    memcpy(sig_b64_copy, sig_b64, sig_b64_len); sig_b64_copy[sig_b64_len] = 0;
    unsigned char *provided = b64url_decode(sig_b64_copy, &provided_len);
    free(sig_b64_copy);
    if (!provided || provided_len != HMAC_SHA256_N) {
        free(provided);
        char *e = (char *)malloc(1); if (e) e[0] = 0; return e;
    }
    int sig_ok = ct_memcmp(mac, provided, HMAC_SHA256_N) == 0;
    free(provided);
    if (!sig_ok) { char *e = (char *)malloc(1); if (e) e[0] = 0; return e; }

    /* Decode claims payload to a JSON C string. */
    char *claims_b64_copy = (char *)malloc(c_len + 1);
    if (!claims_b64_copy) { char *e = (char *)malloc(1); if (e) e[0] = 0; return e; }
    memcpy(claims_b64_copy, dot1 + 1, c_len); claims_b64_copy[c_len] = 0;
    size_t claims_bin_len = 0;
    unsigned char *claims_bin = b64url_decode(claims_b64_copy, &claims_bin_len);
    free(claims_b64_copy);
    if (!claims_bin) { char *e = (char *)malloc(1); if (e) e[0] = 0; return e; }
    /* Ensure null termination for JSON string usage. */
    unsigned char *claims_cstr = realloc(claims_bin, claims_bin_len + 1);
    if (!claims_cstr) { free(claims_bin); char *e = (char *)malloc(1); if (e) e[0] = 0; return e; }
    claims_cstr[claims_bin_len] = 0;

    /* `exp` check: if present and <= now, reject. */
    int64_t exp_val = 0;
    if (json_get_int_field((const char *)claims_cstr, "exp", &exp_val)) {
        int64_t now = (int64_t)time(NULL);
        if (exp_val <= now) {
            free(claims_cstr);
            char *e = (char *)malloc(1); if (e) e[0] = 0; return e;
        }
    }

    return (char *)claims_cstr;
}

/* =========================================================================
 * C4 bonus: helper externs introduced by B2_wrapper (iter 15 task #14)
 *
 * `runtime.vais` now calls three low-level helpers from its pure-vais
 * wrappers over std.  Two of them are cheap one-liners; the third is a
 * `gettime` wrapper. Implementing them here keeps all of monitor's C
 * plumbing in one file.
 * ========================================================================= */

/* __strlen: NOTE — the Vais std C runtime (`http_runtime.c`) already
 * provides `__strlen` with the same signature, so we must NOT duplicate
 * it here. The linker picks it up from `/tmp/monitor_runtime/http_runtime.o`.
 * (This was found during the iter 15 D1 link pass — the first compile of
 * this file emitted `__strlen` and clang reported a duplicate symbol.)
 */

/* __clock_gettime_ms: used by F current_time_ms. */
int64_t __clock_gettime_ms(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_REALTIME, &ts) != 0) return 0;
    return (int64_t)ts.tv_sec * 1000 + (int64_t)(ts.tv_nsec / 1000000);
}

/* __load_byte: NOTE — vaisc already emits a definition of this intrinsic
 * in every main module (runtime.rs, see ROADMAP #9). The runtime.vais call
 * site actually hits the vaisc-provided `@__load_byte` at link time, so we
 * do NOT duplicate it here — that would trigger the exact redefinition bug
 * ROADMAP #9 just finished removing. */

/* ====================== C5: json ====================== */

/*
 * json_parse — identity return.  monitor's use-case is treating JSON as an
 * opaque string token; actual tree parsing is not required.
 * Returns a malloc'd copy; caller frees.  Returns "" on error.
 */
char *json_parse(const char *s) {
    if (!s) {
        char *e = (char *)malloc(1);
        if (e) e[0] = '\0';
        return e;
    }
    char *r = strdup(s);
    if (!r) {
        char *e = (char *)malloc(1);
        if (e) e[0] = '\0';
        return e;
    }
    return r;
}

/*
 * json_stringify — identity return.
 * Returns a malloc'd copy; caller frees.  Returns "" on error.
 */
char *json_stringify(const char *obj) {
    if (!obj) {
        char *e = (char *)malloc(1);
        if (e) e[0] = '\0';
        return e;
    }
    char *r = strdup(obj);
    if (!r) {
        char *e = (char *)malloc(1);
        if (e) e[0] = '\0';
        return e;
    }
    return r;
}

/* Internal helper: extract the Nth (0-based) element from a JSON array
 * top-level string like ["a","b","c"] or [1,2,3].
 * Returns a malloc'd string (without surrounding quotes for string elements),
 * or NULL on failure. */
static char *json_array_get_index(const char *arr, long long idx) {
    if (!arr) return NULL;
    const char *p = arr;
    while (*p && *p != '[') p++;
    if (*p != '[') return NULL;
    p++;  /* skip '[' */
    long long count = 0;
    while (*p) {
        /* skip whitespace */
        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
        if (*p == ']') break;
        /* find start and end of this element */
        const char *elem_start;
        const char *elem_end;
        if (*p == '"') {
            /* string element */
            p++;
            elem_start = p;
            while (*p && *p != '"') {
                if (*p == '\\' && p[1]) p += 2;
                else p++;
            }
            elem_end = p;
            if (*p == '"') p++;
        } else {
            /* bare element: number / bool / null */
            elem_start = p;
            while (*p && *p != ',' && *p != ']') p++;
            elem_end = p;
            /* trim trailing whitespace */
            while (elem_end > elem_start &&
                   (elem_end[-1] == ' ' || elem_end[-1] == '\t' ||
                    elem_end[-1] == '\n' || elem_end[-1] == '\r'))
                elem_end--;
        }
        if (count == idx) {
            size_t n = (size_t)(elem_end - elem_start);
            char *v = (char *)malloc(n + 1);
            if (!v) return NULL;
            memcpy(v, elem_start, n);
            v[n] = '\0';
            return v;
        }
        count++;
        /* advance past comma */
        while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
        if (*p == ',') p++;
    }
    return NULL;
}

/*
 * json_get — extract value for `key` from a flat top-level JSON object or
 * array.  Supports string, integer, bool, and null values.
 * For arrays, key must be a non-negative decimal integer index.
 * Returns malloc'd string; caller frees.  Returns malloc'd "" on miss/error.
 */
char *json_get(const char *json, const char *key) {
    /* empty fallback helper */
#define JSON_GET_EMPTY() do { \
    char *_e = (char *)malloc(1); \
    if (_e) _e[0] = '\0'; \
    return _e; \
} while (0)

    if (!json || !key) JSON_GET_EMPTY();

    /* array mode */
    const char *p = json;
    while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') p++;
    if (*p == '[') {
        char *end_ptr = NULL;
        long long idx = strtoll(key, &end_ptr, 10);
        if (!end_ptr || end_ptr == key) JSON_GET_EMPTY();
        char *v = json_array_get_index(json, idx);
        if (v) return v;
        JSON_GET_EMPTY();
    }

    /* object mode — try string field first */
    char *sv = json_get_string_field(json, key);
    if (sv) return sv;

    /* try integer field */
    int64_t iv = 0;
    if (json_get_int_field(json, key, &iv)) {
        char buf[32];
        snprintf(buf, sizeof(buf), "%lld", (long long)iv);
        char *r = strdup(buf);
        if (!r) JSON_GET_EMPTY();
        return r;
    }

    JSON_GET_EMPTY();
#undef JSON_GET_EMPTY
}

/* Internal helper: escape a value string for JSON object insertion.
 * Only escapes '"' and '\'.  Returns malloc'd string; caller frees. */
static char *json_escape_value(const char *v) {
    if (!v) return strdup("");
    size_t n = 0;
    for (const char *p = v; *p; p++) {
        if (*p == '"' || *p == '\\') n++;
        n++;
    }
    char *out = (char *)malloc(n + 1);
    if (!out) return NULL;
    size_t i = 0;
    for (const char *p = v; *p; p++) {
        if (*p == '"' || *p == '\\') out[i++] = '\\';
        out[i++] = *p;
    }
    out[i] = '\0';
    return out;
}

/*
 * json_set — set or insert a key/value pair in a flat top-level JSON object.
 * If the key already exists (as a string field), its value is replaced.
 * Otherwise the pair is appended before the closing '}'.
 * Returns a new malloc'd string; caller frees.  Returns "" on error.
 */
char *json_set(const char *json, const char *key, const char *value) {
#define JSON_SET_EMPTY() do { \
    char *_e = (char *)malloc(1); \
    if (_e) _e[0] = '\0'; \
    return _e; \
} while (0)

    if (!json || !key || !value) JSON_SET_EMPTY();

    char *esc_val = json_escape_value(value);
    if (!esc_val) JSON_SET_EMPTY();

    /* Try to locate an existing string field value region to replace. */
    size_t klen = strlen(key);
    const char *p = json;
    int replaced = 0;

    /* We build the result in a dynamic buffer. */
    size_t json_len = strlen(json);
    /* worst case: replace all + some slack */
    size_t buf_cap = json_len + strlen(esc_val) + strlen(key) + 8;
    char *buf = (char *)malloc(buf_cap);
    if (!buf) { free(esc_val); JSON_SET_EMPTY(); }

    /* Search for the key as a quoted string key followed by ':' and a string value.
     * We replicate the scan logic from json_get_string_field to find the exact
     * byte range of the value (including its surrounding quotes) so we can
     * splice in the new value. */
    const char *scan = json;
    while ((scan = strchr(scan, '"')) != NULL) {
        scan++;  /* past opening quote of candidate key */
        if (strncmp(scan, key, klen) == 0 && scan[klen] == '"') {
            const char *q = scan + klen + 1;
            while (*q && (*q == ' ' || *q == '\t')) q++;
            if (*q != ':') { continue; }
            q++;
            while (*q && (*q == ' ' || *q == '\t')) q++;
            if (*q != '"') break;  /* not a string value — can't splice */
            q++;
            const char *val_start = q;
            while (*q && *q != '"') {
                if (*q == '\\' && q[1]) q += 2;
                else q++;
            }
            if (*q != '"') break;
            const char *val_end = q + 1;  /* past closing quote */

            /* splice: everything before val_start-1 (before opening quote of value),
             * then '"', new escaped value, '"', then rest from val_end. */
            size_t prefix_len = (size_t)((val_start - 1) - json);
            size_t suffix_len = json_len - (size_t)(val_end - json);
            size_t need = prefix_len + 1 + strlen(esc_val) + 1 + suffix_len + 1;
            if (need > buf_cap) {
                char *nb = (char *)realloc(buf, need);
                if (!nb) { free(buf); free(esc_val); JSON_SET_EMPTY(); }
                buf = nb;
            }
            memcpy(buf, json, prefix_len);
            size_t o = prefix_len;
            buf[o++] = '"';
            size_t evl = strlen(esc_val);
            memcpy(buf + o, esc_val, evl);
            o += evl;
            buf[o++] = '"';
            memcpy(buf + o, val_end, suffix_len);
            o += suffix_len;
            buf[o] = '\0';
            replaced = 1;
            break;
        }
    }

    if (!replaced) {
        /* Find the last '}' and insert before it. */
        const char *close = strrchr(json, '}');
        if (!close) {
            /* malformed — just return a minimal object */
            size_t need = 1 + 1 + klen + 1 + 1 + 1 + strlen(esc_val) + 1 + 1 + 1;
            if (need > buf_cap) {
                char *nb = (char *)realloc(buf, need);
                if (!nb) { free(buf); free(esc_val); JSON_SET_EMPTY(); }
                buf = nb;
            }
            snprintf(buf, buf_cap, "{\"%s\":\"%s\"}", key, esc_val);
        } else {
            /* Determine separator: if the object is empty (only whitespace before '}')
             * use no leading comma, otherwise use ','. */
            const char *inner = json;
            while (*inner && *inner != '{') inner++;
            if (*inner == '{') inner++;
            int is_empty = 1;
            for (const char *t = inner; t < close; t++) {
                if (*t != ' ' && *t != '\t' && *t != '\n' && *t != '\r') {
                    is_empty = 0;
                    break;
                }
            }
            const char *sep = is_empty ? "" : ",";
            size_t prefix_len = (size_t)(close - json);
            size_t suffix_len = json_len - prefix_len;  /* includes '}' and beyond */
            size_t ins_len = strlen(sep) + 1 + klen + 3 + strlen(esc_val) + 1;
            size_t need = prefix_len + ins_len + suffix_len + 1;
            if (need > buf_cap) {
                char *nb = (char *)realloc(buf, need);
                if (!nb) { free(buf); free(esc_val); JSON_SET_EMPTY(); }
                buf = nb;
            }
            size_t o = 0;
            memcpy(buf + o, json, prefix_len);
            o += prefix_len;
            /* append: sep + "key":"value" */
            size_t sl = strlen(sep);
            memcpy(buf + o, sep, sl); o += sl;
            buf[o++] = '"';
            memcpy(buf + o, key, klen); o += klen;
            buf[o++] = '"'; buf[o++] = ':'; buf[o++] = '"';
            size_t evl = strlen(esc_val);
            memcpy(buf + o, esc_val, evl); o += evl;
            buf[o++] = '"';
            memcpy(buf + o, json + prefix_len, suffix_len);
            o += suffix_len;
            buf[o] = '\0';
        }
    }

    free(esc_val);
    (void)p;
    return buf;
#undef JSON_SET_EMPTY
}

/* =========================================================================
 * C6: websocket stubs + async poll shim
 *
 * Introduced in Phase 2 iter 15 (D1 link pass) after the first end-to-end
 * link revealed symbols that runtime.vais alone didn't cover:
 *   - The `ws_*` family is declared in `websocket/handler.vais`, not in
 *     runtime.vais. monitor uses it for real-time subscription delivery.
 *     These stubs are intentionally no-op / fake-success so the binary
 *     boots even without a real pubsub runtime; swapping in a live
 *     implementation (redis pubsub, in-memory channel map, etc.) is a
 *     follow-up that doesn't block the "compiler is green" goal.
 *   - `sleep_ms__poll` is a vaisc async-lowering artifact: any call to
 *     `sleep_ms` from an `async F` context generates `<name>__poll` as
 *     the Future poll hook. For a synchronous primitive we just forward
 *     to the blocking version and report "completed" via a non-zero
 *     poll result.
 * ========================================================================= */

/* ---------- async poll shim ------------------------------------------------
 * vaisc emits one of these per `X F name(...)` that is called from an async
 * function. Signature: `int64_t name__poll(int64_t future_ptr)`.
 * Return value convention (see vaisc runtime.rs `__call_poll`): low bit =
 * status (0 pending, 1 ready); upper bits = value. For sleep_ms which has
 * no return value, the value is 0. The sleep itself is expected to have
 * already run synchronously in the caller's flow, so we always report
 * "ready".
 */
int64_t sleep_ms__poll(int64_t future_ptr) {
    (void)future_ptr;
    return 1;  /* status=ready, value=0 */
}

/* ---------- websocket stubs -------------------------------------------------
 * The monitor server's websocket layer uses a client_id + channel model.
 * Stubs below preserve the control flow (no crashes, harmless returns)
 * without actually wiring a pubsub runtime. Replace with a real broker
 * when the monitor project needs live websocket delivery.
 */

void ws_register_client(const char *client_id, const char *channel) {
    (void)client_id; (void)channel;
}

void ws_unregister_client(const char *client_id) {
    (void)client_id;
}

void ws_add_subscription(const char *client_id, const char *channel) {
    (void)client_id; (void)channel;
}

void ws_remove_subscription(const char *client_id, const char *channel) {
    (void)client_id; (void)channel;
}

void ws_broadcast(const char *channel, const char *message) {
    (void)channel; (void)message;
}

void ws_send(const char *client_id, const char *message) {
    (void)client_id; (void)message;
}

char *ws_upgrade_response(const char *client_id, const char *channel,
                          const char *initial_msg) {
    (void)client_id; (void)channel; (void)initial_msg;
    const char *body = "{\"upgraded\":false,\"stub\":true}";
    char *out = (char *)malloc(strlen(body) + 1);
    if (!out) return NULL;
    strcpy(out, body);
    return out;
}
