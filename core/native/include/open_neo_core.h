#ifndef OPEN_NEO_CORE_H
#define OPEN_NEO_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

typedef enum OpenNeoStatus {
    OPEN_NEO_OK = 0,
    OPEN_NEO_ERROR = 1
} OpenNeoStatus;

const char* open_neo_core_version(void);
OpenNeoStatus open_neo_core_init(void);

#ifdef __cplusplus
}
#endif

#endif
