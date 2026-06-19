cmake_minimum_required(VERSION 3.20)

project(open_neo_core VERSION 0.3.3 LANGUAGES C CXX)

add_library(open_neo_core SHARED
    src/open_neo_core.c
    src/process_bridge.cpp
)

target_include_directories(open_neo_core PUBLIC include)
target_compile_features(open_neo_core PUBLIC cxx_std_20)

if (MSVC)
    target_compile_options(open_neo_core PRIVATE /W4)
else()
    target_compile_options(open_neo_core PRIVATE -Wall -Wextra -Wpedantic)
endif()
