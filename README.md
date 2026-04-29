# anime units display

discord server link: https://discord.gg/R3sAxVdvke

original mod: https://github.com/aazamitsu/anime-units-display

includes improvements from: https://github.com/JiroCab/anime-units-display

# Current changes
- Setting menu for the mod
    - Global override to enable a specific character regardless of unit
    - Fallback logic for characters missing certain actions
- Optimization
    - Lazy loading for unit textures by using cache that only loads needed textures
    - Fix missing textures causing constant reread attempts and now uses cache
- Fixes
    - Fixed crash from a unhandled null case when a controlled tile is destroyed
- From JiroCab's fork
    - Dynamic floor detection
    - Weather detection
    - Womter season state
    - Optimized season to be determined when map starts rather than every frame
        - I might change this to also recheck whenever weather changes