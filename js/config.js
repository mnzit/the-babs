// config.js — extracted from index.html (P0 mechanical split, verbatim)
        // ---------------------------------------------------------------------------
        // Matter aliases & world constants (each lane is a 550x700 world)
        // ---------------------------------------------------------------------------
        const Engine = Matter.Engine, Bodies = Matter.Bodies, Composite = Matter.Composite, Body = Matter.Body;
        const CANVAS_WIDTH = 550, CANVAS_HEIGHT = 700, PLATFORM_Y = 620;
        const DEFAULT_BOX_WIDTH = 137, DEFAULT_BOX_HEIGHT = 81;   // base house ~25% bigger (shrink rule still applies)
        const pivotX = CANVAS_WIDTH / 2;
        const ropeLength = 265;
        const HANG_OFFSET = 200 + 265; // crane sits this far above the tower top

        // Each house picks one of these palettes so the tower is colourful and every house looks different.
        const HOUSE_STYLES = [
            { wall: '#fef3c7', trim: '#d97706' },
            { wall: '#fde68a', trim: '#b45309' },
            { wall: '#e0f2fe', trim: '#0369a1' },
            { wall: '#dcfce7', trim: '#15803d' },
            { wall: '#fce7f3', trim: '#9d174d' },
            { wall: '#ede9fe', trim: '#6d28d9' },
            { wall: '#ffedd5', trim: '#c2410c' }
        ];

        // Houses shrink as you climb: full size < 200m, then -10% per 100m (min 40%).
        function shrinkScale(drops) {
            const altitude = drops * 10;
            if (altitude < 200) return 1.0;
            const steps = Math.floor((altitude - 200) / 100) + 1;
            return Math.max(0.4, 1.0 - 0.1 * steps);
        }
