# anime units display

discord server link: https://discord.gg/R3sAxVdvke

original mod: https://github.com/aazamitsu/anime-units-display

includes improvements from: https://github.com/JiroCab/anime-units-display

# Doc
character-season-action.png

- character: name of unit, block
- (optional) season: summer, winter
- (optional) action: mining, building, shooting

If an action is missing, it can fall back if option is enabled.

If a season is missing, that season for character will be ignored and will use default set.

# Current changes
- Setting menu for the mod
    - Global override to enable a specific character regardless of unit
    - Fallback logic for characters missing certain actions
- Play squish animation for outfit changes
- Optimization
    - Lazy loading for unit textures by using cache that only loads needed textures
    - Fix missing textures causing constant reread attempts and now uses cache
    - Weather changes only calculate once every second, tiles never recalculate
- Fixes
    - Fixed crash from a unhandled null case when a controlled tile is destroyed
- From JiroCab's fork
    - Dynamic floor detection
    - Weather detection
    - Womter season state
    - Optimized season to be determined when map starts rather than every frame
        - I changed this quite a bit